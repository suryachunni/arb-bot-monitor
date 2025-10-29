/**
 * ═══════════════════════════════════════════════════════════════════
 * REAL-TIME PRICE AGGREGATOR
 * Ultra-fast price fetching with WebSocket support
 * ═══════════════════════════════════════════════════════════════════
 */

import { ethers, Contract, BigNumber } from 'ethers';
import WebSocket from 'ws';
import { productionConfig } from '../config/production.config';

export interface TokenPrice {
  token0: string;
  token1: string;
  dex: string;
  price: number;
  liquidity: string;
  timestamp: number;
  blockNumber: number;
}

export interface PriceUpdate {
  pair: string;
  prices: Map<string, TokenPrice>;
  spread: number;
  bestBuy: TokenPrice;
  bestSell: TokenPrice;
}

/**
 * Real-time price aggregator using multiple methods for maximum speed
 */
export class RealtimePriceAggregator {
  private provider: ethers.providers.JsonRpcProvider;
  private wsProvider: ethers.providers.WebSocketProvider | null = null;
  private priceCache: Map<string, Map<string, TokenPrice>> = new Map();
  private listeners: Map<string, ((update: PriceUpdate) => void)[]> = new Map();
  private isRunning: boolean = false;
  
  // DEX contract addresses
  private readonly DEXS = {
    UNISWAP_V3: {
      name: 'Uniswap V3',
      factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
    },
    SUSHISWAP: {
      name: 'SushiSwap',
      factory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
      router: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    },
    CAMELOT: {
      name: 'Camelot',
      factory: '0x6EcCab422D763aC031210895C81787E87B43A652',
      router: '0xc873fEcbd354f5A56E00E710B90EF4201db2448d',
    },
  };

  // ABIs (minimal for gas efficiency)
  private readonly PAIR_ABI = [
    'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
    'function token0() external view returns (address)',
    'function token1() external view returns (address)',
  ];

  private readonly FACTORY_ABI = [
    'function getPair(address tokenA, address tokenB) external view returns (address pair)',
  ];

  private readonly QUOTER_ABI = [
    'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)',
  ];

  constructor() {
    // Initialize HTTP provider
    this.provider = new ethers.providers.JsonRpcProvider(
      productionConfig.network.rpcUrl,
      productionConfig.network.chainId
    );

    // Initialize WebSocket provider for real-time updates
    this.initializeWebSocket();
  }

  /**
   * Initialize WebSocket connection for real-time block updates
   */
  private async initializeWebSocket() {
    try {
      const wsUrl = productionConfig.network.rpcUrl.replace('https://', 'wss://');
      this.wsProvider = new ethers.providers.WebSocketProvider(
        wsUrl,
        productionConfig.network.chainId
      );

      console.log('✅ WebSocket connected for real-time updates');
    } catch (error) {
      console.warn('⚠️  WebSocket connection failed, using HTTP polling:', error);
      this.wsProvider = null;
    }
  }

