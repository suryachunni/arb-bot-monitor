import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { config } from '../config/config';

export interface RealPriceData {
  tokenA: string;
  tokenB: string;
  dex: string;
  price: string;
  priceBN: ethers.BigNumber;
  liquidity: string;
  liquidityUSD: number;
  volume24h: string;
  volume24hUSD: number;
  fee: number;
  poolAddress: string;
  timestamp: number;
  confidence: number;
  latency: number;
  isValid: boolean;
}

export interface RealArbitrageOpportunity {
  tokenA: string;
  tokenB: string;
  buyDex: string;
  sellDex: string;
  buyPrice: string;
  sellPrice: string;
  profitPercentage: number;
  estimatedProfitUSD: number;
  buyLiquidityUSD: number;
  sellLiquidityUSD: number;
  recommendedLoanSize: string;
  recommendedLoanSizeUSD: number;
  gasEstimate: number;
  gasCostUSD: number;
  netProfitUSD: number;
  roi: number;
  confidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  executionPriority: number;
  timestamp: number;
  isValid: boolean;
}

export class RealDEXScanner {
  private provider: ethers.providers.JsonRpcProvider;
  private readonly UNISWAP_V3_QUOTER_V2 = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';
  private readonly SUSHISWAP_ROUTER = '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506';
  private readonly CAMELOT_ROUTER = '0xc873fEcbd354f5A56E00E710B90EF4201db2448d';
  
