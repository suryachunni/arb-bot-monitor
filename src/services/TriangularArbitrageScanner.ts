/**
 * ═══════════════════════════════════════════════════════════════════
 * TRIANGULAR ARBITRAGE SCANNER
 * Bidirectional 3-token arbitrage loops (A→B→C→A and A→C→B→A)
 * ═══════════════════════════════════════════════════════════════════
 */

import { BigNumber, ethers } from 'ethers';
import { RealtimePriceAggregator } from './RealtimePriceAggregator';
import { productionConfig } from '../config/production.config';
import { getTokenInfo, supportsFlashLoan } from '../config/tokens.config';

export interface TriangularArbitrageOpportunity {
  // Route info
  token0: string; // Start/end token (flash loan token)
  token1: string; // Middle token 1
  token2: string; // Middle token 2
  
  token0Symbol: string;
  token1Symbol: string;
  token2Symbol: string;
  
  // Direction (A→B→C→A or A→C→B→A)
  direction: 'forward' | 'reverse';
  route: string; // e.g., "USDC→WETH→ARB→USDC"
  
  // DEXs for each leg
  dex1: string; // DEX for first swap
  dex2: string; // DEX for second swap
  dex3: string; // DEX for third swap
  
  // Prices for each leg
  price1: number; // Token0 → Token1
  price2: number; // Token1 → Token2
  price3: number; // Token2 → Token0
  
  // Flash loan details
  flashLoanToken: string;
  flashLoanAmount: BigNumber;
  flashLoanAmountUSD: number;
  
  // Amounts through the route
  amount1Out: BigNumber; // After first swap
  amount2Out: BigNumber; // After second swap
  amount3Out: BigNumber; // After third swap (return amount)
  
  // Profit estimation
  grossProfit: BigNumber;
  grossProfitUSD: number;
  profitPercentage: number;
  
  // Costs
  flashLoanFee: BigNumber;
  estimatedGasCost: BigNumber;
  totalCosts: BigNumber;
  
  // Net profit
  netProfit: BigNumber;
  netProfitUSD: number;
  netProfitPercentage: number;
  
  // Execution data
  minAmountOut1: BigNumber;
  minAmountOut2: BigNumber;
  minAmountOut3: BigNumber;
  deadline: number;
  
  // Metadata
  timestamp: number;
  confidence: number; // 0-100
}

/**
 * Triangular arbitrage scanner with bidirectional detection
 */
export class TriangularArbitrageScanner {
  private priceAggregator: RealtimePriceAggregator;
  private provider: ethers.providers.JsonRpcProvider;

  constructor() {
    this.priceAggregator = new RealtimePriceAggregator();
    this.provider = new ethers.providers.JsonRpcProvider(
      productionConfig.network.rpcUrl,
      productionConfig.network.chainId
    );
  }

  /**
   * Scan for triangular arbitrage on a 3-token route
   * Checks both directions: A→B→C→A and A→C→B→A
   */
  async scanTriangularRoute(
    token0: string, // Base token (flash loan)
    token1: string, // Middle token 1
    token2: string, // Middle token 2
    loanAmountUSD: number = productionConfig.flashLoan.minLoanAmountUSD
  ): Promise<TriangularArbitrageOpportunity[]> {
    const opportunities: TriangularArbitrageOpportunity[] = [];

    // Only scan if base token supports flash loans
    if (!supportsFlashLoan(token0)) {
      return opportunities;
    }

    try {
      // Get prices for all three pairs
      const prices01 = await this.priceAggregator.getPricesForPair(token0, token1);
      const prices12 = await this.priceAggregator.getPricesForPair(token1, token2);
      const prices20 = await this.priceAggregator.getPricesForPair(token2, token0);

      if (prices01.size === 0 || prices12.size === 0 || prices20.size === 0) {
        return opportunities; // Missing price data
      }

      // Forward direction: token0 → token1 → token2 → token0
      const forwardOpp = await this.checkTriangularDirection(
        token0, token1, token2,
        prices01, prices12, prices20,
        'forward',
        loanAmountUSD
      );
      if (forwardOpp && this.isProfitable(forwardOpp)) {
        opportunities.push(forwardOpp);
      }

      // Reverse direction: token0 → token2 → token1 → token0
      const reverseOpp = await this.checkTriangularDirection(
        token0, token2, token1,
        prices20, prices12, prices01,
        'reverse',
        loanAmountUSD
      );
      if (reverseOpp && this.isProfitable(reverseOpp)) {
        opportunities.push(reverseOpp);
      }

    } catch (error) {
      console.error('Error in triangular scan:', error);
    }

    return opportunities;
  }

