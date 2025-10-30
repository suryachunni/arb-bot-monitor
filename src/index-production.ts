import { ethers } from 'ethers';
import { logger } from './utils/logger';
import { config, validateConfig } from './config/config';
import { ProductionPriceOracle } from './services/ProductionPriceOracle';
import { ProductionArbitrageScanner } from './services/ProductionArbitrageScanner';
import { ProductionTelegramBot } from './services/ProductionTelegramBot';
import { ProductionTradeExecutor } from './services/ProductionTradeExecutor';

/**
 * ═══════════════════════════════════════════════════════════════════
 * PRODUCTION FLASH LOAN ARBITRAGE BOT
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Features:
 * ✅ Real-time price scanning (every 2 minutes)
 * ✅ Multi-DEX support (Uniswap V3, SushiSwap, Balancer)
 * ✅ Bidirectional + Triangular arbitrage
 * ✅ Automated flash loan execution
 * ✅ MEV protection
 * ✅ Gas optimization
 * ✅ Slippage protection
 * ✅ Telegram alerts & control
 * ✅ Profit tracking
 * 
 * Author: Production-Grade Bot v2.0
 * Network: Arbitrum Mainnet
 * ═══════════════════════════════════════════════════════════════════
 */

class ProductionFlashLoanBot {
  private provider: ethers.providers.JsonRpcProvider;
  private priceOracle: ProductionPriceOracle;
  private scanner: ProductionArbitrageScanner;
  private telegramBot: ProductionTelegramBot;
  private executor: ProductionTradeExecutor;
  private isRunning: boolean = false;
  private scanCount: number = 0;
  private totalProfitUSD: number = 0;
  private successfulTrades: number = 0;
  private failedTrades: number = 0;

  constructor() {
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════════════════');
    logger.info('   PRODUCTION FLASH LOAN ARBITRAGE BOT - ARBITRUM MAINNET');
    logger.info('═══════════════════════════════════════════════════════════════════');
    logger.info('');

    // Validate configuration
    try {
      validateConfig();
      logger.info('✅ Configuration validated');
    } catch (error) {
      logger.error('❌ Configuration validation failed:', error);
      process.exit(1);
    }

    // Initialize provider
    this.provider = new ethers.providers.JsonRpcProvider(config.network.rpcUrl);
    logger.info(`✅ Connected to Arbitrum RPC`);

    // Initialize services
    this.priceOracle = new ProductionPriceOracle(this.provider);
    logger.info('✅ Price Oracle initialized');

    this.scanner = new ProductionArbitrageScanner(
      this.priceOracle,
      5_000_000, // $5M min liquidity
      config.flashLoan.minProfitUSD,
      config.flashLoan.maxGasPriceGwei
    );
    logger.info('✅ Arbitrage Scanner initialized');

    this.telegramBot = new ProductionTelegramBot(
      config.telegram.botToken,
      config.telegram.chatId,
      true // Auto-execute enabled by default
    );
    logger.info('✅ Telegram Bot initialized');

    // Check if contract address is configured
    if (!config.contract.address) {
      logger.error('❌ Contract address not configured! Please deploy contract first.');
      logger.info('Run: npm run deploy');
      process.exit(1);
    }

    this.executor = new ProductionTradeExecutor(
      this.provider,
      config.wallet.privateKey,
      config.contract.address,
      true, // MEV protection
      config.flashLoan.maxGasPriceGwei,
      config.monitoring.maxSlippagePercent
    );
    logger.info('✅ Trade Executor initialized');

    // Register execution callback
    this.telegramBot.onExecute(async (opportunity) => {
      await this.executeOpportunity(opportunity);
    });

    logger.info('');
    logger.info('═══════════════════════════════════════════════════════════════════');
    logger.info('');
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('⚠️  Bot is already running');
      return;
    }

    logger.info('🚀 Starting Production Flash Loan Arbitrage Bot...');
    this.isRunning = true;

    // Check wallet balance
    const balance = await this.executor.checkBalance();
    logger.info(`💰 Wallet Balance: ${balance.eth} ETH ($${balance.ethValue.toFixed(2)})`);

    if (balance.ethValue < 10) {
      logger.warn('⚠️  Low ETH balance. Recommended: At least 0.01 ETH for gas fees.');
      await this.telegramBot.sendMessage(
        '⚠️ *Warning*: Low ETH balance\n\n' +
        `Balance: ${balance.eth} ETH\n` +
        'Please add funds for gas fees.'
      );
    }

    // Send startup message
    await this.telegramBot.sendMessage(
      '🚀 *BOT STARTED*\n\n' +
      '✅ All systems operational\n' +
      `💰 Wallet: ${this.executor.getWalletAddress().slice(0, 10)}...\n` +
      `💵 Balance: ${balance.eth} ETH\n` +
      `📊 Min Profit: $${config.flashLoan.minProfitUSD}\n` +
      `🔍 Scan Interval: 2 minutes\n` +
      `⚡ Auto-Execute: ${this.telegramBot.isAutoExecuteEnabled() ? 'ON' : 'OFF'}\n\n` +
      'Scanning for arbitrage opportunities...'
    );

