import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { ValidatedPrice } from './ProductionPriceScanner';
import { config } from '../config/config';
import { SPEED_CONSTANTS } from '../config/constants';
import { PoolReserveReader } from './PoolReserveReader';

export interface ProductionArbitrageOpportunity {
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
  isExecutable: boolean;
  validationErrors: string[];
  timestamp: number;
}

export class ProductionArbitrageDetector {
  private minProfitUSD: number;
  private ethPriceUSD: number = 2000;
  private poolReader?: PoolReserveReader;

  // PRODUCTION: Validation thresholds
  private readonly MAX_REALISTIC_SPREAD = 10; // 10% max realistic spread
  private readonly MIN_SPREAD_FOR_PROFIT = 0.5; // 0.5% minimum spread

  constructor(provider?: ethers.providers.Provider) {
    this.minProfitUSD = SPEED_CONSTANTS.MIN_PROFIT_AFTER_GAS;
    if (provider) {
      this.poolReader = new PoolReserveReader(provider);
    }
  }

  /**
   * PRODUCTION: Detect arbitrage with full validation
   */
  async detectArbitrageProduction(
    priceData: Map<string, ValidatedPrice[]>
  ): Promise<ProductionArbitrageOpportunity[]> {
    const startTime = Date.now();
    const opportunities: ProductionArbitrageOpportunity[] = [];

    for (const [pairKey, prices] of priceData.entries()) {
      // Need at least 2 valid prices
      if (prices.length < 2) continue;

      // Only use validated prices
      const validPrices = prices.filter(p => p.isValid);
      if (validPrices.length < 2) continue;

      // Check all combinations
      for (let i = 0; i < validPrices.length; i++) {
        for (let j = 0; j < validPrices.length; j++) {
          if (i === j) continue;

          const price1 = validPrices[i];
          const price2 = validPrices[j];

          // Check both directions
          const arbAtoB = await this.calculateAndValidateArbitrage(price1, price2, 'AtoB');
          if (arbAtoB && arbAtoB.isExecutable) {
            opportunities.push(arbAtoB);
          }

          const arbBtoA = await this.calculateAndValidateArbitrage(price1, price2, 'BtoA');
          if (arbBtoA && arbBtoA.isExecutable) {
            opportunities.push(arbBtoA);
          }
        }
      }
    }

    // Sort by net profit
    opportunities.sort((a, b) => b.netProfitUSD - a.netProfitUSD);

    const detectTime = Date.now() - startTime;
    
    if (opportunities.length > 0) {
      logger.info(`🎯 FOUND ${opportunities.length} EXECUTABLE opportunities in ${detectTime}ms`);
      opportunities.slice(0, 3).forEach((opp, idx) => {
        logger.info(
          `   #${idx + 1}: ${opp.tokenA}/${opp.tokenB} | ` +
          `${opp.buyDex}→${opp.sellDex} | ` +
          `Spread: ${opp.profitPercentage.toFixed(3)}% | ` +
          `NET: $${opp.netProfitUSD.toFixed(2)} ⚡`
        );
      });
    }

    return opportunities;
  }

