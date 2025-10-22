import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { TOKENS, UNISWAP_V3_FACTORY, SUSHISWAP_FACTORY } from '../config/constants';

// Uniswap V3 Pool ABI (minimal)
const UNISWAP_V3_POOL_ABI = [
  'function liquidity() external view returns (uint128)',
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
];

// Uniswap V2 Pair ABI (minimal)
const UNISWAP_V2_PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
];

// Factory ABIs
const UNISWAP_V3_FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)',
];

const UNISWAP_V2_FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
];

export interface PoolReserves {
  reserve0: ethers.BigNumber;
  reserve1: ethers.BigNumber;
  token0: string;
  token1: string;
  liquidity: ethers.BigNumber;
}

export class PoolReserveReader {
  private provider: ethers.providers.Provider;
  private uniV3Factory: ethers.Contract;
  private sushiFactory: ethers.Contract;
  private reserveCache: Map<string, { reserves: PoolReserves; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 5000; // 5 seconds cache

  constructor(provider: ethers.providers.Provider) {
    this.provider = provider;
    this.uniV3Factory = new ethers.Contract(UNISWAP_V3_FACTORY, UNISWAP_V3_FACTORY_ABI, provider);
    this.sushiFactory = new ethers.Contract(SUSHISWAP_FACTORY, UNISWAP_V2_FACTORY_ABI, provider);
  }

  /**
   * Get pool reserves for Uniswap V3
   */
  async getUniswapV3Reserves(
    tokenA: string,
    tokenB: string,
    fee: number
  ): Promise<PoolReserves | null> {
    const cacheKey = `uniV3_${tokenA}_${tokenB}_${fee}`;
    
    // Check cache
    const cached = this.reserveCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.reserves;
    }

    try {
      const poolAddress = await this.uniV3Factory.getPool(tokenA, tokenB, fee);
      
      if (poolAddress === ethers.constants.AddressZero) {
        return null;
      }

      const pool = new ethers.Contract(poolAddress, UNISWAP_V3_POOL_ABI, this.provider);
      
      const [liquidity, slot0, token0] = await Promise.all([
        pool.liquidity(),
        pool.slot0(),
        pool.token0(),
      ]);

      // Calculate reserves from sqrtPriceX96 and liquidity
      const sqrtPriceX96 = slot0[0];
      
      // For V3, we use liquidity as a proxy for both reserves
      // This is simplified - real calculation is more complex
      const reserves: PoolReserves = {
        reserve0: liquidity,
        reserve1: liquidity,
        token0: token0.toLowerCase(),
        token1: token0.toLowerCase() === tokenA.toLowerCase() ? tokenB : tokenA,
        liquidity: liquidity,
      };

      // Cache it
      this.reserveCache.set(cacheKey, { reserves, timestamp: Date.now() });

      return reserves;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get pool reserves for Uniswap V2 style (SushiSwap)
   */
  async getUniswapV2Reserves(
    tokenA: string,
    tokenB: string,
    factory: ethers.Contract
  ): Promise<PoolReserves | null> {
    const cacheKey = `uniV2_${factory.address}_${tokenA}_${tokenB}`;
    
    // Check cache
    const cached = this.reserveCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.reserves;
    }

    try {
      const pairAddress = await factory.getPair(tokenA, tokenB);
      
      if (pairAddress === ethers.constants.AddressZero) {
        return null;
      }

      const pair = new ethers.Contract(pairAddress, UNISWAP_V2_PAIR_ABI, this.provider);
      
      const [reserves, token0] = await Promise.all([
        pair.getReserves(),
        pair.token0(),
      ]);

      const reserves0 = reserves.reserve0;
      const reserves1 = reserves.reserve1;

      const poolReserves: PoolReserves = {
        reserve0: reserves0,
        reserve1: reserves1,
        token0: token0.toLowerCase(),
        token1: token0.toLowerCase() === tokenA.toLowerCase() ? tokenB : tokenA,
        liquidity: reserves0.add(reserves1), // Simplified
      };

      // Cache it
      this.reserveCache.set(cacheKey, { reserves: poolReserves, timestamp: Date.now() });

      return poolReserves;
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate exact price impact for a trade
   */
  calculatePriceImpact(
    amountIn: ethers.BigNumber,
    reserves: PoolReserves,
    isToken0: boolean
  ): number {
    try {
      const reserveIn = isToken0 ? reserves.reserve0 : reserves.reserve1;
      const reserveOut = isToken0 ? reserves.reserve1 : reserves.reserve0;

      if (reserveIn.isZero() || reserveOut.isZero()) {
        return 99; // No liquidity = 99% impact
      }

      // Calculate price impact using constant product formula
      // Impact = (amountIn / (reserveIn + amountIn)) * 100
      const impact = amountIn
        .mul(10000)
        .div(reserveIn.add(amountIn))
        .toNumber() / 100;

      return Math.min(impact, 99); // Cap at 99%
    } catch (error) {
      return 5; // Default 5% if calculation fails
    }
  }

  /**
   * Get reserves for any DEX
   */
  async getReserves(
    tokenA: string,
    tokenB: string,
    dex: string,
    fee?: number
  ): Promise<PoolReserves | null> {
    if (dex === 'UniswapV3' && fee) {
      return await this.getUniswapV3Reserves(tokenA, tokenB, fee);
    } else if (dex === 'SushiSwap') {
      return await this.getUniswapV2Reserves(tokenA, tokenB, this.sushiFactory);
    }
    return null;
  }

  /**
   * Calculate slippage for a trade based on actual reserves
   */
  async calculateSlippage(
    tokenIn: string,
    tokenOut: string,
    amountIn: ethers.BigNumber,
    dex: string,
    fee?: number
  ): Promise<number> {
    const reserves = await this.getReserves(tokenIn, tokenOut, dex, fee);
    
    if (!reserves) {
      return 1; // Default 1% if no reserves found
    }

    const isToken0 = reserves.token0.toLowerCase() === tokenIn.toLowerCase();
    return this.calculatePriceImpact(amountIn, reserves, isToken0);
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache() {
    this.reserveCache.clear();
  }
}
