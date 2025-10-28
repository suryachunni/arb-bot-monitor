import { ethers } from 'ethers';
import { logger } from './utils/logger';
import { config } from './config/config';
import { UltraFastPriceScanner } from './services/UltraFastPriceScanner';
import { ArbitrageDetector } from './services/ArbitrageDetector';
import { DynamicLoanCalculator } from './services/DynamicLoanCalculator';
import { LiquidityValidator } from './services/LiquidityValidator';
import { AtomicExecutionEngine } from './services/AtomicExecutionEngine';
import { TelegramNotifier } from './services/TelegramBot';
import { HIGH_LIQUIDITY_PAIRS } from './config/constants';

export interface BotStatistics {
  totalScans: number;
  opportunitiesFound: number;
  tradesExecuted: number;
  totalProfit: number;
  averageExecutionTime: number;
  successRate: number;
  uptime: number;
  lastScanTime: number;
  lastOpportunityTime: number;
  lastTradeTime: number;
}

export class UltraFastArbitrageBot {
  private priceScanner: UltraFastPriceScanner;
  private arbitrageDetector: ArbitrageDetector;
  private loanCalculator: DynamicLoanCalculator;
  private liquidityValidator: LiquidityValidator;
  private executionEngine: AtomicExecutionEngine;
  private telegramNotifier: TelegramNotifier;
  
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private startTime: number = 0;
  private statistics: BotStatistics = {
    totalScans: 0,
    opportunitiesFound: 0,
    tradesExecuted: 0,
    totalProfit: 0,
    averageExecutionTime: 0,
    successRate: 0,
    uptime: 0,
    lastScanTime: 0,
    lastOpportunityTime: 0,
    lastTradeTime: 0
  };

  private executionTimes: number[] = [];
  private lastStatusUpdate: number = 0;
  private readonly STATUS_UPDATE_INTERVAL = 300000; // 5 minutes

  constructor() {
    this.priceScanner = new UltraFastPriceScanner();
    this.arbitrageDetector = new ArbitrageDetector();
    this.loanCalculator = new DynamicLoanCalculator();
    this.liquidityValidator = new LiquidityValidator();
    this.executionEngine = new AtomicExecutionEngine();
    this.telegramNotifier = new TelegramNotifier();
    
    this.setupTelegramCommands();
    this.setupGracefulShutdown();
  }

  /**
   * Start the ultra-fast arbitrage bot
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Bot is already running');
      return;
    }

    try {
      logger.info('🚀 Starting Ultra-Fast Arbitrage Bot...');
      
      this.isRunning = true;
      this.startTime = Date.now();
      
      // Send startup notification
      await this.telegramNotifier.sendMessage(
        '🚀 Ultra-Fast Arbitrage Bot Started!\n\n' +
        '⚡ Lightning-fast execution\n' +
        '💰 Dynamic loan sizing ($1k - $2M)\n' +
        '🔍 Multi-layer liquidity validation\n' +
        '🛡️ MEV protection enabled\n' +
        '📊 Real-time monitoring active'
      );

      // Start the main loop
      await this.runMainLoop();

    } catch (error) {
      logger.error('Failed to start bot:', error);
      await this.telegramNotifier.sendMessage(`❌ Bot startup failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Main execution loop
   */
  private async runMainLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        if (!this.isPaused) {
          await this.executeScanCycle();
        }
        
        // Update statistics
        this.updateStatistics();
        
        // Send periodic status updates
        if (Date.now() - this.lastStatusUpdate > this.STATUS_UPDATE_INTERVAL) {
          await this.sendStatusUpdate();
          this.lastStatusUpdate = Date.now();
        }
        
