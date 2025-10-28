import { logger } from './utils/logger';
import { config, validateConfig } from './config/config';
import { PriceScanner } from './services/PriceScanner';
import { ArbitrageDetector } from './services/ArbitrageDetector';
import { TelegramNotifier } from './services/TelegramBot';
import { TradeExecutor } from './services/TradeExecutor';
import { HIGH_LIQUIDITY_PAIRS } from './config/constants';

class ProductionFlashLoanArbitrageBot {
  private priceScanner: PriceScanner;
  private arbitrageDetector: ArbitrageDetector;
  private telegramBot: TelegramNotifier;
  private tradeExecutor: TradeExecutor;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private autoExecute: boolean = true; // Fully automated execution
  private stats = {
    totalScans: 0,
    opportunitiesFound: 0,
    tradesExecuted: 0,
    totalProfit: 0,
    startTime: Date.now(),
  };

  constructor() {
    logger.info('🚀 Initializing Production Flash Loan Arbitrage Bot...');
    
    // Validate configuration
    try {
      validateConfig();
    } catch (error) {
      logger.error('Configuration validation failed:', error);
      process.exit(1);
    }

    // Initialize services
    this.priceScanner = new PriceScanner();
    this.arbitrageDetector = new ArbitrageDetector();
    this.telegramBot = new TelegramNotifier();
    this.tradeExecutor = new TradeExecutor(this.priceScanner);

    // Register trade execution callback
    this.telegramBot.onExecute(async (opportunity) => {
      await this.executeOpportunity(opportunity);
    });

    // Register bot control callbacks
    this.telegramBot.onBotControls({
      start: () => this.start(),
      stop: () => this.stop(),
      pause: () => this.pause(),
      resume: () => this.resume(),
    });

    logger.info('✅ Bot initialized successfully');
    logger.info(`📍 Wallet: ${this.tradeExecutor.getWalletAddress()}`);
    logger.info(`💰 Min Profit: $${config.flashLoan.minProfitUSD}`);
    logger.info(`💵 Loan Amount: $${config.flashLoan.minLoanAmountUSD.toLocaleString()}`);
    logger.info(`⏱️ Scan Interval: ${config.monitoring.scanIntervalMs / 1000}s`);
  }

  /**
   * Start the bot
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Bot is already running');
      return;
    }

    logger.info('🎬 Starting production arbitrage bot...');
    this.isRunning = true;
    this.stats.startTime = Date.now();

    // Check wallet balance
    const balance = await this.tradeExecutor.checkBalance();
    logger.info(`💰 Wallet Balance: ${balance.eth} ETH ($${balance.ethValue.toFixed(2)})`);
    
    if (balance.ethValue < 0.01) {
      logger.warn('⚠️  Low ETH balance. Make sure you have enough for gas fees!');
      await this.telegramBot.sendMessage(
        '⚠️ *Warning*: Low ETH balance. Please add funds for gas fees.'
      );
    }

    // Start scanning loop
    await this.scanLoop();

    logger.info('✅ Bot started successfully');
  }

  /**
   * Main scanning loop
   */
  private async scanLoop() {
    while (this.isRunning) {
      try {
        await this.scan();
        
        // Wait for next scan interval
        await this.sleep(config.monitoring.scanIntervalMs);
      } catch (error) {
        logger.error('Error in scan loop:', error);
        await this.telegramBot.sendError(`Scan error: ${(error as Error).message}`);
        
        // Wait a bit before retrying
        await this.sleep(5000);
      }
    }
  }

  /**
   * Perform a single scan
   */
  private async scan() {
    logger.info('🔍 Starting ultra-fast production scan...');
    const startTime = Date.now();
    this.stats.totalScans++;

    // Use batch scanning for maximum speed
    const priceData = await this.priceScanner.batchScanPrices(HIGH_LIQUIDITY_PAIRS);
    
    // Detect arbitrage opportunities
    const opportunities = this.arbitrageDetector.detectArbitrage(priceData);
    this.stats.opportunitiesFound += opportunities.length;
    
    const scanTime = Date.now() - startTime;
    logger.info(`✅ Scan complete in ${scanTime}ms. Found ${opportunities.length} opportunities.`);

    // Process opportunities
    if (opportunities.length > 0) {
      await this.processOpportunities(opportunities);
    }

    // Send periodic status updates
    if (this.stats.totalScans % 10 === 0) {
      await this.sendStatusUpdate();
    }
  }