  /**
   * PRODUCTION: Calculate and validate arbitrage
   */
  private async calculateAndValidateArbitrage(
    price1: ValidatedPrice,
    price2: ValidatedPrice,
    direction: 'AtoB' | 'BtoA'
  ): Promise<ProductionArbitrageOpportunity | null> {
    const validationErrors: string[] = [];

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

    // VALIDATION 1: Calculate spread
    const profitRatio = (sellPrice * buyPrice) - 1;
    const profitPercentage = profitRatio * 100;

    // VALIDATION 2: Spread must be realistic
    if (profitPercentage > this.MAX_REALISTIC_SPREAD) {
      validationErrors.push(`Spread too high: ${profitPercentage.toFixed(2)}% (max ${this.MAX_REALISTIC_SPREAD}%)`);
      return null; // Reject obviously wrong data
    }

    // VALIDATION 3: Spread must be sufficient
    if (profitPercentage < this.MIN_SPREAD_FOR_PROFIT) {
      return null; // Not profitable enough
    }

    // Calculate costs
    const loanAmountUSD = config.flashLoan.minLoanAmountUSD;
    const tokenBorrowAddress = direction === 'AtoB' ? price1.tokenAAddress : price1.tokenBAddress;
    const tokenTargetAddress = direction === 'AtoB' ? price1.tokenBAddress : price1.tokenAAddress;

    const costs = await this.calculateAccurateCosts(
      buyDex, sellDex, tokenBorrowAddress, tokenTargetAddress,
      loanAmountUSD, buyFee, sellFee, gasEstimate
    );

    const grossProfitUSD = loanAmountUSD * (profitPercentage / 100);
    const netProfitUSD = grossProfitUSD - costs.totalCostUSD;

    // VALIDATION 4: Must be profitable after all costs
    if (netProfitUSD < this.minProfitUSD) {
      return null;
    }

    // VALIDATION 5: Price impact check
    const priceImpact = this.estimatePriceImpact(loanAmountUSD, buyDex, sellDex);
    if (priceImpact > 5) { // 5% max price impact
      validationErrors.push(`Price impact too high: ${priceImpact.toFixed(2)}%`);
    }

    const executionSpeed = this.determineExecutionSpeed(buyDex, sellDex, gasEstimate);

    // VALIDATION 6: Final executable check
    const isExecutable = validationErrors.length === 0 && netProfitUSD >= this.minProfitUSD;

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
      isExecutable,
      validationErrors,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate costs with pool reserves
   */
  private async calculateAccurateCosts(
    buyDex: string, sellDex: string, tokenBorrowAddress: string,
    tokenTargetAddress: string, loanAmountUSD: number,
    buyFee?: number, sellFee?: number, gasEstimate?: number
  ): Promise<{ totalCostUSD: number; breakdown: any }> {
    const buyFeePercent = buyFee ? buyFee / 10000 / 100 : 0.003;
    const sellFeePercent = sellFee ? sellFee / 10000 / 100 : 0.003;
    
    const buyFeeCost = loanAmountUSD * buyFeePercent;
    const sellFeeCost = loanAmountUSD * sellFeePercent;

    let slippageCost = 0;
    if (this.poolReader) {
      try {
        const loanAmountWei = ethers.utils.parseUnits(loanAmountUSD.toString(), 18);
        const buySlippage = await this.poolReader.calculateSlippage(
          tokenBorrowAddress, tokenTargetAddress, loanAmountWei, buyDex, buyFee
        );
        const sellSlippage = await this.poolReader.calculateSlippage(
          tokenTargetAddress, tokenBorrowAddress, loanAmountWei, sellDex, sellFee
        );
        slippageCost = loanAmountUSD * ((buySlippage + sellSlippage) / 100);
      } catch (error) {
        slippageCost = loanAmountUSD * 0.003;
      }
    } else {
      slippageCost = loanAmountUSD * 0.003;
    }

    const flashLoanPremium = loanAmountUSD * 0.0009;

    let gasCostUSD = 15;
    if (gasEstimate) {
      const totalGas = gasEstimate * 1.5;
      const gasPrice = 0.1;
      const gasCostETH = (totalGas * gasPrice) / 1e9;
      gasCostUSD = gasCostETH * this.ethPriceUSD;
    } else {
      if (buyDex === 'UniswapV3' && sellDex === 'UniswapV3') {
        gasCostUSD = 20;
      } else if (buyDex === 'SushiSwap' && sellDex === 'SushiSwap') {
        gasCostUSD = 10;
      } else {
        gasCostUSD = 15;
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

  private estimatePriceImpact(tradeSize: number, buyDex: string, sellDex: string): number {
    let impact = 0;

    if (tradeSize >= 100000) {
      impact += 0.5;
    } else if (tradeSize >= 50000) {
      impact += 0.2;
    } else {
      impact += 0.1;
    }

    if (buyDex === 'UniswapV3' && sellDex === 'UniswapV3') {
      impact *= 0.5;
    }

    return impact;
  }

  private determineExecutionSpeed(
    buyDex: string, sellDex: string, gasEstimate?: number
  ): 'instant' | 'fast' | 'slow' {
    if (buyDex === 'UniswapV3' && sellDex === 'UniswapV3') {
      return 'instant';
    }
    if (buyDex === 'SushiSwap' && sellDex === 'SushiSwap') {
      return 'fast';
    }
    return 'fast';
  }

  filterBestOpportunities(opportunities: ProductionArbitrageOpportunity[]): ProductionArbitrageOpportunity[] {
    return opportunities
      .filter(opp => opp.isExecutable && opp.validationErrors.length === 0)
      .slice(0, 5);
  }

  updateEthPrice(priceUSD: number) {
    this.ethPriceUSD = priceUSD;
  }
}
