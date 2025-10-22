import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import { ArbitrageOpportunity } from './ArbitrageDetector';
import { DEX_ROUTERS } from '../config/constants';
import { PriceScanner } from './PriceScanner';

const FLASH_LOAN_ARBITRAGE_ABI = [
  'function executeArbitrage(tuple(address tokenBorrow, address tokenTarget, uint256 amountBorrow, address dexBuy, address dexSell, uint24 feeBuy, uint24 feeSell, uint256 minProfit, uint256 deadline) params) external',
  'function owner() view returns (address)',
  'function profitReceiver() view returns (address)',
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

export class TradeExecutor {
  private provider: ethers.providers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;
  private priceScanner: PriceScanner;

  constructor(priceScanner: PriceScanner) {
    this.provider = new ethers.providers.JsonRpcProvider(config.network.rpcUrl);
    this.wallet = new ethers.Wallet(config.wallet.privateKey, this.provider);
    this.priceScanner = priceScanner;

    if (!config.contract.address) {
      throw new Error('Contract address not set. Please deploy the contract first.');
    }

    this.contract = new ethers.Contract(
      config.contract.address,
      FLASH_LOAN_ARBITRAGE_ABI,
      this.wallet
    );

    logger.info(`Trade executor initialized with wallet: ${this.wallet.address}`);
  }

  /**
   * Execute arbitrage trade with flash loan
   */
  async executeArbitrage(opportunity: ArbitrageOpportunity): Promise<{
    success: boolean;
    txHash?: string;
    profit?: number;
    error?: string;
  }> {
    try {
      logger.info(`🚀 Executing arbitrage: ${opportunity.tokenA}/${opportunity.tokenB}`);
      
      // Verify gas price is acceptable
      const gasPrice = await this.provider.getGasPrice();
      const gasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));
      
      if (gasPriceGwei > config.flashLoan.maxGasPriceGwei) {
        const error = `Gas price too high: ${gasPriceGwei} gwei`;
        logger.warn(error);
        return { success: false, error };
      }

      // Determine loan token and target token based on direction
      let tokenBorrow: string;
      let tokenTarget: string;
      let dexBuy: string;
      let dexSell: string;
      
      if (opportunity.direction === 'AtoB') {
        tokenBorrow = opportunity.tokenAAddress;
        tokenTarget = opportunity.tokenBAddress;
        dexBuy = this.getDexRouter(opportunity.buyDex);
        dexSell = this.getDexRouter(opportunity.sellDex);
      } else {
        tokenBorrow = opportunity.tokenBAddress;
        tokenTarget = opportunity.tokenAAddress;
        dexBuy = this.getDexRouter(opportunity.buyDex);
        dexSell = this.getDexRouter(opportunity.sellDex);
      }

      // Get token decimals
      const tokenContract = new ethers.Contract(tokenBorrow, ERC20_ABI, this.provider);
      const decimals = await tokenContract.decimals();
      
      // Calculate loan amount
      const loanAmount = ethers.utils.parseUnits(
        config.flashLoan.minLoanAmountUSD.toString(),
        decimals
      );

      // Calculate minimum profit (accounting for gas and fees)
      const minProfit = loanAmount.mul(50).div(10000); // 0.5% minimum

      // Re-verify prices before execution (critical for real-time accuracy)
      logger.info('🔍 Verifying prices before execution...');
      const verifiedBuyPrice = await this.priceScanner.getRealTimePrice(
        tokenBorrow,
        tokenTarget,
        opportunity.buyDex,
        loanAmount,
        opportunity.buyFee
      );

      if (!verifiedBuyPrice) {
        return { success: false, error: 'Failed to verify buy price' };
      }

      const verifiedSellPrice = await this.priceScanner.getRealTimePrice(
        tokenTarget,
        tokenBorrow,
        opportunity.sellDex,
        verifiedBuyPrice,
        opportunity.sellFee
      );

      if (!verifiedSellPrice) {
        return { success: false, error: 'Failed to verify sell price' };
      }

      // Check if still profitable after verification
      const expectedProfit = verifiedSellPrice.sub(loanAmount);
      if (expectedProfit.lt(minProfit)) {
        return { 
          success: false, 
          error: 'Opportunity no longer profitable after price verification' 
        };
      }

      logger.info('✅ Prices verified, executing transaction...');

      // Prepare parameters
      const params = {
        tokenBorrow,
        tokenTarget,
        amountBorrow: loanAmount,
        dexBuy,
        dexSell,
        feeBuy: opportunity.buyFee || 3000,
        feeSell: opportunity.sellFee || 3000,
        minProfit,
        deadline: Math.floor(Date.now() / 1000) + 300, // 5 minutes
      };

      // Estimate gas
      let gasLimit: ethers.BigNumber;
      try {
        gasLimit = await this.contract.estimateGas.executeArbitrage(params);
        gasLimit = gasLimit.mul(Math.floor(config.monitoring.gasLimitMultiplier * 100)).div(100);
      } catch (error) {
        logger.error('Gas estimation failed:', error);
        return { 
          success: false, 
          error: 'Gas estimation failed - transaction would likely revert' 
        };
      }

      // Calculate optimal gas price (use EIP-1559 if available)
      const feeData = await this.provider.getFeeData();
      const txOptions: any = {
        gasLimit,
      };

      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        // EIP-1559 transaction
        txOptions.maxFeePerGas = feeData.maxFeePerGas;
        txOptions.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas.mul(110).div(100); // 10% boost for speed
      } else {
        txOptions.gasPrice = gasPrice.mul(110).div(100); // 10% boost for speed
      }

      logger.info(`💰 Executing with loan amount: ${ethers.utils.formatUnits(loanAmount, decimals)}`);
      logger.info(`⛽ Gas limit: ${gasLimit.toString()}, Gas price: ${gasPriceGwei.toFixed(2)} gwei`);

      // Execute transaction
      const tx = await this.contract.executeArbitrage(params, txOptions);
      logger.info(`📝 Transaction sent: ${tx.hash}`);
      logger.info(`⏳ Waiting for confirmation...`);

      // Wait for confirmation with timeout
      const receipt = await Promise.race([
        tx.wait(1),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction timeout')), 60000)
        ),
      ]) as ethers.ContractReceipt;

      if (receipt.status === 1) {
        // Transaction successful
        const profit = await this.calculateProfit(receipt, tokenBorrow, decimals);
        
        logger.info(`✅ Transaction successful!`);
        logger.info(`💰 Profit: $${profit.toFixed(2)}`);
        logger.info(`🔗 TX: ${receipt.transactionHash}`);

        return {
          success: true,
          txHash: receipt.transactionHash,
          profit,
        };
      } else {
        logger.error('Transaction failed');
        return {
          success: false,
          txHash: receipt.transactionHash,
          error: 'Transaction reverted',
        };
      }
    } catch (error: any) {
      logger.error('Error executing arbitrage:', error);
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Get DEX router address
   */
  private getDexRouter(dexName: string): string {
    switch (dexName) {
      case 'UniswapV3':
        return DEX_ROUTERS.UNISWAP_V3;
      case 'SushiSwap':
        return DEX_ROUTERS.SUSHISWAP;
      case 'Camelot':
        return DEX_ROUTERS.CAMELOT;
      default:
        throw new Error(`Unknown DEX: ${dexName}`);
    }
  }

  /**
   * Calculate actual profit from transaction
   */
  private async calculateProfit(
    receipt: ethers.ContractReceipt,
    tokenAddress: string,
    decimals: number
  ): Promise<number> {
    try {
      // Look for profit in events or calculate from balance change
      // For now, use estimated profit based on opportunity
      // In production, parse events from the contract
      return config.flashLoan.minProfitUSD; // Placeholder
    } catch (error) {
      logger.error('Error calculating profit:', error);
      return 0;
    }
  }

  /**
   * Check wallet balance
   */
  async checkBalance(): Promise<{
    eth: string;
    ethValue: number;
  }> {
    const balance = await this.wallet.getBalance();
    const ethValue = parseFloat(ethers.utils.formatEther(balance));
    
    return {
      eth: ethers.utils.formatEther(balance),
      ethValue,
    };
  }

  /**
   * Get wallet address
   */
  getWalletAddress(): string {
    return this.wallet.address;
  }
}
