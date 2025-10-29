/**
 * ═══════════════════════════════════════════════════════════════════
 * DYNAMIC LOAN SIZER
 * Calculates optimal flash loan amount for each trade ($1k - $2M)
 * ═══════════════════════════════════════════════════════════════════
 */

import { BigNumber, ethers } from 'ethers';
import { productionConfig } from '../config/production.config';
import { getTokenInfo } from '../config/tokens.config';

export interface LoanSizeRecommendation {
  optimalLoanSize: BigNumber;
  optimalLoanSizeUSD: number;
  minLoanSize: BigNumber;
  minLoanSizeUSD: number;
  maxLoanSize: BigNumber;
  maxLoanSizeUSD: number;
  reasoning: string;
  confidence: number; // 0-100
  estimatedProfit: number; // USD
  estimatedProfitPercentage: number;
}

/**
 * Intelligent loan sizing based on multiple factors
 */
export class DynamicLoanSizer {
  
  /**
   * Calculate optimal loan size for a specific trade opportunity
   * 
   * Considers:
   * 1. Pool liquidity depth
   * 2. Price spread magnitude
   * 3. Slippage tolerance
   * 4. Gas costs vs profit ratio
   * 5. Configuration limits ($1k - $2M)
   */
  calculateOptimalLoanSize(
    tokenAddress: string,
    liquidityUSD: number,
    spreadPercentage: number,
    estimatedSlippage: number
  ): LoanSizeRecommendation {
    
    const tokenInfo = getTokenInfo(tokenAddress);
    if (!tokenInfo) {
      throw new Error(`Unknown token: ${tokenAddress}`);
    }

    console.log('\n💰 DYNAMIC LOAN SIZING');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Token: ${tokenInfo.symbol}`);
    console.log(`Liquidity: $${liquidityUSD.toLocaleString()}`);
    console.log(`Spread: ${spreadPercentage.toFixed(3)}%`);
    console.log(`Estimated Slippage: ${estimatedSlippage.toFixed(3)}%`);

    // STEP 1: Calculate liquidity-based maximum
    // Rule: Never exceed 5% of pool liquidity to minimize slippage
    const liquidityBasedMax = liquidityUSD * 0.05; // 5% of liquidity
    console.log(`\n📊 Liquidity-based max: $${liquidityBasedMax.toLocaleString()}`);

    // STEP 2: Calculate spread-based optimal
    // Rule: Larger spreads can support larger trades
    let spreadBasedOptimal: number;
    
    if (spreadPercentage >= 2.0) {
      // Very large spread (2%+) - can use max size
      spreadBasedOptimal = liquidityBasedMax;
      console.log(`📈 Large spread (${spreadPercentage.toFixed(2)}%) - using max size`);
    } else if (spreadPercentage >= 1.0) {
      // Large spread (1-2%) - use 75% of max
      spreadBasedOptimal = liquidityBasedMax * 0.75;
      console.log(`📈 Good spread (${spreadPercentage.toFixed(2)}%) - using 75% of max`);
    } else if (spreadPercentage >= 0.5) {
      // Medium spread (0.5-1%) - use 50% of max
      spreadBasedOptimal = liquidityBasedMax * 0.50;
      console.log(`📈 Medium spread (${spreadPercentage.toFixed(2)}%) - using 50% of max`);
    } else {
      // Small spread (<0.5%) - use 25% of max
      spreadBasedOptimal = liquidityBasedMax * 0.25;
      console.log(`📈 Small spread (${spreadPercentage.toFixed(2)}%) - using 25% of max`);
    }

    // STEP 3: Calculate slippage-adjusted size
    // Rule: Higher slippage means smaller trade size
    let slippageAdjusted = spreadBasedOptimal;
    
    if (estimatedSlippage > 0.3) {
      slippageAdjusted = spreadBasedOptimal * 0.5;
      console.log(`⚠️  High slippage (${estimatedSlippage.toFixed(3)}%) - reducing size by 50%`);
    } else if (estimatedSlippage > 0.2) {
      slippageAdjusted = spreadBasedOptimal * 0.75;
      console.log(`⚠️  Medium slippage (${estimatedSlippage.toFixed(3)}%) - reducing size by 25%`);
    }

    // STEP 4: Apply configuration limits
    const configMin = productionConfig.flashLoan.minLoanAmountUSD;
    const configMax = productionConfig.flashLoan.maxLoanAmountUSD;

    let optimalSizeUSD = slippageAdjusted;

    // Apply minimum limit
    if (optimalSizeUSD < configMin) {
      console.log(`⬆️  Below min limit ($${configMin.toLocaleString()}) - using minimum`);
      optimalSizeUSD = configMin;
    }

    // Apply maximum limit
    if (optimalSizeUSD > configMax) {
      console.log(`⬇️  Above max limit ($${configMax.toLocaleString()}) - using maximum`);
      optimalSizeUSD = configMax;
    }

    // STEP 5: Calculate size range
    const minSizeUSD = Math.max(configMin, optimalSizeUSD * 0.5); // 50% of optimal
    const maxSizeUSD = Math.min(configMax, liquidityBasedMax);

    // STEP 6: Estimate profit
    const estimatedProfitPercentage = spreadPercentage - estimatedSlippage - 0.05; // -0.05% for flash loan fee
    const estimatedProfit = (optimalSizeUSD * estimatedProfitPercentage) / 100;

    // STEP 7: Gas cost check
    // Rule: Profit should be at least 10x gas cost
    const estimatedGasCost = 0.5; // ~$0.50 on Arbitrum
    const profitToGasRatio = estimatedProfit / estimatedGasCost;

    if (profitToGasRatio < 10 && optimalSizeUSD < configMax) {
      // Try to increase size to improve profit/gas ratio
      const targetProfit = estimatedGasCost * 10;
      const targetSize = (targetProfit * 100) / estimatedProfitPercentage;
      
      if (targetSize <= maxSizeUSD) {
        console.log(`⚡ Increasing size to improve profit/gas ratio`);
        optimalSizeUSD = Math.min(targetSize, maxSizeUSD);
      }
    }

    // STEP 8: Calculate confidence
    let confidence = 50; // Base confidence

    // Liquidity confidence
    if (liquidityUSD > 10000000) confidence += 25; // >$10M
    else if (liquidityUSD > 5000000) confidence += 20; // >$5M
    else if (liquidityUSD > 1000000) confidence += 15; // >$1M
    else if (liquidityUSD > 500000) confidence += 10; // >$500k
    else confidence += 5;

    // Spread confidence
    if (spreadPercentage > 2) confidence += 25;
    else if (spreadPercentage > 1) confidence += 20;
    else if (spreadPercentage > 0.5) confidence += 15;
    else confidence += 5;

    confidence = Math.min(100, confidence);

    // STEP 9: Build recommendation
    const decimals = tokenInfo.decimals;

    const recommendation: LoanSizeRecommendation = {
      optimalLoanSize: ethers.utils.parseUnits(
        Math.floor(optimalSizeUSD).toString(),
        decimals
      ),
      optimalLoanSizeUSD: Math.floor(optimalSizeUSD),
      minLoanSize: ethers.utils.parseUnits(
        Math.floor(minSizeUSD).toString(),
        decimals
      ),
      minLoanSizeUSD: Math.floor(minSizeUSD),
      maxLoanSize: ethers.utils.parseUnits(
        Math.floor(maxSizeUSD).toString(),
        decimals
      ),
      maxLoanSizeUSD: Math.floor(maxSizeUSD),
      reasoning: this.buildReasoning(
        optimalSizeUSD,
        liquidityUSD,
        spreadPercentage,
        estimatedSlippage
      ),
      confidence,
      estimatedProfit,
      estimatedProfitPercentage,
    };

    console.log('\n💎 RECOMMENDATION:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Optimal Loan: $${recommendation.optimalLoanSizeUSD.toLocaleString()}`);
    console.log(`Range: $${recommendation.minLoanSizeUSD.toLocaleString()} - $${recommendation.maxLoanSizeUSD.toLocaleString()}`);
    console.log(`Estimated Profit: $${recommendation.estimatedProfit.toFixed(2)} (${recommendation.estimatedProfitPercentage.toFixed(3)}%)`);
    console.log(`Confidence: ${recommendation.confidence}%`);
    console.log(`Reasoning: ${recommendation.reasoning}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return recommendation;
  }

  /**
   * Build human-readable reasoning
   */
  private buildReasoning(
    optimalSize: number,
    liquidity: number,
    spread: number,
    slippage: number
  ): string {
    const reasons: string[] = [];

    // Liquidity reasoning
    const liquidityRatio = (optimalSize / liquidity) * 100;
    if (liquidityRatio < 1) {
      reasons.push(`Low impact (<1% of liquidity)`);
    } else if (liquidityRatio < 3) {
      reasons.push(`Moderate impact (${liquidityRatio.toFixed(1)}% of liquidity)`);
    } else {
      reasons.push(`Significant impact (${liquidityRatio.toFixed(1)}% of liquidity)`);
    }

    // Spread reasoning
    if (spread > 1.5) {
      reasons.push(`Excellent spread (${spread.toFixed(2)}%)`);
    } else if (spread > 0.8) {
      reasons.push(`Good spread (${spread.toFixed(2)}%)`);
    } else {
      reasons.push(`Adequate spread (${spread.toFixed(2)}%)`);
    }

    // Slippage reasoning
    if (slippage < 0.2) {
      reasons.push(`Low slippage (${slippage.toFixed(2)}%)`);
    } else if (slippage < 0.4) {
      reasons.push(`Moderate slippage (${slippage.toFixed(2)}%)`);
    } else {
      reasons.push(`High slippage (${slippage.toFixed(2)}%)`);
    }

    // Size reasoning
    if (optimalSize >= 1000000) {
      reasons.push(`Large trade ($${(optimalSize / 1000000).toFixed(1)}M)`);
    } else if (optimalSize >= 100000) {
      reasons.push(`Medium trade ($${(optimalSize / 1000).toFixed(0)}k)`);
    } else {
      reasons.push(`Small trade ($${(optimalSize / 1000).toFixed(0)}k)`);
    }

    return reasons.join(', ');
  }

  /**
   * Quick size check - is this opportunity worth pursuing?
   */
  isOpportunityViable(
    liquidityUSD: number,
    spreadPercentage: number,
    minProfitUSD: number = productionConfig.flashLoan.minProfitUSD
  ): boolean {
    // Quick calculation
    const maxSafeSize = liquidityUSD * 0.05;
    const configMin = productionConfig.flashLoan.minLoanAmountUSD;
    const configMax = productionConfig.flashLoan.maxLoanAmountUSD;

    const usableSize = Math.max(configMin, Math.min(maxSafeSize, configMax));
    const estimatedProfit = (usableSize * spreadPercentage) / 100;

    return estimatedProfit >= minProfitUSD;
  }

  /**
   * Calculate loan size for multiple opportunities (batch)
   */
  calculateBatch(
    opportunities: Array<{
      token: string;
      liquidity: number;
      spread: number;
      slippage: number;
    }>
  ): LoanSizeRecommendation[] {
    return opportunities.map(opp =>
      this.calculateOptimalLoanSize(
        opp.token,
        opp.liquidity,
        opp.spread,
        opp.slippage
      )
    );
  }
}
