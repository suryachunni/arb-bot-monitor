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

async function testMultiplePairs() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('   🔍 SCANNING MULTIPLE PAIRS - LIVE TEST');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const quoter = new ethers.Contract(UNISWAP_V3_QUOTER, QUOTER_ABI, provider);
  const sushiRouter = new ethers.Contract(SUSHISWAP_ROUTER, ROUTER_ABI, provider);

  const pairs = [
    { name: 'USDC/USDT', tokenIn: TOKENS.USDC, tokenOut: TOKENS.USDT, amount: '1000', decimalsIn: 6, decimalsOut: 6 },
    { name: 'WETH/ARB', tokenIn: TOKENS.WETH, tokenOut: TOKENS.ARB, amount: '1', decimalsIn: 18, decimalsOut: 18 },
    { name: 'USDC/ARB', tokenIn: TOKENS.USDC, tokenOut: TOKENS.ARB, amount: '1000', decimalsIn: 6, decimalsOut: 18 },
  ];

  console.log('⏰ Starting multi-pair scan...');
  console.log('');

  for (const pair of pairs) {
    console.log(`📊 ${pair.name}:`);
    console.log('');

    try {
      const amountIn = ethers.utils.parseUnits(pair.amount, pair.decimalsIn);

      // Uniswap V3 - 0.05%
      const uniV3_005 = await quoter.callStatic.quoteExactInputSingle(
        pair.tokenIn, pair.tokenOut, 500, amountIn, 0
      );
      const price005 = parseFloat(ethers.utils.formatUnits(uniV3_005, pair.decimalsOut));

      // Uniswap V3 - 0.3%
      const uniV3_03 = await quoter.callStatic.quoteExactInputSingle(
        pair.tokenIn, pair.tokenOut, 3000, amountIn, 0
      );
      const price03 = parseFloat(ethers.utils.formatUnits(uniV3_03, pair.decimalsOut));

      // SushiSwap
      const sushi = await sushiRouter.getAmountsOut(amountIn, [pair.tokenIn, pair.tokenOut]);
      const sushiPrice = parseFloat(ethers.utils.formatUnits(sushi[1], pair.decimalsOut));

      console.log(`   Uniswap V3 (0.05%): ${price005.toFixed(6)}`);
      console.log(`   Uniswap V3 (0.3%):  ${price03.toFixed(6)}`);
      console.log(`   SushiSwap:          ${sushiPrice.toFixed(6)}`);

      const prices = [
        { dex: 'UniV3-0.05%', price: price005 },
        { dex: 'UniV3-0.3%', price: price03 },
        { dex: 'SushiSwap', price: sushiPrice },
      ];
      prices.sort((a, b) => b.price - a.price);

      const spread = ((prices[0].price - prices[2].price) / prices[2].price) * 100;
      console.log(`   📈 Spread: ${spread.toFixed(3)}%`);

      if (spread > 0.3) {
        console.log(`   🎯 ARBITRAGE! Buy on ${prices[2].dex}, sell on ${prices[0].dex}`);
      } else {
        console.log(`   ✅ Efficient market (< 0.3% spread)`);
      }

      console.log('');
    } catch (error: any) {
      console.log(`   ⚠️ Pool might not exist or low liquidity`);
      console.log('');
    }
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ MULTI-PAIR SCAN COMPLETE!');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('💡 This is what the bot does every 0.25 seconds!');
  console.log('⚡ When it finds spread > 0.5%, it executes automatically!');
  console.log('');

  process.exit(0);
}

testMultiplePairs();