  /**
   * Check triangular arbitrage in a specific direction
   */
  private async checkTriangularDirection(
    token0: string,
    token1: string,
    token2: string,
    prices01: Map<string, any>,
    prices12: Map<string, any>,
    prices20: Map<string, any>,
    direction: 'forward' | 'reverse',
    loanAmountUSD: number
  ): Promise<TriangularArbitrageOpportunity | null> {
    try {
      const token0Info = getTokenInfo(token0);
      const token1Info = getTokenInfo(token1);
      const token2Info = getTokenInfo(token2);

      if (!token0Info || !token1Info || !token2Info) {
        return null;
      }

      // Calculate loan amount
      const loanAmount = ethers.utils.parseUnits(
        loanAmountUSD.toString(),
        token0Info.decimals
      );

      // Find best prices for each leg
      const bestPrice01 = this.findBestPrice(prices01, 'buy'); // Buy token1 with token0
      const bestPrice12 = this.findBestPrice(prices12, 'buy'); // Buy token2 with token1
      const bestPrice20 = this.findBestPrice(prices20, 'buy'); // Buy token0 with token2

      if (!bestPrice01 || !bestPrice12 || !bestPrice20) {
        return null;
      }

      // Simulate the three swaps
      // Swap 1: token0 → token1
      const amount1Out = loanAmount.mul(Math.floor(bestPrice01.price * 1e6)).div(1e6);
      
      // Swap 2: token1 → token2
      const amount2Out = amount1Out.mul(Math.floor(bestPrice12.price * 1e6)).div(1e6);
      
      // Swap 3: token2 → token0
      const amount3Out = amount2Out.mul(Math.floor(bestPrice20.price * 1e6)).div(1e6);

      // Calculate profit
      const flashLoanFee = loanAmount.mul(productionConfig.flashLoan.aaveFeeBps).div(10000);
      const totalDebt = loanAmount.add(flashLoanFee);

      if (amount3Out.lte(totalDebt)) {
        return null; // No profit
      }

      const grossProfit = amount3Out.sub(totalDebt);
      
      // Estimate gas cost (higher for 3 swaps)
      const gasPrice = await this.provider.getGasPrice();
      const estimatedGas = BigNumber.from(800000); // Higher gas for triangular
      const gasCost = gasPrice.mul(estimatedGas);

      const netProfit = grossProfit.sub(gasCost);

      if (netProfit.lte(0)) {
        return null; // Not profitable after gas
      }

      // Calculate USD values
      const grossProfitUSD = parseFloat(ethers.utils.formatUnits(grossProfit, token0Info.decimals)) * 
        (token0Info.symbol === 'USDC' || token0Info.symbol === 'USDT' ? 1 : 2000);
      const netProfitUSD = parseFloat(ethers.utils.formatUnits(netProfit, token0Info.decimals)) * 
        (token0Info.symbol === 'USDC' || token0Info.symbol === 'USDT' ? 1 : 2000);

      // Calculate percentages
      const profitPercentage = parseFloat(grossProfit.toString()) / parseFloat(loanAmount.toString()) * 100;
      const netProfitPercentage = parseFloat(netProfit.toString()) / parseFloat(loanAmount.toString()) * 100;

      // Slippage protection
      const slippageBps = productionConfig.trading.maxSlippageBps;
      const minAmountOut1 = amount1Out.mul(10000 - slippageBps).div(10000);
      const minAmountOut2 = amount2Out.mul(10000 - slippageBps).div(10000);
      const minAmountOut3 = amount3Out.mul(10000 - slippageBps).div(10000);

      // Build opportunity
      const opportunity: TriangularArbitrageOpportunity = {
        token0,
        token1,
        token2,
        token0Symbol: token0Info.symbol,
        token1Symbol: token1Info.symbol,
        token2Symbol: token2Info.symbol,
        direction,
        route: `${token0Info.symbol}→${token1Info.symbol}→${token2Info.symbol}→${token0Info.symbol}`,
        dex1: bestPrice01.dex,
        dex2: bestPrice12.dex,
        dex3: bestPrice20.dex,
        price1: bestPrice01.price,
        price2: bestPrice12.price,
        price3: bestPrice20.price,
        flashLoanToken: token0,
        flashLoanAmount: loanAmount,
        flashLoanAmountUSD: loanAmountUSD,
        amount1Out,
        amount2Out,
        amount3Out,
        grossProfit,
        grossProfitUSD,
        profitPercentage,
        flashLoanFee,
        estimatedGasCost: gasCost,
        totalCosts: flashLoanFee.add(gasCost),
        netProfit,
        netProfitUSD,
        netProfitPercentage,
        minAmountOut1,
        minAmountOut2,
        minAmountOut3,
        deadline: Math.floor(Date.now() / 1000) + productionConfig.trading.txDeadlineSeconds,
        timestamp: Date.now(),
        confidence: this.calculateConfidence(netProfitPercentage),
      };

      return opportunity;

    } catch (error) {
      console.error('Error checking triangular direction:', error);
      return null;
    }
  }

