import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { UltraFastPriceData } from './UltraFastPriceScanner';

export interface TriangularArbitrageOpportunity {
  tokenA: string;
  tokenB: string;
  tokenC: string;
  path1: string; // A -> B
  path2: string; // B -> C  
  path3: string; // C -> A
  profitPercentage: number;
  estimatedProfitUSD: number;
  executionPath: string;
  confidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  gasEstimate: number;
  timestamp: number;
}

export class TriangularArbitrageDetector {
  private readonly MIN_PROFIT_PERCENTAGE = 0.3; // 0.3% minimum profit
  private readonly MIN_CONFIDENCE = 0.7; // 70% minimum confidence
  private readonly MAX_GAS_COST_USD = 50; // $50 maximum gas cost

  /**
   * Detect triangular arbitrage opportunities
   */
  detectTriangularArbitrage(priceData: Map<string, UltraFastPriceData[]>): TriangularArbitrageOpportunity[] {
    const opportunities: TriangularArbitrageOpportunity[] = [];
    
    try {
      // Get all unique tokens
      const tokens = this.extractUniqueTokens(priceData);
      
      // Find triangular opportunities for each token combination
      for (let i = 0; i < tokens.length; i++) {
        for (let j = 0; j < tokens.length; j++) {
          for (let k = 0; k < tokens.length; k++) {
            if (i !== j && j !== k && k !== i) {
              const tokenA = tokens[i];
              const tokenB = tokens[j];
              const tokenC = tokens[k];
              
              // Check both directions: A->B->C->A and A->C->B->A
              const opportunity1 = this.checkTriangularPath(priceData, tokenA, tokenB, tokenC);
              const opportunity2 = this.checkTriangularPath(priceData, tokenA, tokenC, tokenB);
              
              if (opportunity1) opportunities.push(opportunity1);
              if (opportunity2) opportunities.push(opportunity2);
            }
          }
        }
      }
      
      // Sort by profit percentage (highest first)
      opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
      
      logger.info(`🔺 Found ${opportunities.length} triangular arbitrage opportunities`);
      return opportunities;
      
    } catch (error) {
      logger.error('Error detecting triangular arbitrage:', error);
      return [];
    }
  }

  /**
   * Check a specific triangular path
   */
  private checkTriangularPath(
    priceData: Map<string, UltraFastPriceData[]>,
    tokenA: string,
    tokenB: string,
    tokenC: string
  ): TriangularArbitrageOpportunity | null {
    try {
      // Get prices for each leg
      const priceAB = this.getBestPrice(priceData, tokenA, tokenB);
      const priceBC = this.getBestPrice(priceData, tokenB, tokenC);
      const priceCA = this.getBestPrice(priceData, tokenC, tokenA);
      
      if (!priceAB || !priceBC || !priceCA) {
        return null;
      }
      
      // Calculate triangular arbitrage
      const startAmount = ethers.utils.parseEther('1'); // Start with 1 ETH
      const amountAfterAB = this.calculateSwapOutput(startAmount, priceAB.price, priceAB.liquidity);
      const amountAfterBC = this.calculateSwapOutput(amountAfterAB, priceBC.price, priceBC.liquidity);
      const finalAmount = this.calculateSwapOutput(amountAfterBC, priceCA.price, priceCA.liquidity);
      
      // Calculate profit
      const profit = finalAmount.sub(startAmount);
      const profitPercentage = parseFloat(ethers.utils.formatEther(profit)) * 100;
      
      if (profitPercentage < this.MIN_PROFIT_PERCENTAGE) {
        return null;
      }
      
      // Calculate confidence based on liquidity and price consistency
      const confidence = this.calculateConfidence(priceAB, priceBC, priceCA);
      
      if (confidence < this.MIN_CONFIDENCE) {
        return null;
      }
      
      // Calculate gas estimate
      const gasEstimate = this.calculateGasEstimate();
      
      // Determine risk level
      const riskLevel = this.determineRiskLevel(profitPercentage, confidence, gasEstimate);
      
      // Calculate estimated profit in USD
      const estimatedProfitUSD = parseFloat(ethers.utils.formatEther(profit)) * 2000; // Approximate ETH price
      
      return {
        tokenA,
        tokenB,
        tokenC,
        path1: `${tokenA} -> ${tokenB}`,
        path2: `${tokenB} -> ${tokenC}`,
        path3: `${tokenC} -> ${tokenA}`,
        profitPercentage,
        estimatedProfitUSD,
        executionPath: `${tokenA} -> ${tokenB} -> ${tokenC} -> ${tokenA}`,
        confidence,
        riskLevel,
        gasEstimate,
        timestamp: Date.now()
      };
      
    } catch (error) {
      logger.error(`Error checking triangular path ${tokenA}->${tokenB}->${tokenC}->${tokenA}:`, error);
      return null;
    }
  }

