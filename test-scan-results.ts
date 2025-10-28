import { ethers } from 'ethers';
import { UltraFastPriceScanner } from './src/services/UltraFastPriceScanner';
import { ArbitrageDetector } from './src/services/ArbitrageDetector';
import { TriangularArbitrageDetector } from './src/services/TriangularArbitrageDetector';
import { DynamicLoanCalculator } from './src/services/DynamicLoanCalculator';
import { LiquidityValidator } from './src/services/LiquidityValidator';
import { HIGH_LIQUIDITY_PAIRS } from './src/config/constants';

async function runTestScan() {
  console.log('🚀 Starting Ultra-Fast Test Scan...\n');
  
  try {
    // Initialize services
    const priceScanner = new UltraFastPriceScanner();
    const arbitrageDetector = new ArbitrageDetector();
    const triangularDetector = new TriangularArbitrageDetector();
    const loanCalculator = new DynamicLoanCalculator();
    const liquidityValidator = new LiquidityValidator();
    
    // Step 1: Ultra-fast price scanning
    console.log('📊 Step 1: Scanning prices across all DEXs...');
    const scanStart = Date.now();
    const scanResult = await priceScanner.scanUltraFast(HIGH_LIQUIDITY_PAIRS);
    const scanTime = Date.now() - scanStart;
    
    console.log(`✅ Price scan completed in ${scanTime}ms`);
    console.log(`📈 Successfully scanned ${scanResult.successfulPairs}/${scanResult.totalPairs} pairs`);
    console.log(`⚡ Average latency: ${scanResult.averageLatency}ms\n`);
    
    // Step 2: Detect regular arbitrage opportunities
    console.log('🎯 Step 2: Detecting arbitrage opportunities...');
    const arbitrageStart = Date.now();
    const arbitrageOpportunities = arbitrageDetector.detectArbitrage(scanResult.prices);
    const arbitrageTime = Date.now() - arbitrageStart;
    
    console.log(`✅ Arbitrage detection completed in ${arbitrageTime}ms`);
    console.log(`🎯 Found ${arbitrageOpportunities.length} arbitrage opportunities\n`);
    
    // Step 3: Detect triangular arbitrage opportunities
    console.log('🔺 Step 3: Detecting triangular arbitrage opportunities...');
    const triangularStart = Date.now();
    const triangularOpportunities = triangularDetector.detectTriangularArbitrage(scanResult.prices);
    const triangularTime = Date.now() - triangularStart;
    
    console.log(`✅ Triangular arbitrage detection completed in ${triangularTime}ms`);
    console.log(`🔺 Found ${triangularOpportunities.length} triangular arbitrage opportunities\n`);
    
    // Step 4: Process opportunities with loan calculation
    console.log('💰 Step 4: Processing opportunities with dynamic loan sizing...');
    const processStart = Date.now();
    
    const processedOpportunities = [];
    const gasPrice = ethers.utils.parseUnits('20', 'gwei');
    
    for (const opportunity of arbitrageOpportunities.slice(0, 5)) { // Process top 5
      try {
        // Validate liquidity
        const liquidityData = await liquidityValidator.validateLiquidity(
          opportunity.tokenAAddress,
          opportunity.tokenBAddress,
          opportunity.buyDex,
          ethers.utils.parseEther('1')
        );
        
        if (!liquidityData || !liquidityData.isLiquidEnough) {
          console.log(`❌ Rejected ${opportunity.tokenA}/${opportunity.tokenB}: ${liquidityData?.rejectionReason || 'Liquidity validation failed'}`);
          continue;
        }
        
        // Calculate optimal loan
        const loanCalculation = loanCalculator.calculateOptimalLoan(
          opportunity,
          liquidityData,
          gasPrice
        );
        
        if (!loanCalculation) {
          console.log(`❌ Rejected ${opportunity.tokenA}/${opportunity.tokenB}: Loan calculation failed`);
          continue;
        }
        
        processedOpportunities.push({
          ...opportunity,
          loanCalculation,
          liquidityData
        });
        
        console.log(`✅ Processed ${opportunity.tokenA}/${opportunity.tokenB}: ${opportunity.profitPercentage.toFixed(2)}% profit, $${loanCalculation.profitAfterCosts.toFixed(2)} after costs`);
        
      } catch (error) {
        console.log(`❌ Error processing ${opportunity.tokenA}/${opportunity.tokenB}: ${error.message}`);
      }
    }
    
    const processTime = Date.now() - processStart;
    console.log(`✅ Opportunity processing completed in ${processTime}ms\n`);
    
    // Step 5: Generate Telegram-style results
    console.log('📱 Step 5: Generating Telegram Alert Results...\n');
    
    // Generate main scan results
    const totalTime = Date.now() - scanStart;
    const telegramResults = generateTelegramResults(
      scanResult,
      arbitrageOpportunities,
      triangularOpportunities,
      processedOpportunities,
      totalTime
    );
    
    console.log('='.repeat(80));
    console.log('📱 TELEGRAM BOT ALERT RESULTS');
    console.log('='.repeat(80));
    console.log(telegramResults);
    console.log('='.repeat(80));
    
    // Generate performance summary
    console.log('\n📊 PERFORMANCE SUMMARY');
    console.log('='.repeat(50));
    console.log(`⚡ Total Scan Time: ${totalTime}ms`);
    console.log(`📈 Price Scan: ${scanTime}ms (${scanResult.successfulPairs} pairs)`);
    console.log(`🎯 Arbitrage Detection: ${arbitrageTime}ms (${arbitrageOpportunities.length} opportunities)`);
    console.log(`🔺 Triangular Detection: ${triangularTime}ms (${triangularOpportunities.length} opportunities)`);
    console.log(`💰 Opportunity Processing: ${processTime}ms (${processedOpportunities.length} processed)`);
    console.log(`📊 Success Rate: ${((scanResult.successfulPairs / scanResult.totalPairs) * 100).toFixed(1)}%`);
    console.log(`⚡ Average Latency: ${scanResult.averageLatency}ms`);
    
  } catch (error) {
    console.error('❌ Test scan failed:', error);
  }
}

