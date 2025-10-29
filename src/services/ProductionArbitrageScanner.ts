import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { ProductionPriceOracle } from './ProductionPriceOracle';
import { TOKENS, HIGH_LIQUIDITY_PAIRS } from '../config/constants';

/**
 * PRODUCTION-GRADE ARBITRAGE SCANNER
 * 
 * Features:
 * - Bidirectional arbitrage (A→B→A)
 * - Triangular arbitrage (A→B→C→A)
 * - Real-time price validation
 * - Liquidity filtering
 * - Gas cost estimation
 * - Multi-layer profit validation
 */

export interface ArbitrageOpportunity {
  type: 'direct' | 'triangular';
  path: string[];
  tokenAddresses: string[];
  dexPath: string[];
  amountIn: string;
  expectedAmountOut: string;
  profit: number;
  profitUSD: number;
  profitPercentage: number;
  gasEstimate: number;
  gasCostUSD: number;
  netProfitUSD: number;
  spread: number;
  spreadPercent: number;
  liquidity: number;
  timestamp: number;
  priceDetails: {
    token: string;
    dex: string;
    price: number;
    liquidity: number;
  }[];
}

export class ProductionArbitrageScanner {
  private priceOracle: ProductionPriceOracle;
  private minLiquidityUSD: number;
  private minProfitUSD: number;
  private maxGasPriceGwei: number;

  constructor(
    priceOracle: ProductionPriceOracle,
    minLiquidityUSD: number = 5_000_000,
    minProfitUSD: number = 50,
    maxGasPriceGwei: number = 0.5
  ) {
    this.priceOracle = priceOracle;
    this.minLiquidityUSD = minLiquidityUSD;
    this.minProfitUSD = minProfitUSD;
    this.maxGasPriceGwei = maxGasPriceGwei;
  }

  /**
   * Scan for ALL arbitrage opportunities (direct + triangular)
   */
  async scanAllOpportunities(): Promise<ArbitrageOpportunity[]> {
    const startTime = Date.now();
    logger.info('🔍 Starting comprehensive arbitrage scan...');

    try {
      // Run both scans in parallel
      const [directOpps, triangularOpps] = await Promise.all([
        this.scanDirectArbitrage(),
        this.scanTriangularArbitrage(),
      ]);

      const allOpportunities = [...directOpps, ...triangularOpps];

      // Sort by net profit (highest first)
      allOpportunities.sort((a, b) => b.netProfitUSD - a.netProfitUSD);

      const scanTime = Date.now() - startTime;
      logger.info(`✅ Scan complete in ${scanTime}ms. Found ${allOpportunities.length} opportunities.`);

      return allOpportunities;
    } catch (error) {
      logger.error('Error in arbitrage scan:', error);
      return [];
    }
  }

