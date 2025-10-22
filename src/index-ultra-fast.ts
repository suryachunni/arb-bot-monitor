import { logger } from './utils/logger';
import { config, validateConfig } from './config/config';
import { FastPriceScanner } from './services/FastPriceScanner';
import { FastArbitrageDetector } from './services/FastArbitrageDetector';
import { TelegramNotifier } from './services/TelegramBot';
import { FlashbotsExecutor } from './services/FlashbotsExecutor';
import { HIGH_LIQUIDITY_PAIRS, SPEED_CONSTANTS } from './config/constants';

/**
 * ULTRA-FAST Flash Loan Arbitrage Bot
 * 
 * Key optimizations:
 * - Event-driven (WebSocket, not polling)
 * - Multicall3 (all prices in 1 RPC call)
 * - Sub-second execution target
 * - MEV protection
 * - Accurate profit calculation
 */
class UltraFastArbitrageBot {
  private priceScanner: FastPriceScanner;
  private arbitrageDetector: FastArbitrageDetector;
  private telegramBot: TelegramNotifier;
  private executor: FlashbotsExecutor;
  private isRunning: boolean = false;
  private autoExecute: boolean = true;
  private lastBlockNumber: number = 0;
  private scanCount: number = 0;
  private executionCount: number = 0;
  private successCount: number = 0;
  private totalProfit: number = 0;
  private isScanning: boolean = false;

  constructor() {
    logger.info('⚡⚡⚡ Initializing ULTRA-FAST Arbitrage Bot ⚡⚡⚡');
    
    // Validate configuration
    try {
      validateConfig();
    } catch (error) {
      logger.error('Configuration validation failed:', error);
      process.exit(1);
    }

    // Initialize services
    this.priceScanner = new FastPriceScanner();
    this.arbitrageDetector = new FastArbitrageDetector();
    this.telegramBot = new TelegramNotifier();
    this.executor = new FlashbotsExecutor();

    // Register trade execution callback
    this.telegramBot.onExecute(async (opportunity) => {
      await this.executeOpportunity(opportunity);
    });

    logger.info('✅ ULTRA-FAST Bot initialized');
    logger.info(`📍 Wallet: ${this.executor.getWalletAddress()}`);
    logger.info(`💰 Min Net Profit: $${SPEED_CONSTANTS.MIN_PROFIT_AFTER_GAS}`);
    logger.info(`⚡ Target: < ${SPEED_CONSTANTS.MAX_EXECUTION_TIME_MS}ms execution`);
  }

  /**
   * Start the bot with event-driven architecture
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Bot is already running');
      return;
    }

    logger.info('🚀 Starting ULTRA-FAST arbitrage bot...');
    this.isRunning = true;

    // Check wallet balance
    const balance = await this.executor.checkBalance();
    logger.info(`💰 Wallet Balance: ${balance.eth} ETH ($${(balance.ethValue * 2000).toFixed(2)})`);
    
    if (balance.ethValue < 0.02) {
      logger.warn('⚠️  Low ETH balance! Add more for gas fees.');
      await this.telegramBot.sendMessage(
        '⚠️ *Warning*: Low ETH balance. Add at least 0.05 ETH for gas.'
      );
    }

    // Subscribe to new blocks (EVENT-DRIVEN, not polling!)
    this.priceScanner.onNewBlock(async (blockNumber) => {
      await this.onNewBlock(blockNumber);
    });

    // Also do periodic scans as backup (every 2 seconds)
    setInterval(async () => {
      if (!this.isScanning) {
        await this.scanAndExecute();
      }
    }, 2000);

    logger.info('');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('✅ ULTRA-FAST BOT IS NOW LIVE!');
    logger.info('📡 Listening to every block on Arbitrum');
    logger.info('⚡ Execution target: < 1 second');
    logger.info('🎯 Ready to capture arbitrage opportunities');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('');
  }

  /**
   * Event handler for new blocks (INSTANT reaction!)
   */
  private async onNewBlock(blockNumber: number) {
    // Skip if we've already processed this block
    if (blockNumber <= this.lastBlockNumber) return;
    this.lastBlockNumber = blockNumber;

    // Skip if already scanning
    if (this.isScanning) return;

    // Execute on every 1st block (Arbitrum is ~0.25s per block)
    // This means we scan 4 times per second!
    await this.scanAndExecute();
  }

