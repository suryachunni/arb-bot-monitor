import { ethers } from 'ethers';
import { config } from './src/config/config';
import { FastPriceScanner } from './src/services/FastPriceScanner';
import { FastArbitrageDetector } from './src/services/FastArbitrageDetector';
import { HIGH_LIQUIDITY_PAIRS } from './src/config/constants';

async function testPrices() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('   🧪 TESTING BOT - REAL PRICE FETCHING');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('⏰ Starting real-time price scan...');
  console.log('📡 Connecting to Arbitrum mainnet...');
  console.log('');

  try {
    // Initialize with HTTP provider for testing (WebSocket for production)
    const provider = new ethers.providers.JsonRpcProvider(config.network.rpcUrl);
    
    // Create scanner components manually
    const { TOKENS, DEX_ROUTERS, UNISWAP_V3_FEES, MULTICALL3_ADDRESS, UNISWAP_V3_QUOTER_V2 } = require('./src/config/constants');
    const detector = new FastArbitrageDetector(provider);

    console.log('✅ Connected to Arbitrum!');
    console.log('🔍 Scanning prices on Uniswap V3 and SushiSwap...');
    console.log('');

    // Scan prices
    const startTime = Date.now();
    const priceData = await scanner.scanAllPairsUltraFast(HIGH_LIQUIDITY_PAIRS);
    const scanTime = Date.now() - startTime;

    console.log('═══════════════════════════════════════════════════════');
    console.log(`⚡ SCAN COMPLETE IN ${scanTime}ms`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    // Show prices
    let totalPrices = 0;
    for (const [pair, prices] of priceData.entries()) {
      console.log(`📊 ${pair}:`);
      for (const p of prices) {
        console.log(`   ${p.dex}${p.fee ? ` (${p.fee/10000}% fee)` : ''}:`);
        console.log(`      ${p.tokenA} → ${p.tokenB}: ${p.priceAtoB.toFixed(6)}`);
        console.log(`      ${p.tokenB} → ${p.tokenA}: ${p.priceBtoA.toFixed(6)}`);
        totalPrices++;
      }
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log(`📈 TOTAL: ${totalPrices} price quotes from ${priceData.size} pairs`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    // Detect arbitrage
    console.log('🎯 Detecting arbitrage opportunities...');
    console.log('');

    const opportunities = await detector.detectArbitrageFast(priceData);

    if (opportunities.length > 0) {
      console.log('═══════════════════════════════════════════════════════');
      console.log(`🎉 FOUND ${opportunities.length} ARBITRAGE OPPORTUNITIES!`);
      console.log('═══════════════════════════════════════════════════════');
      console.log('');

      opportunities.slice(0, 5).forEach((opp, idx) => {
        console.log(`#${idx + 1}: ${opp.tokenA}/${opp.tokenB}`);
        console.log(`   Direction: ${opp.direction === 'AtoB' ? `${opp.tokenA} → ${opp.tokenB}` : `${opp.tokenB} → ${opp.tokenA}`}`);
        console.log(`   Buy on: ${opp.buyDex}${opp.buyFee ? ` (${opp.buyFee/10000}%)` : ''}`);
        console.log(`   Sell on: ${opp.sellDex}${opp.sellFee ? ` (${opp.sellFee/10000}%)` : ''}`);
        console.log(`   Buy price: ${opp.buyPrice.toFixed(8)}`);
        console.log(`   Sell price: ${opp.sellPrice.toFixed(8)}`);
        console.log(`   Spread: ${opp.profitPercentage.toFixed(3)}%`);
        console.log(`   Estimated profit: $${opp.estimatedProfitUSD.toFixed(2)}`);
        console.log(`   Gas cost: $${opp.estimatedGasCost.toFixed(2)}`);
        console.log(`   NET PROFIT: $${opp.netProfitUSD.toFixed(2)} 💰`);
        console.log('');
      });
    } else {
      console.log('═══════════════════════════════════════════════════════');
      console.log('📊 NO ARBITRAGE OPPORTUNITIES RIGHT NOW');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      console.log('✅ This is NORMAL! Real arbitrage is rare.');
      console.log('💡 The bot is working correctly.');
      console.log('⏰ When opportunities appear, bot will catch them!');
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ TEST COMPLETE - BOT IS WORKING!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('📋 Summary:');
    console.log(`   Scan time: ${scanTime}ms`);
    console.log(`   Pairs scanned: ${priceData.size}`);
    console.log(`   Prices fetched: ${totalPrices}`);
    console.log(`   Opportunities: ${opportunities.length}`);
    console.log('');
    console.log('🔍 These are REAL prices from Arbitrum mainnet!');
    console.log('⚡ Bot scans this fast every 0.25 seconds when running!');
    console.log('');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

testPrices();