  /**
   * Find best price (lowest for buy)
   */
  private findBestPrice(prices: Map<string, any>, type: 'buy' | 'sell'): { price: number; dex: string } | null {
    if (prices.size === 0) return null;

    const priceArray = Array.from(prices.entries()).map(([dex, data]) => ({
      dex,
      price: data.price,
    }));

    if (type === 'buy') {
      // For buying, we want the lowest price
      priceArray.sort((a, b) => a.price - b.price);
    } else {
      // For selling, we want the highest price
      priceArray.sort((a, b) => b.price - a.price);
    }

    return priceArray[0];
  }

  /**
   * Check if opportunity is profitable
   */
  private isProfitable(opportunity: TriangularArbitrageOpportunity): boolean {
    // Check minimum profit in USD
    if (opportunity.netProfitUSD < productionConfig.flashLoan.minProfitUSD) {
      return false;
    }

    // Check minimum profit percentage
    if (opportunity.netProfitPercentage < productionConfig.flashLoan.minProfitPercentage) {
      return false;
    }

    // Net profit must be positive
    if (opportunity.netProfit.lte(0)) {
      return false;
    }

    return true;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(netProfitPercentage: number): number {
    let score = 50; // Base

    if (netProfitPercentage > 1) score += 30;
    else if (netProfitPercentage > 0.5) score += 20;
    else if (netProfitPercentage > 0.3) score += 10;

    return Math.min(100, score);
  }

  /**
   * Scan multiple triangular routes
   */
  async scanMultipleRoutes(
    routes: Array<{ token0: string; token1: string; token2: string; label?: string }>,
    loanAmountUSD?: number
  ): Promise<TriangularArbitrageOpportunity[]> {
    const scanPromises = routes.map(route =>
      this.scanTriangularRoute(route.token0, route.token1, route.token2, loanAmountUSD)
    );

    const results = await Promise.allSettled(scanPromises);

    const opportunities: TriangularArbitrageOpportunity[] = [];
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        opportunities.push(...result.value);
      }
    });

    // Sort by net profit USD
    opportunities.sort((a, b) => b.netProfitUSD - a.netProfitUSD);

    return opportunities;
  }
}
