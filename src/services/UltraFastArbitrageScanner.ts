/**
 * ═══════════════════════════════════════════════════════════════════
 * ULTRA-FAST ARBITRAGE SCANNER
 * Bidirectional arbitrage detection with real-time pricing
 * ═══════════════════════════════════════════════════════════════════
 */

import { BigNumber, ethers } from 'ethers';
import { RealtimePriceAggregator, TokenPrice, PriceUpdate } from './RealtimePriceAggregator';
import { productionConfig } from '../config/production.config';
import { getTokenInfo, supportsFlashLoan, getTokenSymbol } from '../config/tokens.config';

export interface ArbitrageOpportunity {
  // Pair info
  token0: string;
  token1: string;
  token0Symbol: string;
  token1Symbol: string;
  
  // Direction (A->B->A or B->A->B)
  direction: 'forward' | 'reverse';
  
  // DEXs
  buyDex: string;
  sellDex: string;
  
  // Prices
  buyPrice: number;
  sellPrice: number;
  spread: number;
  spreadPercentage: number;
  
  // Flash loan details
  flashLoanToken: string;
  flashLoanAmount: BigNumber;
  flashLoanAmountUSD: number;
  
  // Profit estimation
  estimatedProfit: BigNumber;
  estimatedProfitUSD: number;
  profitPercentage: number;
  
  // Costs
  flashLoanFee: BigNumber;
  estimatedGasCost: BigNumber;
  totalCosts: BigNumber;
  
  // Net profit (after all costs)
  netProfit: BigNumber;
  netProfitUSD: number;
  netProfitPercentage: number;
  
  // Execution data
  minAmountOut1: BigNumber; // Slippage protection for first swap
  minAmountOut2: BigNumber; // Slippage protection for second swap
  deadline: number;
  
  // Metadata
  timestamp: number;
  blockNumber: number;
  confidence: number; // 0-100 score
}

/**
 * Ultra-fast arbitrage scanner with bidirectional detection
 */
export class UltraFastArbitrageScanner {
  private priceAggregator: RealtimePriceAggregator;
  private provider: ethers.providers.JsonRpcProvider;
  private ethPrice: number = 2000; // Default ETH price, updated in real-time
  
  constructor() {
    this.priceAggregator = new RealtimePriceAggregator();
    this.provider = new ethers.providers.JsonRpcProvider(
      productionConfig.network.rpcUrl,
      productionConfig.network.chainId
    );
    
    // Update ETH price periodically
    this.updateEthPrice();
    setInterval(() => this.updateEthPrice(), 60000); // Every minute
  }

  /**
   * Update ETH price for gas cost calculations
   */
  private async updateEthPrice() {
    try {
      // Get ETH/USDC price from real-time aggregator
      const WETH = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
      const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
      
      const prices = await this.priceAggregator.getPricesForPair(
        WETH,
        USDC,
        ethers.utils.parseEther('1')
      );
      
      if (prices.size > 0) {
        const avgPrice = Array.from(prices.values())
          .reduce((sum, p) => sum + p.price, 0) / prices.size;
        this.ethPrice = avgPrice;
      }
    } catch (error) {
      console.warn('Failed to update ETH price:', error);
    }
  }

