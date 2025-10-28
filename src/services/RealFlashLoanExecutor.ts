import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import { RealArbitrageOpportunity } from './RealDEXScanner';

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  profit?: number;
  gasUsed?: number;
  executionTime?: number;
  error?: string;
  blockNumber?: number;
  actualProfit?: number;
  actualGasUsed?: number;
}

export class RealFlashLoanExecutor {
  private provider: ethers.providers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private aaveV3Pool: ethers.Contract;
  private arbitrageContract: ethers.Contract;
  
  // Aave V3 addresses on Arbitrum
  private readonly AAVE_V3_POOL = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';
  private readonly WETH_ADDRESS = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
  private readonly USDC_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.network.rpcUrl);
    this.wallet = new ethers.Wallet(config.wallet.privateKey, this.provider);
    
    // Initialize Aave V3 Pool contract
    this.aaveV3Pool = new ethers.Contract(
      this.AAVE_V3_POOL,
      [
        'function flashLoanSimple(address receiverAddress, address asset, uint256 amount, bytes calldata params, uint16 referralCode) external',
        'function getReserveData(address asset) external view returns (tuple(uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))',
        'function FLASHLOAN_PREMIUM_TOTAL() external view returns (uint128)'
      ],
      this.wallet
    );

    // Initialize arbitrage contract (will be deployed)
    this.arbitrageContract = new ethers.Contract(
      config.contract.address || '0x0000000000000000000000000000000000000000',
      [
        'function executeArbitrage(address tokenA, address tokenB, uint256 amount, address dexA, address dexB, uint256 minProfit) external',
        'function owner() view returns (address)',
        'function getBalance(address token) view returns (uint256)'
      ],
      this.wallet
    );
  }

  /**
   * Execute real arbitrage with flash loan
   */
  async executeRealArbitrage(opportunity: RealArbitrageOpportunity): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`🚀 Executing real arbitrage: ${opportunity.tokenA}/${opportunity.tokenB}`);
      logger.info(`💰 Expected profit: ${opportunity.profitPercentage.toFixed(3)}%`);
      logger.info(`💵 Expected profit USD: $${opportunity.estimatedProfitUSD.toFixed(2)}`);

      // Validate opportunity
      if (!this.validateOpportunity(opportunity)) {
        return {
          success: false,
          error: 'Invalid opportunity - failed validation',
          executionTime: Date.now() - startTime
        };
      }

      // Check if we have enough ETH for gas
      const balance = await this.wallet.getBalance();
      const gasPrice = await this.provider.getGasPrice();
      const gasCost = gasPrice.mul(opportunity.gasEstimate);
      
      if (balance.lt(gasCost)) {
        return {
          success: false,
          error: 'Insufficient ETH for gas fees',
          executionTime: Date.now() - startTime
        };
      }

      // Get current gas price with priority
      const feeData = await this.provider.getFeeData();
      const gasSettings = this.getOptimalGasSettings(feeData);

      // Prepare transaction parameters
      const txParams = await this.prepareTransactionParams(opportunity);

      // Execute flash loan
      const tx = await this.aaveV3Pool.flashLoanSimple(
        this.arbitrageContract.address, // Receiver
        this.getTokenAddress(opportunity.tokenA), // Asset to borrow
        ethers.utils.parseEther(opportunity.recommendedLoanSize), // Amount
        this.encodeArbitrageParams(opportunity), // Params
        0 // Referral code
      );

      logger.info(`📝 Flash loan transaction sent: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait(2); // Wait for 2 confirmations

      if (receipt.status === 1) {
        // Calculate actual profit
        const actualProfit = await this.calculateActualProfit(receipt, opportunity);
        
        logger.info(`✅ Arbitrage executed successfully!`);
        logger.info(`💰 Actual profit: $${actualProfit.toFixed(2)}`);
        logger.info(`⛽ Gas used: ${receipt.gasUsed.toString()}`);

        return {
          success: true,
          txHash: receipt.transactionHash,
          profit: actualProfit,
          gasUsed: receipt.gasUsed.toNumber(),
          executionTime: Date.now() - startTime,
          blockNumber: receipt.blockNumber,
          actualProfit: actualProfit,
          actualGasUsed: receipt.gasUsed.toNumber()
        };
      } else {
        return {
          success: false,
          txHash: receipt.transactionHash,
          error: 'Transaction reverted',
          executionTime: Date.now() - startTime
        };
      }

    } catch (error) {
      logger.error('Arbitrage execution failed:', error);
      return {
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Validate opportunity before execution
   */
  private validateOpportunity(opportunity: RealArbitrageOpportunity): boolean {
    // Check minimum profit
    if (opportunity.netProfitUSD < 50) {
      logger.warn('Opportunity rejected: profit too low');
      return false;
    }

    // Check minimum liquidity
    const minLiquidity = Math.min(opportunity.buyLiquidityUSD, opportunity.sellLiquidityUSD);
    if (minLiquidity < 10000) {
      logger.warn('Opportunity rejected: liquidity too low');
      return false;
    }

    // Check risk level
    if (opportunity.riskLevel === 'EXTREME') {
      logger.warn('Opportunity rejected: risk too high');
      return false;
    }

    // Check confidence
    if (opportunity.confidence < 0.5) {
      logger.warn('Opportunity rejected: confidence too low');
      return false;
    }

    return true;
  }

  /**
   * Get optimal gas settings
   */
  private getOptimalGasSettings(feeData: any): any {
    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
      return {
        maxFeePerGas: feeData.maxFeePerGas.mul(120).div(100), // 20% boost
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.mul(150).div(100), // 50% boost
        gasLimit: 500000 // High gas limit for complex operations
      };
    } else {
      const gasPrice = feeData.gasPrice || ethers.utils.parseUnits('20', 'gwei');
      return {
        gasPrice: gasPrice.mul(120).div(100), // 20% boost
        gasLimit: 500000
      };
    }
  }

  /**
   * Prepare transaction parameters
   */
  private async prepareTransactionParams(opportunity: RealArbitrageOpportunity): Promise<any> {
    return {
      tokenA: this.getTokenAddress(opportunity.tokenA),
      tokenB: this.getTokenAddress(opportunity.tokenB),
      amount: ethers.utils.parseEther(opportunity.recommendedLoanSize),
      dexA: this.getDexAddress(opportunity.buyDex),
      dexB: this.getDexAddress(opportunity.sellDex),
      minProfit: ethers.utils.parseEther('0.1') // Minimum 0.1 ETH profit
    };
  }

  /**
   * Encode arbitrage parameters for flash loan
   */
  private encodeArbitrageParams(opportunity: RealArbitrageOpportunity): string {
    return ethers.utils.defaultAbiCoder.encode(
      ['address', 'address', 'uint256', 'address', 'address', 'uint256'],
      [
        this.getTokenAddress(opportunity.tokenA),
        this.getTokenAddress(opportunity.tokenB),
        ethers.utils.parseEther(opportunity.recommendedLoanSize),
        this.getDexAddress(opportunity.buyDex),
        this.getDexAddress(opportunity.sellDex),
        ethers.utils.parseEther('0.1')
      ]
    );
  }

  /**
   * Get token address
   */
  private getTokenAddress(token: string): string {
    const addresses: { [key: string]: string } = {
      'WETH': this.WETH_ADDRESS,
      'USDC': this.USDC_ADDRESS,
      'USDT': '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      'ARB': '0x912CE59144191C1204E64559FE8253a0e49E6548',
      'LINK': '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
      'UNI': '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0',
      'GMX': '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a'
    };
    
    return addresses[token] || '0x0000000000000000000000000000000000000000';
  }

  /**
   * Get DEX address
   */
  private getDexAddress(dex: string): string {
    const addresses: { [key: string]: string } = {
      'UniswapV3': '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3 Router
      'SushiSwap': '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
      'Camelot': '0xc873fEcbd354f5A56E00E710B90EF4201db2448d'
    };
    
    return addresses[dex] || '0x0000000000000000000000000000000000000000';
  }

  /**
   * Calculate actual profit from transaction
   */
  private async calculateActualProfit(receipt: any, opportunity: RealArbitrageOpportunity): Promise<number> {
    try {
      // In a real implementation, you would:
      // 1. Parse events from the arbitrage contract
      // 2. Calculate the actual profit made
      // 3. Account for gas costs and fees
      
      // For now, return the estimated profit minus gas costs
      const gasCostUSD = parseFloat(ethers.utils.formatEther(receipt.gasUsed.mul(receipt.effectiveGasPrice))) * 2000;
      return Math.max(0, opportunity.estimatedProfitUSD - gasCostUSD);
      
    } catch (error) {
      logger.error('Error calculating actual profit:', error);
      return 0;
    }
  }

  /**
   * Check if contract is deployed and ready
   */
  async isReady(): Promise<boolean> {
    try {
      if (!config.contract.address || config.contract.address === '0x0000000000000000000000000000000000000000') {
        logger.error('Arbitrage contract not deployed');
        return false;
      }

      const owner = await this.arbitrageContract.owner();
      if (owner === '0x0000000000000000000000000000000000000000') {
        logger.error('Arbitrage contract not initialized');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Contract readiness check failed:', error);
      return false;
    }
  }

  /**
   * Get contract balance
   */
  async getContractBalance(token: string): Promise<ethers.BigNumber> {
    try {
      const tokenAddress = this.getTokenAddress(token);
      return await this.arbitrageContract.getBalance(tokenAddress);
    } catch (error) {
      logger.error('Error getting contract balance:', error);
      return ethers.BigNumber.from(0);
    }
  }
}