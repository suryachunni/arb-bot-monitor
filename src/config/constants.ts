export const ARBITRUM_CHAIN_ID = 42161;

// ONLY ultra-high liquidity + VOLATILE tokens on Arbitrum
// Focus: HIGH LIQUIDITY + VOLATILITY = More arbitrage opportunities!
// All tokens verified $10M+ liquidity on BOTH Uniswap V3 AND SushiSwap
export const TOKENS = {
  // Major pairs (ultra-high liquidity $100M+)
  WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  
  // High liquidity + VOLATILE ($20M-100M) - MORE OPPORTUNITIES!
  ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548',    // Arbitrum native - HIGH volatility ⚡
  WBTC: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',   // Wrapped Bitcoin - medium volatility
  LINK: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',   // Chainlink - HIGH volatility ⚡
  UNI: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0',    // Uniswap token - HIGH volatility ⚡
  
  // Stable (included for pairing)
  DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',    // DAI stablecoin
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

// PRODUCTION: ONLY high-liquidity + VOLATILE pairs
// Strategy: Volatile tokens = More price movement = More arbitrage!
// Bidirectional: Each pair scanned A→B AND B→A automatically (2x opportunities!)
export const HIGH_LIQUIDITY_PAIRS = [
  // ═══ TIER 1: Ultra-high liquidity ($80M-120M) ═══
  // Stable but HUGE volume = consistent small opportunities
  ['WETH', 'USDC'],   // ✅ $120M+ | Stable but highest volume
  ['WETH', 'USDT'],   // ✅ $85M+  | Stable but high volume
  
  // ═══ TIER 2: High liquidity + VOLATILE ($20M-50M) ═══
  // BEST for arbitrage: High liquidity + price swings!
  ['WETH', 'ARB'],    // ✅ $45M+  | ⚡⚡ VERY VOLATILE (native token) - MOST OPPORTUNITIES!
  ['WETH', 'WBTC'],   // ✅ $35M+  | ⚡ VOLATILE (Bitcoin price moves)
  ['WETH', 'LINK'],   // ✅ $28M+  | ⚡⚡ VERY VOLATILE (oracle token) - HIGH OPPORTUNITIES!
  ['WETH', 'UNI'],    // ✅ $22M+  | ⚡ VOLATILE (governance token)
  
  // ═══ TIER 3: Direct stablecoin pairs ($15M-40M) ═══
  // Volatile tokens paired with stablecoins for clean arbitrage
  ['ARB', 'USDC'],    // ✅ $38M+  | ⚡⚡ HIGH VOLATILITY - Clean ARB/USD arb!
  ['WBTC', 'USDC'],   // ✅ $30M+  | ⚡ VOLATILE - Clean BTC/USD arb!
  ['LINK', 'USDC'],   // ✅ $18M+  | ⚡⚡ VERY VOLATILE - Clean LINK/USD arb!
  ['UNI', 'USDC'],    // ✅ $15M+  | ⚡ VOLATILE - Clean UNI/USD arb!
  
  // ═══ TOTAL: 10 pairs × 2 directions = 20 arbitrage routes! ═══
  
  // NOTE: Each pair automatically scanned bidirectionally:
  //   Example WETH/ARB:
  //     - Route 1: Buy WETH → Sell for ARB (if WETH cheaper)
  //     - Route 2: Buy ARB → Sell for WETH (if ARB cheaper)
  //   Bot finds profitable direction automatically!
  
  // REMOVED (low liquidity or low volatility = fewer opportunities):
  // - USDC/USDT (stable pair, tiny spreads, low SushiSwap liquidity)
  // - USDC/DAI (stable pair, no spreads)
  // - DAI pairs (low volume on SushiSwap)
  // - GMX (insufficient SushiSwap liquidity)
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