  /**
   * ULTRA-FAST scan and execute
   */
  private async scanAndExecute() {
    if (this.isScanning) return;
    this.isScanning = true;

    const scanStartTime = Date.now();

    try {
      this.scanCount++;

      // STEP 1: Fetch ALL prices in ONE multicall (ultra-fast!)
      const priceData = await this.priceScanner.scanAllPairsUltraFast(HIGH_LIQUIDITY_PAIRS);
      
      // STEP 2: Detect arbitrage opportunities (with accurate profit calc)
      const opportunities = this.arbitrageDetector.detectArbitrageFast(priceData);
      
      // STEP 3: Filter best opportunities
      const bestOpportunities = this.arbitrageDetector.filterBestOpportunities(opportunities);
      
      const totalScanTime = Date.now() - scanStartTime;

      // Log performance metrics
      if (this.scanCount % 10 === 0) {
        logger.info(
          `📊 Stats: Scans=${this.scanCount} | ` +
          `Executions=${this.executionCount} | ` +
          `Success=${this.successCount} | ` +
          `Total Profit=$${this.totalProfit.toFixed(2)} | ` +
          `Avg Scan=${totalScanTime}ms`
        );
      }

      // STEP 4: Execute best opportunity immediately
      if (bestOpportunities.length > 0) {
        const best = bestOpportunities[0];
        
        // Send Telegram alert
        await this.telegramBot.sendArbitrageAlert(best, this.autoExecute);
        
        // Auto-execute if enabled
        if (this.autoExecute) {
          await this.executeOpportunity(best);
        }
      }

    } catch (error: any) {
      logger.error('Error in scan cycle:', error.message);
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Execute opportunity with ULTRA-FAST execution
   */
  private async executeOpportunity(opportunity: any) {
    this.executionCount++;
    
    logger.info('');
    logger.info('⚡⚡⚡ EXECUTING TRADE ⚡⚡⚡');
    
    const result = await this.executor.executeUltraFast(opportunity);
    
    // Update stats
    if (result.success) {
      this.successCount++;
      this.totalProfit += result.profit || 0;
    }

    // Send result to Telegram
    await this.telegramBot.sendExecutionResult(
      result.success,
      result.txHash,
      result.profit,
      result.error
    );

    if (result.success) {
      logger.info('');
      logger.info('═══════════════════════════════════════════════════════');
      logger.info(`✅✅✅ TRADE SUCCESSFUL! ✅✅✅`);
      logger.info(`💰 Profit: $${result.profit?.toFixed(2)}`);
      logger.info(`⚡ Execution Time: ${result.executionTime}ms`);
      logger.info(`🔗 TX: ${result.txHash}`);
      logger.info(`📊 Total Profit: $${this.totalProfit.toFixed(2)}`);
      logger.info('═══════════════════════════════════════════════════════');
      logger.info('');
    } else {
      logger.warn(`❌ Trade failed: ${result.error} (${result.executionTime}ms)`);
    }
  }

  /**
   * Stop the bot
   */
  stop() {
    logger.info('🛑 Stopping ULTRA-FAST bot...');
    this.isRunning = false;
    this.priceScanner.destroy();
    
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('📊 FINAL STATISTICS:');
    logger.info(`   Total Scans: ${this.scanCount}`);
    logger.info(`   Trade Attempts: ${this.executionCount}`);
    logger.info(`   Successful Trades: ${this.successCount}`);
    logger.info(`   Success Rate: ${this.executionCount > 0 ? (this.successCount / this.executionCount * 100).toFixed(1) : 0}%`);
    logger.info(`   Total Profit: $${this.totalProfit.toFixed(2)}`);
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('');
    
    logger.info('✅ Bot stopped');
  }
}

// Main execution
async function main() {
  logger.info('');
  logger.info('███████████████████████████████████████████████████████');
  logger.info('█                                                     █');
  logger.info('█     ULTRA-FAST FLASH LOAN ARBITRAGE BOT v2.0       █');
  logger.info('█              ARBITRUM MAINNET                       █');
  logger.info('█                                                     █');
  logger.info('█  ⚡ Event-Driven | 📊 Multicall3 | 🚀 Sub-second   █');
  logger.info('█                                                     █');
  logger.info('███████████████████████████████████████████████████████');
  logger.info('');

  const bot = new UltraFastArbitrageBot();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('\n📴 Received SIGINT, shutting down...');
    bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('\n📴 Received SIGTERM, shutting down...');
    bot.stop();
    process.exit(0);
  });

  // Start the bot
  await bot.start();
}

// Run the ULTRA-FAST bot
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
