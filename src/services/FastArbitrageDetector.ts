import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { FastPricePair } from './FastPriceScanner';
import { config } from '../config/config';
import { SPEED_CONSTANTS } from '../config/constants';
import { PoolReserveReader } from './PoolReserveReader';

export interface FastArbitrageOpportunity {
  tokenA: string;
  tokenB: string;
  tokenAAddress: string;
  tokenBAddress: string;
  buyDex: string;
  sellDex: string;
  buyPrice: number;
  sellPrice: number;
  profitPercentage: number;
  direction: 'AtoB' | 'BtoA';
  buyFee?: number;
  sellFee?: number;
  estimatedProfitUSD: number;
  estimatedGasCost: number;
  netProfitUSD: number;
  priceImpact: number;
  gasEstimate?: number;
  executionSpeed: 'instant' | 'fast' | 'slow';
  timestamp: number;
}

export class FastArbitrageDetector {
  private minProfitUSD: number;
  private ethPriceUSD: number = 2000; // Conservative ETH price for gas calculation
  private poolReader?: PoolReserveReader;

  constructor(provider?: ethers.providers.Provider) {
    this.minProfitUSD = SPEED_CONSTANTS.MIN_PROFIT_AFTER_GAS;
    if (provider) {
      this.poolReader = new PoolReserveReader(provider);
    }
  }

  /**
   * FAST: Detect arbitrage with accurate profit calculation (NOW WITH POOL RESERVES!)
   */
  async detectArbitrageFast(priceData: Map<string, FastPricePair[]>): Promise<FastArbitrageOpportunity[]> {
    const startTime = Date.now();
    const opportunities: FastArbitrageOpportunity[] = [];

    for (const [pairKey, prices] of priceData.entries()) {
      if (prices.length < 2) continue;

      // Check all DEX combinations
      for (let i = 0; i < prices.length; i++) {
        for (let j = 0; j < prices.length; j++) {
          if (i === j) continue;

          const price1 = prices[i];
          const price2 = prices[j];

          // Check both directions (NOW READS POOL RESERVES FOR EXACT SLIPPAGE!)
          const arbAtoB = await this.calculateArbitrage(price1, price2, 'AtoB');
          if (arbAtoB && arbAtoB.netProfitUSD >= this.minProfitUSD) {
            opportunities.push(arbAtoB);
          }

          const arbBtoA = await this.calculateArbitrage(price1, price2, 'BtoA');
          if (arbBtoA && arbBtoA.netProfitUSD >= this.minProfitUSD) {
            opportunities.push(arbBtoA);
          }
        }
      }
    }

    // Sort by NET profit (after gas)
    opportunities.sort((a, b) => b.netProfitUSD - a.netProfitUSD);

    const detectTime = Date.now() - startTime;
    
    if (opportunities.length > 0) {
      logger.info(`🎯 Found ${opportunities.length} opportunities in ${detectTime}ms`);
      opportunities.slice(0, 3).forEach((opp, idx) => {
        logger.info(
          `   #${idx + 1}: ${opp.tokenA}/${opp.tokenB} | ` +
          `${opp.buyDex}→${opp.sellDex} | ` +
          `Gross: $${opp.estimatedProfitUSD.toFixed(2)} | ` +
          `Gas: $${opp.estimatedGasCost.toFixed(2)} | ` +
          `NET: $${opp.netProfitUSD.toFixed(2)} ⚡`
        );
      });
    }

    return opportunities;
  }