  /**
   * Extract unique tokens from price data
   */
  private extractUniqueTokens(priceData: Map<string, UltraFastPriceData[]>): string[] {
    const tokens = new Set<string>();
    
    for (const [pairKey, prices] of priceData.entries()) {
      const [tokenA, tokenB] = pairKey.split('-');
      tokens.add(tokenA);
      tokens.add(tokenB);
    }
    
    return Array.from(tokens);
  }

  /**
   * Get best price for a token pair
   */
  private getBestPrice(priceData: Map<string, UltraFastPriceData[]>, tokenA: string, tokenB: string): UltraFastPriceData | null {
    const pairKey = `${tokenA}-${tokenB}`;
    const prices = priceData.get(pairKey);
    
    if (!prices || prices.length === 0) {
      return null;
    }
    
    // Return the price with highest confidence
    return prices.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
  }

  /**
   * Calculate swap output amount
   */
  private calculateSwapOutput(amountIn: ethers.BigNumber, price: ethers.BigNumber, liquidity: ethers.BigNumber): ethers.BigNumber {
    // Simplified calculation - in production, use actual DEX formulas
    const priceImpact = amountIn.mul(1000).div(liquidity); // 0.1% impact per 1% of liquidity
    const adjustedPrice = price.mul(1000 - priceImpact.toNumber()).div(1000);
    return amountIn.mul(adjustedPrice).div(ethers.utils.parseEther('1'));
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(priceAB: UltraFastPriceData, priceBC: UltraFastPriceData, priceCA: UltraFastPriceData): number {
    const avgConfidence = (priceAB.confidence + priceBC.confidence + priceCA.confidence) / 3;
    const avgLiquidity = (parseFloat(ethers.utils.formatEther(priceAB.liquidity)) + 
                         parseFloat(ethers.utils.formatEther(priceBC.liquidity)) + 
                         parseFloat(ethers.utils.formatEther(priceCA.liquidity))) / 3;
    
    const liquidityScore = Math.min(avgLiquidity / 1000, 1); // Normalize to 0-1
    const latencyScore = Math.max(0, 1 - (priceAB.latency + priceBC.latency + priceCA.latency) / 300); // Penalize high latency
    
    return (avgConfidence + liquidityScore + latencyScore) / 3;
  }

  /**
   * Calculate gas estimate
   */
  private calculateGasEstimate(): number {
    // Triangular arbitrage requires 3 swaps + flash loan
    return 400000; // Estimated gas for 3 swaps
  }

  /**
   * Determine risk level
   */
  private determineRiskLevel(profitPercentage: number, confidence: number, gasEstimate: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
    const gasCostUSD = (gasEstimate * 20 * 1e-9) * 2000; // Approximate gas cost in USD
    
    if (profitPercentage >= 2.0 && confidence >= 0.9 && gasCostUSD <= 20) {
      return 'LOW';
    } else if (profitPercentage >= 1.0 && confidence >= 0.8 && gasCostUSD <= 30) {
      return 'MEDIUM';
    } else if (profitPercentage >= 0.5 && confidence >= 0.7 && gasCostUSD <= 40) {
      return 'HIGH';
    } else {
      return 'EXTREME';
    }
  }
}