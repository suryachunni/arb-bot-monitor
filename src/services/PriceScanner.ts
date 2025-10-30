import { BigNumber, Contract, ethers } from 'ethers';
import { logger } from '../utils/logger';
import {
  DEXES,
  DexType,
  HIGH_LIQUIDITY_PAIRS,
  MULTICALL3_ADDRESS,
  TOKENS,
  TRIANGULAR_ROUTES,
  TokenMetadata,
  TokenPair,
  UNISWAP_V3_FEE_TIERS,
  UNISWAP_V3_QUOTER_V2,
} from '../config/constants';
import { config } from '../config/config';

const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[])',
];

const UNISWAP_V3_POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() view returns (uint128)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function fee() view returns (uint24)',
];

const UNISWAP_V3_FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)',
];

const UNISWAP_V2_FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) view returns (address)',
];

const UNISWAP_V2_PAIR_ABI = [
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
];

const UNISWAP_V3_QUOTER_ABI = [
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)',
];

const UNISWAP_V2_ROUTER_ABI = [
  'function getAmountsOut(uint256 amountIn, address[] calldata path) view returns (uint256[] memory amounts)',
];

const Q96 = Math.pow(2, 96);

export interface PoolSnapshot {
  poolAddress: string;
  dex: DexType;
  feeTier?: number;
  token0: TokenMetadata;
  token1: TokenMetadata;
  priceToken1PerToken0: number;
  priceToken0PerToken1: number;
  liquidity: number;
  reserve0?: number;
  reserve1?: number;
  blockNumber: number;
}

export interface TokenPairQuote {
  pair: TokenPair;
  baseToken: TokenMetadata;
  quoteToken: TokenMetadata;
  dex: DexType;
  feeTier?: number;
  priceBaseToQuote: number;
  priceQuoteToBase: number;
  poolAddress: string;
  liquidity: number;
  blockNumber: number;
}

export interface MarketSnapshot {
  blockNumber: number;
  fetchedAt: number;
  pools: PoolSnapshot[];
  directQuotes: TokenPairQuote[];
}

interface UniswapV3PoolDescriptor {
  poolAddress: string;
  fee: number;
  symbols: [string, string];
}

interface SushiPoolDescriptor {
  pairAddress: string;
  token0: TokenMetadata;
  token1: TokenMetadata;
}

const pairKey = (tokenA: string, tokenB: string): string => {
  return [tokenA.toLowerCase(), tokenB.toLowerCase()].sort().join('-');
};

const toFloat = (value: BigNumber, decimals: number): number => {
  return parseFloat(ethers.utils.formatUnits(value, decimals));
};

const computePriceFromSqrtPrice = (
  sqrtPriceX96: BigNumber,
  decimalsToken0: number,
  decimalsToken1: number
): { priceToken1PerToken0: number; priceToken0PerToken1: number } => {
  const sqrt = parseFloat(ethers.utils.formatUnits(sqrtPriceX96, 96));
  const ratio = sqrt * sqrt;
  const decimalFactor = Math.pow(10, decimalsToken0 - decimalsToken1);
  const priceToken1PerToken0 = ratio * decimalFactor;
  const priceToken0PerToken1 = priceToken1PerToken0 === 0 ? 0 : 1 / priceToken1PerToken0;
  return { priceToken1PerToken0, priceToken0PerToken1 };
};

