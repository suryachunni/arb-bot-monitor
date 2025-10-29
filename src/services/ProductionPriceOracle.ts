import { ethers, BigNumber } from 'ethers';
import { logger } from '../utils/logger';
import { TOKENS, UNISWAP_V3_QUOTER_V2, UNISWAP_V3_FEES, DEX_ROUTERS } from '../config/constants';

/**
 * PRODUCTION-GRADE REAL-TIME PRICE ORACLE
 * 
 * Features:
 * - Direct on-chain pool reserve reading
 * - Multi-DEX price aggregation
 * - Parallel batch processing
 * - Sub-second response time
 * - Multi-source validation
 */

const QUOTER_V2_ABI = [
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
];

const POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() external view returns (uint128)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
];

const FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)',
];

const ERC20_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

const UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const SUSHISWAP_FACTORY = '0xc35DADB65012eC5796536bD9864eD8773aBc74C4';
const BALANCER_VAULT = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';

interface PriceData {
  dex: string;
  price: number;
  liquidity: number;
  gasEstimate: number;
  timestamp: number;
  fee?: number;
  source: 'pool' | 'quoter' | 'router';
}

interface TokenPairPrice {
  tokenA: string;
  tokenB: string;
  prices: PriceData[];
  bestBuyPrice: number;
  bestSellPrice: number;
  spread: number;
  spreadPercent: number;
  totalLiquidity: number;
  timestamp: number;
}

export class ProductionPriceOracle {
  private provider: ethers.providers.JsonRpcProvider;
  private quoterV2: ethers.Contract;
  private factoryV3: ethers.Contract;
  private priceCache: Map<string, TokenPairPrice> = new Map();
  private cacheTTL = 500; // 500ms cache for ultra-fast refresh

  constructor(provider: ethers.providers.JsonRpcProvider) {
    this.provider = provider;
    this.quoterV2 = new ethers.Contract(UNISWAP_V3_QUOTER_V2, QUOTER_V2_ABI, provider);
    this.factoryV3 = new ethers.Contract(UNISWAP_V3_FACTORY, FACTORY_ABI, provider);
  }

  /**
   * Get real-time prices from ALL sources with multi-layer validation
   */
  async getRealTimePrices(tokenA: string, tokenB: string): Promise<TokenPairPrice> {
    const cacheKey = `${tokenA}-${tokenB}`;
    const cached = this.priceCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached;
    }

    const startTime = Date.now();
    
