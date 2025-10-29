/**
 * ═══════════════════════════════════════════════════════════════════
 * PRODUCTION FLASH LOAN ARBITRAGE BOT
 * Enterprise-Grade Automated Trading System
 * ═══════════════════════════════════════════════════════════════════
 */

import { productionConfig } from './config/production.config';
import { UltraFastArbitrageScanner, ArbitrageOpportunity } from './services/UltraFastArbitrageScanner';
import { AdvancedFlashLoanExecutor } from './services/AdvancedFlashLoanExecutor';
import { ProductionTelegramBot } from './services/ProductionTelegramBot';
import { LiquidityValidator } from './services/LiquidityValidator';
import { HIGH_LIQUIDITY_PAIRS } from './config/tokens.config';
import { ethers } from 'ethers';

/**
 * Production-grade arbitrage bot with enterprise features
 */
class ProductionArbitrageBot {
  private scanner: UltraFastArbitrageScanner;
  private executor: AdvancedFlashLoanExecutor;
  private telegram: ProductionTelegramBot;
  private liquidityValidator: LiquidityValidator;
  
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;
  
  // Performance tracking
  private stats = {
    scansCompleted: 0,
    opportunitiesFound: 0,
    opportunitiesExecuted: 0,
    successfulTrades: 0,
    failedTrades: 0,
    totalProfitUSD: 0,
    totalGasSpentUSD: 0,
    startTime: Date.now(),
  };

  // Circuit breaker
  private consecutiveFailures: number = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 5;
  private circuitBreakerActive: boolean = false;

  constructor() {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('   PRODUCTION FLASH LOAN ARBITRAGE BOT - ARBITRUM MAINNET');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('\n');

    // Initialize all services
    console.log('🔧 Initializing services...\n');
    
    this.scanner = new UltraFastArbitrageScanner();
    this.executor = new AdvancedFlashLoanExecutor();
    this.telegram = new ProductionTelegramBot();
    this.liquidityValidator = new LiquidityValidator();

    // Register execution callback from Telegram
    this.telegram.onExecute(async (opportunity) => {
      await this.executeOpportunity(opportunity);
    });

    console.log('\n✅ All services initialized successfully\n');
  }

