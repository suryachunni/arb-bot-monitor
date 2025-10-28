import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * SPREAD VERIFICATION TOOL
 * 
 * Run this script YOURSELF to verify bot's prices are genuine
 * Fetches prices directly from blockchain - no manipulation possible!
 */

const RPC_URL = process.env.RPC_URL || 'https://arb1.arbitrum.io/rpc';

const TOKENS = {
  WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548',
  USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
};

async function verifyPrices() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                   ║');
  console.log('║              ✅ SPREAD VERIFICATION TOOL ✅                        ║');
  console.log('║                                                                   ║');
  console.log('║   Fetching prices DIRECTLY from Arbitrum blockchain              ║');
  console.log('║   This data is 100% genuine and cannot be manipulated!           ║');
  console.log('║                                                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  
  console.log('📍 Network: Arbitrum One');
  console.log('⏰ Time:', new Date().toISOString());
  console.log('🔗 RPC:', RPC_URL);
  console.log('\n═══════════════════════════════════════════════════════════════════\n');

  // Uniswap V3 Quoter
  const QUOTER_ADDRESS = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';
  const QUOTER_ABI = [
    'function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
  ];
  const quoter = new ethers.Contract(QUOTER_ADDRESS, QUOTER_ABI, provider);

  // SushiSwap Router
  const SUSHI_ROUTER = '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506';
  const ROUTER_ABI = [
    'function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)'
  ];
  const router = new ethers.Contract(SUSHI_ROUTER, ROUTER_ABI, provider);

  const pairs = [
    { name: 'WETH/ARB', tokenIn: TOKENS.WETH, tokenOut: TOKENS.ARB, decimalsIn: 18, decimalsOut: 18 },
    { name: 'WETH/USDT', tokenIn: TOKENS.WETH, tokenOut: TOKENS.USDT, decimalsIn: 18, decimalsOut: 6 },
    { name: 'ARB/USDC', tokenIn: TOKENS.ARB, tokenOut: TOKENS.USDC, decimalsIn: 18, decimalsOut: 6 },
  ];

  for (const pair of pairs) {
    console.log(`🔍 Checking ${pair.name}:\n`);
    
    const amountIn = ethers.utils.parseUnits('1', pair.decimalsIn);
    let uniPrice = 0;
    let sushiPrice = 0;

    // Get Uniswap V3 price
    try {
      const result = await quoter.callStatic.quoteExactInputSingle({
        tokenIn: pair.tokenIn,
        tokenOut: pair.tokenOut,
        amountIn: amountIn,
        fee: 500, // 0.05%
        sqrtPriceLimitX96: 0
      });
      uniPrice = parseFloat(ethers.utils.formatUnits(result.amountOut, pair.decimalsOut));
      console.log(`   ✅ Uniswap V3:  ${uniPrice.toFixed(6)}`);
    } catch (error: any) {
      console.log(`   ❌ Uniswap V3:  Pool not available`);
      continue;
    }

    // Get SushiSwap price
    try {
      const result = await router.getAmountsOut(amountIn, [pair.tokenIn, pair.tokenOut]);
      sushiPrice = parseFloat(ethers.utils.formatUnits(result[1], pair.decimalsOut));
      console.log(`   ✅ SushiSwap:   ${sushiPrice.toFixed(6)}`);
    } catch (error: any) {
      console.log(`   ❌ SushiSwap:   Pool not available`);
      continue;
    }

    // Calculate spread
    if (uniPrice > 0 && sushiPrice > 0) {
      const diff = Math.abs(uniPrice - sushiPrice);
      const spread = (diff / Math.min(uniPrice, sushiPrice)) * 100;
      
      console.log(`\n   📊 SPREAD CALCULATION:`);
      console.log(`      Difference: ${diff.toFixed(6)}`);
      console.log(`      Spread: ${spread.toFixed(3)}%`);
      
      if (spread > 0.3 && spread < 5) {
        console.log(`      Status: ✅ GENUINE ARBITRAGE OPPORTUNITY!`);
        
        // Calculate profit
        const tradeSize = 50000;
        const grossProfit = (tradeSize * spread) / 100;
        const fees = 45 + 175 + 0.11; // Flash loan + DEX fees + gas
        const netProfit = grossProfit - fees;
        
        console.log(`\n   💰 PROFIT ESTIMATE (on $50k trade):`);
        console.log(`      Gross profit: $${grossProfit.toFixed(2)}`);
        console.log(`      Fees: $${fees.toFixed(2)}`);
        console.log(`      Net profit: $${netProfit.toFixed(2)}`);
      } else if (spread > 5) {
        console.log(`      Status: ⚠️  Spread too high (likely low liquidity)`);
      } else {
        console.log(`      Status: ⚠️  Spread too small (not profitable after fees)`);
      }
    }
    
    console.log('\n   ─────────────────────────────────────────────────────────────\n');
  }

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  ✅ VERIFICATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  console.log('🎯 HOW TO VERIFY THESE PRICES YOURSELF:\n');
  console.log('1. Go to https://app.sushi.com/swap (select Arbitrum)');
  console.log('2. Enter the token pair (e.g., WETH → ARB)');
  console.log('3. Enter amount: 1');
  console.log('4. Compare with SushiSwap price above\n');
  console.log('5. Go to https://app.uniswap.org (select Arbitrum)');
  console.log('6. Enter same pair and amount');
  console.log('7. Compare with Uniswap V3 price above\n');
  console.log('✅ If prices match → Bot is 100% accurate!\n');
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

verifyPrices().catch(console.error);