    // Start scanning loop
    await this.scanningLoop();
  }

  /**
   * Main scanning loop
   */
  private async scanningLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.performScan();

        // Wait for next scan (2 minutes = 120000ms)
        const waitTime = config.monitoring.scanIntervalMs || 120000;
        logger.info(`⏳ Waiting ${waitTime / 1000} seconds until next scan...`);
        await this.sleep(waitTime);

      } catch (error) {
        logger.error('❌ Error in scanning loop:', error);
        await this.telegramBot.sendError(`Scan error: ${(error as Error).message}`);

        // Wait a bit before retrying
        await this.sleep(10000);
      }
    }
  }

  /**
   * Perform a single comprehensive scan
   */
  private async performScan(): Promise<void> {
    this.scanCount++;
    const startTime = Date.now();

    logger.info('');
    logger.info('═══════════════════════════════════════════════════════════════════');
    logger.info(`🔍 SCAN #${this.scanCount} - ${new Date().toLocaleString()}`);
    logger.info('═══════════════════════════════════════════════════════════════════');

    try {
      // Clear price cache for fresh data
      this.priceOracle.clearCache();

      // Scan for all arbitrage opportunities
      const opportunities = await this.scanner.scanAllOpportunities();

      const scanTime = Date.now() - startTime;
      logger.info(`✅ Scan completed in ${scanTime}ms`);
      logger.info(`📊 Found ${opportunities.length} opportunities`);

      if (opportunities.length > 0) {
        // Show top 3 opportunities
        logger.info('');
        logger.info('🎯 Top Opportunities:');
        opportunities.slice(0, 3).forEach((opp, index) => {
          logger.info(
            `  ${index + 1}. ${opp.type.toUpperCase()}: ${opp.path.join('→')} | ` +
            `Profit: $${opp.netProfitUSD.toFixed(2)} | ` +
            `Spread: ${opp.spreadPercent.toFixed(3)}%`
          );
        });

        // Process best opportunity
        const bestOpp = opportunities[0];
        await this.processOpportunity(bestOpp);
      } else {
        logger.info('ℹ️  No profitable opportunities found this scan');
      }

      logger.info('');
      logger.info('📈 Session Statistics:');
      logger.info(`  Total Scans: ${this.scanCount}`);
      logger.info(`  Successful Trades: ${this.successfulTrades}`);
      logger.info(`  Failed Trades: ${this.failedTrades}`);
      logger.info(`  Total Profit: $${this.totalProfitUSD.toFixed(2)}`);
      logger.info('═══════════════════════════════════════════════════════════════════');

    } catch (error) {
      logger.error('❌ Scan failed:', error);
      throw error;
    }
  }

  /**
   * Process detected opportunity
   */
  private async processOpportunity(opportunity: any): Promise<void> {
    logger.info('');
    logger.info('🎯 Processing opportunity...');

    try {
      // Send alert to Telegram
      await this.telegramBot.sendArbitrageAlert(opportunity);

      // Note: Execution is handled by the callback registered in constructor
      // If auto-execute is ON, it will execute immediately
      // If auto-execute is OFF, user must click button in Telegram

    } catch (error) {
      logger.error('❌ Error processing opportunity:', error);
    }
  }

  /**
   * Execute arbitrage opportunity
   */
  private async executeOpportunity(opportunity: any): Promise<void> {
    logger.info('');
    logger.info('⚡⚡⚡ EXECUTING ARBITRAGE TRADE ⚡⚡⚡');

    try {
      const result = await this.executor.executeArbitrage(opportunity);

      // Send result to Telegram
      await this.telegramBot.sendExecutionResult(
        result.success,
        result.txHash,
        opportunity.netProfitUSD,
        result.error
      );

      if (result.success) {
        this.successfulTrades++;
        this.totalProfitUSD += opportunity.netProfitUSD;
        
        logger.info('');
        logger.info('🎉🎉🎉 TRADE SUCCESSFUL! 🎉🎉🎉');
        logger.info(`💰 Profit: $${opportunity.netProfitUSD.toFixed(2)}`);
        logger.info(`📝 TX: ${result.txHash}`);
        logger.info('');
      } else {
        this.failedTrades++;
        logger.error('❌ Trade execution failed:', result.error);
      }

    } catch (error) {
      this.failedTrades++;
      logger.error('❌ Execution error:', error);
      
      await this.telegramBot.sendExecutionResult(
        false,
        undefined,
        undefined,
        (error as Error).message
      );
    }
  }

  /**
   * Stop the bot
   */
  stop(): void {
    logger.info('');
    logger.info('🛑 Stopping bot...');
    this.isRunning = false;
    
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════════════════');
    logger.info('   FINAL STATISTICS');
    logger.info('═══════════════════════════════════════════════════════════════════');
    logger.info(`Total Scans: ${this.scanCount}`);
    logger.info(`Successful Trades: ${this.successfulTrades}`);
    logger.info(`Failed Trades: ${this.failedTrades}`);
    logger.info(`Total Profit: $${this.totalProfitUSD.toFixed(2)}`);
    logger.info('═══════════════════════════════════════════════════════════════════');
    logger.info('');
    logger.info('✅ Bot stopped gracefully');
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════════

async function main() {
  const bot = new ProductionFlashLoanBot();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('\n📴 Received SIGINT, shutting down gracefully...');
    bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('\n📴 Received SIGTERM, shutting down gracefully...');
    bot.stop();
    process.exit(0);
  });

  // Handle unhandled errors
  process.on('unhandledRejection', (error) => {
    logger.error('❌ Unhandled rejection:', error);
  });

  process.on('uncaughtException', (error) => {
    logger.error('❌ Uncaught exception:', error);
    bot.stop();
    process.exit(1);
  });

  // Start the bot
  await bot.start();
}

// Run
main().catch((error) => {
  logger.error('❌ Fatal error:', error);
  process.exit(1);
});
