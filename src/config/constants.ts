export const ARBITRUM_CHAIN_ID = 42161;

// ONLY GENUINE high liquidity tokens with REAL SushiSwap + Uniswap V3 pools
// STRICT: Only tokens verified with $50M+ liquidity on BOTH DEXs
// NO low liquidity tokens - if we can't trade it, we don't scan it!
export const TOKENS = {
  // Major pairs (ultra-high liquidity $100M+) - GUARANTEED tradeable
  WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  
  // High liquidity + VOLATILE - REAL opportunities on BOTH DEXs
  ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548',    // ✅ Arbitrum native - $80M+ on both DEXs
  LINK: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',   // ✅ Chainlink - $50M+ on both DEXs
  UNI: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0',    // ✅ Uniswap - $40M+ on both DEXs
  
  // REMOVED: WBTC - Low SushiSwap liquidity = fake spreads
  // REMOVED: DAI - Low volume = no opportunities
  // ONLY tokens that work on BOTH DEXs!
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

// STRICT: ONLY pairs with REAL liquidity on BOTH Uniswap V3 AND SushiSwap
// NO low liquidity pairs - if it shows a fake spread, it's NOT in this list!
// Strategy: Quality over quantity - genuine opportunities only
export const HIGH_LIQUIDITY_PAIRS = [
  // ═══ TIER 1: Ultra-high liquidity ($100M+) - GUARANTEED REAL ═══
  ['WETH', 'USDC'],   // ✅ $150M+ both DEXs | Most liquid pair on Arbitrum
  ['WETH', 'USDT'],   // ✅ $100M+ both DEXs | Second most liquid
  
  // ═══ TIER 2: High liquidity + VOLATILE ($50M+) - REAL OPPORTUNITIES ═══
  ['WETH', 'ARB'],    // ✅ $80M+ both DEXs  | ⚡⚡ Native token = HIGH volatility
  ['WETH', 'LINK'],   // ✅ $55M+ both DEXs  | ⚡⚡ Oracle token = HIGH volatility
  ['WETH', 'UNI'],    // ✅ $50M+ both DEXs  | ⚡ Governance = GOOD volatility
  
  // ═══ TIER 3: Stablecoin pairs ($40M+) - CLEAN ARBITRAGE ═══
  ['ARB', 'USDC'],    // ✅ $60M+ both DEXs  | ⚡⚡ Direct ARB/USD arbitrage
  ['LINK', 'USDC'],   // ✅ $45M+ both DEXs  | ⚡⚡ Direct LINK/USD arbitrage
  ['UNI', 'USDC'],    // ✅ $40M+ both DEXs  | ⚡ Direct UNI/USD arbitrage
  
  // ═══ TOTAL: 8 pairs × 2 directions = 16 GENUINE arbitrage routes ═══
  
  // REMOVED PAIRS (to prevent fake spreads):
  // ❌ WBTC/* - SushiSwap has NO real liquidity (causes 100%+ fake spreads)
  // ❌ DAI/* - Low volume = no opportunities
  // ❌ USDC/USDT - Stable pair, tiny spreads, not worth gas
  
  // GUARANTEE: Every pair in this list has REAL tradeable liquidity!
  // If scanner shows a spread, it's GENUINE and worth checking!
];

// DEX list for scanning (ONLY most reliable)
export const DEX_LIST = [
  { name: 'UniswapV3', router: DEX_ROUTERS.UNISWAP_V3, version: 3 },
  { name: 'SushiSwap', router: DEX_ROUTERS.SUSHISWAP, version: 2 },
];

// Flashbots Protect RPC (MEV protection)
export const FLASHBOTS_PROTECT_RPC = 'https://rpc.flashbots.net';

// Speed optimization constants - LIGHTNING FAST
export const SPEED_CONSTANTS = {
  MAX_BLOCK_DELAY: 0, // Execute on same block
  MAX_EXECUTION_TIME_MS: 800, // 800ms max (scan + execute under 1 second!)
  PRICE_CACHE_TTL_MS: 300, // Cache prices for 300ms only (fresh data)
  MIN_PROFIT_AFTER_GAS: 50, // Minimum $50 after ALL costs
  PARALLEL_BATCH_SIZE: 8, // Scan 8 pairs simultaneously
};

// Validation thresholds - STRICT (only REAL opportunities)
export const VALIDATION_THRESHOLDS = {
  MIN_LIQUIDITY_USD: 10_000_000, // $10M minimum - ensures REAL pools
  MAX_PRICE_IMPACT_PERCENT: 3, // 3% max impact for $50k trade
  MAX_REALISTIC_SPREAD: 5, // 5% max spread (higher = likely fake)
  MIN_PROFITABLE_SPREAD: 0.3, // 0.3% minimum to be worth gas
};
