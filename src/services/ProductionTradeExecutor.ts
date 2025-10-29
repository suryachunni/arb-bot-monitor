import { ethers, Wallet, Contract } from 'ethers';
import { logger } from '../utils/logger';
import { ArbitrageOpportunity } from './ProductionArbitrageScanner';
import { FlashbotsProvider } from './FlashbotsProvider';

/**
 * PRODUCTION-GRADE TRADE EXECUTOR
 * 
 * Features:
 * - Atomic flash loan execution
 * - MEV protection via Flashbots
 * - Dynamic gas optimization
 * - Slippage protection
 * - Multi-layer validation
 * - Automatic loan amount calculation
 */

const FLASH_LOAN_CONTRACT_ABI = [
  'function executeArbitrage(tuple(address tokenBorrow, address tokenTarget, uint256 amountBorrow, uint8 dexBuy, uint8 dexSell, bytes dexDataBuy, bytes dexDataSell, uint256 minAmountOutBuy, uint256 minAmountOutSell, uint256 minProfit, uint256 estimatedGasCost, uint256 deadline) params) external',
  'function getStatistics() external view returns (uint256 executed, uint256 profit, uint256 gasUsed, uint256 avgGasPerTrade)',
  'function emergencyStop() external view returns (bool)',
];

interface ExecutionResult {
  success: boolean;
  txHash?: string;
  profit?: number;
  gasUsed?: number;
  error?: string;
}

export class ProductionTradeExecutor {
  private wallet: Wallet;
  private provider: ethers.providers.JsonRpcProvider;
  private flashbotsProvider?: FlashbotsProvider;
  private contractAddress: string;
  private contract: Contract;
  private useMEVProtection: boolean;
  private maxGasPriceGwei: number;
  private maxSlippagePercent: number;

  constructor(
    provider: ethers.providers.JsonRpcProvider,
    privateKey: string,
    contractAddress: string,
    useMEVProtection: boolean = true,
    maxGasPriceGwei: number = 0.5,
    maxSlippagePercent: number = 0.5
  ) {
    this.provider = provider;
    this.wallet = new Wallet(privateKey, provider);
    this.contractAddress = contractAddress;
    this.contract = new Contract(contractAddress, FLASH_LOAN_CONTRACT_ABI, this.wallet);
    this.useMEVProtection = useMEVProtection;
    this.maxGasPriceGwei = maxGasPriceGwei;
    this.maxSlippagePercent = maxSlippagePercent;

    // Initialize Flashbots if MEV protection is enabled
    if (useMEVProtection) {
      this.flashbotsProvider = new FlashbotsProvider(provider, this.wallet);
    }

    logger.info(`✅ Trade Executor initialized (MEV Protection: ${useMEVProtection})`);
    logger.info(`📍 Wallet: ${this.wallet.address}`);
    logger.info(`📝 Contract: ${contractAddress}`);
  }

