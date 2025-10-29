import { ethers } from 'ethers';

/**
 * TEST REAL PRICES PROPERLY
 * Let's verify what's actually working before deploying
 */

const provider = new ethers.providers.JsonRpcProvider(
  'https://arb-mainnet.g.alchemy.com/v2/wuLT9bA29g4SF1zeOlgpg'
);

const WETH = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
const ARB = '0x912CE59144191C1204E64559FE8253a0e49E6548';

const QUOTER_ABI = [
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)',
];

const QUOTER_ADDRESS = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6'; // Uniswap V3 Quoter

async function testRealPrices() {
  console.log('Testing REAL prices from Uniswap V3 Quoter...\n');

  const quoter = new ethers.Contract(QUOTER_ADDRESS, QUOTER_ABI, provider);

  // Test WETH/USDC
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('WETH → USDC');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const amountIn = ethers.utils.parseEther('1'); // 1 WETH

  try {
    // Fee: 500 (0.05%)
    const amountOut500 = await quoter.callStatic.quoteExactInputSingle(
      WETH,
      USDC,
      500,
      amountIn,
      0
    );
    const price500 = parseFloat(ethers.utils.formatUnits(amountOut500, 6)); // USDC has 6 decimals
    console.log(`UniswapV3 (0.05%): 1 WETH = $${price500.toFixed(2)}`);

    // Fee: 3000 (0.3%)
    const amountOut3000 = await quoter.callStatic.quoteExactInputSingle(
      WETH,
      USDC,
      3000,
      amountIn,
      0
    );
    const price3000 = parseFloat(ethers.utils.formatUnits(amountOut3000, 6));
    console.log(`UniswapV3 (0.30%): 1 WETH = $${price3000.toFixed(2)}`);

    const spread = Math.abs(price500 - price3000);
    const spreadPercent = (spread / Math.min(price500, price3000)) * 100;
    console.log(`\nSpread: $${spread.toFixed(2)} (${spreadPercent.toFixed(3)}%)`);

  } catch (error: any) {
    console.log('Error:', error.message);
  }

  // Test ARB/USDC
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('ARB → USDC');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const amountInARB = ethers.utils.parseEther('100'); // 100 ARB

  try {
    const amountOut500 = await quoter.callStatic.quoteExactInputSingle(
      ARB,
      USDC,
      500,
      amountInARB,
      0
    );
    const price500 = parseFloat(ethers.utils.formatUnits(amountOut500, 6)) / 100;
    console.log(`UniswapV3 (0.05%): 1 ARB = $${price500.toFixed(4)}`);

    const amountOut3000 = await quoter.callStatic.quoteExactInputSingle(
      ARB,
      USDC,
      3000,
      amountInARB,
      0
    );
    const price3000 = parseFloat(ethers.utils.formatUnits(amountOut3000, 6)) / 100;
    console.log(`UniswapV3 (0.30%): 1 ARB = $${price3000.toFixed(4)}`);

    const spread = Math.abs(price500 - price3000);
    const spreadPercent = (spread / Math.min(price500, price3000)) * 100;
    console.log(`\nSpread: $${spread.toFixed(4)} (${spreadPercent.toFixed(3)}%)`);

  } catch (error: any) {
    console.log('Error:', error.message);
  }

  console.log('\n✅ If you see realistic prices above, the Quoter method works!');
  console.log('✅ These are REAL prices, not calculation errors');
}

testRealPrices().catch(console.error);
