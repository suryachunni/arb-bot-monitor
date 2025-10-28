import { AggressiveScanner } from './src/services/AggressiveScanner';

async function test() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   🚀 AGGRESSIVE SCAN TEST - OPTIMIZED FOR OPPORTUNITIES 🚀      ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  const scanner = new AggressiveScanner('https://arb1.arbitrum.io/rpc');
  
  console.log('⚙️  SETTINGS:');
  console.log('   Min liquidity: $100,000 (find MORE opportunities!)');
  console.log('   Min confidence: 60%');
  console.log('   Min spread: 0.3%');
  console.log('   Min profit: $20\n');
  
  console.log('🔍 Scanning...\n');
  
  const start = Date.now();
  const opportunities = await scanner.scanAggressive();
  const scanTime = Date.now() - start;
  
  console.log(`\n⏱️  Scan time: ${(scanTime/1000).toFixed(2)}s`);
  console.log(`🎯 Opportunities found: ${opportunities.length}\n`);
  
  if (opportunities.length > 0) {
    console.log('✅ OPPORTUNITIES FOUND!\n');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    
    opportunities.forEach((opp, i) => {
      console.log(`${i+1}. ${opp.path.join(' → ')}`);
      console.log(`   Spread: ${opp.spread.toFixed(2)}%`);
      console.log(`   Trade size: $${opp.tradeSize.toLocaleString()}`);
      console.log(`   Gross profit: $${opp.grossProfit.toFixed(2)}`);
      console.log(`   Net profit: $${opp.netProfit.toFixed(2)}`);
      console.log(`   Confidence: ${opp.confidence}%`);
      console.log(`   Buy: ${opp.buyDex} @ ${opp.buyPrice.toFixed(6)}`);
      console.log(`   Sell: ${opp.sellDex} @ ${opp.sellPrice.toFixed(6)}`);
      console.log(`   Liquidity: $${Math.min(opp.buyLiquidity, opp.sellLiquidity).toLocaleString()}\n`);
    });
  } else {
    console.log('❌ No opportunities found\n');
    console.log('This means market is very efficient right now.');
    console.log('Keep scanning - opportunities appear throughout the day!\n');
  }
  
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  await scanner.cleanup();
  process.exit(0);
}

test().catch(e => {
  console.error(e);
  process.exit(1);
});
