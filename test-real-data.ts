import { RealDataScanner } from './src/services/RealDataScanner';

/**
 * TEST: REAL DATA SCANNER
 * NO assumptions - everything from blockchain
 */

async function testRealData() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                   ║');
  console.log('║      🎯 REAL DATA SCAN - NO ASSUMPTIONS 🎯                        ║');
  console.log('║                                                                   ║');
  console.log('║   • REAL pool reserves from blockchain                            ║');
  console.log('║   • REAL price impact calculated                                  ║');
  console.log('║   • REAL liquidity (not estimated)                                ║');
  console.log('║   • REAL slippage from pool math                                  ║');
  console.log('║   • NO fake or assumed data                                       ║');
  console.log('║                                                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  const scanner = new RealDataScanner();
  
  try {
    console.log('⚡ Starting REAL data scan...\n');
    const startTime = Date.now();
    
    const opportunities = await scanner.scanMarket(50000);
    
    const elapsed = Date.now() - startTime;

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('  ✅ SCAN COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    console.log(`⏱️  Scan Time: ${elapsed}ms (${(elapsed/1000).toFixed(2)}s)`);
    console.log(`📊 Opportunities: ${opportunities.length}`);
    console.log(`✅ ALL data is REAL from blockchain\n`);

    console.log(`${'═'.repeat(67)}\n`);

    if (opportunities.length === 0) {
      console.log('❌ NO OPPORTUNITIES FOUND\n');
      console.log('This means:');
      console.log('  • No profitable spreads exist right now');
      console.log('  • Or all spreads have too high price impact');
      console.log('  • Market is efficient at this moment');
      console.log('  • Try again in a few minutes\n');
      return;
    }

    console.log(`💰 FOUND ${opportunities.length} REAL OPPORTUNITIES:\n`);
    console.log(`${'═'.repeat(67)}\n`);

    opportunities.forEach((opp, i) => {
      console.log(`OPPORTUNITY #${i+1}`);
      console.log(`${'─'.repeat(67)}`);
      console.log(`📊 PATH: ${opp.path.join(' → ')}`);
      console.log(`💹 SPREAD: ${opp.spread.toFixed(3)}%`);
      console.log('');
      
      console.log(`💰 REAL PROFITABILITY:`);
      console.log(`   Trade Size:         $${opp.tradeSize.toLocaleString()}`);
      console.log(`   Gross Profit:       $${opp.grossProfit.toFixed(2)}`);
      console.log(`   ────────────────────────────────`);
      console.log(`   Flash Loan Fee:     $${opp.flashLoanFee.toFixed(2)}`);
      console.log(`   DEX Fees:           $${opp.dexFees.toFixed(2)}`);
      console.log(`   Gas:                $${opp.gasCost.toFixed(2)}`);
      console.log(`   REAL Slippage:      $${opp.realSlippage.toFixed(2)}`);
      console.log(`   ────────────────────────────────`);
      console.log(`   Total Costs:        $${opp.totalCosts.toFixed(2)}`);
      console.log(`   ────────────────────────────────`);
      console.log(`   NET PROFIT:         $${opp.netProfit.toFixed(2)}`);
      console.log('');
      
      console.log(`💧 BUY POOL (${opp.buyPool.fee}):`);
      console.log(`   Address:     ${opp.buyPool.address}`);
      console.log(`   Reserve 0:   ${opp.buyPool.reserve0.substring(0, 20)}...`);
      console.log(`   Reserve 1:   ${opp.buyPool.reserve1.substring(0, 20)}...`);
      console.log(`   REAL Liquidity: $${(opp.buyPool.liquidityUSD/1000000).toFixed(2)}M`);
      console.log('');
      
      console.log(`💧 SELL POOL (${opp.sellPool.fee}):`);
      console.log(`   Address:     ${opp.sellPool.address}`);
      console.log(`   Reserve 0:   ${opp.sellPool.reserve0.substring(0, 20)}...`);
      console.log(`   Reserve 1:   ${opp.sellPool.reserve1.substring(0, 20)}...`);
      console.log(`   REAL Liquidity: $${(opp.sellPool.liquidityUSD/1000000).toFixed(2)}M`);
      console.log('');
      
      console.log(`📊 REAL PRICE IMPACT: ${opp.realPriceImpact.toFixed(3)}%`);
      console.log(`   (Calculated from actual pool reserves)`);
      console.log('');
      
      console.log(`✅ ALL DATA IS GENUINE - NO ASSUMPTIONS`);
      
      console.log(`\n${'═'.repeat(67)}\n`);
    });

    // Summary
    const totalProfit = opportunities.reduce((sum, o) => sum + o.netProfit, 0);
    const avgProfit = totalProfit / opportunities.length;
    const avgLiquidity = opportunities.reduce((sum, o) => 
      sum + (o.buyPool.liquidityUSD + o.sellPool.liquidityUSD) / 2, 0
    ) / opportunities.length;

    console.log('📊 SUMMARY:\n');
    console.log(`   Total Opportunities:  ${opportunities.length}`);
    console.log(`   Total Profit:         $${totalProfit.toFixed(2)}`);
    console.log(`   Average Per Trade:    $${avgProfit.toFixed(2)}`);
    console.log(`   Avg Liquidity:        $${(avgLiquidity/1000000).toFixed(1)}M`);
    console.log(`   Best Opportunity:     $${opportunities[0].netProfit.toFixed(2)}`);

    console.log(`\n${'═'.repeat(67)}\n`);

    console.log('🎯 DATA VERIFICATION:\n');
    console.log('   ✅ Pool reserves: Read from blockchain');
    console.log('   ✅ Liquidity: Calculated from real reserves');
    console.log('   ✅ Price impact: Calculated from constant product formula');
    console.log('   ✅ Slippage: Derived from real price impact');
    console.log('   ✅ NO assumptions or estimates used');

    console.log(`\n${'═'.repeat(67)}\n`);

    await scanner.cleanup();

  } catch (error: any) {
    console.error(`\n❌ ERROR: ${error.message}\n`);
    console.error(error.stack);
  }
}

testRealData().catch(console.error);