  /**
   * Calculate arbitrage with ACCURATE profit estimation (NOW WITH POOL RESERVES!)
   */
  private async calculateArbitrage(
    price1: FastPricePair,
    price2: FastPricePair,
    direction: 'AtoB' | 'BtoA'
  ): Promise<FastArbitrageOpportunity | null> {
    let buyPrice: number;
    let sellPrice: number;
    let buyDex: string;
    let sellDex: string;
    let buyFee: number | undefined;
    let sellFee: number | undefined;
    let gasEstimate: number | undefined;

    if (direction === 'AtoB') {
      buyPrice = price1.priceAtoB;
      sellPrice = price2.priceBtoA;
      buyDex = price1.dex;
      sellDex = price2.dex;
      buyFee = price1.fee;
      sellFee = price2.fee;
      gasEstimate = price1.gasEstimate;
    } else {
      buyPrice = price1.priceBtoA;
      sellPrice = price2.priceAtoB;
      buyDex = price1.dex;
      sellDex = price2.dex;
      buyFee = price1.fee;
      sellFee = price2.fee;
      gasEstimate = price1.gasEstimate;
    }

    // Calculate raw profit
    const profitRatio = (sellPrice * buyPrice) - 1;
    const profitPercentage = profitRatio * 100;

    // Quick filter - must have at least 0.3% spread
    if (profitPercentage < 0.3) return null;

    // Loan amount
    const loanAmountUSD = config.flashLoan.minLoanAmountUSD;

    // Determine token addresses for pool reserve reading
    const tokenBorrowAddress = direction === 'AtoB' ? price1.tokenAAddress : price1.tokenBAddress;
    const tokenTargetAddress = direction === 'AtoB' ? price1.tokenBAddress : price1.tokenAAddress;

    // Calculate ACCURATE costs (NOW READS ACTUAL POOL RESERVES!)
    const costs = await this.calculateAccurateCosts(
      buyDex, 
      sellDex, 
      tokenBorrowAddress,
      tokenTargetAddress,
      loanAmountUSD,
      buyFee, 
      sellFee, 
      gasEstimate
    );

    // Gross profit (before costs)
    const grossProfitUSD = loanAmountUSD * (profitPercentage / 100);

    // Net profit (after ALL costs)
    const netProfitUSD = grossProfitUSD - costs.totalCostUSD;

    // Must be profitable after costs
    if (netProfitUSD < this.minProfitUSD) return null;

    // Calculate price impact (estimated)
    const priceImpact = this.estimatePriceImpact(loanAmountUSD, buyDex, sellDex);

    // Determine execution speed
    const executionSpeed = this.determineExecutionSpeed(buyDex, sellDex, gasEstimate);

    return {
      tokenA: price1.tokenA,
      tokenB: price1.tokenB,
      tokenAAddress: price1.tokenAAddress,
      tokenBAddress: price1.tokenBAddress,
      buyDex,
      sellDex,
      buyPrice,
      sellPrice,
      profitPercentage,
      direction,
      buyFee,
      sellFee,
      estimatedProfitUSD: grossProfitUSD,
      estimatedGasCost: costs.totalCostUSD,
      netProfitUSD,
      priceImpact,
      gasEstimate,
      executionSpeed,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate ACCURATE costs (DEX fees + EXACT slippage from pool reserves + gas + flash loan premium)
   */
  private async calculateAccurateCosts(
    buyDex: string,
    sellDex: string,
    tokenBorrowAddress: string,
    tokenTargetAddress: string,
    loanAmountUSD: number,
    buyFee?: number,
    sellFee?: number,
    gasEstimate?: number
  ): Promise<{ totalCostUSD: number; breakdown: any }> {
    // DEX fees
    const buyFeePercent = buyFee ? buyFee / 10000 / 100 : 0.003; // Default 0.3%
    const sellFeePercent = sellFee ? sellFee / 10000 / 100 : 0.003;
    
    const buyFeeCost = loanAmountUSD * buyFeePercent;
    const sellFeeCost = loanAmountUSD * sellFeePercent;

    // Calculate EXACT slippage from pool reserves
    let slippageCost = 0;
    if (this.poolReader) {
      try {
        const loanAmountWei = ethers.utils.parseUnits(loanAmountUSD.toString(), 18);
        const buySlippage = await this.poolReader.calculateSlippage(
          tokenBorrowAddress,
          tokenTargetAddress,
          loanAmountWei,
          buyDex,
          buyFee
        );
        const sellSlippage = await this.poolReader.calculateSlippage(
          tokenTargetAddress,
          tokenBorrowAddress,
          loanAmountWei,
          sellDex,
          sellFee
        );
        slippageCost = loanAmountUSD * ((buySlippage + sellSlippage) / 100);
      } catch (error) {
        // Fallback to estimation if reading fails
        slippageCost = loanAmountUSD * 0.003; // 0.3% default
      }
    } else {
      slippageCost = loanAmountUSD * 0.003; // 0.3% default
    }

    // Aave flash loan premium: 0.09%
    const flashLoanPremium = loanAmountUSD * 0.0009;

    // Gas cost (estimated)
    let gasCostUSD = 15; // Conservative default
    
    if (gasEstimate) {
      // Use actual gas estimate if available
      const totalGas = gasEstimate * 1.5; // Add 50% buffer for full arbitrage
      const gasPrice = 0.1; // Gwei (Arbitrum is cheap)
      const gasCostETH = (totalGas * gasPrice) / 1e9;
      gasCostUSD = gasCostETH * this.ethPriceUSD;
    } else {
      // Estimate based on DEX types
      if (buyDex === 'UniswapV3' && sellDex === 'UniswapV3') {
        gasCostUSD = 20; // V3 is more gas intensive
      } else if (buyDex === 'SushiSwap' && sellDex === 'SushiSwap') {
        gasCostUSD = 10; // V2 is cheaper
      } else {
        gasCostUSD = 15; // Mixed
      }
    }

    const totalCostUSD = buyFeeCost + sellFeeCost + slippageCost + flashLoanPremium + gasCostUSD;

    return {
      totalCostUSD,
      breakdown: {
        buyFee: buyFeeCost,
        sellFee: sellFeeCost,
        slippage: slippageCost,
        flashLoanPremium,
        gas: gasCostUSD,
      },
    };
  }

  /**
   * Estimate price impact for large trades
   */
  private estimatePriceImpact(tradeSize: number, buyDex: string, sellDex: string): number {
    // Conservative estimates based on typical liquidity
    let impact = 0;

    // Larger trades = more impact
    if (tradeSize >= 100000) {
      impact += 0.5; // 0.5% for $100k+
    } else if (tradeSize >= 50000) {
      impact += 0.2; // 0.2% for $50k+
    } else {
      impact += 0.1; // 0.1% for smaller
    }

    // V3 typically has better depth
    if (buyDex === 'UniswapV3' && sellDex === 'UniswapV3') {
      impact *= 0.5; // Half the impact
    }

    return impact;
  }

  /**
   * Determine execution speed category
   */
  private determineExecutionSpeed(
    buyDex: string,
    sellDex: string,
    gasEstimate?: number
  ): 'instant' | 'fast' | 'slow' {
    // Uniswap V3 <-> V3 is fastest
    if (buyDex === 'UniswapV3' && sellDex === 'UniswapV3') {
      return 'instant';
    }

    // SushiSwap <-> SushiSwap is fast
    if (buyDex === 'SushiSwap' && sellDex === 'SushiSwap') {
      return 'fast';
    }

    // Mixed is slower
    return 'fast';
  }

  /**
   * Filter opportunities by profitability and speed
   */
  filterBestOpportunities(opportunities: FastArbitrageOpportunity[]): FastArbitrageOpportunity[] {
    return opportunities
      .filter(opp => 
        opp.netProfitUSD >= this.minProfitUSD &&
        opp.executionSpeed !== 'slow'
      )
      .slice(0, 5); // Top 5 only
  }

  /**
   * Update ETH price for gas calculations
   */
  updateEthPrice(priceUSD: number) {
    this.ethPriceUSD = priceUSD;
  }
}
