/**
 * ═══════════════════════════════════════════════════════════════════
 * TOKEN CONFIGURATION
 * High-liquidity tokens on Arbitrum with flash loan support
 * ═══════════════════════════════════════════════════════════════════
 */

export interface TokenInfo {
  symbol: string;
  address: string;
  decimals: number;
  flashLoanSupported: boolean;
  minLiquidity: string; // Minimum liquidity in USD
}

/**
 * Top tokens on Arbitrum with excellent liquidity and flash loan support
 */
export const ARBITRUM_TOKENS: Record<string, TokenInfo> = {
  // Stablecoins (Best for flash loans - high liquidity, low volatility)
  USDC: {
    symbol: 'USDC',
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    decimals: 6,
    flashLoanSupported: true,
    minLiquidity: '10000000', // $10M
  },
  USDT: {
    symbol: 'USDT',
    address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    decimals: 6,
    flashLoanSupported: true,
    minLiquidity: '10000000', // $10M
  },
  DAI: {
    symbol: 'DAI',
    address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    decimals: 18,
    flashLoanSupported: true,
    minLiquidity: '5000000', // $5M
  },
  USDC_E: {
    symbol: 'USDC.e',
    address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    decimals: 6,
    flashLoanSupported: true,
    minLiquidity: '5000000', // $5M
  },

  // Major tokens (Good liquidity)
  WETH: {
    symbol: 'WETH',
    address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    decimals: 18,
    flashLoanSupported: true,
    minLiquidity: '20000000', // $20M
  },
  WBTC: {
    symbol: 'WBTC',
    address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    decimals: 8,
    flashLoanSupported: true,
    minLiquidity: '10000000', // $10M
  },
  ARB: {
    symbol: 'ARB',
    address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    decimals: 18,
    flashLoanSupported: true,
    minLiquidity: '5000000', // $5M
  },

  // DeFi tokens (Good for arbitrage)
  GMX: {
    symbol: 'GMX',
    address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a',
    decimals: 18,
    flashLoanSupported: false,
    minLiquidity: '2000000', // $2M
  },
  LINK: {
    symbol: 'LINK',
    address: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
    decimals: 18,
    flashLoanSupported: false,
    minLiquidity: '2000000', // $2M
  },
};

/**
 * Token pairs with best arbitrage potential
 * Sorted by liquidity and volume
 */
export const HIGH_LIQUIDITY_PAIRS = [
  // Stablecoin pairs (Very low risk, frequent small arbitrage)
  { token0: ARBITRUM_TOKENS.USDC.address, token1: ARBITRUM_TOKENS.USDT.address, label: 'USDC/USDT' },
  { token0: ARBITRUM_TOKENS.USDC.address, token1: ARBITRUM_TOKENS.DAI.address, label: 'USDC/DAI' },
  { token0: ARBITRUM_TOKENS.USDT.address, token1: ARBITRUM_TOKENS.DAI.address, label: 'USDT/DAI' },
  { token0: ARBITRUM_TOKENS.USDC.address, token1: ARBITRUM_TOKENS.USDC_E.address, label: 'USDC/USDC.e' },

  // ETH pairs (High volume, good arbitrage)
  { token0: ARBITRUM_TOKENS.WETH.address, token1: ARBITRUM_TOKENS.USDC.address, label: 'WETH/USDC' },
  { token0: ARBITRUM_TOKENS.WETH.address, token1: ARBITRUM_TOKENS.USDT.address, label: 'WETH/USDT' },
  { token0: ARBITRUM_TOKENS.WETH.address, token1: ARBITRUM_TOKENS.DAI.address, label: 'WETH/DAI' },

  // BTC pairs (High volume)
  { token0: ARBITRUM_TOKENS.WBTC.address, token1: ARBITRUM_TOKENS.USDC.address, label: 'WBTC/USDC' },
  { token0: ARBITRUM_TOKENS.WBTC.address, token1: ARBITRUM_TOKENS.USDT.address, label: 'WBTC/USDT' },
  { token0: ARBITRUM_TOKENS.WBTC.address, token1: ARBITRUM_TOKENS.WETH.address, label: 'WBTC/WETH' },

  // ARB pairs (Native token, good volume)
  { token0: ARBITRUM_TOKENS.ARB.address, token1: ARBITRUM_TOKENS.USDC.address, label: 'ARB/USDC' },
  { token0: ARBITRUM_TOKENS.ARB.address, token1: ARBITRUM_TOKENS.USDT.address, label: 'ARB/USDT' },
  { token0: ARBITRUM_TOKENS.ARB.address, token1: ARBITRUM_TOKENS.WETH.address, label: 'ARB/WETH' },

  // DeFi token pairs
  { token0: ARBITRUM_TOKENS.GMX.address, token1: ARBITRUM_TOKENS.USDC.address, label: 'GMX/USDC' },
  { token0: ARBITRUM_TOKENS.GMX.address, token1: ARBITRUM_TOKENS.WETH.address, label: 'GMX/WETH' },
  { token0: ARBITRUM_TOKENS.LINK.address, token1: ARBITRUM_TOKENS.USDC.address, label: 'LINK/USDC' },
  { token0: ARBITRUM_TOKENS.LINK.address, token1: ARBITRUM_TOKENS.WETH.address, label: 'LINK/WETH' },
];

/**
 * Tokens that support Aave V3 flash loans on Arbitrum
 */
export const FLASH_LOAN_TOKENS = Object.values(ARBITRUM_TOKENS)
  .filter(token => token.flashLoanSupported)
  .map(token => token.address);

/**
 * Get token info by address
 */
export function getTokenInfo(address: string): TokenInfo | undefined {
  return Object.values(ARBITRUM_TOKENS).find(
    token => token.address.toLowerCase() === address.toLowerCase()
  );
}

/**
 * Get token symbol by address
 */
export function getTokenSymbol(address: string): string {
  const token = getTokenInfo(address);
  return token?.symbol || address.substring(0, 6);
}

/**
 * Check if token supports flash loans
 */
export function supportsFlashLoan(address: string): boolean {
  const token = getTokenInfo(address);
  return token?.flashLoanSupported || false;
}