  /**
   * Process detected opportunities
   */
  private async processOpportunities(opportunities: any[]) {
    // Get best opportunity
    const bestOpportunity = opportunities[0];
    
    logger.info(`🎯 Best opportunity: ${bestOpportunity.profitPercentage.toFixed(3)}% profit`);
    
    // Send alert to Telegram
    await this.telegramBot.sendArbitrageAlert(bestOpportunity, this.autoExecute);
    
    // Auto-execute if enabled
    if (this.autoExecute) {
      await this.executeOpportunity(bestOpportunity);
    }
  }

  /**
   * Execute an arbitrage opportunity
   */
  private async executeOpportunity(opportunity: any) {
    logger.info('⚡ Executing arbitrage opportunity...');
    
    try {
      const result = await this.tradeExecutor.executeArbitrage(opportunity);
      
      // Send result to Telegram
      await this.telegramBot.sendExecutionResult(
        result.success,
        result.txHash,
        result.profit,
        result.error
      );

      if (result.success) {
        this.stats.tradesExecuted++;
        this.stats.totalProfit += result.profit || 0;
        logger.info(`🎉 Trade executed successfully! Profit: $${result.profit?.toFixed(2)}`);
      } else {
        logger.error(`❌ Trade execution failed: ${result.error}`);
      }
    } catch (error) {
      logger.error('Error executing opportunity:', error);
      await this.telegramBot.sendExecutionResult(
        false,
        undefined,
        undefined,
        (error as Error).message
      );
    }
  }

  /**
   * Pause the bot
   */
  pause() {
    logger.info('⏸️ Pausing bot...');
    this.isRunning = false;
  }

  /**
   * Resume the bot
   */
  resume() {
    logger.info('▶️ Resuming bot...');
    this.isRunning = true;
    this.scanLoop();
  }

  /**
   * Stop the bot
   */
  stop() {
    logger.info('🛑 Stopping bot...');
    this.isRunning = false;
    
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    
    logger.info('✅ Bot stopped');
  }

  /**
   * Send status update
   */
  private async sendStatusUpdate() {
    const uptime = Math.floor((Date.now() - this.stats.startTime) / 1000 / 60);
    const avgProfit = this.stats.tradesExecuted > 0 ? this.stats.totalProfit / this.stats.tradesExecuted : 0;
    
    const message = (
      `📊 *Bot Status Update*\\n\\n` +
      `⏱️ Uptime: ${uptime} minutes\\n` +
      `🔍 Total Scans: ${this.stats.totalScans}\\n` +
      `🎯 Opportunities Found: ${this.stats.opportunitiesFound}\\n` +
      `⚡ Trades Executed: ${this.stats.tradesExecuted}\\n` +
      `💰 Total Profit: $${this.stats.totalProfit.toFixed(2)}\\n` +
      `📈 Avg Profit/Trade: $${avgProfit.toFixed(2)}\\n\\n` +
      `🤖 Bot is running smoothly!`
    );
    
    await this.telegramBot.sendMessage(message);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  logger.info('');
  logger.info('═══════════════════════════════════════════════════════');
  logger.info('   PRODUCTION FLASH LOAN ARBITRAGE BOT');
  logger.info('   ARBITRUM MAINNET - FULLY AUTOMATED');
  logger.info('═══════════════════════════════════════════════════════');
  logger.info('');

  const bot = new ProductionFlashLoanArbitrageBot();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('\\n📴 Received SIGINT, shutting down gracefully...');
    bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('\\n📴 Received SIGTERM, shutting down gracefully...');
    bot.stop();
    process.exit(0);
  });

  // Start the bot
  await bot.start();
}

// Run the bot
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});