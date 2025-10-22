import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * FULL SCAN TEST - SHOW ALL SPREADS
 * 
 * Shows EVERY spread found, not just top 3
 * User will verify authenticity manually
 */

interface SpreadResult {
  pair: string;
  tokenA: string;
  tokenB: string;
  buyDex: string;
  sellDex: string;
  buyPrice: number;
  sellPrice: number;
  spread: number;
  priceImpact: number;
  estimatedProfit: number;
  passedValidation: boolean;
  rejectionReason?: string;
}

const TOKENS: { [key: string]: string } = {
  WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548',
  LINK: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
  UNI: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0',
};

const PAIRS = [
  ['WETH', 'USDC'],
  ['WETH', 'USDT'],
  ['WETH', 'ARB'],
  ['WETH', 'LINK'],
  ['WETH', 'UNI'],
  ['ARB', 'USDC'],
  ['LINK', 'USDC'],
  ['UNI', 'USDC'],
];

async function fullScan() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                   ║');
  console.log('║         🔍 FULL SCAN - SHOWING ALL SPREADS 🔍                     ║');
  console.log('║                                                                   ║');
  console.log('║   Every spread will be shown, not just profitable ones           ║');
  console.log('║   You can verify EACH ONE manually                               ║');
  console.log('║                                                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  const provider = new ethers.providers.JsonRpcProvider(
    process.env.RPC_URL || 'https://arb1.arbitrum.io/rpc'
  );

  const blockNumber = await provider.getBlockNumber();
  console.log(`📊 Arbitrum Block: ${blockNumber}`);
  console.log(`⏰ Time: ${new Date().toISOString()}\n`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const QUOTER_ADDRESS = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';
  const QUOTER_ABI = [
    'function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
  ];
  const quoter = new ethers.Contract(QUOTER_ADDRESS, QUOTER_ABI, provider);

  const SUSHI_ROUTER = '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506';
  const ROUTER_ABI = [
    'function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)'
  ];
  const sushiRouter = new ethers.Contract(SUSHI_ROUTER, ROUTER_ABI, provider);

  const ERC20_ABI = ['function decimals() view returns (uint8)'];

  const allSpreads: SpreadResult[] = [];
  let pairsScanned = 0;

  for (const [symbolA, symbolB] of PAIRS) {
    const tokenA = TOKENS[symbolA];
    const tokenB = TOKENS[symbolB];

    console.log(`🔍 Scanning ${symbolA}/${symbolB}...`);
    pairsScanned++;

    try {
      const tokenAContract = new ethers.Contract(tokenA, ERC20_ABI, provider);
      const tokenBContract = new ethers.Contract(tokenB, ERC20_ABI, provider);
      
      const decimalsA = await tokenAContract.decimals();
      const decimalsB = await tokenBContract.decimals();
      const amountIn = ethers.utils.parseUnits('1', decimalsA);

      let uniPrices: { fee: number; price: number }[] = [];
      let sushiPrice: number | null = null;

      // Try all Uniswap V3 fee tiers
      const feeTiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
      
      for (const fee of feeTiers) {
        try {
          const result = await quoter.callStatic.quoteExactInputSingle({
            tokenIn: tokenA,
            tokenOut: tokenB,
            amountIn: amountIn,
            fee: fee,
            sqrtPriceLimitX96: 0
          });
          const price = parseFloat(ethers.utils.formatUnits(result.amountOut, decimalsB));
          uniPrices.push({ fee, price });
          console.log(`   ✅ Uniswap V3 (${(fee/10000).toFixed(2)}%): ${price.toFixed(6)}`);
        } catch {
          console.log(`   ⚠️  Uniswap V3 (${(fee/10000).toFixed(2)}%): No pool`);
        }
      }

      // Try SushiSwap
      try {
        const amounts = await sushiRouter.getAmountsOut(amountIn, [tokenA, tokenB]);
        sushiPrice = parseFloat(ethers.utils.formatUnits(amounts[1], decimalsB));
        console.log(`   ✅ SushiSwap: ${sushiPrice.toFixed(6)}`);
      } catch {
        console.log(`   ⚠️  SushiSwap: No pool`);
      }

      // Find all possible spreads
      const allPrices: { dex: string; price: number }[] = [];
      
      uniPrices.forEach(({ fee, price }) => {
        allPrices.push({ dex: `Uniswap V3 (${(fee/10000).toFixed(2)}%)`, price });
      });
      
      if (sushiPrice) {
        allPrices.push({ dex: 'SushiSwap', price: sushiPrice });
      }

      // Calculate ALL possible spreads (including between Uniswap pools)
      for (let i = 0; i < allPrices.length; i++) {
        for (let j = i + 1; j < allPrices.length; j++) {
          const price1 = allPrices[i];
          const price2 = allPrices[j];
          
          const minPrice = Math.min(price1.price, price2.price);
          const maxPrice = Math.max(price1.price, price2.price);
          const spread = ((maxPrice - minPrice) / minPrice) * 100;

          if (spread < 0.01) continue; // Skip tiny spreads

          const buyDex = price1.price < price2.price ? price1.dex : price2.dex;
          const sellDex = price1.price < price2.price ? price2.dex : price1.dex;
          const buyPrice = minPrice;
          const sellPrice = maxPrice;

          // Estimate profit
          const tradeSize = 50000;
          const grossProfit = (tradeSize * spread) / 100;
          const fees = 220; // Flash loan + DEX fees + gas
          const priceImpact = Math.min((tradeSize / 50000000) * 100 * (1 + spread/5), 15);
          const slippageLoss = (tradeSize * priceImpact) / 100;
          const estimatedProfit = grossProfit - fees - slippageLoss;

          // Validation
          let passedValidation = true;
          let rejectionReason = '';

          if (spread > 5) {
            passedValidation = false;
            rejectionReason = 'Spread too high (>5%)';
          } else if (spread < 0.3) {
            passedValidation = false;
            rejectionReason = 'Spread too small (<0.3%)';
          } else if (priceImpact > 3) {
            passedValidation = false;
            rejectionReason = 'Price impact too high (>3%)';
          } else if (estimatedProfit < 50) {
            passedValidation = false;
            rejectionReason = 'Net profit < $50';
          }

          allSpreads.push({
            pair: `${symbolA}/${symbolB}`,
            tokenA: symbolA,
            tokenB: symbolB,
            buyDex,
            sellDex,
            buyPrice,
            sellPrice,
            spread,
            priceImpact,
            estimatedProfit,
            passedValidation,
            rejectionReason,
          });
        }
      }

      console.log('');
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  }

  // Sort by spread (highest first)
  allSpreads.sort((a, b) => b.spread - a.spread);

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  📊 FULL SCAN RESULTS - ALL SPREADS');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log(`Pairs scanned: ${pairsScanned}`);
  console.log(`Total spreads found: ${allSpreads.length}`);
  console.log(`Passed validation: ${allSpreads.filter(s => s.passedValidation).length}`);
  console.log(`Rejected: ${allSpreads.filter(s => !s.passedValidation).length}\n`);

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  💰 ALL SPREADS (Sorted by Spread %)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  allSpreads.forEach((spread, index) => {
    const status = spread.passedValidation ? '✅' : '❌';
    console.log(`${index + 1}. ${spread.pair} - ${spread.spread.toFixed(3)}% ${status}`);
    console.log(`   Buy:  ${spread.buyDex} @ ${spread.buyPrice.toFixed(6)}`);
    console.log(`   Sell: ${spread.sellDex} @ ${spread.sellPrice.toFixed(6)}`);
    console.log(`   Price Impact: ${spread.priceImpact.toFixed(2)}%`);
    console.log(`   Est. Profit: $${spread.estimatedProfit.toFixed(2)}`);
    
    if (spread.passedValidation) {
      console.log(`   Status: ✅ PASSED ALL VALIDATION`);
    } else {
      console.log(`   Status: ❌ REJECTED - ${spread.rejectionReason}`);
    }
    console.log('');
  });

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  ✅ HOW TO VERIFY EACH SPREAD');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log('For SushiSwap prices:');
  console.log('1. Go to: https://app.sushi.com/swap');
  console.log('2. Select Arbitrum network');
  console.log('3. Enter token pair');
  console.log('4. Enter amount: 1');
  console.log('5. Compare with price above\n');

  console.log('For Uniswap V3 prices:');
  console.log('1. Go to: https://app.uniswap.org');
  console.log('2. Select Arbitrum network');
  console.log('3. Enter token pair');
  console.log('4. Enter amount: 1');
  console.log('5. Compare with price above\n');

  console.log('For Uniswap V3 specific fee tiers:');
  console.log('• You may need to manually select the fee tier');
  console.log('• 0.05% = lowest fee');
  console.log('• 0.3% = standard fee');
  console.log('• 1% = highest fee\n');

  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Summary by validation status
  const passed = allSpreads.filter(s => s.passedValidation);
  const rejected = allSpreads.filter(s => !s.passedValidation);

  console.log('📊 SUMMARY BY VALIDATION:');
  console.log('');
  console.log(`✅ PASSED (${passed.length}):`);
  passed.forEach(s => {
    console.log(`   ${s.pair}: ${s.spread.toFixed(2)}% - $${s.estimatedProfit.toFixed(2)} profit`);
  });
  console.log('');
  console.log(`❌ REJECTED (${rejected.length}):`);
  const rejectionReasons: { [key: string]: number } = {};
  rejected.forEach(s => {
    const reason = s.rejectionReason || 'Unknown';
    rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
  });
  Object.entries(rejectionReasons).forEach(([reason, count]) => {
    console.log(`   ${reason}: ${count}`);
  });

  console.log('\n═══════════════════════════════════════════════════════════════════\n');
}

fullScan().catch(console.error);