  // Real token addresses on Arbitrum with decimals
  private readonly TOKENS = {
    WETH: { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18 },
    USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
    USDT: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
    ARB: { address: '0x912CE59144191C1204E64559FE8253a0e49E6548', decimals: 18 },
    LINK: { address: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4', decimals: 18 },
    UNI: { address: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0', decimals: 18 },
    GMX: { address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', decimals: 18 }
  };

  private readonly PAIRS = [
    ['WETH', 'USDC'],
    ['WETH', 'USDT'],
    ['ARB', 'USDC'],
    ['ARB', 'USDT'],
    ['LINK', 'WETH'],
    ['UNI', 'WETH'],
    ['GMX', 'WETH']
  ];

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.network.rpcUrl);
  }

  /**
   * Scan real market data with proper validation
   */
  async scanRealMarket(): Promise<{
    prices: RealPriceData[];
    opportunities: RealArbitrageOpportunity[];
    scanTime: number;
    successRate: number;
  }> {
    const startTime = Date.now();
    const prices: RealPriceData[] = [];
    const opportunities: RealArbitrageOpportunity[] = [];

    logger.info('🔍 Starting REAL market scan...');

    try {
      // Scan all pairs across all DEXs
      for (const [tokenA, tokenB] of this.PAIRS) {
        const pairPrices: RealPriceData[] = [];

        // Get Uniswap V3 price
        const uniswapPrice = await this.getUniswapV3Price(tokenA, tokenB);
        if (uniswapPrice && uniswapPrice.isValid) {
          pairPrices.push(uniswapPrice);
        }

        // Get SushiSwap price
        const sushiswapPrice = await this.getSushiswapPrice(tokenA, tokenB);
        if (sushiswapPrice && sushiswapPrice.isValid) {
          pairPrices.push(sushiswapPrice);
        }

        // Get Camelot price
        const camelotPrice = await this.getCamelotPrice(tokenA, tokenB);
        if (camelotPrice && camelotPrice.isValid) {
          pairPrices.push(camelotPrice);
        }

        // Add to prices array
        prices.push(...pairPrices);

        // Check for arbitrage opportunities
        if (pairPrices.length >= 2) {
          const pairOpportunities = this.detectArbitrageOpportunities(pairPrices);
          opportunities.push(...pairOpportunities);
        }
      }

      const scanTime = Date.now() - startTime;
      const successRate = (prices.length / (this.PAIRS.length * 3)) * 100;

      logger.info(`✅ Real scan completed in ${scanTime}ms`);
      logger.info(`📊 Success rate: ${successRate.toFixed(1)}%`);
      logger.info(`💰 Found ${opportunities.length} arbitrage opportunities`);

      return {
        prices,
        opportunities,
        scanTime,
        successRate
      };

    } catch (error) {
      logger.error('Real market scan failed:', error);
      return {
        prices: [],
        opportunities: [],
        scanTime: Date.now() - startTime,
        successRate: 0
      };
    }
  }

  /**
   * Get Uniswap V3 price with proper validation
   */
  private async getUniswapV3Price(tokenA: string, tokenB: string): Promise<RealPriceData | null> {
    try {
      const startTime = Date.now();
      
      const quoter = new ethers.Contract(
        this.UNISWAP_V3_QUOTER_V2,
        [
          'function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) view returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
          'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)'
        ],
        this.provider
      );

      const tokenAInfo = this.TOKENS[tokenA as keyof typeof this.TOKENS];
      const tokenBInfo = this.TOKENS[tokenB as keyof typeof this.TOKENS];
      
      if (!tokenAInfo || !tokenBInfo) {
        return null;
      }

      // Try different fee tiers
      const fees = [3000, 500, 10000]; // 0.3%, 0.05%, 1%
      let bestPrice: ethers.BigNumber | null = null;
      let bestPool = '';
      let bestFee = 0;

      for (const fee of fees) {
        try {
          const poolAddress = await quoter.getPool(tokenAInfo.address, tokenBInfo.address, fee);
          if (poolAddress === '0x0000000000000000000000000000000000000000') {
            continue; // Pool doesn't exist
          }

          const amountIn = ethers.utils.parseUnits('1', tokenAInfo.decimals);
          const params = {
            tokenIn: tokenAInfo.address,
            tokenOut: tokenBInfo.address,
            amountIn: amountIn,
            fee: fee,
            sqrtPriceLimitX96: 0
          };

          const result = await quoter.callStatic.quoteExactInputSingle(params);
          const price = result.amountOut;

          if (!bestPrice || price.gt(bestPrice)) {
            bestPrice = price;
            bestPool = poolAddress;
            bestFee = fee;
          }
        } catch (error) {
          // Pool doesn't exist or other error, try next fee
          continue;
        }
      }

      if (!bestPrice || bestPrice.isZero()) {
        return null;
      }

      // Get pool liquidity
      let liquidity = ethers.BigNumber.from(0);
      try {
        const pool = new ethers.Contract(
          bestPool,
          ['function liquidity() view returns (uint128)'],
          this.provider
        );
        liquidity = await pool.liquidity();
      } catch (error) {
        // Pool might not have liquidity function
      }

      const latency = Date.now() - startTime;
      const price = ethers.utils.formatUnits(bestPrice, tokenBInfo.decimals);
      const liquidityUSD = parseFloat(ethers.utils.formatEther(liquidity)) * 2000; // Approximate ETH price

      return {
        tokenA,
        tokenB,
        dex: 'UniswapV3',
        price,
        priceBN: bestPrice,
        liquidity: ethers.utils.formatEther(liquidity),
        liquidityUSD,
        volume24h: '0', // Would need subgraph
        volume24hUSD: 0,
        fee: bestFee,
        poolAddress: bestPool,
        timestamp: Date.now(),
        confidence: liquidityUSD > 100000 ? 0.9 : 0.5,
        latency,
        isValid: true
      };

    } catch (error) {
      logger.error(`Uniswap V3 price error for ${tokenA}/${tokenB}:`, error);
      return null;
    }
  }

  /**
   * Get SushiSwap price with proper validation
   */
  private async getSushiswapPrice(tokenA: string, tokenB: string): Promise<RealPriceData | null> {
    try {
      const startTime = Date.now();
      
      const router = new ethers.Contract(
        this.SUSHISWAP_ROUTER,
        [
          'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)',
          'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'
        ],
        this.provider
      );

      const tokenAInfo = this.TOKENS[tokenA as keyof typeof this.TOKENS];
      const tokenBInfo = this.TOKENS[tokenB as keyof typeof this.TOKENS];
      
      if (!tokenAInfo || !tokenBInfo) {
        return null;
      }

      const amountIn = ethers.utils.parseUnits('1', tokenAInfo.decimals);
      const path = [tokenAInfo.address, tokenBInfo.address];
      
      const amounts = await router.callStatic.getAmountsOut(amountIn, path);
      const quote = amounts[1];

      if (quote.isZero()) {
        return null;
      }

      // Get reserves for liquidity calculation
      let liquidity = ethers.BigNumber.from(0);
      try {
        const reserves = await router.getReserves();
        liquidity = reserves.reserve0.add(reserves.reserve1);
      } catch (error) {
        // Pool might not exist
      }

      const latency = Date.now() - startTime;
      const price = ethers.utils.formatUnits(quote, tokenBInfo.decimals);
      const liquidityUSD = parseFloat(ethers.utils.formatEther(liquidity)) * 2000;

      return {
        tokenA,
        tokenB,
        dex: 'SushiSwap',
        price,
        priceBN: quote,
        liquidity: ethers.utils.formatEther(liquidity),
        liquidityUSD,
        volume24h: '0',
        volume24hUSD: 0,
        fee: 3000, // SushiSwap uses 0.3% fee
        poolAddress: '0x0000000000000000000000000000000000000000', // Would need to get actual pool
        timestamp: Date.now(),
        confidence: liquidityUSD > 50000 ? 0.8 : 0.4,
        latency,
        isValid: true
      };

    } catch (error) {
      logger.error(`SushiSwap price error for ${tokenA}/${tokenB}:`, error);
      return null;
    }
  }

  /**
   * Get Camelot price with proper validation
   */
  private async getCamelotPrice(tokenA: string, tokenB: string): Promise<RealPriceData | null> {
    try {
      const startTime = Date.now();
      
      const router = new ethers.Contract(
        this.CAMELOT_ROUTER,
        [
          'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)'
        ],
        this.provider
      );

      const tokenAInfo = this.TOKENS[tokenA as keyof typeof this.TOKENS];
      const tokenBInfo = this.TOKENS[tokenB as keyof typeof this.TOKENS];
      
      if (!tokenAInfo || !tokenBInfo) {
        return null;
      }

      const amountIn = ethers.utils.parseUnits('1', tokenAInfo.decimals);
      const path = [tokenAInfo.address, tokenBInfo.address];
      
      const amounts = await router.callStatic.getAmountsOut(amountIn, path);
      const quote = amounts[1];

      if (quote.isZero()) {
        return null;
      }

      const latency = Date.now() - startTime;
      const price = ethers.utils.formatUnits(quote, tokenBInfo.decimals);
      const liquidityUSD = 10000; // Simplified - would need actual pool data

      return {
        tokenA,
        tokenB,
        dex: 'Camelot',
        price,
        priceBN: quote,
        liquidity: '5.0', // Simplified
        liquidityUSD,
        volume24h: '0',
        volume24hUSD: 0,
        fee: 3000,
        poolAddress: '0x0000000000000000000000000000000000000000',
        timestamp: Date.now(),
        confidence: 0.7,
        latency,
        isValid: true
      };

    } catch (error) {
      logger.error(`Camelot price error for ${tokenA}/${tokenB}:`, error);
      return null;
    }
  }

  /**
   * Detect arbitrage opportunities between DEXs
   */
  private detectArbitrageOpportunities(prices: RealPriceData[]): RealArbitrageOpportunity[] {
    const opportunities: RealArbitrageOpportunity[] = [];

    for (let i = 0; i < prices.length; i++) {
      for (let j = 0; j < prices.length; j++) {
        if (i === j) continue;

        const buyPrice = prices[i];
        const sellPrice = prices[j];

        if (buyPrice.dex === sellPrice.dex) continue;

        // Calculate profit percentage
        const profitPercentage = this.calculateProfitPercentage(buyPrice, sellPrice);
        
        if (profitPercentage < 0.5) continue; // Minimum 0.5% profit

        // Calculate recommended loan size
        const loanSize = this.calculateRecommendedLoanSize(buyPrice, sellPrice, profitPercentage);
        
        // Calculate costs
        const gasEstimate = 400000; // Estimated gas for arbitrage
        const gasPrice = ethers.utils.parseUnits('20', 'gwei');
        const gasCostUSD = parseFloat(ethers.utils.formatEther(gasEstimate * gasPrice)) * 2000;

        // Calculate net profit
        const estimatedProfitUSD = (parseFloat(loanSize) * profitPercentage / 100);
        const netProfitUSD = estimatedProfitUSD - gasCostUSD;

        if (netProfitUSD < 50) continue; // Minimum $50 net profit

        const opportunity: RealArbitrageOpportunity = {
          tokenA: buyPrice.tokenA,
          tokenB: buyPrice.tokenB,
          buyDex: buyPrice.dex,
          sellDex: sellPrice.dex,
          buyPrice: buyPrice.price,
          sellPrice: sellPrice.price,
          profitPercentage,
          estimatedProfitUSD,
          buyLiquidityUSD: buyPrice.liquidityUSD,
          sellLiquidityUSD: sellPrice.liquidityUSD,
          recommendedLoanSize: loanSize,
          recommendedLoanSizeUSD: parseFloat(loanSize) * 2000, // Approximate ETH price
          gasEstimate,
          gasCostUSD,
          netProfitUSD,
          roi: (netProfitUSD / (parseFloat(loanSize) * 2000)) * 100,
          confidence: (buyPrice.confidence + sellPrice.confidence) / 2,
          riskLevel: this.determineRiskLevel(profitPercentage, buyPrice.liquidityUSD, sellPrice.liquidityUSD),
          executionPriority: this.calculateExecutionPriority(profitPercentage, netProfitUSD),
          timestamp: Date.now(),
          isValid: true
        };

        opportunities.push(opportunity);
      }
    }

    // Sort by profit percentage
    opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);

    return opportunities;
  }