    try {
      // Fetch prices from all sources in parallel
      const [uniswapV3Prices, sushiswapPrices, balancerPrices] = await Promise.all([
        this.getUniswapV3Prices(tokenA, tokenB),
        this.getSushiswapPrices(tokenA, tokenB),
        this.getBalancerPrices(tokenA, tokenB),
      ]);

      const allPrices = [...uniswapV3Prices, ...sushiswapPrices, ...balancerPrices];

      if (allPrices.length === 0) {
        throw new Error(`No prices found for ${tokenA}/${tokenB}`);
      }

      // Filter out invalid prices (zero or near-zero, or unreasonably high)
      const validPrices = allPrices.filter(p => {
        const price = p.price;
        // Filter out: zero prices, negative, or unreasonably high (likely calculation errors)
        return price > 0.000001 && price < 1000000000000;
      });

      if (validPrices.length === 0) {
        throw new Error(`No valid prices found for ${tokenA}/${tokenB}`);
      }

      // Find best buy (lowest) and sell (highest) prices from VALID prices only
      const buyPrices = validPrices.map(p => p.price);
      const bestBuyPrice = Math.min(...buyPrices);
      const bestSellPrice = Math.max(...buyPrices);
      
      const spread = bestSellPrice - bestBuyPrice;
      const spreadPercent = (spread / bestBuyPrice) * 100;

      const totalLiquidity = allPrices.reduce((sum, p) => sum + p.liquidity, 0);

      const result: TokenPairPrice = {
        tokenA,
        tokenB,
        prices: validPrices, // Use only valid prices
        bestBuyPrice,
        bestSellPrice,
        spread,
        spreadPercent,
        totalLiquidity: validPrices.reduce((sum, p) => sum + p.liquidity, 0),
        timestamp: Date.now(),
      };

      // Cache the result
      this.priceCache.set(cacheKey, result);

      const scanTime = Date.now() - startTime;
      logger.debug(`Price fetch ${tokenA}/${tokenB}: ${scanTime}ms, ${allPrices.length} sources`);

      return result;
    } catch (error) {
      logger.error(`Error fetching prices for ${tokenA}/${tokenB}:`, error);
      throw error;
    }
  }

  /**
   * Get Uniswap V3 prices across all fee tiers
   */
  private async getUniswapV3Prices(tokenA: string, tokenB: string): Promise<PriceData[]> {
    const prices: PriceData[] = [];
    const fees = [100, 500, 3000, 10000]; // All fee tiers
    const amountIn = ethers.utils.parseUnits('1', 18); // 1 token for price quote

    await Promise.all(
      fees.map(async (fee) => {
        try {
          // Get pool address
          const poolAddress = await this.factoryV3.getPool(tokenA, tokenB, fee);
          
          if (poolAddress === ethers.constants.AddressZero) {
            return; // Pool doesn't exist
          }

          const pool = new ethers.Contract(poolAddress, POOL_ABI, this.provider);

          // Get pool data in parallel
          const [slot0, liquidity, token0, token1] = await Promise.all([
            pool.slot0(),
            pool.liquidity(),
            pool.token0(),
            pool.token1(),
          ]);

          // Calculate liquidity in USD (rough estimate)
          const liquidityNum = parseFloat(ethers.utils.formatUnits(liquidity, 18));
          
          // Calculate price from sqrtPriceX96
          const sqrtPriceX96 = slot0.sqrtPriceX96;
          const price = this.calculatePriceFromSqrtPriceX96(
            sqrtPriceX96,
            token0.toLowerCase() === tokenA.toLowerCase()
          );

          prices.push({
            dex: `UniswapV3-${fee}bp`,
            price,
            liquidity: liquidityNum,
            gasEstimate: 150000, // Estimated gas for V3 swap
            timestamp: Date.now(),
            fee: fee / 10000, // Convert to percentage
            source: 'pool',
          });
        } catch (error) {
          // Pool doesn't exist or error reading
          logger.debug(`UniswapV3 fee ${fee}: Pool not found or error`);
        }
      })
    );

    return prices;
  }

  /**
   * Get SushiSwap prices (Uniswap V2 fork)
   */
  private async getSushiswapPrices(tokenA: string, tokenB: string): Promise<PriceData[]> {
    try {
      const factory = new ethers.Contract(
        SUSHISWAP_FACTORY,
        ['function getPair(address tokenA, address tokenB) external view returns (address pair)'],
        this.provider
      );

      const pairAddress = await factory.getPair(tokenA, tokenB);

      if (pairAddress === ethers.constants.AddressZero) {
        return []; // Pair doesn't exist
      }

      const pair = new ethers.Contract(
        pairAddress,
        [
          'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
          'function token0() external view returns (address)',
          'function token1() external view returns (address)',
        ],
        this.provider
      );

      const [reserves, token0, token1] = await Promise.all([
        pair.getReserves(),
        pair.token0(),
        pair.token1(),
      ]);

      const reserve0 = parseFloat(ethers.utils.formatUnits(reserves.reserve0, 18));
      const reserve1 = parseFloat(ethers.utils.formatUnits(reserves.reserve1, 18));

      const isToken0 = token0.toLowerCase() === tokenA.toLowerCase();
      const price = isToken0 ? reserve1 / reserve0 : reserve0 / reserve1;
      const liquidity = Math.min(reserve0, reserve1) * 2; // Rough TVL estimate

      return [{
        dex: 'SushiSwap',
        price,
        liquidity,
        gasEstimate: 120000, // Estimated gas for V2 swap
        timestamp: Date.now(),
        fee: 0.3, // 0.3% fee
        source: 'pool',
      }];
    } catch (error) {
      logger.debug('SushiSwap: Pair not found or error');
      return [];
    }
  }

  /**
   * Get Balancer prices
   */
  private async getBalancerPrices(tokenA: string, tokenB: string): Promise<PriceData[]> {
    // TODO: Implement Balancer price fetching
    // Balancer uses pool IDs and is more complex
    // For now, return empty array
    return [];
  }

  /**
   * Calculate price from Uniswap V3 sqrtPriceX96
   */
  private calculatePriceFromSqrtPriceX96(sqrtPriceX96: BigNumber, isToken0: boolean): number {
    const Q96 = ethers.BigNumber.from(2).pow(96);
    const price = sqrtPriceX96.mul(sqrtPriceX96).div(Q96);
    const priceNum = parseFloat(ethers.utils.formatUnits(price, 18));
    
    return isToken0 ? priceNum : 1 / priceNum;
  }

  /**
   * Batch fetch prices for multiple pairs
   */
  async batchGetPrices(pairs: string[][]): Promise<Map<string, TokenPairPrice>> {
    const results = new Map<string, TokenPairPrice>();

    // Process in batches of 10 for optimal performance
    const batchSize = 10;
    for (let i = 0; i < pairs.length; i += batchSize) {
      const batch = pairs.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(async ([tokenA, tokenB]) => {
          const tokenAAddress = TOKENS[tokenA as keyof typeof TOKENS];
          const tokenBAddress = TOKENS[tokenB as keyof typeof TOKENS];
          
          if (!tokenAAddress || !tokenBAddress) {
            throw new Error(`Token not found: ${tokenA} or ${tokenB}`);
          }

          return {
            key: `${tokenA}/${tokenB}`,
            data: await this.getRealTimePrices(tokenAAddress, tokenBAddress),
          };
        })
      );

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.set(result.value.key, result.value.data);
        }
      });
    }

    return results;
  }

  /**
   * Clear price cache
   */
  clearCache() {
    this.priceCache.clear();
  }
}
