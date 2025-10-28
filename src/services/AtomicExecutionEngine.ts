import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import { ArbitrageOpportunity } from './ArbitrageDetector';
import { DynamicLoanCalculator, LoanCalculation } from './DynamicLoanCalculator';
import { LiquidityValidator, LiquidityData } from './LiquidityValidator';

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  profit?: number;
  gasUsed?: number;
  executionTime?: number;
  error?: string;
  rejectionReason?: string;
}

export interface ExecutionMetrics {
  scanToDetection: number;
  detectionToValidation: number;
  validationToExecution: number;
  executionToProfit: number;
  totalTime: number;
}

export class AtomicExecutionEngine {
  private provider: ethers.providers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;
  private loanCalculator: DynamicLoanCalculator;
  private liquidityValidator: LiquidityValidator;
  private executionQueue: Map<string, ArbitrageOpportunity> = new Map();
  private metrics: ExecutionMetrics = {
    scanToDetection: 0,
    detectionToValidation: 0,
    validationToExecution: 0,
    executionToProfit: 0,
    totalTime: 0
  };

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.network.rpcUrl);
    this.wallet = new ethers.Wallet(config.wallet.privateKey, this.provider);
    this.loanCalculator = new DynamicLoanCalculator();
    this.liquidityValidator = new LiquidityValidator();
    
    if (!config.contract.address) {
      throw new Error('Contract address not set. Please deploy the contract first.');
    }

    this.contract = new ethers.Contract(
      config.contract.address,
      this.getContractABI(),
      this.wallet
    );
  }

  /**
   * Execute arbitrage opportunity atomically - from detection to profit
   */
  async executeAtomicArbitrage(opportunity: ArbitrageOpportunity): Promise<ExecutionResult> {
    const startTime = Date.now();
    this.metrics.scanToDetection = startTime;

    try {
      logger.info(`🚀 Starting atomic execution for ${opportunity.tokenA}/${opportunity.tokenB}`);

      // Step 1: Validate liquidity (milliseconds)
      const validationStart = Date.now();
      const liquidityData = await this.validateLiquidity(opportunity);
      this.metrics.detectionToValidation = Date.now() - validationStart;

      if (!liquidityData || !liquidityData.isLiquidEnough) {
        return {
          success: false,
          rejectionReason: liquidityData?.rejectionReason || 'Liquidity validation failed'
        };
      }

      // Step 2: Calculate optimal loan amount (milliseconds)
      const calculationStart = Date.now();
      const gasPrice = await this.provider.getGasPrice();
      const loanCalculation = this.loanCalculator.calculateOptimalLoan(
        opportunity,
        liquidityData,
        gasPrice
      );
      this.metrics.validationToExecution = Date.now() - calculationStart;

      if (!loanCalculation) {
        return {
          success: false,
          rejectionReason: 'Loan calculation failed'
        };
      }

      // Step 3: Validate loan safety
      const safetyCheck = this.loanCalculator.validateLoanSafety(
        loanCalculation.optimalLoanAmount,
        liquidityData
      );

      if (!safetyCheck.isSafe) {
        return {
          success: false,
          rejectionReason: safetyCheck.reason
        };
      }

      // Step 4: Execute atomic transaction (milliseconds)
      const executionStart = Date.now();
      const result = await this.executeAtomicTransaction(opportunity, loanCalculation);
      this.metrics.executionToProfit = Date.now() - executionStart;

      // Calculate total execution time
      this.metrics.totalTime = Date.now() - startTime;

      if (result.success) {
        logger.info(`✅ Atomic execution completed in ${this.metrics.totalTime}ms`);
        logger.info(`💰 Profit: $${result.profit?.toFixed(2)}`);
        logger.info(`⛽ Gas used: ${result.gasUsed}`);
      }

      return result;

    } catch (error) {
      logger.error('Atomic execution failed:', error);
      return {
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Validate liquidity for the opportunity
   */
  private async validateLiquidity(opportunity: ArbitrageOpportunity): Promise<LiquidityData | null> {
    try {
      // Validate buy side liquidity
      const buyLiquidity = await this.liquidityValidator.validateLiquidity(
        opportunity.tokenAAddress,
        opportunity.tokenBAddress,
        opportunity.buyDex,
        ethers.utils.parseEther('1') // Test with 1 ETH
      );

      if (!buyLiquidity || !buyLiquidity.isLiquidEnough) {
        return buyLiquidity;
      }

      // Validate sell side liquidity
      const sellLiquidity = await this.liquidityValidator.validateLiquidity(
        opportunity.tokenBAddress,
        opportunity.tokenAAddress,
        opportunity.sellDex,
        ethers.utils.parseEther('1') // Test with 1 ETH
      );

      if (!sellLiquidity || !sellLiquidity.isLiquidEnough) {
        return sellLiquidity;
      }

      // Return the more restrictive liquidity data
      return buyLiquidity.depthScore < sellLiquidity.depthScore ? buyLiquidity : sellLiquidity;

    } catch (error) {
      logger.error('Liquidity validation failed:', error);
      return null;
    }
  }

  /**
   * Execute atomic transaction with all optimizations
   */
  private async executeAtomicTransaction(
    opportunity: ArbitrageOpportunity,
    loanCalculation: LoanCalculation
  ): Promise<ExecutionResult> {
    try {
      // Prepare transaction parameters
      const params = this.prepareTransactionParams(opportunity, loanCalculation);

      // Get optimal gas settings
      const gasSettings = await this.getOptimalGasSettings();

      // Execute transaction with maximum speed
      const tx = await this.contract.executeArbitrage(params, {
        ...gasSettings,
        gasLimit: 1000000, // High gas limit for complex operations
      });

      logger.info(`📝 Transaction sent: ${tx.hash}`);

      // Wait for confirmation with timeout
      const receipt = await Promise.race([
        tx.wait(1),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction timeout')), 30000)
        ),
      ]) as ethers.ContractReceipt;

      if (receipt.status === 1) {
        const profit = await this.calculateActualProfit(receipt, loanCalculation);
        
        return {
          success: true,
          txHash: receipt.transactionHash,
          profit: profit,
          gasUsed: receipt.gasUsed.toNumber(),
          executionTime: Date.now()
        };
      } else {
        return {
          success: false,
          txHash: receipt.transactionHash,
          error: 'Transaction reverted'
        };
      }

    } catch (error) {
      logger.error('Atomic transaction execution failed:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Prepare transaction parameters for atomic execution
   */
  private prepareTransactionParams(
    opportunity: ArbitrageOpportunity,
    loanCalculation: LoanCalculation
  ): any {
    return {
      tokenBorrow: opportunity.tokenAAddress,
      tokenTarget: opportunity.tokenBAddress,
      amountBorrow: loanCalculation.optimalLoanAmount,
      dexBuy: this.getDexType(opportunity.buyDex),
      dexSell: this.getDexType(opportunity.sellDex),
      dexDataBuy: this.encodeDexData(opportunity.buyDex, opportunity.buyFee),
      dexDataSell: this.encodeDexData(opportunity.sellDex, opportunity.sellFee),
      minAmountOutBuy: this.calculateMinAmountOut(loanCalculation.optimalLoanAmount, 0.5),
      minAmountOutSell: this.calculateMinAmountOut(loanCalculation.optimalLoanAmount, 0.5),
      minProfit: ethers.utils.parseEther('0.1'), // Minimum 0.1 ETH profit
      estimatedGasCost: ethers.utils.parseEther('0.01'), // Estimated gas cost
      deadline: Math.floor(Date.now() / 1000) + 60, // 1 minute deadline
    };
  }

  /**
   * Get optimal gas settings for maximum speed
   */
  private async getOptimalGasSettings(): Promise<any> {
    const feeData = await this.provider.getFeeData();
    
    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
      // EIP-1559 transaction with priority boost
      return {
        maxFeePerGas: feeData.maxFeePerGas.mul(120).div(100), // 20% boost
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.mul(150).div(100), // 50% boost
      };
    } else {
      // Legacy transaction
      const gasPrice = await this.provider.getGasPrice();
      return {
        gasPrice: gasPrice.mul(120).div(100), // 20% boost
      };
    }
  }

  /**
   * Calculate minimum amount out with slippage protection
   */
  private calculateMinAmountOut(amountIn: ethers.BigNumber, slippagePercent: number): ethers.BigNumber {
    const slippageBasisPoints = Math.floor(slippagePercent * 100);
    return amountIn.mul(10000 - slippageBasisPoints).div(10000);
  }

  /**
   * Get DEX type enum value
   */
  private getDexType(dexName: string): number {
    switch (dexName) {
      case 'UniswapV3': return 0;
      case 'SushiSwap': return 1;
      case 'Balancer': return 2;
      default: throw new Error(`Unknown DEX: ${dexName}`);
    }
  }

  /**
   * Encode DEX-specific data
   */
  private encodeDexData(dexName: string, fee?: number): string {
    switch (dexName) {
      case 'UniswapV3':
        return ethers.utils.defaultAbiCoder.encode(['uint24'], [fee || 3000]);
      case 'SushiSwap':
        return '0x';
      case 'Balancer':
        return ethers.utils.defaultAbiCoder.encode(['bytes32'], ['0x0000000000000000000000000000000000000000000000000000000000000000']);
      default:
        return '0x';
    }
  }

  /**
   * Calculate actual profit from transaction
   */
  private async calculateActualProfit(
    receipt: ethers.ContractReceipt,
    loanCalculation: LoanCalculation
  ): Promise<number> {
    // In production, this would parse events from the contract
    // For now, return the calculated profit
    return loanCalculation.profitAfterCosts;
  }

  /**
   * Get contract ABI
   */
  private getContractABI(): any[] {
    return [
      'function executeArbitrage(tuple(address tokenBorrow, address tokenTarget, uint256 amountBorrow, uint8 dexBuy, uint8 dexSell, bytes dexDataBuy, bytes dexDataSell, uint256 minAmountOutBuy, uint256 minAmountOutSell, uint256 minProfit, uint256 estimatedGasCost, uint256 deadline) params) external',
      'function owner() view returns (address)',
      'function profitReceiver() view returns (address)',
    ];
  }

  /**
   * Get execution metrics
   */
  getExecutionMetrics(): ExecutionMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      scanToDetection: 0,
      detectionToValidation: 0,
      validationToExecution: 0,
      executionToProfit: 0,
      totalTime: 0
    };
  }
}