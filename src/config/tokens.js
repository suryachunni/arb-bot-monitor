// Arbitrum Mainnet Token Addresses
export const TOKENS = {
  WETH: {
    address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    symbol: 'WETH',
    decimals: 18,
    flashLoanSupport: true
  },
  ARB: {
    address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    symbol: 'ARB',
    decimals: 18,
    flashLoanSupport: true
  },
  USDC: {
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    symbol: 'USDC',
    decimals: 6,
    flashLoanSupport: true
  },
  USDT: {
    address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    symbol: 'USDT',
    decimals: 6,
    flashLoanSupport: true
  },
  DAI: {
    address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    symbol: 'DAI',
    decimals: 18,
    flashLoanSupport: true
  },
  LINK: {
    address: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
    symbol: 'LINK',
    decimals: 18,
    flashLoanSupport: true
  },
  MAGIC: {
    address: '0x539bdE0d7Dbd336b79148AA742883198BBF60342',
    symbol: 'MAGIC',
    decimals: 18,
    flashLoanSupport: true
  },
  GMX: {
    address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a',
    symbol: 'GMX',
    decimals: 18,
    flashLoanSupport: false
  },
  RDNT: {
    address: '0x3082CC23568eA640225c2467653dB90e9250AaA0',
    symbol: 'RDNT',
    decimals: 18,
    flashLoanSupport: true
  },
  WBTC: {
    address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    symbol: 'WBTC',
    decimals: 8,
    flashLoanSupport: true
  }
};

// DEX Configurations for Arbitrum
export const DEXS = {
  UNISWAP_V3: {
    name: 'Uniswap V3',
    router: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
    type: 'v3'
  },
  SUSHISWAP: {
    name: 'Sushiswap',
    router: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    factory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
    type: 'v2'
  },
  CAMELOT: {
    name: 'Camelot',
    router: '0xc873fEcbd354f5A56E00E710B90EF4201db2448d',
    factory: '0x6EcCab422D763aC031210895C81787E87B43A652',
    type: 'v2'
  },
  BALANCER: {
    name: 'Balancer',
    vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    type: 'balancer'
  },
  CURVE: {
    name: 'Curve',
    type: 'curve'
  }
};

// Trading pairs for arbitrage scanning
export const TRADING_PAIRS = [
  // Direct pairs with WETH
  { tokenA: 'WETH', tokenB: 'USDC' },
  { tokenA: 'WETH', tokenB: 'USDT' },
  { tokenA: 'WETH', tokenB: 'DAI' },
  { tokenA: 'WETH', tokenB: 'ARB' },
  { tokenA: 'WETH', tokenB: 'LINK' },
  { tokenA: 'WETH', tokenB: 'MAGIC' },
  { tokenA: 'WETH', tokenB: 'WBTC' },
  { tokenA: 'WETH', tokenB: 'GMX' },
  { tokenA: 'WETH', tokenB: 'RDNT' },
  
  // Stablecoin pairs
  { tokenA: 'USDC', tokenB: 'USDT' },
  { tokenA: 'USDC', tokenB: 'DAI' },
  { tokenA: 'USDT', tokenB: 'DAI' },
  
  // ARB pairs
  { tokenA: 'ARB', tokenB: 'USDC' },
  { tokenA: 'ARB', tokenB: 'USDT' },
  
  // Other pairs
  { tokenA: 'LINK', tokenB: 'USDC' },
  { tokenA: 'MAGIC', tokenB: 'USDC' },
  { tokenA: 'WBTC', tokenB: 'USDC' },
  { tokenA: 'GMX', tokenB: 'USDC' },
  { tokenA: 'RDNT', tokenB: 'USDC' }
];

// Triangular arbitrage paths
export const TRIANGULAR_PATHS = [
  // WETH as base
  ['WETH', 'USDC', 'ARB'],
  ['WETH', 'USDC', 'LINK'],
  ['WETH', 'USDC', 'MAGIC'],
  ['WETH', 'USDT', 'ARB'],
  ['WETH', 'DAI', 'ARB'],
  ['WETH', 'ARB', 'USDC'],
  ['WETH', 'LINK', 'USDC'],
  ['WETH', 'MAGIC', 'USDC'],
  ['WETH', 'WBTC', 'USDC'],
  
  // ARB triangular
  ['ARB', 'USDC', 'WETH'],
  ['ARB', 'USDT', 'WETH'],
  ['ARB', 'WETH', 'USDC'],
  
  // Stablecoin arbitrage
  ['USDC', 'USDT', 'DAI'],
  ['USDC', 'DAI', 'USDT'],
  
  // Complex paths
  ['WETH', 'USDC', 'RDNT'],
  ['WETH', 'GMX', 'USDC']
];
