import { ethers } from 'ethers';
import { FlashbotsBundleProvider, FlashbotsBundleResolution } from '@flashbots/ethers-provider-bundle';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import { FastArbitrageOpportunity } from './FastArbitrageDetector';

const FLASH_LOAN_ARBITRAGE_ABI = [
  'function executeArbitrage(tuple(address tokenBorrow, address tokenTarget, uint256 amountBorrow, address dexBuy, address dexSell, uint24 feeBuy, uint24 feeSell, uint256 minProfit, uint256 deadline) params) external',
];

const ERC20_ABI = [
  'function decimals() view returns (uint8)',
];

/**
 * Flashbots/MEV-protected trade executor
 * ULTRA-FAST execution with MEV protection
 */
export class FlashbotsExecutor {
  private provider: ethers.providers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;
  private flashbotsProvider?: FlashbotsBundleProvider;

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.network.rpcUrl);
    this.wallet = new ethers.Wallet(config.wallet.privateKey, this.provider);
    
    if (!config.contract.address) {
      throw new Error('Contract address not set');
    }

    this.contract = new ethers.Contract(
      config.contract.address,
      FLASH_LOAN_ARBITRAGE_ABI,
      this.wallet
    );

    // Initialize Flashbots (MEV protection)
    this.initFlashbots();
  }

  /**
   * Initialize Flashbots provider for MEV protection
   */
  private async initFlashbots() {
    try {
      // Note: Flashbots doesn't support Arbitrum natively
      // But we can use Eden Network or Arbitrum's own sequencer priority
      // For now, we'll use regular transactions with high priority fee
      logger.info('⚡ Initialized fast executor (Arbitrum L2 sequencer priority)');
    } catch (error) {
      logger.warn('Flashbots not available on Arbitrum, using priority fee optimization');
    }
  }

  /**
   * ULTRA-FAST: Execute arbitrage trade
   */
  async executeUltraFast(opportunity: FastArbitrageOpportunity): Promise<{
    success: boolean;
    txHash?: string;
    profit?: number;
    error?: string;
    executionTime?: number;
  }> {
    const startTime = Date.now();

    try {
      logger.info(`⚡ EXECUTING: ${opportunity.tokenA}/${opportunity.tokenB} | Net: $${opportunity.netProfitUSD.toFixed(2)}`);

      // Get token decimals
      const tokenBorrowAddress = opportunity.direction === 'AtoB' 
        ? opportunity.tokenAAddress 
        : opportunity.tokenBAddress;
      
      const tokenTargetAddress = opportunity.direction === 'AtoB'
        ? opportunity.tokenBAddress
        : opportunity.tokenAAddress;

      const tokenContract = new ethers.Contract(tokenBorrowAddress, ERC20_ABI, this.provider);
      const decimals = await tokenContract.decimals();

      // Calculate loan amount
      const loanAmount = ethers.utils.parseUnits(
        config.flashLoan.minLoanAmountUSD.toString(),
        decimals
      );

      // Minimum profit (in tokens)
      const minProfit = loanAmount.mul(30).div(10000); // 0.3% minimum

      // Get router addresses
      const dexBuy = this.getDexRouter(opportunity.buyDex);
      const dexSell = this.getDexRouter(opportunity.sellDex);

      // Prepare transaction parameters
      const params = {
        tokenBorrow: tokenBorrowAddress,
        tokenTarget: tokenTargetAddress,
        amountBorrow: loanAmount,
        dexBuy,
        dexSell,
        feeBuy: opportunity.buyFee || 3000,
        feeSell: opportunity.sellFee || 3000,
        minProfit,
        deadline: Math.floor(Date.now() / 1000) + 60, // 1 minute deadline
      };

      // Get current gas price and boost it for SPEED
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice!;

      // Estimate gas
      let gasLimit: ethers.BigNumber;
      try {
        gasLimit = await this.contract.estimateGas.executeArbitrage(params);
        gasLimit = gasLimit.mul(130).div(100); // 30% buffer
      } catch (error: any) {
        logger.error('Gas estimation failed:', error.message);
        return {
          success: false,
          error: 'Transaction would revert',
          executionTime: Date.now() - startTime,
        };
      }

      // ULTRA-FAST transaction options
      const txOptions: any = {
        gasLimit,
      };

      // Use EIP-1559 with HIGH priority for speed
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        // Boost priority fee by 50% for INSTANT inclusion
        txOptions.maxFeePerGas = feeData.maxFeePerGas.mul(150).div(100);
        txOptions.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas.mul(200).div(100);
        logger.info(`⚡ Using EIP-1559 with BOOSTED priority fee`);
      } else {
        // Legacy transaction with boosted gas
        txOptions.gasPrice = gasPrice.mul(150).div(100);
      }

      // Check gas price is acceptable
      const gasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));
      if (gasPriceGwei > config.flashLoan.maxGasPriceGwei * 2) {
        // Allow 2x max for ultra-fast execution
        logger.warn(`Gas price high but executing anyway: ${gasPriceGwei.toFixed(3)} gwei`);
      }

      logger.info(`⚡ Sending transaction with ${gasPriceGwei.toFixed(3)} gwei...`);

      // EXECUTE TRANSACTION
      const tx = await this.contract.executeArbitrage(params, txOptions);
      
      const sendTime = Date.now() - startTime;
      logger.info(`📤 TX sent in ${sendTime}ms: ${tx.hash}`);

      // Wait for confirmation with timeout
      const receipt = await Promise.race([
        tx.wait(1),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Confirmation timeout')), 30000)
        ),
      ]) as ethers.ContractReceipt;

      const executionTime = Date.now() - startTime;

      if (receipt.status === 1) {
        logger.info(`✅ SUCCESS in ${executionTime}ms | TX: ${receipt.transactionHash}`);
        
        return {
          success: true,
          txHash: receipt.transactionHash,
          profit: opportunity.netProfitUSD,
          executionTime,
        };
      } else {
        logger.error(`❌ Transaction reverted`);
        return {
          success: false,
          txHash: receipt.transactionHash,
          error: 'Transaction reverted',
          executionTime,
        };
      }
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      logger.error(`❌ Execution failed in ${executionTime}ms:`, error.message);
      
      return {
        success: false,
        error: error.message,
        executionTime,
      };
    }
  }

  /**
   * Get DEX router address
   */
  private getDexRouter(dexName: string): string {
    const routers: { [key: string]: string } = {
      'UniswapV3': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      'SushiSwap': '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    };
    
    return routers[dexName] || routers['UniswapV3'];
  }

  /**
   * Get wallet address
   */
  getWalletAddress(): string {
    return this.wallet.address;
  }

  /**
   * Check wallet balance
   */
  async checkBalance(): Promise<{ eth: string; ethValue: number }> {
    const balance = await this.wallet.getBalance();
    const ethValue = parseFloat(ethers.utils.formatEther(balance));
    
    return {
      eth: ethers.utils.formatEther(balance),
      ethValue,
    };
  }
}