const uniqueBy = <T>(items: T[], selector: (item: T) => string): T[] => {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = selector(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
};

const chunkArray = <T>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

export class PriceScanner {
  private provider: ethers.providers.JsonRpcProvider;
  private multicall: Contract;
  private uniswapV3Factory: Contract;
  private sushiFactory: Contract;
  private uniswapQuoter: Contract;
  private sushiRouter: Contract;

  private uniswapPoolCache: Map<string, UniswapV3PoolDescriptor[]> = new Map();
  private sushiPairCache: Map<string, SushiPoolDescriptor> = new Map();

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.network.rpcUrl);
    this.multicall = new Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, this.provider);
    this.uniswapV3Factory = new Contract(DEXES.UniswapV3.factory!, UNISWAP_V3_FACTORY_ABI, this.provider);
    this.sushiFactory = new Contract(DEXES.SushiSwap.factory!, UNISWAP_V2_FACTORY_ABI, this.provider);
    this.uniswapQuoter = new Contract(UNISWAP_V3_QUOTER_V2, UNISWAP_V3_QUOTER_ABI, this.provider);
    this.sushiRouter = new Contract(DEXES.SushiSwap.router!, UNISWAP_V2_ROUTER_ABI, this.provider);
  }

  async scan(): Promise<MarketSnapshot> {
    await this.ensurePoolsCached();

    const blockNumber = await this.provider.getBlockNumber();
    const fetchedAt = Date.now();

    const uniswapSnapshots = await this.fetchUniswapPoolStates(blockNumber);
    const sushiSnapshots = await this.fetchSushiPoolStates(blockNumber);

    const pools = [...uniswapSnapshots, ...sushiSnapshots];

    const directQuotes = this.buildDirectQuotes(pools);

    logger.info(
      `Scanned ${pools.length} pools across ${directQuotes.length} direct pair quotes (block ${blockNumber})`
    );

    return {
      blockNumber,
      fetchedAt,
      pools,
      directQuotes,
    };
  }

  getCachedPairs(): TokenPair[] {
    return HIGH_LIQUIDITY_PAIRS;
  }

  getTriangularRoutes() {
    return TRIANGULAR_ROUTES;
  }

  async verifyUniswapQuote(
    tokenIn: TokenMetadata,
    tokenOut: TokenMetadata,
    amountIn: BigNumber,
    fee: number
  ): Promise<BigNumber | null> {
    try {
      const amountOut = await this.uniswapQuoter.callStatic.quoteExactInputSingle(
        tokenIn.address,
        tokenOut.address,
        fee,
        amountIn,
        0
      );
      return amountOut;
    } catch (error) {
      logger.debug(`Uniswap v3 quote failed ${tokenIn.symbol}->${tokenOut.symbol} fee ${fee}: ${error}`);
      return null;
    }
  }

  async quoteSwap(
    dex: DexType,
    tokenIn: TokenMetadata,
    tokenOut: TokenMetadata,
    amountIn: BigNumber,
    fee?: number
  ): Promise<BigNumber | null> {
    if (amountIn.lte(0)) return null;

    if (dex === 'UniswapV3') {
      if (!fee) return null;
      return this.verifyUniswapQuote(tokenIn, tokenOut, amountIn, fee);
    }

    if (dex === 'SushiSwap') {
      try {
        const path = [tokenIn.address, tokenOut.address];
        const amounts = await this.sushiRouter.getAmountsOut(amountIn, path);
        return amounts[amounts.length - 1];
      } catch (error) {
        logger.debug(`SushiSwap quote failed ${tokenIn.symbol}->${tokenOut.symbol}: ${error}`);
        return null;
      }
    }

    // TODO: add Balancer / Curve quoting via vault APIs
    return null;
  }

  private async ensurePoolsCached() {
    if (this.uniswapPoolCache.size === 0) {
      await this.populateUniswapPools();
    }
    if (this.sushiPairCache.size === 0) {
      await this.populateSushiPairs();
    }
  }

  private async populateUniswapPools() {
    const calls = [] as any[];
    const iface = this.uniswapV3Factory.interface;

    for (const pair of HIGH_LIQUIDITY_PAIRS) {
      const tokenA = TOKENS[pair.base];
      const tokenB = TOKENS[pair.quote];
      if (!tokenA || !tokenB) continue;

      for (const fee of UNISWAP_V3_FEE_TIERS) {
        const key = `${pairKey(tokenA.address, tokenB.address)}::${fee}`;
        const callData = iface.encodeFunctionData('getPool', [tokenA.address, tokenB.address, fee]);
        calls.push({
          target: this.uniswapV3Factory.address,
          allowFailure: true,
          callData,
          meta: { key, pair, fee },
        });
      }
    }

    const responses = await this.executeMulticall(calls);

    responses.forEach(({ success, returnData, meta }) => {
      if (!success || !returnData) return;
      const poolAddress = iface.decodeFunctionResult('getPool', returnData)[0];
      if (poolAddress === ethers.constants.AddressZero) return;

      const { pair, fee } = meta as { pair: TokenPair; fee: number };
      const tokenA = TOKENS[pair.base];
      const tokenB = TOKENS[pair.quote];
      if (!tokenA || !tokenB) return;

      const key = pairKey(tokenA.address, tokenB.address);
      const current = this.uniswapPoolCache.get(key) || [];
      current.push({
        poolAddress,
        fee,
        symbols: [pair.base, pair.quote],
      });
      this.uniswapPoolCache.set(key, current);
    });

    for (const [key, pools] of this.uniswapPoolCache.entries()) {
      this.uniswapPoolCache.set(
        key,
        uniqueBy(pools, (pool) => pool.poolAddress.toLowerCase())
      );
    }

    logger.info(`Cached ${this.uniswapPoolCache.size} Uniswap v3 pool groups`);
  }

  private async populateSushiPairs() {
    const calls: any[] = [];
    const iface = this.sushiFactory.interface;

    for (const pair of HIGH_LIQUIDITY_PAIRS) {
      const tokenA = TOKENS[pair.base];
      const tokenB = TOKENS[pair.quote];
      if (!tokenA || !tokenB) continue;

      const callData = iface.encodeFunctionData('getPair', [tokenA.address, tokenB.address]);
      calls.push({
        target: this.sushiFactory.address,
        allowFailure: true,
        callData,
        meta: { pair },
      });
    }

    const responses = await this.executeMulticall(calls);

    responses.forEach(({ success, returnData, meta }) => {
      if (!success || !returnData) return;
      const pairAddress = iface.decodeFunctionResult('getPair', returnData)[0];
      if (pairAddress === ethers.constants.AddressZero) return;

      const { pair } = meta as { pair: TokenPair };
      const tokenA = TOKENS[pair.base];
      const tokenB = TOKENS[pair.quote];
      if (!tokenA || !tokenB) return;

      const key = pairKey(tokenA.address, tokenB.address);
      this.sushiPairCache.set(key, {
        pairAddress,
        token0: tokenA,
        token1: tokenB,
      });
    });

    logger.info(`Cached ${this.sushiPairCache.size} SushiSwap pairs`);
  }

  private async fetchUniswapPoolStates(blockNumber: number): Promise<PoolSnapshot[]> {
    const iface = new ethers.utils.Interface(UNISWAP_V3_POOL_ABI);
    const calls: any[] = [];

    for (const pools of this.uniswapPoolCache.values()) {
      for (const pool of pools) {
        calls.push({
          target: pool.poolAddress,
          allowFailure: true,
          callData: iface.encodeFunctionData('slot0'),
          meta: { pool, type: 'slot0' },
        });
        calls.push({
          target: pool.poolAddress,
          allowFailure: true,
          callData: iface.encodeFunctionData('liquidity'),
          meta: { pool, type: 'liquidity' },
        });
        calls.push({
          target: pool.poolAddress,
          allowFailure: true,
          callData: iface.encodeFunctionData('token0'),
          meta: { pool, type: 'token0' },
        });
        calls.push({
          target: pool.poolAddress,
          allowFailure: true,
          callData: iface.encodeFunctionData('token1'),
          meta: { pool, type: 'token1' },
        });
      }
    }

    const responses = await this.executeMulticall(calls, blockNumber);

    const slot0Map = new Map<string, any>();
    const liquidityMap = new Map<string, BigNumber>();
    const token0Map = new Map<string, string>();
    const token1Map = new Map<string, string>();

    responses.forEach(({ success, returnData, meta }) => {
      if (!success || !returnData) return;
      const key = meta.pool.poolAddress.toLowerCase();
      if (meta.type === 'slot0') {
        const decoded = iface.decodeFunctionResult('slot0', returnData);
        slot0Map.set(key, decoded);
      } else if (meta.type === 'liquidity') {
        const liquidity = iface.decodeFunctionResult('liquidity', returnData)[0] as BigNumber;
        liquidityMap.set(key, liquidity);
      } else if (meta.type === 'token0') {
        const [address] = iface.decodeFunctionResult('token0', returnData);
        token0Map.set(key, address.toLowerCase());
      } else if (meta.type === 'token1') {
        const [address] = iface.decodeFunctionResult('token1', returnData);
        token1Map.set(key, address.toLowerCase());
      }
    });

    const snapshots: PoolSnapshot[] = [];

    for (const pools of this.uniswapPoolCache.values()) {
      for (const descriptor of pools) {
        const key = descriptor.poolAddress.toLowerCase();
        const slot0 = slot0Map.get(key);
        const liquidity = liquidityMap.get(key);
        const token0Address = token0Map.get(key);
        const token1Address = token1Map.get(key);
        if (!slot0 || !liquidity || !token0Address || !token1Address) continue;

        const token0 = this.findTokenByAddress(token0Address);
        const token1 = this.findTokenByAddress(token1Address);
        if (!token0 || !token1) continue;

        const sqrtPriceX96 = slot0[0] as BigNumber;
        const { priceToken1PerToken0, priceToken0PerToken1 } = computePriceFromSqrtPrice(
          sqrtPriceX96,
          token0.decimals,
          token1.decimals
        );

        snapshots.push({
          poolAddress: descriptor.poolAddress,
          dex: 'UniswapV3',
          feeTier: descriptor.fee,
          token0,
          token1,
          priceToken1PerToken0,
          priceToken0PerToken1,
          liquidity: parseFloat(ethers.utils.formatUnits(liquidity, 18)),
          blockNumber,
        });
      }
    }

    return snapshots;
  }

  private async fetchSushiPoolStates(blockNumber: number): Promise<PoolSnapshot[]> {
    const iface = new ethers.utils.Interface(UNISWAP_V2_PAIR_ABI);
    const calls: any[] = [];

    for (const descriptor of this.sushiPairCache.values()) {
      calls.push({
        target: descriptor.pairAddress,
        allowFailure: true,
        callData: iface.encodeFunctionData('getReserves'),
        meta: { descriptor },
      });
      calls.push({
        target: descriptor.pairAddress,
        allowFailure: true,
        callData: iface.encodeFunctionData('token0'),
        meta: { descriptor, type: 'token0' },
      });
      calls.push({
        target: descriptor.pairAddress,
        allowFailure: true,
        callData: iface.encodeFunctionData('token1'),
        meta: { descriptor, type: 'token1' },
      });
    }

    const responses = await this.executeMulticall(calls, blockNumber);

    const reserveMap = new Map<string, { reserve0: BigNumber; reserve1: BigNumber }>();
    const token0Map = new Map<string, string>();
    const token1Map = new Map<string, string>();

    responses.forEach(({ success, returnData, meta }) => {
      if (!success || !returnData) return;
      const key = meta.descriptor.pairAddress.toLowerCase();
      if (!meta.type) {
        const [reserve0, reserve1] = iface.decodeFunctionResult('getReserves', returnData) as [BigNumber, BigNumber, number];
        reserveMap.set(key, { reserve0, reserve1 });
      } else if (meta.type === 'token0') {
        const [address] = iface.decodeFunctionResult('token0', returnData);
        token0Map.set(key, address.toLowerCase());
      } else if (meta.type === 'token1') {
        const [address] = iface.decodeFunctionResult('token1', returnData);
        token1Map.set(key, address.toLowerCase());
      }
    });

    const snapshots: PoolSnapshot[] = [];

    for (const descriptor of this.sushiPairCache.values()) {
      const key = descriptor.pairAddress.toLowerCase();
      const reserves = reserveMap.get(key);
      const token0Addr = token0Map.get(key);
      const token1Addr = token1Map.get(key);
      if (!reserves || !token0Addr || !token1Addr) continue;

      const token0 = this.findTokenByAddress(token0Addr);
      const token1 = this.findTokenByAddress(token1Addr);
      if (!token0 || !token1) continue;

      const reserve0 = toFloat(reserves.reserve0, token0.decimals);
      const reserve1 = toFloat(reserves.reserve1, token1.decimals);
      if (reserve0 === 0 || reserve1 === 0) continue;

      const priceToken1PerToken0 = reserve1 / reserve0;
      const priceToken0PerToken1 = reserve0 / reserve1;

      snapshots.push({
        poolAddress: descriptor.pairAddress,
        dex: 'SushiSwap',
        token0,
        token1,
        priceToken1PerToken0,
        priceToken0PerToken1,
        liquidity: reserve0 + reserve1,
        reserve0,
        reserve1,
        blockNumber,
      });
    }

    return snapshots;
  }

  private buildDirectQuotes(pools: PoolSnapshot[]): TokenPairQuote[] {
    const quotes: TokenPairQuote[] = [];

    for (const pool of pools) {
      const pairs = HIGH_LIQUIDITY_PAIRS.filter((pair) => {
        const tokenA = TOKENS[pair.base];
        const tokenB = TOKENS[pair.quote];
        if (!tokenA || !tokenB) return false;
        const addresses = [tokenA.address.toLowerCase(), tokenB.address.toLowerCase()];
        return (
          addresses.includes(pool.token0.address.toLowerCase()) &&
          addresses.includes(pool.token1.address.toLowerCase())
        );
      });

      for (const pair of pairs) {
        const baseToken = TOKENS[pair.base];
        const quoteToken = TOKENS[pair.quote];
        if (!baseToken || !quoteToken) continue;

        const isToken0Base = pool.token0.address.toLowerCase() === baseToken.address.toLowerCase();

        const priceBaseToQuote = isToken0Base
          ? pool.priceToken1PerToken0
          : pool.priceToken0PerToken1;
        const priceQuoteToBase = priceBaseToQuote === 0 ? 0 : 1 / priceBaseToQuote;

        quotes.push({
          pair,
          baseToken,
          quoteToken,
          dex: pool.dex,
          feeTier: pool.feeTier,
          priceBaseToQuote,
          priceQuoteToBase,
          poolAddress: pool.poolAddress,
          liquidity: pool.liquidity,
          blockNumber: pool.blockNumber,
        });
      }
    }

    return quotes;
  }

  private async executeMulticall(calls: any[], blockTag?: number) {
    if (calls.length === 0) return [];

    const batches = chunkArray(calls, config.monitoring.multicallBatchSize || 20);
    const results: Array<{ success: boolean; returnData: string; meta: any }> = [];

    for (const batch of batches) {
      const formattedCalls = batch.map((call) => ({
        target: call.target,
        allowFailure: call.allowFailure ?? true,
        callData: call.callData,
      }));

      const response = await this.multicall.aggregate3(formattedCalls, {
        blockTag,
      });

      response.forEach((item: any, idx: number) => {
        results.push({
          success: Boolean(item.success),
          returnData: item.returnData,
          meta: batch[idx].meta,
        });
      });
    }

    return results;
  }

  private findTokenByAddress(address: string): TokenMetadata | undefined {
    const lower = address.toLowerCase();
    return Object.values(TOKENS).find((token) => token.address.toLowerCase() === lower);
  }
}