  /**
   * Execute arbitrage opportunity with full validation and protection
   */
  async executeArbitrage(opportunity: ArbitrageOpportunity): Promise<ExecutionResult> {
    logger.info('⚡ Starting arbitrage execution...');
    logger.info(`📊 Type: ${opportunity.type}`);
    logger.info(`🔄 Path: ${opportunity.path.join(' → ')}`);
    logger.info(`💰 Expected Profit: $${opportunity.netProfitUSD.toFixed(2)}`);

    try {
      // Pre-execution validation
      await this.validateExecution(opportunity);

      // Calculate optimal flash loan amount
      const loanAmount = this.calculateLoanAmount(opportunity);
      
      // Build execution parameters
      const params = await this.buildExecutionParams(opportunity, loanAmount);

      // Execute with MEV protection
      if (this.useMEVProtection && this.flashbotsProvider) {
        return await this.executeWithFlashbots(params);
      } else {
        return await this.executeWithoutFlashbots(params);
      }
    } catch (error) {
      logger.error('❌ Execution failed:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Validate execution conditions
   */
  private async validateExecution(opportunity: ArbitrageOpportunity): Promise<void> {
    logger.info('🔍 Validating execution conditions...');

    // 1. Check gas price
    const gasPrice = await this.provider.getGasPrice();
    const gasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));
    
    if (gasPriceGwei > this.maxGasPriceGwei) {
      throw new Error(`Gas price too high: ${gasPriceGwei.toFixed(2)} gwei > ${this.maxGasPriceGwei} gwei`);
    }

    // 2. Check wallet balance for gas
    const balance = await this.wallet.getBalance();
    const balanceETH = parseFloat(ethers.utils.formatEther(balance));
    
    const estimatedGasCost = gasPrice.mul(opportunity.gasEstimate);
    const estimatedGasCostETH = parseFloat(ethers.utils.formatEther(estimatedGasCost));
    
    if (balanceETH < estimatedGasCostETH * 2) {
      throw new Error(`Insufficient ETH for gas. Have: ${balanceETH.toFixed(4)} ETH, Need: ~${(estimatedGasCostETH * 2).toFixed(4)} ETH`);
    }

    // 3. Check contract is not in emergency stop
    const emergencyStop = await this.contract.emergencyStop();
    if (emergencyStop) {
      throw new Error('Contract is in emergency stop mode');
    }

    // 4. Check opportunity is still fresh (< 30 seconds old)
    const age = Date.now() - opportunity.timestamp;
    if (age > 30000) {
      throw new Error(`Opportunity too old: ${age}ms`);
    }

    logger.info('✅ All validation checks passed');
  }

  /**
   * Calculate optimal flash loan amount based on liquidity and opportunity
   */
  private calculateLoanAmount(opportunity: ArbitrageOpportunity): ethers.BigNumber {
    // For simplicity, use the amountIn from opportunity
    // In production, this could be optimized based on liquidity depth
    const amountIn = ethers.BigNumber.from(opportunity.amountIn);
    
    // Adjust based on liquidity to minimize price impact
    const maxImpactAmount = ethers.utils.parseUnits(
      (opportunity.liquidity * 0.03).toFixed(0), // 3% of liquidity
      18
    );

    // Use smaller of: opportunity amount or max impact amount
    return amountIn.lt(maxImpactAmount) ? amountIn : maxImpactAmount;
  }

  /**
   * Build execution parameters for smart contract
   */
  private async buildExecutionParams(
    opportunity: ArbitrageOpportunity,
    loanAmount: ethers.BigNumber
  ): Promise<any> {
    // Map DEX names to enum values
    const dexMap: { [key: string]: number } = {
      'UniswapV3': 0,
      'SushiSwap': 1,
      'Balancer': 2,
    };

    // Extract DEX types
    const getDexType = (dexName: string): number => {
      for (const [key, value] of Object.entries(dexMap)) {
        if (dexName.includes(key)) return value;
      }
      return 0; // Default to UniswapV3
    };

    const dexBuy = getDexType(opportunity.dexPath[0]);
    const dexSell = getDexType(opportunity.dexPath[1]);

    // Extract fee for Uniswap V3
    const extractFee = (dexName: string): number => {
      if (dexName.includes('100bp')) return 100;
      if (dexName.includes('500bp')) return 500;
      if (dexName.includes('3000bp') || dexName.includes('-3000')) return 3000;
      if (dexName.includes('10000bp')) return 10000;
      return 3000; // Default 0.3%
    };

    const feeBuy = extractFee(opportunity.dexPath[0]);
    const feeSell = extractFee(opportunity.dexPath[1]);

    // Encode DEX-specific data
    const dexDataBuy = ethers.utils.defaultAbiCoder.encode(['uint24'], [feeBuy]);
    const dexDataSell = ethers.utils.defaultAbiCoder.encode(['uint24'], [feeSell]);

    // Calculate slippage-protected minimums
    const slippageMultiplier = (100 - this.maxSlippagePercent) / 100;
    
    const minAmountOutBuy = ethers.BigNumber.from(opportunity.expectedAmountOut)
      .mul(Math.floor(slippageMultiplier * 1000))
      .div(1000);
    
    const minAmountOutSell = loanAmount
      .mul(Math.floor((1 + opportunity.profitPercentage / 100) * slippageMultiplier * 1000))
      .div(1000);

    // Minimum profit (in tokens)
    const minProfit = ethers.utils.parseUnits(
      (opportunity.netProfitUSD / 2000).toFixed(6), // Rough conversion
      18
    );

    // Deadline: 2 minutes from now
    const deadline = Math.floor(Date.now() / 1000) + 120;

    return {
      tokenBorrow: opportunity.tokenAddresses[0],
      tokenTarget: opportunity.tokenAddresses[1],
      amountBorrow: loanAmount,
      dexBuy,
      dexSell,
      dexDataBuy,
      dexDataSell,
      minAmountOutBuy,
      minAmountOutSell,
      minProfit,
      estimatedGasCost: ethers.utils.parseUnits(
        (opportunity.gasCostUSD / 2000).toFixed(6),
        18
      ),
      deadline,
    };
  }

  /**
   * Execute with Flashbots (MEV protection)
   */
  private async executeWithFlashbots(params: any): Promise<ExecutionResult> {
    logger.info('🛡️ Executing with Flashbots MEV protection...');

    try {
      if (!this.flashbotsProvider) {
        throw new Error('Flashbots provider not initialized');
      }

      // Build transaction
      const tx = await this.contract.populateTransaction.executeArbitrage(params);
      
      // Get current block
      const currentBlock = await this.provider.getBlockNumber();
      
      // Send via Flashbots
      const result = await this.flashbotsProvider.sendPrivateTransaction(
        tx,
        currentBlock + 1
      );

      if (result.success && result.txHash) {
        logger.info(`✅ Transaction sent via Flashbots: ${result.txHash}`);
        
        // Wait for confirmation
        const receipt = await this.provider.waitForTransaction(result.txHash, 1, 60000);
        
        return {
          success: receipt.status === 1,
          txHash: result.txHash,
          profit: params.minProfit,
          gasUsed: receipt.gasUsed.toNumber(),
        };
      } else {
        throw new Error(result.error || 'Flashbots submission failed');
      }
    } catch (error) {
      logger.error('Flashbots execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute without Flashbots (standard transaction)
   */
  private async executeWithoutFlashbots(params: any): Promise<ExecutionResult> {
    logger.info('📤 Executing standard transaction...');

    try {
      // Get optimal gas price
      const gasPrice = await this.getOptimalGasPrice();

      // Execute transaction
      const tx = await this.contract.executeArbitrage(params, {
        gasLimit: ethers.BigNumber.from(params.estimatedGasCost).mul(120).div(100), // 20% buffer
        gasPrice,
      });

      logger.info(`📨 Transaction sent: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait(1);

      logger.info(`✅ Transaction confirmed: ${receipt.transactionHash}`);

      return {
        success: receipt.status === 1,
        txHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toNumber(),
      };
    } catch (error) {
      logger.error('Standard execution failed:', error);
      throw error;
    }
  }

  /**
   * Get optimal gas price (low priority for profit optimization)
   */
  private async getOptimalGasPrice(): Promise<ethers.BigNumber> {
    const gasPrice = await this.provider.getGasPrice();
    
    // Use base gas price without priority fee for max profit
    // Arbitrum has low gas anyway
    return gasPrice;
  }

  /**
   * Check wallet balance
   */
  async checkBalance(): Promise<{ eth: string; ethValue: number }> {
    const balance = await this.wallet.getBalance();
    const eth = ethers.utils.formatEther(balance);
    const ethValue = parseFloat(eth) * 2000; // Rough USD value

    return { eth, ethValue };
  }

  /**
   * Get wallet address
   */
  getWalletAddress(): string {
    return this.wallet.address;
  }

  /**
   * Get contract statistics
   */
  async getStatistics(): Promise<{
    executed: number;
    profit: string;
    gasUsed: number;
    avgGasPerTrade: number;
  }> {
    const stats = await this.contract.getStatistics();
    
    return {
      executed: stats.executed.toNumber(),
      profit: ethers.utils.formatEther(stats.profit),
      gasUsed: stats.gasUsed.toNumber(),
      avgGasPerTrade: stats.avgGasPerTrade.toNumber(),
    };
  }
}
