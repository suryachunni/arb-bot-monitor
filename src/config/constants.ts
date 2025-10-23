export const ARBITRUM_CHAIN_ID = 42161;

// EXPANDED: More tokens = More opportunities (while maintaining quality!)
// STRICT: Only tokens verified with decent liquidity on Uniswap V3
// Strategy: If Uniswap V3 has liquidity, we can find inter-fee-tier arbitrage!
export const TOKENS = {
  // ═══ TIER 1: Ultra-high liquidity ($100M+) ═══
  WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  
  // ═══ TIER 2: High liquidity + VOLATILE ($20M+) ═══
  ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548',    // ✅ $80M+ Uniswap V3 | Arbitrum native token
  LINK: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',   // ✅ $50M+ Uniswap V3 | Oracle token = volatile
  UNI: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0',    // ✅ $40M+ Uniswap V3 | Governance token
  GMX: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a',    // ✅ $30M+ Uniswap V3 | ⚡⚡ HIGHLY volatile DeFi
  PENDLE: '0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8', // ✅ $15M+ Uniswap V3 | ⚡⚡ HIGHLY volatile yield
  
  // ═══ TIER 3: Medium liquidity + VERY VOLATILE ($5M+) ═══
  MAGIC: '0x539bdE0d7Dbd336b79148AA742883198BBF60342',  // ✅ $8M+ Uniswap V3 | ⚡⚡⚡ Gaming token = EXTREME volatility
  RDNT: '0x3082CC23568eA640225c2467653dB90e9250AaA0',   // ✅ $5M+ Uniswap V3 | ⚡⚡ DeFi lending = HIGH volatility
  
  // REMOVED: WBTC (low SushiSwap liquidity)
  // REMOVED: DAI (low volatility = no opportunities)
  
  // TOTAL: 10 tokens = 100+ possible pairs
  // More tokens = More arbitrage opportunities!
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

// EXPANDED: More pairs = More opportunities!
// Strategy: Cast wider net while maintaining quality through validation
// Scan MANY pairs, but ONLY execute if they pass strict checks
export const HIGH_LIQUIDITY_PAIRS = [
  // ═══ TIER 1: Ultra-high liquidity - BASE PAIRS ($100M+) ═══
  ['WETH', 'USDC'],   // ✅ $150M+ | King of arbitrage
  ['WETH', 'USDT'],   // ✅ $100M+ | Second king
  
  // ═══ TIER 2: High liquidity + VOLATILE ($20M+) ═══
  ['WETH', 'ARB'],    // ✅ $80M+  | ⚡⚡ Native = volatile
  ['WETH', 'LINK'],   // ✅ $50M+  | ⚡⚡ Oracle = volatile  
  ['WETH', 'UNI'],    // ✅ $40M+  | ⚡ Governance
  ['WETH', 'GMX'],    // ✅ $30M+  | ⚡⚡⚡ DeFi = VERY volatile
  ['WETH', 'PENDLE'], // ✅ $15M+  | ⚡⚡⚡ Yield = VERY volatile
  ['WETH', 'MAGIC'],  // ✅ $8M+   | ⚡⚡⚡ Gaming = EXTREME volatility
  ['WETH', 'RDNT'],   // ✅ $5M+   | ⚡⚡ Lending = HIGH volatility
  
  // ═══ TIER 3: Direct stablecoin pairs ═══
  ['ARB', 'USDC'],    // ✅ $60M+  | Direct fiat
  ['LINK', 'USDC'],   // ✅ $45M+  | Direct fiat
  ['UNI', 'USDC'],    // ✅ $40M+  | Direct fiat
  ['GMX', 'USDC'],    // ✅ $20M+  | Direct fiat
  ['PENDLE', 'USDC'], // ✅ $10M+  | Direct fiat
  
  // ═══ TIER 4: Volatile-to-volatile (HIGH opportunity!) ═══
  ['ARB', 'LINK'],    // ✅ $15M+  | ⚡⚡ Both volatile
  ['ARB', 'UNI'],     // ✅ $10M+  | ⚡⚡ Both volatile
  ['GMX', 'ARB'],     // ✅ $8M+   | ⚡⚡⚡ BOTH very volatile
  
  // ═══ TOTAL: 17 pairs × 2 directions = 34 arbitrage routes ═══
  // PLUS: Multi-fee-tier arbitrage on Uniswap V3 (0.05% vs 0.3%)
  // REAL TOTAL: ~50-70 possible arbitrage opportunities!
  
  // Strategy: Scan MANY, validate STRICTLY, execute ONLY best
  // More pairs = More chances to find that perfect 2-5% spread
];

// DEX list for scanning (ONLY most reliable)
export const DEX_LIST = [
  { name: 'UniswapV3', router: DEX_ROUTERS.UNISWAP_V3, version: 3 },
  { name: 'SushiSwap', router: DEX_ROUTERS.SUSHISWAP, version: 2 },
];

// Flashbots Protect RPC (MEV protection)
export const FLASHBOTS_PROTECT_RPC = 'https://rpc.flashbots.net';

// Speed optimization constants - MAXIMUM PERFORMANCE
export const SPEED_CONSTANTS = {
  MAX_BLOCK_DELAY: 0, // Execute on same block
  MAX_SCAN_TIME_MS: 1000, // Target: <1 second for SCAN ONLY (execution is separate)
  PRICE_CACHE_TTL_MS: 500, // Cache prices for 500ms (balance speed vs freshness)
  MIN_PROFIT_AFTER_GAS: 50, // Minimum $50 after ALL costs
  PARALLEL_BATCH_SIZE: 20, // Scan 20 pairs simultaneously (FAST!)
  USE_MULTICALL: true, // Use Multicall3 for batching (10x faster)
};

// Validation thresholds - BALANCED (quality + quantity)
export const VALIDATION_THRESHOLDS = {
  MIN_LIQUIDITY_USD: 5_000_000, // $5M minimum (relaxed from $10M for more opportunities)
  MAX_PRICE_IMPACT_PERCENT: 5, // 5% max impact (relaxed for volatile tokens)
  MAX_REALISTIC_SPREAD: 8, // 8% max spread (relaxed for highly volatile pairs)
  MIN_PROFITABLE_SPREAD: 0.5, // 0.5% minimum (to cover all costs)
  REQUIRE_BOTH_DEXS: false, // Allow Uniswap V3 inter-fee-tier arbitrage!
};