        // Wait for next scan
        await this.sleep(config.monitoring.scanIntervalMs);
        
      } catch (error) {
        logger.error('Error in main loop:', error);
        await this.telegramNotifier.sendMessage(`⚠️ Bot error: ${(error as Error).message}`);
        
        // Wait before retrying
        await this.sleep(10000);
      }
    }
  }

  /**
   * Execute a single scan cycle
   */
  private async executeScanCycle(): Promise<void> {
    const cycleStartTime = Date.now();
    
    try {
      logger.info('🔍 Starting ultra-fast scan cycle...');
      
      // Step 1: Ultra-fast price scanning
      const scanResult = await this.priceScanner.scanUltraFast(HIGH_LIQUIDITY_PAIRS);
      this.statistics.totalScans++;
      this.statistics.lastScanTime = Date.now();
      
      if (scanResult.successfulPairs === 0) {
        logger.warn('No prices retrieved in scan');
        return;
      }
      
      // Step 2: Detect arbitrage opportunities
      const opportunities = this.arbitrageDetector.detectArbitrage(scanResult.prices);
      
      if (opportunities.length === 0) {
        logger.info('No arbitrage opportunities found');
        return;
      }
      
      this.statistics.opportunitiesFound += opportunities.length;
      this.statistics.lastOpportunityTime = Date.now();
      
      logger.info(`🎯 Found ${opportunities.length} arbitrage opportunities`);
      
      // Step 3: Process opportunities with atomic execution
      await this.processOpportunities(opportunities);
      
      const cycleTime = Date.now() - cycleStartTime;
      this.executionTimes.push(cycleTime);
      
      // Keep only last 100 execution times for average calculation
      if (this.executionTimes.length > 100) {
        this.executionTimes = this.executionTimes.slice(-100);
      }
      
      logger.info(`✅ Scan cycle completed in ${cycleTime}ms`);
      
    } catch (error) {
      logger.error('Scan cycle failed:', error);
      throw error;
    }
  }

  /**
   * Process arbitrage opportunities with atomic execution
   */
  private async processOpportunities(opportunities: any[]): Promise<void> {
    // Sort opportunities by profit percentage (highest first)
    const sortedOpportunities = opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
    
    for (const opportunity of sortedOpportunities) {
      try {
        logger.info(`🎯 Processing opportunity: ${opportunity.tokenA}/${opportunity.tokenB} - ${opportunity.profitPercentage.toFixed(2)}% profit`);
        
        // Execute atomic arbitrage
        const result = await this.executionEngine.executeAtomicArbitrage(opportunity);
        
        if (result.success) {
          this.statistics.tradesExecuted++;
          this.statistics.totalProfit += result.profit || 0;
          this.statistics.lastTradeTime = Date.now();
          
          // Send success notification
          await this.telegramNotifier.sendMessage(
            `✅ Arbitrage Executed Successfully!\n\n` +
            `💰 Profit: $${result.profit?.toFixed(2)}\n` +
            `⛽ Gas Used: ${result.gasUsed}\n` +
            `⚡ Execution Time: ${result.executionTime}ms\n` +
            `📝 TX: ${result.txHash}`
          );
          
          logger.info(`✅ Arbitrage executed successfully: $${result.profit?.toFixed(2)} profit`);
          
        } else {
          logger.warn(`❌ Arbitrage execution failed: ${result.rejectionReason || result.error}`);
          
          // Send failure notification for high-value opportunities
          if (opportunity.profitPercentage > 1.0) {
            await this.telegramNotifier.sendMessage(
              `❌ Arbitrage Execution Failed\n\n` +
              `🎯 Opportunity: ${opportunity.tokenA}/${opportunity.tokenB}\n` +
              `💰 Potential Profit: ${opportunity.profitPercentage.toFixed(2)}%\n` +
              `❌ Reason: ${result.rejectionReason || result.error}`
            );
          }
        }
        
      } catch (error) {
        logger.error(`Error processing opportunity:`, error);
        await this.telegramNotifier.sendMessage(`⚠️ Error processing opportunity: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Setup Telegram commands
   */
  private setupTelegramCommands(): void {
    this.telegramNotifier.onBotControls({
      onPause: () => this.pause(),
      onResume: () => this.resume(),
      onStop: () => this.stop()
    });
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await this.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await this.stop();
      process.exit(0);
    });

    process.on('uncaughtException', async (error) => {
      logger.error('Uncaught exception:', error);
      await this.telegramNotifier.sendMessage(`💥 Critical error: ${error.message}`);
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      await this.telegramNotifier.sendMessage(`💥 Unhandled rejection: ${reason}`);
    });
  }

  /**
   * Pause the bot
   */
  async pause(): Promise<void> {
    this.isPaused = true;
    logger.info('⏸️ Bot paused');
    await this.telegramNotifier.sendMessage('⏸️ Bot paused');
  }

  /**
   * Resume the bot
   */
  async resume(): Promise<void> {
    this.isPaused = false;
    logger.info('▶️ Bot resumed');
    await this.telegramNotifier.sendMessage('▶️ Bot resumed');
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    logger.info('🛑 Bot stopped');
    await this.telegramNotifier.sendMessage('🛑 Bot stopped');
  }

  /**
   * Update bot statistics
   */
  private updateStatistics(): void {
    this.statistics.uptime = Date.now() - this.startTime;
    
    if (this.executionTimes.length > 0) {
      this.statistics.averageExecutionTime = this.executionTimes.reduce((a, b) => a + b, 0) / this.executionTimes.length;
    }
    
    if (this.statistics.totalScans > 0) {
      this.statistics.successRate = (this.statistics.tradesExecuted / this.statistics.opportunitiesFound) * 100;
    }
  }

  /**
   * Send status update to Telegram
   */
  private async sendStatusUpdate(): Promise<void> {
    const stats = this.statistics;
    const uptimeHours = Math.floor(stats.uptime / (1000 * 60 * 60));
    const uptimeMinutes = Math.floor((stats.uptime % (1000 * 60 * 60)) / (1000 * 60));
    
    const message = 
      `📊 Bot Status Update\n\n` +
      `⏱️ Uptime: ${uptimeHours}h ${uptimeMinutes}m\n` +
      `🔍 Total Scans: ${stats.totalScans}\n` +
      `🎯 Opportunities Found: ${stats.opportunitiesFound}\n` +
      `✅ Trades Executed: ${stats.tradesExecuted}\n` +
      `💰 Total Profit: $${stats.totalProfit.toFixed(2)}\n` +
      `⚡ Avg Execution Time: ${stats.averageExecutionTime.toFixed(0)}ms\n` +
      `📈 Success Rate: ${stats.successRate.toFixed(1)}%\n` +
      `🔄 Status: ${this.isPaused ? '⏸️ Paused' : '▶️ Running'}`;
    
    await this.telegramNotifier.sendMessage(message);
  }

  /**
   * Get current statistics
   */
  getStatistics(): BotStatistics {
    return { ...this.statistics };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  try {
    const bot = new UltraFastArbitrageBot();
    await bot.start();
  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { UltraFastArbitrageBot };