function generateTelegramResults(
  scanResult: any,
  arbitrageOpportunities: any[],
  triangularOpportunities: any[],
  processedOpportunities: any[],
  totalTime: number
): string {
  let result = '';
  
  // Header
  result += '🚀 ULTRA-FAST ARBITRAGE SCAN COMPLETE\n\n';
  
  // Performance metrics
  result += `⚡ Scan Time: ${totalTime}ms\n`;
  result += `📈 Pairs Scanned: ${scanResult.successfulPairs}/${scanResult.totalPairs}\n`;
  result += `📊 Success Rate: ${((scanResult.successfulPairs / scanResult.totalPairs) * 100).toFixed(1)}%\n`;
  result += `⚡ Average Latency: ${scanResult.averageLatency}ms\n\n`;
  
  // Arbitrage opportunities
  if (arbitrageOpportunities.length > 0) {
    result += `🎯 ARBITRAGE OPPORTUNITIES (${arbitrageOpportunities.length})\n`;
    result += '─'.repeat(40) + '\n';
    
    arbitrageOpportunities.slice(0, 5).forEach((opp, index) => {
      result += `${index + 1}. ${opp.tokenA}/${opp.tokenB}\n`;
      result += `   💰 Profit: ${opp.profitPercentage.toFixed(2)}%\n`;
      result += `   📊 Buy: ${opp.buyDex} | Sell: ${opp.sellDex}\n`;
      result += `   💵 Est. Profit: $${opp.estimatedProfitUSD.toFixed(2)}\n\n`;
    });
  }
  
  // Triangular arbitrage opportunities
  if (triangularOpportunities.length > 0) {
    result += `🔺 TRIANGULAR ARBITRAGE (${triangularOpportunities.length})\n`;
    result += '─'.repeat(40) + '\n';
    
    triangularOpportunities.slice(0, 3).forEach((opp, index) => {
      result += `${index + 1}. ${opp.executionPath}\n`;
      result += `   💰 Profit: ${opp.profitPercentage.toFixed(2)}%\n`;
      result += `   🎯 Confidence: ${(opp.confidence * 100).toFixed(1)}%\n`;
      result += `   ⚠️ Risk: ${opp.riskLevel}\n`;
      result += `   💵 Est. Profit: $${opp.estimatedProfitUSD.toFixed(2)}\n\n`;
    });
  }
  
  // Processed opportunities (ready for execution)
  if (processedOpportunities.length > 0) {
    result += `✅ READY FOR EXECUTION (${processedOpportunities.length})\n`;
    result += '─'.repeat(40) + '\n';
    
    processedOpportunities.forEach((opp, index) => {
      result += `${index + 1}. ${opp.tokenA}/${opp.tokenB}\n`;
      result += `   💰 Profit: ${opp.profitPercentage.toFixed(2)}%\n`;
      result += `   💵 After Costs: $${opp.loanCalculation.profitAfterCosts.toFixed(2)}\n`;
      result += `   📊 ROI: ${opp.loanCalculation.roi.toFixed(2)}%\n`;
      result += `   ⚠️ Risk: ${opp.loanCalculation.riskLevel}\n`;
      result += `   🎯 Priority: ${opp.loanCalculation.executionPriority}\n\n`;
    });
  }
  
  // Summary
  result += '📊 SUMMARY\n';
  result += '─'.repeat(20) + '\n';
  result += `🎯 Total Opportunities: ${arbitrageOpportunities.length + triangularOpportunities.length}\n`;
  result += `✅ Ready to Execute: ${processedOpportunities.length}\n`;
  result += `💰 Total Potential Profit: $${(arbitrageOpportunities.reduce((sum, opp) => sum + opp.estimatedProfitUSD, 0) + triangularOpportunities.reduce((sum, opp) => sum + opp.estimatedProfitUSD, 0)).toFixed(2)}\n`;
  result += `⚡ Execution Speed: ${totalTime}ms\n\n`;
  
  result += '🤖 Bot Status: ACTIVE\n';
  result += '⏰ Next Scan: 10 minutes\n';
  result += '📱 Monitoring: ENABLED';
  
  return result;
}

// Run the test scan
if (require.main === module) {
  runTestScan().catch(console.error);
}

export { runTestScan };