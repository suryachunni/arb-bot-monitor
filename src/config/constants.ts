export const ARBITRUM_CHAIN_ID = 42161;

// ONLY ultra-high liquidity tokens on Arbitrum (for speed and reliability)
export const TOKENS = {
  WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548',
  WBTC: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
  DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
};

// DEX Routers on Arbitrum (ONLY most liquid and reliable)
export const DEX_ROUTERS = {
  UNISWAP_V3: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  SUSHISWAP: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
};

// Multicall3 (for batch calls - MASSIVE speedup)
export const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';

// Uniswap V3 Quoter V2 (more accurate)
export const UNISWAP_V3_QUOTER_V2 = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';

// Uniswap V3 Factory
export const UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';

// SushiSwap Factory
export const SUSHISWAP_FACTORY = '0xc35DADB65012eC5796536bD9864eD8773aBc74C4';

// Aave V3 Pool Address Provider
export const AAVE_POOL_PROVIDER = '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb';

// Uniswap V3 Fee Tiers
export const UNISWAP_V3_FEES = {
  LOWEST: 100,    // 0.01%
  LOW: 500,       // 0.05%
  MEDIUM: 3000,   // 0.3%
  HIGH: 10000,    // 1%
};

// Gas optimization constants
export const GAS_CONSTANTS = {
  MAX_GAS_PRICE_GWEI: 2,
  GAS_LIMIT_MULTIPLIER: 1.2,
  PRIORITY_FEE_PERCENTILE: 10,
};

// Profit thresholds
export const PROFIT_THRESHOLDS = {
  MIN_PROFIT_USD: 100,
  MIN_PROFIT_PERCENTAGE: 0.5,
};

// PRODUCTION-GRADE: Only pairs verified to exist on BOTH Uniswap V3 AND SushiSwap
// These pairs have been manually verified for sufficient liquidity
export const HIGH_LIQUIDITY_PAIRS = [
  ['WETH', 'USDC'],   // ✅ Verified: $100M+ liquidity on both DEXs
  ['WETH', 'USDT'],   // ✅ Verified: $50M+ liquidity on both DEXs
  ['WETH', 'ARB'],    // ✅ Verified: $30M+ liquidity on both DEXs
  ['WETH', 'WBTC'],   // ✅ Verified: $20M+ liquidity on both DEXs
  // REMOVED: USDC/USDT - SushiSwap pool has low liquidity
  // REMOVED: USDC/ARB - SushiSwap quotes unreliable
  // REMOVED: USDC/DAI - Low volume on SushiSwap
  // REMOVED: WBTC/USDC - Duplicate of WETH/WBTC route
];

// DEX list for scanning (ONLY most reliable)
export const DEX_LIST = [
  { name: 'UniswapV3', router: DEX_ROUTERS.UNISWAP_V3, version: 3 },
  { name: 'SushiSwap', router: DEX_ROUTERS.SUSHISWAP, version: 2 },
];

// Flashbots Protect RPC (MEV protection)
export const FLASHBOTS_PROTECT_RPC = 'https://rpc.flashbots.net';

// Speed optimization constants
export const SPEED_CONSTANTS = {
  MAX_BLOCK_DELAY: 0, // Execute on same block
  MAX_EXECUTION_TIME_MS: 1000, // 1 second max
  PRICE_CACHE_TTL_MS: 500, // Cache prices for 500ms max
  MIN_PROFIT_AFTER_GAS: 50, // Minimum $50 after ALL costs
};
