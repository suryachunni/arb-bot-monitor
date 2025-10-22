import { logger } from './utils/logger';
import { config, validateConfig } from './config/config';
import { PriceScanner } from './services/PriceScanner';
import { ArbitrageDetector } from './services/ArbitrageDetector';
import { TelegramNotifier } from './services/TelegramBot';
import { TradeExecutor } from './services/TradeExecutor';
import { HIGH_LIQUIDITY_PAIRS } from './config/constants';

class FlashLoanArbitrageBot {
  private priceScanner: PriceScanner;
  private arbitrageDetector: ArbitrageDetector;
  private telegramBot: TelegramNotifier;
  private tradeExecutor: TradeExecutor;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private autoExecute: boolean = true; // Set to true for fully automated execution

  constructor() {
    logger.info('🚀 Initializing Flash Loan Arbitrage Bot...');
    
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

    logger.info('✅ Bot initialized successfully');
    logger.info(`📍 Wallet: ${this.tradeExecutor.getWalletAddress()}`);
    logger.info(`💰 Min Profit: $${config.flashLoan.minProfitUSD}`);
    logger.info(`💵 Loan Amount: $${config.flashLoan.minLoanAmountUSD.toLocaleString()}`);
  }

  /**
   * Start the bot
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Bot is already running');
      return;
    }

    logger.info('🎬 Starting arbitrage bot...');
    this.isRunning = true;

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
    logger.info('🔍 Starting scan...');
    const startTime = Date.now();

    // Scan all token pairs
    const priceData = await this.priceScanner.scanAllPairs(HIGH_LIQUIDITY_PAIRS);
    
    // Detect arbitrage opportunities
    const opportunities = this.arbitrageDetector.detectArbitrage(priceData);
    
    const scanTime = Date.now() - startTime;
    logger.info(`✅ Scan complete in ${scanTime}ms. Found ${opportunities.length} opportunities.`);

    // Process opportunities
    if (opportunities.length > 0) {
      await this.processOpportunities(opportunities);
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
    
    // If auto-execute is disabled, wait for manual confirmation via Telegram
    // The callback will handle execution
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
  logger.info('   FLASH LOAN ARBITRAGE BOT - ARBITRUM MAINNET');
  logger.info('═══════════════════════════════════════════════════════');
  logger.info('');

  const bot = new FlashLoanArbitrageBot();
  
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

  // Start the bot
  await bot.start();
}

// Run the bot
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
