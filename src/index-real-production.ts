import { ethers } from 'ethers';
import { RealDEXScanner } from './services/RealDEXScanner';
import { RealFlashLoanExecutor } from './services/RealFlashLoanExecutor';
import { EnhancedTelegramNotifier } from './services/EnhancedTelegramNotifier';
import { config } from './config/config';
import { logger } from './utils/logger';

class RealArbitrageBot {
  private scanner: RealDEXScanner;
  private executor: RealFlashLoanExecutor;
  private notifier: EnhancedTelegramNotifier;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private stats = {
    totalScans: 0,
    totalOpportunities: 0,
    totalExecutions: 0,
    totalProfit: 0,
    startTime: Date.now()
  };

  constructor() {
    this.scanner = new RealDEXScanner();
    this.executor = new RealFlashLoanExecutor();
    this.notifier = new EnhancedTelegramNotifier();
  }

  /**
   * Start the real arbitrage bot
   */
  async start() {
    try {
      logger.info('🚀 Starting Real Arbitrage Bot...');
      
      // Check if contract is ready
      const isReady = await this.executor.isReady();
      if (!isReady) {
        logger.error('❌ Contract not ready. Please deploy first.');
        return;
      }

      // Send startup notification
      await this.notifier.sendStartupNotification({
        network: 'Arbitrum Mainnet',
        contractAddress: config.contract.address,
        scanInterval: 10 * 60 * 1000 // 10 minutes
      });

      this.isRunning = true;
      logger.info('✅ Bot started successfully');

      // Start scanning loop
      this.startScanLoop();

      // Start stats reporting
      this.startStatsReporting();

    } catch (error) {
      logger.error('Failed to start bot:', error);
      throw error;
    }
  }

  /**
   * Stop the bot
   */
  async stop() {
    try {
      logger.info('🛑 Stopping Real Arbitrage Bot...');
      
      this.isRunning = false;
      
      if (this.scanInterval) {
        clearInterval(this.scanInterval);
        this.scanInterval = null;
      }

      // Send shutdown notification
      await this.notifier.sendShutdownNotification({
        totalScans: this.stats.totalScans,
        totalOpportunities: this.stats.totalOpportunities,
        totalExecutions: this.stats.totalExecutions,
        totalProfit: this.stats.totalProfit,
        uptime: Date.now() - this.stats.startTime
      });

      logger.info('✅ Bot stopped successfully');

    } catch (error) {
      logger.error('Error stopping bot:', error);
    }
  }

  /**
   * Start the scanning loop
   */
  private startScanLoop() {
    // Run immediately
    this.performScan();

    // Then every 10 minutes
    this.scanInterval = setInterval(() => {
      this.performScan();
    }, 10 * 60 * 1000);

    logger.info('🔄 Scan loop started (every 10 minutes)');
  }

  /**
   * Perform a market scan
   */
  private async performScan() {
    if (!this.isRunning) return;

    try {
      logger.info('🔍 Performing market scan...');
      
      const scanResult = await this.scanner.scanRealMarket();
      this.stats.totalScans++;

      logger.info(`📊 Scan completed: ${scanResult.opportunities.length} opportunities found`);

      // Send scan results to Telegram
      if (scanResult.opportunities.length > 0) {
        await this.notifier.sendArbitrageAlert(scanResult.opportunities[0]);
        this.stats.totalOpportunities += scanResult.opportunities.length;
      } else {
        await this.notifier.sendScanResults(scanResult);
      }

      // Execute profitable opportunities
      if (scanResult.opportunities.length > 0) {
        await this.executeOpportunities(scanResult.opportunities);
      }

    } catch (error) {
      logger.error('Scan failed:', error);
      await this.notifier.sendErrorNotification('Scan failed', error);
    }
  }

  /**
   * Execute arbitrage opportunities
   */
  private async executeOpportunities(opportunities: any[]) {
    for (const opportunity of opportunities) {
      if (!this.isRunning) break;

      try {
        // Only execute high-priority, low-risk opportunities
        if (opportunity.riskLevel === 'LOW' && opportunity.executionPriority > 100) {
          logger.info(`🚀 Executing arbitrage: ${opportunity.tokenA}/${opportunity.tokenB}`);
          
          const result = await this.executor.executeRealArbitrage(opportunity);
          
          if (result.success) {
            this.stats.totalExecutions++;
            this.stats.totalProfit += result.profit || 0;
            
            logger.info(`✅ Arbitrage executed: $${result.profit?.toFixed(2)} profit`);
            
            // Send execution notification
            await this.notifier.sendExecutionNotification({
              opportunity,
              result,
              txHash: result.txHash
            });
          } else {
            logger.warn(`❌ Arbitrage failed: ${result.error}`);
          }
        } else {
          logger.info(`⏭️ Skipping opportunity: ${opportunity.riskLevel} risk, priority ${opportunity.executionPriority}`);
        }

      } catch (error) {
        logger.error('Execution failed:', error);
        await this.notifier.sendErrorNotification('Execution failed', error);
      }
    }
  }

  /**
   * Start stats reporting
   */
  private startStatsReporting() {
    // Report stats every hour
    setInterval(() => {
      if (this.isRunning) {
        this.reportStats();
      }
    }, 60 * 60 * 1000);
  }

  /**
   * Report bot statistics
   */
  private async reportStats() {
    try {
      const uptime = Date.now() - this.stats.startTime;
      const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
      
      await this.notifier.sendStatsReport({
        totalScans: this.stats.totalScans,
        totalOpportunities: this.stats.totalOpportunities,
        totalExecutions: this.stats.totalExecutions,
        totalProfit: this.stats.totalProfit,
        uptimeHours,
        avgProfitPerExecution: this.stats.totalExecutions > 0 ? this.stats.totalProfit / this.stats.totalExecutions : 0
      });

    } catch (error) {
      logger.error('Stats reporting failed:', error);
    }
  }

  /**
   * Get bot status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      stats: this.stats,
      uptime: Date.now() - this.stats.startTime
    };
  }
}

// Main execution
async function main() {
  try {
    const bot = new RealArbitrageBot();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      await bot.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      await bot.stop();
      process.exit(0);
    });

    // Start the bot
    await bot.start();

    // Keep the process alive
    setInterval(() => {
      const status = bot.getStatus();
      logger.info(`🤖 Bot status: ${status.isRunning ? 'RUNNING' : 'STOPPED'}`);
    }, 5 * 60 * 1000); // Every 5 minutes

  } catch (error) {
    logger.error('Bot startup failed:', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main().catch(console.error);
}

export { RealArbitrageBot };