  /**
   * Get real-time price for a token pair across all DEXs
   */
  async getPricesForPair(
    token0: string,
    token1: string,
    amountIn: BigNumber = ethers.utils.parseEther('1')
  ): Promise<Map<string, TokenPrice>> {
    const prices = new Map<string, TokenPrice>();
    const blockNumber = await this.provider.getBlockNumber();

    // Fetch prices from all DEXs in parallel for maximum speed
    const pricePromises = [
      this.getUniswapV3Price(token0, token1, amountIn, blockNumber),
      this.getSushiSwapPrice(token0, token1, amountIn, blockNumber),
      this.getCamelotPrice(token0, token1, amountIn, blockNumber),
    ];

    const results = await Promise.allSettled(pricePromises);

    // Process results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        const dexNames = ['Uniswap V3', 'SushiSwap', 'Camelot'];
        prices.set(dexNames[index], result.value);
      }
    });

    return prices;
  }

  /**
   * Get Uniswap V3 price (most accurate, supports multiple fee tiers)
   */
  private async getUniswapV3Price(
    token0: string,
    token1: string,
    amountIn: BigNumber,
    blockNumber: number
  ): Promise<TokenPrice | null> {
    try {
      const quoter = new Contract(
        this.DEXS.UNISWAP_V3.quoter,
        this.QUOTER_ABI,
        this.provider
      );

      // Try different fee tiers (3000 = 0.3%, 500 = 0.05%, 10000 = 1%)
      const feeTiers = [3000, 500, 10000];
      
      for (const fee of feeTiers) {
        try {
          const amountOut = await quoter.callStatic.quoteExactInputSingle(
            token0,
            token1,
            fee,
            amountIn,
            0
          );

          if (amountOut.gt(0)) {
            const price = parseFloat(ethers.utils.formatEther(amountOut)) / 
                         parseFloat(ethers.utils.formatEther(amountIn));

            return {
              token0,
              token1,
              dex: 'Uniswap V3',
              price,
              liquidity: amountOut.toString(),
              timestamp: Date.now(),
              blockNumber,
            };
          }
        } catch (e) {
          // Try next fee tier
          continue;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get SushiSwap price (V2 style)
   */
  private async getSushiSwapPrice(
    token0: string,
    token1: string,
    amountIn: BigNumber,
    blockNumber: number
  ): Promise<TokenPrice | null> {
    try {
      const factory = new Contract(
        this.DEXS.SUSHISWAP.factory,
        this.FACTORY_ABI,
        this.provider
      );

      const pairAddress = await factory.getPair(token0, token1);
      
      if (pairAddress === ethers.constants.AddressZero) {
        return null;
      }

      const pair = new Contract(pairAddress, this.PAIR_ABI, this.provider);
      const [reserve0, reserve1] = await pair.getReserves();

      if (reserve0.eq(0) || reserve1.eq(0)) {
        return null;
      }

      // Calculate price with 0.3% fee
      const amountInWithFee = amountIn.mul(997);
      const numerator = amountInWithFee.mul(reserve1);
      const denominator = reserve0.mul(1000).add(amountInWithFee);
      const amountOut = numerator.div(denominator);

      const price = parseFloat(ethers.utils.formatEther(amountOut)) / 
                   parseFloat(ethers.utils.formatEther(amountIn));

      return {
        token0,
        token1,
        dex: 'SushiSwap',
        price,
        liquidity: reserve1.toString(),
        timestamp: Date.now(),
        blockNumber,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get Camelot price (V2 style)
   */
  private async getCamelotPrice(
    token0: string,
    token1: string,
    amountIn: BigNumber,
    blockNumber: number
  ): Promise<TokenPrice | null> {
    try {
      const factory = new Contract(
        this.DEXS.CAMELOT.factory,
        this.FACTORY_ABI,
        this.provider
      );

      const pairAddress = await factory.getPair(token0, token1);
      
      if (pairAddress === ethers.constants.AddressZero) {
        return null;
      }

      const pair = new Contract(pairAddress, this.PAIR_ABI, this.provider);
      const [reserve0, reserve1] = await pair.getReserves();

      if (reserve0.eq(0) || reserve1.eq(0)) {
        return null;
      }

      // Calculate price with 0.3% fee
      const amountInWithFee = amountIn.mul(997);
      const numerator = amountInWithFee.mul(reserve1);
      const denominator = reserve0.mul(1000).add(amountInWithFee);
      const amountOut = numerator.div(denominator);

      const price = parseFloat(ethers.utils.formatEther(amountOut)) / 
                   parseFloat(ethers.utils.formatEther(amountIn));

      return {
        token0,
        token1,
        dex: 'Camelot',
        price,
        liquidity: reserve1.toString(),
        timestamp: Date.now(),
        blockNumber,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate spread and best prices
   */
  calculateSpread(prices: Map<string, TokenPrice>): PriceUpdate | null {
    if (prices.size < 2) {
      return null;
    }

    const priceArray = Array.from(prices.values());
    priceArray.sort((a, b) => a.price - b.price);

    const bestBuy = priceArray[0]; // Lowest price (best to buy)
    const bestSell = priceArray[priceArray.length - 1]; // Highest price (best to sell)

    const spread = ((bestSell.price - bestBuy.price) / bestBuy.price) * 100;

    return {
      pair: `${bestBuy.token0}-${bestBuy.token1}`,
      prices,
      spread,
      bestBuy,
      bestSell,
    };
  }

  /**
   * Start real-time price monitoring for specific pairs
   */
  async startMonitoring(pairs: Array<{ token0: string; token1: string }>) {
    if (this.isRunning) {
      console.warn('Price monitoring already running');
      return;
    }

    this.isRunning = true;
    console.log(`📊 Starting real-time price monitoring for ${pairs.length} pairs...`);

    // Monitor each pair
    for (const pair of pairs) {
      this.monitorPair(pair.token0, pair.token1);
    }
  }

  /**
   * Monitor a specific pair in real-time
   */
  private async monitorPair(token0: string, token1: string) {
    const pairKey = `${token0}-${token1}`;

    const updatePrices = async () => {
      if (!this.isRunning) return;

      try {
        const prices = await this.getPricesForPair(token0, token1);
        this.priceCache.set(pairKey, prices);

        const update = this.calculateSpread(prices);
        if (update) {
          // Notify all listeners
          const listeners = this.listeners.get(pairKey) || [];
          listeners.forEach(listener => listener(update));
        }
      } catch (error) {
        console.error(`Error updating prices for ${pairKey}:`, error);
      }

      // Schedule next update
      setTimeout(updatePrices, productionConfig.scanning.priceUpdateIntervalMs);
    };

    // Start monitoring
    updatePrices();
  }

  /**
   * Subscribe to price updates for a pair
   */
  onPriceUpdate(
    token0: string,
    token1: string,
    callback: (update: PriceUpdate) => void
  ) {
    const pairKey = `${token0}-${token1}`;
    const listeners = this.listeners.get(pairKey) || [];
    listeners.push(callback);
    this.listeners.set(pairKey, listeners);
  }

  /**
   * Get cached prices (instant, no network call)
   */
  getCachedPrices(token0: string, token1: string): Map<string, TokenPrice> | null {
    const pairKey = `${token0}-${token1}`;
    return this.priceCache.get(pairKey) || null;
  }

  /**
   * Stop monitoring
   */
  stop() {
    this.isRunning = false;
    if (this.wsProvider) {
      this.wsProvider.removeAllListeners();
    }
    console.log('🛑 Price monitoring stopped');
  }
}