  /**
   * Start the production bot
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Bot is already running');
      return;
    }

    try {
      console.log('🚀 Starting Production Arbitrage Bot...\n');

      // Pre-flight checks
      await this.performPreflightChecks();

      // Send startup notification
      const balance = await this.executor.getWalletBalance();
      await this.telegram.sendStartupNotification(
        this.executor.getWalletAddress(),
        balance.eth
      );

      // Start scanning loop
      this.isRunning = true;
      this.stats.startTime = Date.now();

      console.log('\n═══════════════════════════════════════════════════════════════════');
      console.log('🎬 BOT STARTED - SCANNING FOR ARBITRAGE OPPORTUNITIES');
      console.log('═══════════════════════════════════════════════════════════════════\n');

      // Run first scan immediately
      this.runScanCycle();

      // Schedule periodic scans
      this.scanInterval = setInterval(
        () => this.runScanCycle(),
        productionConfig.scanning.scanIntervalMs
      );

    } catch (error: any) {
      console.error('❌ Failed to start bot:', error.message);
      await this.telegram.sendError(`Bot startup failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Perform pre-flight checks before starting
   */
  private async performPreflightChecks() {
    console.log('✈️  PRE-FLIGHT CHECKS\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check 1: Wallet balance
    const balance = await this.executor.getWalletBalance();
    console.log(`✅ Wallet: ${this.executor.getWalletAddress()}`);
    console.log(`✅ Balance: ${balance.eth} ETH ($${(balance.ethValue * 2000).toFixed(2)})`);

    if (balance.ethValue < 0.01) {
      throw new Error('Insufficient ETH balance for gas fees (need at least 0.01 ETH)');
    }

    // Check 2: Flash loan contract
    if (!productionConfig.contracts.flashLoanContract) {
      console.log('⚠️  WARNING: Flash loan contract not deployed');
      console.log('⚠️  Please deploy the contract before trading\n');
    } else {
      console.log(`✅ Flash Loan Contract: ${productionConfig.contracts.flashLoanContract}`);
    }

    // Check 3: Configuration
    console.log(`✅ Network: ${productionConfig.network.name} (Chain ID: ${productionConfig.network.chainId})`);
    console.log(`✅ Min Loan: $${productionConfig.flashLoan.minLoanAmountUSD.toLocaleString()}`);
    console.log(`✅ Min Profit: $${productionConfig.flashLoan.minProfitUSD} (${productionConfig.flashLoan.minProfitPercentage}%)`);
    console.log(`✅ Scan Interval: ${productionConfig.scanning.scanIntervalMs / 1000 / 60} minutes`);
    console.log(`✅ Auto-Execute: ${productionConfig.automation.autoExecute ? 'ENABLED' : 'DISABLED'}`);
    console.log(`✅ MEV Protection: ${productionConfig.mev.enabled ? 'ENABLED' : 'DISABLED'}`);

    console.log('\n✅ All pre-flight checks passed\n');
  }

  /**
   * Run a complete scan cycle
   */
  private async runScanCycle() {
    if (this.circuitBreakerActive) {
      console.log('🔴 CIRCUIT BREAKER ACTIVE - Skipping scan');
      await this.telegram.sendError('Circuit breaker active - too many consecutive failures');
      return;
    }

    const cycleStartTime = Date.now();
    
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log(`│ 🔍 SCAN CYCLE #${this.stats.scansCompleted + 1}`);
    console.log(`│ ${new Date().toISOString()}`);
    console.log('└─────────────────────────────────────────────────────────────────┘\n');

    try {
      // STEP 1: Scan all pairs for arbitrage opportunities
      console.log(`📊 Scanning ${HIGH_LIQUIDITY_PAIRS.length} token pairs...\n`);
      
      const opportunities = await this.scanner.scanMultiplePairs(
        HIGH_LIQUIDITY_PAIRS,
        productionConfig.flashLoan.minLoanAmountUSD
      );

      console.log(`\n💡 Found ${opportunities.length} potential opportunities\n`);
      
      this.stats.scansCompleted++;
      this.stats.opportunitiesFound += opportunities.length;

      if (opportunities.length === 0) {
        const scanTime = Date.now() - cycleStartTime;
        console.log(`⏱  Scan completed in ${scanTime}ms - No opportunities found`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        return;
      }

      // STEP 2: Validate liquidity for each opportunity
      console.log('🔬 VALIDATING LIQUIDITY...\n');
      
      const validatedOpportunities = await this.liquidityValidator.validateBatch(opportunities);

      console.log(`\n✅ ${validatedOpportunities.length}/${opportunities.length} opportunities passed liquidity validation\n`);

      if (validatedOpportunities.length === 0) {
        console.log('❌ No opportunities with sufficient liquidity');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        return;
      }

      // STEP 3: Sort by profitability and depth score
      const sortedOpportunities = validatedOpportunities
        .sort((a, b) => {
          // Primary: Net profit USD
          // Secondary: Depth score
          const profitDiff = b.opportunity.netProfitUSD - a.opportunity.netProfitUSD;
          if (profitDiff !== 0) return profitDiff;
          return b.analysis.depthScore - a.analysis.depthScore;
        });

      // STEP 4: Process best opportunity
      const best = sortedOpportunities[0];
      
      console.log('🎯 BEST OPPORTUNITY SELECTED:\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Pair: ${best.opportunity.token0Symbol}/${best.opportunity.token1Symbol}`);
      console.log(`Route: ${best.opportunity.buyDex} → ${best.opportunity.sellDex}`);
      console.log(`Spread: ${best.opportunity.spreadPercentage.toFixed(3)}%`);
      console.log(`Net Profit: $${best.opportunity.netProfitUSD.toFixed(2)} (${best.opportunity.netProfitPercentage.toFixed(2)}%)`);
      console.log(`Liquidity: $${best.analysis.liquidityUSD.toLocaleString()}`);
      console.log(`Depth Score: ${best.analysis.depthScore}/100`);
      console.log(`Confidence: ${best.opportunity.confidence}%`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // STEP 5: Send Telegram alert
      await this.telegram.sendOpportunityAlert(
        best.opportunity,
        productionConfig.automation.autoExecute
      );

      // STEP 6: Execute if auto-execute is enabled
      if (productionConfig.automation.autoExecute) {
        await this.executeOpportunity(best.opportunity);
      } else {
        console.log('⏳ Waiting for manual confirmation via Telegram...\n');
      }

      const scanTime = Date.now() - cycleStartTime;
      console.log(`⏱  Scan cycle completed in ${scanTime}ms\n`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error: any) {
      console.error('❌ Scan cycle error:', error.message);
      await this.telegram.sendError(`Scan error: ${error.message}`);
      
      this.consecutiveFailures++;
      
      if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        this.activateCircuitBreaker();
      }
    }
  }

  /**
   * Execute an arbitrage opportunity
   */
  private async executeOpportunity(opportunity: ArbitrageOpportunity) {
    console.log('\n⚡ EXECUTING OPPORTUNITY...\n');
    
    this.stats.opportunitiesExecuted++;

    try {
      const result = await this.executor.executeArbitrage(opportunity);

      // Send result to Telegram
      await this.telegram.sendExecutionResult(
        result.success,
        result.txHash,
        result.profitUSD,
        result.error
      );

      if (result.success) {
        // Success - reset circuit breaker
        this.consecutiveFailures = 0;
        this.stats.successfulTrades++;
        this.stats.totalProfitUSD += result.profitUSD || 0;
        
        console.log('\n🎉 TRADE SUCCESSFUL!\n');
      } else {
        // Failure
        this.consecutiveFailures++;
        this.stats.failedTrades++;
        
        console.log('\n❌ TRADE FAILED\n');
        
        // Check circuit breaker
        if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
          this.activateCircuitBreaker();
        }
      }

    } catch (error: any) {
      console.error('❌ Execution error:', error.message);
      await this.telegram.sendError(`Execution error: ${error.message}`);
      
      this.consecutiveFailures++;
      this.stats.failedTrades++;
      
      if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        this.activateCircuitBreaker();
      }
    }
  }

  /**
   * Activate circuit breaker to prevent further losses
   */
  private activateCircuitBreaker() {
    this.circuitBreakerActive = true;
    
    console.log('\n🔴 ═══════════════════════════════════════════════════════════════');
    console.log('🔴 CIRCUIT BREAKER ACTIVATED');
    console.log('🔴 ═══════════════════════════════════════════════════════════════');
    console.log(`🔴 ${this.consecutiveFailures} consecutive failures detected`);
    console.log('🔴 Trading halted to prevent further losses');
    console.log('🔴 Manual intervention required');
    console.log('🔴 ═══════════════════════════════════════════════════════════════\n');

    this.telegram.sendError(
      `🔴 CIRCUIT BREAKER ACTIVATED!\n\n` +
      `${this.consecutiveFailures} consecutive failures.\n` +
      `Trading halted to prevent losses.\n` +
      `Please investigate and restart manually.`
    );

    // Stop the bot
    this.stop();
  }

  /**
   * Get bot statistics
   */
  getStatistics() {
    const uptime = Date.now() - this.stats.startTime;
    const uptimeHours = (uptime / 1000 / 60 / 60).toFixed(2);
    
    return {
      ...this.stats,
      uptime: `${uptimeHours} hours`,
      successRate: this.stats.opportunitiesExecuted > 0
        ? `${((this.stats.successfulTrades / this.stats.opportunitiesExecuted) * 100).toFixed(2)}%`
        : '0%',
      netProfit: `$${(this.stats.totalProfitUSD - this.stats.totalGasSpentUSD).toFixed(2)}`,
    };
  }

  /**
   * Stop the bot
   */
  stop() {
    console.log('\n🛑 Stopping bot...\n');
    
    this.isRunning = false;
    
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    // Print final statistics
    console.log('📊 FINAL STATISTICS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const stats = this.getStatistics();
    console.log(`Scans: ${stats.scansCompleted}`);
    console.log(`Opportunities Found: ${stats.opportunitiesFound}`);
    console.log(`Trades Executed: ${stats.opportunitiesExecuted}`);
    console.log(`Successful: ${stats.successfulTrades}`);
    console.log(`Failed: ${stats.failedTrades}`);
    console.log(`Success Rate: ${stats.successRate}`);
    console.log(`Total Profit: $${stats.totalProfitUSD.toFixed(2)}`);
    console.log(`Net Profit: ${stats.netProfit}`);
    console.log(`Uptime: ${stats.uptime}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    this.telegram.stop();
    
    console.log('✅ Bot stopped\n');
  }
}

/**
 * Main entry point
 */
async function main() {
  const bot = new ProductionArbitrageBot();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n📴 Received SIGINT signal...');
    bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n\n📴 Received SIGTERM signal...');
    bot.stop();
    process.exit(0);
  });

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('\n💥 UNCAUGHT EXCEPTION:', error);
    bot.stop();
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('\n💥 UNHANDLED REJECTION:', reason);
    bot.stop();
    process.exit(1);
  });

  // Start the bot
  await bot.start();
}

// Run the bot
main().catch((error) => {
  console.error('\n💥 FATAL ERROR:', error);
  process.exit(1);
});
