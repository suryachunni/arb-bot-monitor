import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { config } from '../config/config';

export interface LoanCalculation {
  loanAmount: ethers.BigNumber;
  maxLoanAmount: ethers.BigNumber;
  optimalLoanAmount: ethers.BigNumber;
  profitAfterCosts: number;
  roi: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  executionPriority: number;
}

export class DynamicLoanCalculator {
  private readonly MIN_LOAN_USD = 1000; // $1k minimum
  private readonly MAX_LOAN_USD = 2000000; // $2M maximum
  private readonly OPTIMAL_ROI_THRESHOLD = 0.5; // 0.5% minimum ROI
  private readonly HIGH_CONFIDENCE_THRESHOLD = 1.0; // 1% for high confidence trades

  /**
   * Calculate optimal loan amount based on opportunity size and liquidity
   */
  calculateOptimalLoan(
    opportunity: any,
    liquidityData: any,
    gasPrice: ethers.BigNumber
  ): LoanCalculation | null {
    try {
      const { profitPercentage, estimatedProfitUSD, tokenAAddress, tokenBAddress } = opportunity;
      const { liquidityA, liquidityB, priceImpactA, priceImpactB } = liquidityData;

      // Calculate maximum safe loan based on liquidity
      const maxSafeLoanA = this.calculateMaxSafeLoan(liquidityA, priceImpactA);
      const maxSafeLoanB = this.calculateMaxSafeLoan(liquidityB, priceImpactB);
      const maxSafeLoan = maxSafeLoanA.lt(maxSafeLoanB) ? maxSafeLoanA : maxSafeLoanB;

      // Convert to USD for calculations
      const maxSafeLoanUSD = parseFloat(ethers.utils.formatEther(maxSafeLoan)) * 2000; // Approximate ETH price

      // Calculate optimal loan amount based on profit percentage
      let optimalLoanUSD: number;
      
      if (profitPercentage >= this.HIGH_CONFIDENCE_THRESHOLD) {
        // High confidence - use larger loan
        optimalLoanUSD = Math.min(maxSafeLoanUSD * 0.8, this.MAX_LOAN_USD);
      } else if (profitPercentage >= this.OPTIMAL_ROI_THRESHOLD) {
        // Medium confidence - use medium loan
        optimalLoanUSD = Math.min(maxSafeLoanUSD * 0.5, this.MAX_LOAN_USD * 0.5);
      } else {
        // Low confidence - use smaller loan
        optimalLoanUSD = Math.min(maxSafeLoanUSD * 0.2, this.MAX_LOAN_USD * 0.1);
      }

      // Ensure minimum loan amount
      optimalLoanUSD = Math.max(optimalLoanUSD, this.MIN_LOAN_USD);

      // Calculate gas costs
      const gasCostUSD = this.calculateGasCosts(gasPrice);
      
      // Calculate expected profit
      const expectedProfitUSD = (optimalLoanUSD * profitPercentage / 100) - gasCostUSD;
      
      // Calculate ROI
      const roi = (expectedProfitUSD / optimalLoanUSD) * 100;

      // Determine risk level
      const riskLevel = this.determineRiskLevel(profitPercentage, priceImpactA, priceImpactB);
      
      // Calculate execution priority (higher = more urgent)
      const executionPriority = this.calculateExecutionPriority(profitPercentage, riskLevel, expectedProfitUSD);

      // Convert back to token amounts
      const tokenDecimals = 18; // Assume 18 decimals for now
      const optimalLoanAmount = ethers.utils.parseUnits(
        (optimalLoanUSD / 2000).toString(), // Convert USD to ETH
        tokenDecimals
      );

      const maxLoanAmount = ethers.utils.parseUnits(
        (maxSafeLoanUSD / 2000).toString(),
        tokenDecimals
      );

      return {
        loanAmount: optimalLoanAmount,
        maxLoanAmount: maxLoanAmount,
        optimalLoanAmount: optimalLoanAmount,
        profitAfterCosts: expectedProfitUSD,
        roi: roi,
        riskLevel: riskLevel,
        executionPriority: executionPriority
      };

    } catch (error) {
      logger.error('Error calculating optimal loan:', error);
      return null;
    }
  }

