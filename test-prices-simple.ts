import { ethers } from 'ethers';

const RPC_URL = 'https://arb-mainnet.g.alchemy.com/v2/wuLT9bA29g4SF1zeOlgpg';

const TOKENS = {
  WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548',
};

const UNISWAP_V3_QUOTER = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';
const SUSHISWAP_ROUTER = '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506';

const QUOTER_ABI = [
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)',
];

const ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)',
];

async function testRealPrices() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('   🧪 REAL-TIME PRICE TEST - ARBITRUM MAINNET');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  
  console.log('📡 Connecting to Arbitrum...');
  const network = await provider.getNetwork();
  console.log(`✅ Connected! Chain ID: ${network.chainId}`);
  console.log('');

  const quoter = new ethers.Contract(UNISWAP_V3_QUOTER, QUOTER_ABI, provider);
  const sushiRouter = new ethers.Contract(SUSHISWAP_ROUTER, ROUTER_ABI, provider);

  console.log('🔍 Fetching REAL prices from DEXs...');
  console.log('');

  try {
    // Test 1: WETH/USDC on Uniswap V3
    console.log('📊 Testing WETH/USDC prices:');
    console.log('');

    const wethAmount = ethers.utils.parseEther('1'); // 1 WETH

    // Uniswap V3 - 0.05% fee tier
    console.log('   Uniswap V3 (0.05% fee):');
    const startTime1 = Date.now();
    const uniV3Price005 = await quoter.callStatic.quoteExactInputSingle(
      TOKENS.WETH,
      TOKENS.USDC,
      500, // 0.05%
      wethAmount,
      0
    );
    const time1 = Date.now() - startTime1;
    const usdcAmount005 = parseFloat(ethers.utils.formatUnits(uniV3Price005, 6));
    console.log(`      1 WETH = ${usdcAmount005.toFixed(2)} USDC`);
    console.log(`      Fetched in ${time1}ms ⚡`);
    console.log('');

    // Uniswap V3 - 0.3% fee tier
    console.log('   Uniswap V3 (0.3% fee):');
    const startTime2 = Date.now();
    const uniV3Price03 = await quoter.callStatic.quoteExactInputSingle(
      TOKENS.WETH,
      TOKENS.USDC,
      3000, // 0.3%
      wethAmount,
      0
    );
    const time2 = Date.now() - startTime2;
    const usdcAmount03 = parseFloat(ethers.utils.formatUnits(uniV3Price03, 6));
    console.log(`      1 WETH = ${usdcAmount03.toFixed(2)} USDC`);
    console.log(`      Fetched in ${time2}ms ⚡`);
    console.log('');

    // SushiSwap
    console.log('   SushiSwap:');
    const startTime3 = Date.now();
    const sushiPrice = await sushiRouter.getAmountsOut(wethAmount, [TOKENS.WETH, TOKENS.USDC]);
    const time3 = Date.now() - startTime3;
    const sushiUsdcAmount = parseFloat(ethers.utils.formatUnits(sushiPrice[1], 6));
    console.log(`      1 WETH = ${sushiUsdcAmount.toFixed(2)} USDC`);
    console.log(`      Fetched in ${time3}ms ⚡`);
    console.log('');

    // Calculate spreads
    console.log('═══════════════════════════════════════════════════════');
    console.log('💰 PRICE COMPARISON:');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    const prices = [
      { dex: 'Uniswap V3 (0.05%)', price: usdcAmount005 },
      { dex: 'Uniswap V3 (0.3%)', price: usdcAmount03 },
      { dex: 'SushiSwap', price: sushiUsdcAmount },
    ];

    prices.sort((a, b) => b.price - a.price);

    console.log('   Highest price: ' + prices[0].dex + ' - $' + prices[0].price.toFixed(2));
    console.log('   Lowest price: ' + prices[2].dex + ' - $' + prices[2].price.toFixed(2));
    console.log('');

    const spread = ((prices[0].price - prices[2].price) / prices[2].price) * 100;
    const spreadDollar = prices[0].price - prices[2].price;

    console.log(`   📈 SPREAD: ${spread.toFixed(3)}% ($${spreadDollar.toFixed(2)})`);
    console.log('');

    if (spread > 0.3) {
      console.log('   🎯 POTENTIAL ARBITRAGE OPPORTUNITY!');
      console.log(`   💰 If you buy on ${prices[2].dex} and sell on ${prices[0].dex}`);
      console.log(`   💵 Gross profit: $${spreadDollar.toFixed(2)} per WETH`);
      console.log('');

      // Estimate with $50k loan
      const loanAmount = 50000;
      const wethToBuy = loanAmount / prices[2].price;
      const grossProfit = wethToBuy * spreadDollar;
      const fees = loanAmount * 0.006; // ~0.6% total fees
      const netProfit = grossProfit - fees;

      console.log(`   🔢 With $50,000 flash loan:`);
      console.log(`      Buy ${wethToBuy.toFixed(4)} WETH on ${prices[2].dex}`);
      console.log(`      Sell ${wethToBuy.toFixed(4)} WETH on ${prices[0].dex}`);
      console.log(`      Gross profit: $${grossProfit.toFixed(2)}`);
      console.log(`      Fees: -$${fees.toFixed(2)}`);
      console.log(`      NET PROFIT: $${netProfit.toFixed(2)} 💰`);
      console.log('');
    } else {
      console.log('   ✅ Market is efficient (spread < 0.3%)');
      console.log('   📊 No profitable arbitrage right now');
      console.log('   ⏰ This is normal! Bot will catch opportunities when they appear.');
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ PRICE TEST COMPLETE!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('📋 Summary:');
    console.log(`   ✅ Connected to Arbitrum mainnet`);
    console.log(`   ✅ Fetched real prices from Uniswap V3 & SushiSwap`);
    console.log(`   ✅ Total fetch time: ${time1 + time2 + time3}ms`);
    console.log(`   ✅ Current spread: ${spread.toFixed(3)}%`);
    console.log('');
    console.log('💡 These are LIVE prices from Arbitrum blockchain!');
    console.log('⚡ Bot fetches these prices every 0.25 seconds!');
    console.log('🎯 When spread > 0.5%, bot executes automatically!');
    console.log('');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('');
    console.error('This might be due to:');
    console.error('- RPC rate limit');
    console.error('- Pool doesnt exist for this pair');
    console.error('- Network issue');
  }

  process.exit(0);
}

testRealPrices();
