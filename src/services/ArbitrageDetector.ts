import { logger } from '../utils/logger';
import { PricePair } from './PriceScanner';
import { config } from '../config/config';

export interface ArbitrageOpportunity {
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
  timestamp: number;
}

export class ArbitrageDetector {
  private minProfitPercentage: number;
  private minProfitUSD: number;

  constructor() {
    this.minProfitPercentage = config.flashLoan.minProfitUSD / 100; // Convert basis points
    this.minProfitUSD = config.flashLoan.minProfitUSD;
  }

  /**
   * Detect arbitrage opportunities from price data
   */
  detectArbitrage(priceData: Map<string, PricePair[]>): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];

    for (const [pairKey, prices] of priceData.entries()) {
      if (prices.length < 2) continue;

      // Check all combinations of DEXs
      for (let i = 0; i < prices.length; i++) {
        for (let j = 0; j < prices.length; j++) {
          if (i === j) continue;

          const price1 = prices[i];
          const price2 = prices[j];

          // Check A to B arbitrage
          const arbAtoB = this.checkArbitrageDirection(
            price1,
            price2,
            'AtoB'
          );
          if (arbAtoB) {
            opportunities.push(arbAtoB);
          }

          // Check B to A arbitrage
          const arbBtoA = this.checkArbitrageDirection(
            price1,
            price2,
            'BtoA'
          );
          if (arbBtoA) {
            opportunities.push(arbBtoA);
          }
        }
      }
    }

    // Sort by profit percentage
    opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);

    if (opportunities.length > 0) {
      logger.info(`🎯 Found ${opportunities.length} arbitrage opportunities!`);
      opportunities.forEach((opp, idx) => {
        if (idx < 5) { // Log top 5
          logger.info(
            `   #${idx + 1}: ${opp.tokenA}/${opp.tokenB} ` +
            `${opp.direction === 'AtoB' ? '→' : '←'} ` +
            `Buy on ${opp.buyDex}, Sell on ${opp.sellDex} ` +
            `| Profit: ${opp.profitPercentage.toFixed(3)}% ` +
            `($${opp.estimatedProfitUSD.toFixed(2)})`
          );
        }
      });
    }

    return opportunities;
  }

  /**
   * Check arbitrage in one direction
   */
  private checkArbitrageDirection(
    price1: PricePair,
    price2: PricePair,
    direction: 'AtoB' | 'BtoA'
  ): ArbitrageOpportunity | null {
    let buyPrice: number;
    let sellPrice: number;
    let buyDex: string;
    let sellDex: string;
    let buyFee: number | undefined;
    let sellFee: number | undefined;

    if (direction === 'AtoB') {
      // Buy B with A on one DEX, sell B for A on another DEX
      buyPrice = price1.priceAtoB;
      sellPrice = price2.priceBtoA;
      buyDex = price1.dex;
      sellDex = price2.dex;
      buyFee = price1.fee;
      sellFee = price2.fee;
    } else {
      // Buy A with B on one DEX, sell A for B on another DEX
      buyPrice = price1.priceBtoA;
      sellPrice = price2.priceAtoB;
      buyDex = price1.dex;
      sellDex = price2.dex;
      buyFee = price1.fee;
      sellFee = price2.fee;
    }

    // Calculate profit
    // After buying and selling, how much more do we have?
    const profitRatio = (sellPrice * buyPrice) - 1;
    const profitPercentage = profitRatio * 100;

    // Account for fees (rough estimate)
    const feeAdjustedProfit = profitPercentage - 0.6; // Subtract ~0.6% for DEX fees + gas

    if (feeAdjustedProfit < this.minProfitPercentage) {
      return null;
    }

    // Estimate profit in USD based on loan amount
    const estimatedProfitUSD = (config.flashLoan.minLoanAmountUSD * feeAdjustedProfit) / 100;

    if (estimatedProfitUSD < this.minProfitUSD) {
      return null;
    }

    return {
      tokenA: price1.tokenA,
      tokenB: price1.tokenB,
      tokenAAddress: price1.tokenAAddress,
      tokenBAddress: price1.tokenBAddress,
      buyDex,
      sellDex,
      buyPrice,
      sellPrice,
      profitPercentage: feeAdjustedProfit,
      direction,
      buyFee,
      sellFee,
      estimatedProfitUSD,
      timestamp: Date.now(),
    };
  }

  /**
   * Filter opportunities by minimum criteria
   */
  filterOpportunities(opportunities: ArbitrageOpportunity[]): ArbitrageOpportunity[] {
    return opportunities.filter(opp => {
      return (
        opp.profitPercentage >= this.minProfitPercentage &&
        opp.estimatedProfitUSD >= this.minProfitUSD
      );
    });
  }

  /**
   * Get best opportunity
   */
  getBestOpportunity(opportunities: ArbitrageOpportunity[]): ArbitrageOpportunity | null {
    if (opportunities.length === 0) return null;
    return opportunities[0]; // Already sorted by profit
  }
}
