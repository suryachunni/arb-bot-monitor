export const ARBITRUM_CHAIN_ID = 42161;

export type DexType = 'UniswapV3' | 'SushiSwap' | 'Balancer' | 'Curve';

export interface TokenMetadata {
  symbol: string;
  address: string;
  decimals: number;
  stable?: boolean;
}

export interface DexMetadata {
  name: DexType;
  version: 'v2' | 'v3' | 'balancer' | 'curve';
  router?: string;
  factory?: string;
  vault?: string;
}

export const TOKENS: Record<string, TokenMetadata> = {
  WETH: {
    symbol: 'WETH',
    address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    decimals: 18,
  },
  WBTC: {
    symbol: 'WBTC',
    address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    decimals: 8,
  },
  USDC: {
    symbol: 'USDC',
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    decimals: 6,
    stable: true,
  },
  USDT: {
    symbol: 'USDT',
    address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    decimals: 6,
    stable: true,
  },
  USDC_E: {
    symbol: 'USDC.e',
    address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    decimals: 6,
    stable: true,
  },
  ARB: {
    symbol: 'ARB',
    address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    decimals: 18,
  },
  LINK: {
    symbol: 'LINK',
    address: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
    decimals: 18,
  },
  UNI: {
    symbol: 'UNI',
    address: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0',
    decimals: 18,
  },
  GMX: {
    symbol: 'GMX',
    address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a',
    decimals: 18,
  },
  PENDLE: {
    symbol: 'PENDLE',
    address: '0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8',
    decimals: 18,
  },
  RDNT: {
    symbol: 'RDNT',
    address: '0x3082CC23568eA640225c2467653dB90e9250AaA0',
    decimals: 18,
  },
};

export const DEXES: Record<DexType, DexMetadata> = {
  UniswapV3: {
    name: 'UniswapV3',
    version: 'v3',
    router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  },
  SushiSwap: {
    name: 'SushiSwap',
    version: 'v2',
    router: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    factory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
  },
  Balancer: {
    name: 'Balancer',
    version: 'balancer',
    vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
  },
  Curve: {
    name: 'Curve',
    version: 'curve',
  },
};

export const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
export const UNISWAP_V3_QUOTER_V2 = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';
export const AAVE_POOL_PROVIDER = '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb';

export const UNISWAP_V3_FEE_TIERS = [100, 500, 3000, 10000] as const;

export interface TokenPair {
  base: string;
  quote: string;
}

export const HIGH_LIQUIDITY_PAIRS: TokenPair[] = [
  { base: 'WETH', quote: 'USDC' },
  { base: 'WETH', quote: 'USDT' },
  { base: 'WETH', quote: 'WBTC' },
  { base: 'WETH', quote: 'ARB' },
  { base: 'WETH', quote: 'LINK' },
  { base: 'WETH', quote: 'UNI' },
  { base: 'WETH', quote: 'GMX' },
  { base: 'WETH', quote: 'PENDLE' },
  { base: 'WETH', quote: 'RDNT' },
  { base: 'ARB', quote: 'USDC' },
  { base: 'WBTC', quote: 'USDC' },
  { base: 'LINK', quote: 'USDC' },
  { base: 'UNI', quote: 'USDC' },
  { base: 'GMX', quote: 'ARB' },
  { base: 'USDC', quote: 'USDT' },
  { base: 'USDC', quote: 'USDC_E' },
  { base: 'PENDLE', quote: 'USDC' },
];

export type TriangularRoute = [string, string, string];

export const TRIANGULAR_ROUTES: TriangularRoute[] = [
  ['WETH', 'USDC', 'ARB'],
  ['WETH', 'USDC', 'LINK'],
  ['WETH', 'USDC', 'UNI'],
  ['WETH', 'USDC', 'GMX'],
  ['WETH', 'USDC', 'WBTC'],
  ['ARB', 'USDC', 'USDT'],
  ['WETH', 'ARB', 'GMX'],
];

export const STABLE_TOKEN_SYMBOLS = ['USDC', 'USDC_E', 'USDT'];