  /**
   * Calculate profit percentage
   */
  private calculateProfitPercentage(buyPrice: RealPriceData, sellPrice: RealPriceData): number {
    const buyPriceNum = parseFloat(buyPrice.price);
    const sellPriceNum = parseFloat(sellPrice.price);
    
    if (buyPriceNum === 0 || sellPriceNum === 0) return 0;
    
    return ((sellPriceNum - buyPriceNum) / buyPriceNum) * 100;
  }

  /**
   * Calculate recommended loan size
   */
  private calculateRecommendedLoanSize(buyPrice: RealPriceData, sellPrice: RealPriceData, profitPercentage: number): string {
    // Use 5% of the smaller liquidity pool
    const minLiquidity = Math.min(buyPrice.liquidityUSD, sellPrice.liquidityUSD);
    const maxLoanUSD = minLiquidity * 0.05; // 5% of liquidity
    
    // Cap at $100,000 maximum
    const cappedLoanUSD = Math.min(maxLoanUSD, 100000);
    
    // Convert to ETH (approximate)
    const loanETH = cappedLoanUSD / 2000;
    
    return loanETH.toFixed(4);
  }

  /**
   * Determine risk level
   */
  private determineRiskLevel(profitPercentage: number, buyLiquidityUSD: number, sellLiquidityUSD: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
    const minLiquidity = Math.min(buyLiquidityUSD, sellLiquidityUSD);
    
    if (profitPercentage >= 2.0 && minLiquidity >= 100000) {
      return 'LOW';
    } else if (profitPercentage >= 1.0 && minLiquidity >= 50000) {
      return 'MEDIUM';
    } else if (profitPercentage >= 0.5 && minLiquidity >= 10000) {
      return 'HIGH';
    } else {
      return 'EXTREME';
    }
  }

  /**
   * Calculate execution priority
   */
  private calculateExecutionPriority(profitPercentage: number, netProfitUSD: number): number {
    let priority = 0;
    
    // Base priority on profit percentage
    priority += profitPercentage * 100;
    
    // Boost for high profit amounts
    if (netProfitUSD >= 1000) {
      priority += 50;
    } else if (netProfitUSD >= 500) {
      priority += 25;
    }
    
    return Math.floor(priority);
  }
}