  /**
   * Scan for DIRECT (bidirectional) arbitrage: A→B→A
   * 
   * Example: Buy ETH on UniswapV3, sell on SushiSwap
   */
  private async scanDirectArbitrage(): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];

    try {
      // Fetch all pair prices in batch
      const priceMap = await this.priceOracle.batchGetPrices(HIGH_LIQUIDITY_PAIRS);

      for (const [pairKey, priceData] of priceMap.entries()) {
        // Check liquidity filter
        if (priceData.totalLiquidity < this.minLiquidityUSD) {
          continue;
        }

        // Only process if we have meaningful spread
        if (priceData.spreadPercent < 0.3) {
          continue; // Minimum 0.3% spread
        }

        // Find best buy and sell DEXs
        const sortedByPrice = [...priceData.prices].sort((a, b) => a.price - b.price);
        const bestBuy = sortedByPrice[0];
        const bestSell = sortedByPrice[sortedByPrice.length - 1];

        // Calculate opportunity
        const [tokenA, tokenB] = pairKey.split('/');
        const tokenAAddress = TOKENS[tokenA as keyof typeof TOKENS];
        const tokenBAddress = TOKENS[tokenB as keyof typeof TOKENS];

        // Calculate optimal loan amount based on liquidity
        const loanAmountUSD = this.calculateOptimalLoanAmount(priceData.totalLiquidity);
        const amountIn = ethers.utils.parseUnits(
          (loanAmountUSD / 2000).toFixed(6), // Rough ETH price approximation
          18
        );

        // Calculate expected output
        const expectedAmountOut = amountIn.mul(
          Math.floor((bestSell.price / bestBuy.price) * 1e6)
        ).div(1e6);

        const profit = parseFloat(ethers.utils.formatUnits(expectedAmountOut.sub(amountIn), 18));
        const profitUSD = profit * 2000; // Rough USD value

        // Calculate gas cost
        const gasEstimate = bestBuy.gasEstimate + bestSell.gasEstimate + 100000; // Include flash loan overhead
        const gasCostUSD = await this.estimateGasCost(gasEstimate);

        const netProfitUSD = profitUSD - gasCostUSD;

        // Filter by minimum profit
        if (netProfitUSD < this.minProfitUSD) {
          continue;
        }

        const opportunity: ArbitrageOpportunity = {
          type: 'direct',
          path: [tokenA, tokenB, tokenA],
          tokenAddresses: [tokenAAddress, tokenBAddress, tokenAAddress],
          dexPath: [bestBuy.dex, bestSell.dex],
          amountIn: amountIn.toString(),
          expectedAmountOut: expectedAmountOut.toString(),
          profit,
          profitUSD,
          profitPercentage: (profit / parseFloat(ethers.utils.formatUnits(amountIn, 18))) * 100,
          gasEstimate,
          gasCostUSD,
          netProfitUSD,
          spread: priceData.spread,
          spreadPercent: priceData.spreadPercent,
          liquidity: priceData.totalLiquidity,
          timestamp: Date.now(),
          priceDetails: [
            {
              token: `${tokenA}/${tokenB}`,
              dex: bestBuy.dex,
              price: bestBuy.price,
              liquidity: bestBuy.liquidity,
            },
            {
              token: `${tokenB}/${tokenA}`,
              dex: bestSell.dex,
              price: bestSell.price,
              liquidity: bestSell.liquidity,
            },
          ],
        };

        opportunities.push(opportunity);
      }

      logger.info(`Found ${opportunities.length} direct arbitrage opportunities`);
      return opportunities;
    } catch (error) {
      logger.error('Error scanning direct arbitrage:', error);
      return [];
    }
  }

  /**
   * Scan for TRIANGULAR arbitrage: A→B→C→A
   * 
   * Example: WETH → USDC → ARB → WETH
   */
  private async scanTriangularArbitrage(): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];

    try {
      // Define profitable triangular routes
      const triangularRoutes = [
        // High volume routes
        ['WETH', 'USDC', 'ARB'],
        ['WETH', 'USDC', 'WBTC'],
        ['WETH', 'USDT', 'ARB'],
        ['WETH', 'USDC', 'LINK'],
        ['WETH', 'USDC', 'UNI'],
        ['ARB', 'USDC', 'LINK'],
        ['WBTC', 'USDC', 'WETH'],
        ['WETH', 'ARB', 'USDC'],
        
        // Volatile routes
        ['WETH', 'GMX', 'ARB'],
        ['WETH', 'LINK', 'USDC'],
        ['ARB', 'LINK', 'USDC'],
      ];

      // Scan each route
      for (const route of triangularRoutes) {
        try {
          const opportunity = await this.scanTriangularRoute(route);
          if (opportunity && opportunity.netProfitUSD >= this.minProfitUSD) {
            opportunities.push(opportunity);
          }
        } catch (error) {
          // Skip this route
          logger.debug(`Triangular route ${route.join('→')} failed:`, error);
        }
      }

      logger.info(`Found ${opportunities.length} triangular arbitrage opportunities`);
      return opportunities;
    } catch (error) {
      logger.error('Error scanning triangular arbitrage:', error);
      return [];
    }
  }

  /**
   * Scan a specific triangular route
   */
  private async scanTriangularRoute(route: string[]): Promise<ArbitrageOpportunity | null> {
    const [tokenA, tokenB, tokenC] = route;

    // Get all three pair prices in parallel
    const tokenAAddr = TOKENS[tokenA as keyof typeof TOKENS];
    const tokenBAddr = TOKENS[tokenB as keyof typeof TOKENS];
    const tokenCAddr = TOKENS[tokenC as keyof typeof TOKENS];

    const [priceAB, priceBC, priceCA] = await Promise.all([
      this.priceOracle.getRealTimePrices(tokenAAddr, tokenBAddr),
      this.priceOracle.getRealTimePrices(tokenBAddr, tokenCAddr),
      this.priceOracle.getRealTimePrices(tokenCAddr, tokenAAddr),
    ]);

    // Check liquidity
    const minLiquidity = Math.min(
      priceAB.totalLiquidity,
      priceBC.totalLiquidity,
      priceCA.totalLiquidity
    );

    if (minLiquidity < this.minLiquidityUSD) {
      return null;
    }

    // Find best DEXs for each leg
    const bestAB = priceAB.prices.reduce((best, curr) => 
      curr.price < best.price ? curr : best
    );
    const bestBC = priceBC.prices.reduce((best, curr) =>
      curr.price < best.price ? curr : best
    );
    const bestCA = priceCA.prices.reduce((best, curr) =>
      curr.price < best.price ? curr : best
    );

    // Calculate triangular arbitrage
    const amountIn = ethers.utils.parseUnits('1', 18); // Start with 1 token
    
    // A → B
    const amountB = amountIn.mul(Math.floor(bestAB.bestBuyPrice * 1e6)).div(1e6);
    
    // B → C
    const amountC = amountB.mul(Math.floor(bestBC.bestBuyPrice * 1e6)).div(1e6);
    
    // C → A
    const finalAmount = amountC.mul(Math.floor(bestCA.bestBuyPrice * 1e6)).div(1e6);

    const profit = parseFloat(ethers.utils.formatUnits(finalAmount.sub(amountIn), 18));
    const profitPercentage = (profit / parseFloat(ethers.utils.formatUnits(amountIn, 18))) * 100;

    // Must be profitable
    if (profitPercentage < 0.5) {
      return null;
    }

    const profitUSD = profit * 2000; // Rough estimate

    // Calculate gas cost (3 swaps + flash loan)
    const gasEstimate = bestAB.gasEstimate + bestBC.gasEstimate + bestCA.gasEstimate + 150000;
    const gasCostUSD = await this.estimateGasCost(gasEstimate);

    const netProfitUSD = profitUSD - gasCostUSD;

    return {
      type: 'triangular',
      path: route,
      tokenAddresses: [tokenAAddr, tokenBAddr, tokenCAddr, tokenAAddr],
      dexPath: [bestAB.dex, bestBC.dex, bestCA.dex],
      amountIn: amountIn.toString(),
      expectedAmountOut: finalAmount.toString(),
      profit,
      profitUSD,
      profitPercentage,
      gasEstimate,
      gasCostUSD,
      netProfitUSD,
      spread: 0,
      spreadPercent: profitPercentage,
      liquidity: minLiquidity,
      timestamp: Date.now(),
      priceDetails: [
        {
          token: `${tokenA}/${tokenB}`,
          dex: bestAB.dex,
          price: bestAB.price,
          liquidity: bestAB.liquidity,
        },
        {
          token: `${tokenB}/${tokenC}`,
          dex: bestBC.dex,
          price: bestBC.price,
          liquidity: bestBC.liquidity,
        },
        {
          token: `${tokenC}/${tokenA}`,
          dex: bestCA.dex,
          price: bestCA.price,
          liquidity: bestCA.liquidity,
        },
      ],
    };
  }

  /**
   * Calculate optimal loan amount based on liquidity
   */
  private calculateOptimalLoanAmount(liquidityUSD: number): number {
    // Use 1-5% of liquidity to minimize price impact
    const minLoan = 1000; // $1k minimum
    const maxLoan = 2_000_000; // $2M maximum
    
    const optimalLoan = Math.min(liquidityUSD * 0.03, maxLoan); // 3% of liquidity
    
    return Math.max(optimalLoan, minLoan);
  }

  /**
   * Estimate gas cost in USD
   */
  private async estimateGasCost(gasEstimate: number): Promise<number> {
    try {
      const gasPrice = await this.priceOracle['provider'].getGasPrice();
      const gasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));
      
      // If gas price is too high, return high cost to filter out
      if (gasPriceGwei > this.maxGasPriceGwei) {
        return 10000; // Return high cost to discourage execution
      }

      const gasCostETH = parseFloat(ethers.utils.formatUnits(gasPrice.mul(gasEstimate), 18));
      const ethPriceUSD = 2000; // Rough ETH price
      
      return gasCostETH * ethPriceUSD;
    } catch (error) {
      logger.error('Error estimating gas cost:', error);
      return 50; // Default estimate
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: {
    minLiquidityUSD?: number;
    minProfitUSD?: number;
    maxGasPriceGwei?: number;
  }) {
    if (config.minLiquidityUSD !== undefined) {
      this.minLiquidityUSD = config.minLiquidityUSD;
    }
    if (config.minProfitUSD !== undefined) {
      this.minProfitUSD = config.minProfitUSD;
    }
    if (config.maxGasPriceGwei !== undefined) {
      this.maxGasPriceGwei = config.maxGasPriceGwei;
    }
  }
}