  /**
   * Scan for arbitrage opportunities on a specific pair
   * Checks both directions: A->B->A and B->A->B
   */
  async scanPair(
    token0: string,
    token1: string,
    loanAmountUSD: number = productionConfig.flashLoan.minLoanAmountUSD
  ): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];

    // Get real-time prices from all DEXs
    const prices = await this.priceAggregator.getPricesForPair(
      token0,
      token1,
      ethers.utils.parseEther('1')
    );

    if (prices.size < 2) {
      return opportunities; // Need at least 2 DEXs for arbitrage
    }

    // Check forward direction: Borrow token0, buy token1, sell token1, repay token0
    if (supportsFlashLoan(token0)) {
      const forwardOpp = await this.checkDirection(
        token0,
        token1,
        prices,
        'forward',
        loanAmountUSD
      );
      if (forwardOpp && this.isProfitable(forwardOpp)) {
        opportunities.push(forwardOpp);
      }
    }

    // Check reverse direction: Borrow token1, buy token0, sell token0, repay token1
    if (productionConfig.scanning.enableBidirectional && supportsFlashLoan(token1)) {
      const reverseOpp = await this.checkDirection(
        token1,
        token0,
        prices,
        'reverse',
        loanAmountUSD
      );
      if (reverseOpp && this.isProfitable(reverseOpp)) {
        opportunities.push(reverseOpp);
      }
    }

    return opportunities;
  }

  /**
   * Check arbitrage in a specific direction
   */
  private async checkDirection(
    borrowToken: string,
    targetToken: string,
    prices: Map<string, TokenPrice>,
    direction: 'forward' | 'reverse',
    loanAmountUSD: number
  ): Promise<ArbitrageOpportunity | null> {
    try {
      // Convert prices map based on direction
      const relevantPrices = this.normalizePrices(prices, borrowToken, targetToken, direction);
      
      if (relevantPrices.length < 2) {
        return null;
      }

      // Find best buy and sell prices
      relevantPrices.sort((a, b) => a.price - b.price);
      const buyPrice = relevantPrices[0]; // Lowest price = best to buy
      const sellPrice = relevantPrices[relevantPrices.length - 1]; // Highest price = best to sell

      // Calculate spread
      const spread = sellPrice.price - buyPrice.price;
      const spreadPercentage = (spread / buyPrice.price) * 100;

      // Quick profitability check
      if (spreadPercentage < 0.3) {
        return null; // Not enough spread to be profitable after fees
      }

      // Get token info
      const borrowTokenInfo = getTokenInfo(borrowToken);
      const targetTokenInfo = getTokenInfo(targetToken);
      
      if (!borrowTokenInfo || !targetTokenInfo) {
        return null;
      }

      // Calculate loan amount in token decimals
      const loanAmount = ethers.utils.parseUnits(
        (loanAmountUSD / 1).toString(), // Assuming stablecoin or calculating based on price
        borrowTokenInfo.decimals
      );

      // Simulate the arbitrage
      const simulation = await this.simulateArbitrage(
        borrowToken,
        targetToken,
        loanAmount,
        buyPrice,
        sellPrice
      );

      if (!simulation) {
        return null;
      }

      // Build opportunity object
      const opportunity: ArbitrageOpportunity = {
        token0: borrowToken,
        token1: targetToken,
        token0Symbol: borrowTokenInfo.symbol,
        token1Symbol: targetTokenInfo.symbol,
        direction,
        buyDex: buyPrice.dex,
        sellDex: sellPrice.dex,
        buyPrice: buyPrice.price,
        sellPrice: sellPrice.price,
        spread,
        spreadPercentage,
        flashLoanToken: borrowToken,
        flashLoanAmount: loanAmount,
        flashLoanAmountUSD: loanAmountUSD,
        estimatedProfit: simulation.grossProfit,
        estimatedProfitUSD: parseFloat(ethers.utils.formatUnits(
          simulation.grossProfit,
          borrowTokenInfo.decimals
        )) * (borrowTokenInfo.symbol === 'USDC' || borrowTokenInfo.symbol === 'USDT' ? 1 : this.ethPrice),
        profitPercentage: simulation.profitPercentage,
        flashLoanFee: simulation.flashLoanFee,
        estimatedGasCost: simulation.gasCost,
        totalCosts: simulation.totalCosts,
        netProfit: simulation.netProfit,
        netProfitUSD: simulation.netProfitUSD,
        netProfitPercentage: simulation.netProfitPercentage,
        minAmountOut1: simulation.minAmountOut1,
        minAmountOut2: simulation.minAmountOut2,
        deadline: Math.floor(Date.now() / 1000) + productionConfig.trading.txDeadlineSeconds,
        timestamp: Date.now(),
        blockNumber: buyPrice.blockNumber,
        confidence: this.calculateConfidence(spreadPercentage, simulation.netProfitPercentage),
      };

      return opportunity;
    } catch (error) {
      console.error('Error checking direction:', error);
      return null;
    }
  }

  /**
   * Normalize prices based on direction
   */
  private normalizePrices(
    prices: Map<string, TokenPrice>,
    borrowToken: string,
    targetToken: string,
    direction: 'forward' | 'reverse'
  ): TokenPrice[] {
    return Array.from(prices.values()).map(price => {
      // If direction is reverse, we need to invert the price
      if (direction === 'reverse') {
        return {
          ...price,
          price: 1 / price.price,
          token0: price.token1,
          token1: price.token0,
        };
      }
      return price;
    });
  }

  /**
   * Simulate arbitrage execution with accurate calculations
   */
  private async simulateArbitrage(
    borrowToken: string,
    targetToken: string,
    loanAmount: BigNumber,
    buyPrice: TokenPrice,
    sellPrice: TokenPrice
  ) {
    try {
      const borrowTokenInfo = getTokenInfo(borrowToken);
      if (!borrowTokenInfo) return null;

      // Step 1: Calculate first swap (buy targetToken)
      const amountOut1 = loanAmount.mul(Math.floor(buyPrice.price * 1e6)).div(1e6);
      
      // Apply slippage protection (0.5%)
      const slippageBps = productionConfig.trading.maxSlippageBps;
      const minAmountOut1 = amountOut1.mul(10000 - slippageBps).div(10000);

      // Step 2: Calculate second swap (sell targetToken back to borrowToken)
      const amountOut2 = amountOut1.mul(Math.floor(sellPrice.price * 1e6)).div(1e6);
      const minAmountOut2 = amountOut2.mul(10000 - slippageBps).div(10000);

      // Step 3: Calculate flash loan fee (0.05% for Aave V3)
      const flashLoanFee = loanAmount.mul(productionConfig.flashLoan.aaveFeeBps).div(10000);
      const totalDebt = loanAmount.add(flashLoanFee);

      // Step 4: Calculate gas cost (estimate)
      const gasPrice = await this.provider.getGasPrice();
      const estimatedGas = BigNumber.from(500000); // Typical gas for flash loan arbitrage
      const gasCost = gasPrice.mul(estimatedGas);
      const gasCostInToken = gasCost.mul(Math.floor(this.ethPrice * 1e6)).div(1e6);

      // Step 5: Calculate profit
      const grossProfit = minAmountOut2.sub(totalDebt);
      const totalCosts = flashLoanFee.add(gasCostInToken);
      const netProfit = grossProfit.sub(gasCostInToken);

      // Calculate percentages
      const profitPercentage = parseFloat(grossProfit.toString()) / parseFloat(loanAmount.toString()) * 100;
      const netProfitPercentage = parseFloat(netProfit.toString()) / parseFloat(loanAmount.toString()) * 100;

      // Calculate USD value
      const netProfitUSD = parseFloat(ethers.utils.formatUnits(netProfit, borrowTokenInfo.decimals)) * 
        (borrowTokenInfo.symbol === 'USDC' || borrowTokenInfo.symbol === 'USDT' ? 1 : this.ethPrice);

      return {
        grossProfit,
        netProfit,
        profitPercentage,
        netProfitPercentage,
        netProfitUSD,
        flashLoanFee,
        gasCost,
        totalCosts,
        minAmountOut1,
        minAmountOut2,
      };
    } catch (error) {
      console.error('Simulation error:', error);
      return null;
    }
  }

  /**
   * Check if opportunity is profitable after all costs
   */
  private isProfitable(opportunity: ArbitrageOpportunity): boolean {
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
   * Calculate confidence score (0-100)
   */
  private calculateConfidence(spreadPercentage: number, netProfitPercentage: number): number {
    let score = 0;

    // Spread confidence (max 40 points)
    if (spreadPercentage > 2) score += 40;
    else if (spreadPercentage > 1) score += 30;
    else if (spreadPercentage > 0.5) score += 20;
    else score += 10;

    // Profit confidence (max 40 points)
    if (netProfitPercentage > 1) score += 40;
    else if (netProfitPercentage > 0.5) score += 30;
    else if (netProfitPercentage > 0.3) score += 20;
    else score += 10;

    // Liquidity confidence (max 20 points)
    score += 20; // Assuming high liquidity pairs

    return Math.min(100, score);
  }

  /**
   * Get price aggregator for external use
   */
  getPriceAggregator(): RealtimePriceAggregator {
    return this.priceAggregator;
  }

  /**
   * Scan multiple pairs in parallel
   */
  async scanMultiplePairs(
    pairs: Array<{ token0: string; token1: string; label?: string }>,
    loanAmountUSD?: number
  ): Promise<ArbitrageOpportunity[]> {
    const scanPromises = pairs.map(pair => 
      this.scanPair(pair.token0, pair.token1, loanAmountUSD)
    );

    const results = await Promise.allSettled(scanPromises);
    
    const opportunities: ArbitrageOpportunity[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        opportunities.push(...result.value);
      } else {
        console.error(`Error scanning pair ${pairs[index].label}:`, result.reason);
      }
    });

    // Sort by net profit USD (descending)
    opportunities.sort((a, b) => b.netProfitUSD - a.netProfitUSD);

    return opportunities;
  }
}
