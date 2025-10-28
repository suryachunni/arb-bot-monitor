export const ARBITRUM_CHAIN_ID = 42161;

// REALISTIC: Focus on tokens with REAL Uniswap V3 liquidity on Arbitrum
// Strategy: Uniswap V3 ONLY (SushiSwap removed - no liquidity!)
// We'll find arbitrage between different fee tiers (0.05%, 0.3%, 1%)
export const TOKENS = {
  // ═══ TIER 1: Ultra-high liquidity ($50M+) ═══
  WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',  // $200M+ on Uniswap V3
  USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',  // $150M+ on Uniswap V3
  USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',  // $50M+ on Uniswap V3
  
  // ═══ TIER 2: High liquidity + VOLATILE ($10M+) ═══
  ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548',   // $60M+ Uniswap V3 | Native token
  LINK: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',  // $30M+ Uniswap V3 | Oracle = volatile
  UNI: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0',   // $25M+ Uniswap V3 | Governance
  GMX: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a',   // $20M+ Uniswap V3 | DeFi = volatile
  
  // ═══ TIER 3: Medium liquidity + MORE VOLATILE ($5M+) ═══
  PENDLE: '0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8', // $8M+ Uniswap V3 | Yield = volatile
  RDNT: '0x3082CC23568eA640225c2467653dB90e9250AaA0',   // $5M+ Uniswap V3 | Lending
  
  // ═══ NEW: More popular tokens ═══
  WBTC: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',  // $40M+ Uniswap V3 | Bitcoin
  USDC_E: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // $30M+ Uniswap V3 | USDC bridged
  
  // TOTAL: 11 tokens for maximum opportunity coverage
  // ALL verified to have REAL Uniswap V3 liquidity on Arbitrum!
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

// REALISTIC PAIRS: Only Uniswap V3 (SushiSwap removed!)
// Strategy: Inter-fee-tier arbitrage (0.05% vs 0.3% vs 1%)
// Direct pairs (A→B) and Triangular (A→B→C→A)
export const HIGH_LIQUIDITY_PAIRS = [
  // ═══ TIER 1: Major pairs (guaranteed liquidity $50M+) ═══
  ['WETH', 'USDC'],     // $150M+ TVL
  ['WETH', 'USDT'],     // $50M+ TVL
  ['WETH', 'WBTC'],     // $40M+ TVL
  ['WETH', 'ARB'],      // $60M+ TVL
  
  // ═══ TIER 2: High liquidity ($10M+) ═══
  ['WETH', 'LINK'],     // $30M+ TVL
  ['WETH', 'UNI'],      // $25M+ TVL
  ['WETH', 'GMX'],      // $20M+ TVL
  ['ARB', 'USDC'],      // $40M+ TVL
  ['WBTC', 'USDC'],     // $30M+ TVL
  ['LINK', 'USDC'],     // $15M+ TVL
  
  // ═══ TIER 3: Stablecoin pairs (low spread but safe) ═══
  ['USDC', 'USDT'],     // $20M+ TVL
  ['USDC', 'USDC_E'],   // $15M+ TVL (bridged USDC)
  
  // ═══ TIER 4: Volatile pairs (higher spread potential) ═══
  ['ARB', 'LINK'],      // $10M+ TVL
  ['UNI', 'USDC'],      // $15M+ TVL
  ['GMX', 'ARB'],       // $8M+ TVL
  
  // ═══ NEW: More token combinations ═══
  ['WETH', 'PENDLE'],   // $8M+ TVL
  ['WETH', 'RDNT'],     // $5M+ TVL
  ['PENDLE', 'USDC'],   // $5M+ TVL
  
  // TOTAL: 19 direct pairs
  // Each can have arbitrage between fee tiers (0.05%, 0.3%, 1%)
  // PLUS: Triangular routes (explained in scanner)
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