  /**
   * Calculate maximum safe loan based on liquidity and price impact
   */
  private calculateMaxSafeLoan(
    liquidity: ethers.BigNumber,
    priceImpact: number
  ): ethers.BigNumber {
    // Maximum 2% price impact
    const maxPriceImpact = 0.02;
    
    if (priceImpact > maxPriceImpact) {
      // Reduce loan size to stay within price impact limits
      const reductionFactor = maxPriceImpact / priceImpact;
      return liquidity.mul(Math.floor(reductionFactor * 1000)).div(1000);
    }
    
    // Use 5% of available liquidity as maximum
    return liquidity.mul(5).div(100);
  }

  /**
   * Calculate gas costs in USD
   */
  private calculateGasCosts(gasPrice: ethers.BigNumber): number {
    const gasLimit = 800000; // Estimated gas for flash loan arbitrage
    const gasCostWei = gasPrice.mul(gasLimit);
    const gasCostETH = parseFloat(ethers.utils.formatEther(gasCostWei));
    const gasCostUSD = gasCostETH * 2000; // Approximate ETH price
    return gasCostUSD;
  }

  /**
   * Determine risk level based on various factors
   */
  private determineRiskLevel(
    profitPercentage: number,
    priceImpactA: number,
    priceImpactB: number
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
    const maxPriceImpact = Math.max(priceImpactA, priceImpactB);
    
    if (profitPercentage >= 2.0 && maxPriceImpact <= 0.01) {
      return 'LOW';
    } else if (profitPercentage >= 1.0 && maxPriceImpact <= 0.02) {
      return 'MEDIUM';
    } else if (profitPercentage >= 0.5 && maxPriceImpact <= 0.05) {
      return 'HIGH';
    } else {
      return 'EXTREME';
    }
  }

  /**
   * Calculate execution priority (higher = more urgent)
   */
  private calculateExecutionPriority(
    profitPercentage: number,
    riskLevel: string,
    expectedProfitUSD: number
  ): number {
    let priority = 0;
    
    // Base priority on profit percentage
    priority += profitPercentage * 100;
    
    // Adjust for risk level
    switch (riskLevel) {
      case 'LOW':
        priority += 50;
        break;
      case 'MEDIUM':
        priority += 30;
        break;
      case 'HIGH':
        priority += 10;
        break;
      case 'EXTREME':
        priority += 0;
        break;
    }
    
    // Adjust for profit amount
    if (expectedProfitUSD >= 1000) {
      priority += 20;
    } else if (expectedProfitUSD >= 500) {
      priority += 10;
    }
    
    return Math.floor(priority);
  }

  /**
   * Validate if loan amount is safe for execution
   */
  validateLoanSafety(
    loanAmount: ethers.BigNumber,
    liquidityData: any
  ): { isSafe: boolean; reason?: string } {
    const { liquidityA, liquidityB, priceImpactA, priceImpactB } = liquidityData;
    
    // Check if loan amount exceeds liquidity limits
    const maxLiquidity = liquidityA.lt(liquidityB) ? liquidityA : liquidityB;
    if (loanAmount.gt(maxLiquidity.mul(10).div(100))) { // Max 10% of liquidity
      return { isSafe: false, reason: 'Loan amount exceeds liquidity limits' };
    }
    
    // Check price impact limits
    const maxPriceImpact = Math.max(priceImpactA, priceImpactB);
    if (maxPriceImpact > 0.05) { // Max 5% price impact
      return { isSafe: false, reason: 'Price impact too high' };
    }
    
    return { isSafe: true };
  }
}