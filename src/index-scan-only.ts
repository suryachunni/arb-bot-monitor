import { ethers } from 'ethers';
import { logger } from './utils/logger';
import { config, validateConfig } from './config/config';
import { ProductionPriceOracle } from './services/ProductionPriceOracle';
import { ProductionArbitrageScanner } from './services/ProductionArbitrageScanner';
import { ProductionTelegramBot } from './services/ProductionTelegramBot';
import { TOKENS } from './config/constants';

/**
 * ═══════════════════════════════════════════════════════════════════
 * SCAN-ONLY MODE - TEST WITHOUT FUNDS
 * ═══════════════════════════════════════════════════════════════════
 * 
 * This mode allows you to:
 * ✅ Test price scanning
 * ✅ Test arbitrage detection
 * ✅ Test Telegram alerts
 * ❌ NO trade execution (no funds needed)
 * 
 * Perfect for testing before adding funds!
 * ═══════════════════════════════════════════════════════════════════
 */

class ScanOnlyBot {
  private provider: ethers.providers.JsonRpcProvider;
  private priceOracle: ProductionPriceOracle;
  private scanner: ProductionArbitrageScanner;
  private telegramBot: ProductionTelegramBot;
  private isRunning: boolean = false;
  private scanCount: number = 0;
  private totalOpportunitiesFound: number = 0;

  constructor() {
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════════════════');
    logger.info('   SCAN-ONLY MODE - TESTING WITHOUT FUNDS');
    logger.info('═══════════════════════════════════════════════════════════════════');
    logger.info('');

    // Validate configuration (only Telegram needed)
    try {
      if (!config.telegram.botToken || !config.telegram.chatId) {
        throw new Error('Telegram credentials required');
      }
      logger.info('✅ Telegram configuration validated');
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
      50, // $50 min profit
      0.5 // 0.5 gwei max gas
    );
    logger.info('✅ Arbitrage Scanner initialized');

    this.telegramBot = new ProductionTelegramBot(
      config.telegram.botToken,
      config.telegram.chatId,
      false // Auto-execute OFF (scan only mode)
    );
    logger.info('✅ Telegram Bot initialized');

    // Register dummy callback (won't execute in scan-only mode)
    this.telegramBot.onExecute(async (opportunity) => {
      await this.telegramBot.sendMessage(
        '⚠️ *SCAN-ONLY MODE*\n\n' +
        'Trade execution is disabled.\n' +
        'This is a test to verify scanning and alerts.\n\n' +
        'Fund your wallet to enable trading!'
      );
    });

    logger.info('');
    logger.info('═══════════════════════════════════════════════════════════════════');
    logger.info('');
  }

  /**
   * Start the bot in scan-only mode
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('⚠️  Bot is already running');
      return;
    }

    logger.info('🔍 Starting SCAN-ONLY mode...');
    this.isRunning = true;

    // Send startup message
    await this.telegramBot.sendMessage(
      '🔍 *SCAN-ONLY MODE STARTED*\n\n' +
      '✅ Bot is scanning for opportunities\n' +
      '✅ Telegram alerts enabled\n' +
      '⚠️ Trade execution DISABLED (no funds needed)\n\n' +
      '📊 *What you\'ll see:*\n' +
      '• Real-time price scanning every 2 minutes\n' +
      '• Arbitrage opportunities detected\n' +
      '• Detailed alerts with prices and profits\n' +
      '• All data is LIVE from Arbitrum mainnet\n\n' +
      '💡 *This is a test mode*\n' +
      'Once you verify everything works, fund your wallet to enable trading!\n\n' +
      '🔄 Scanning will begin in 10 seconds...'
    );

    // Wait 10 seconds before first scan
    await this.sleep(10000);

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

      // Send detailed price update to Telegram EVERY scan
      await this.sendDetailedPriceUpdate(startTime);

      // Scan for all arbitrage opportunities
      const opportunities = await this.scanner.scanAllOpportunities();

      const scanTime = Date.now() - startTime;
      logger.info(`✅ Scan completed in ${scanTime}ms`);
      logger.info(`📊 Found ${opportunities.length} opportunities`);

      this.totalOpportunitiesFound += opportunities.length;

      if (opportunities.length > 0) {
        // Show top 3 opportunities in logs
        logger.info('');
        logger.info('🎯 Top Opportunities:');
        opportunities.slice(0, 3).forEach((opp, index) => {
          logger.info(
            `  ${index + 1}. ${opp.type.toUpperCase()}: ${opp.path.join('→')} | ` +
            `Profit: $${opp.netProfitUSD.toFixed(2)} | ` +
            `Spread: ${opp.spreadPercent.toFixed(3)}%`
          );
        });

        // Send best opportunity to Telegram
        const bestOpp = opportunities[0];
        await this.sendScanOnlyAlert(bestOpp, opportunities.length);
      }

      logger.info('');
      logger.info('📈 Session Statistics:');
      logger.info(`  Total Scans: ${this.scanCount}`);
      logger.info(`  Opportunities Found: ${this.totalOpportunitiesFound}`);
      logger.info(`  Avg per Scan: ${(this.totalOpportunitiesFound / this.scanCount).toFixed(1)}`);
      logger.info('═══════════════════════════════════════════════════════════════════');

    } catch (error) {
      logger.error('❌ Scan failed:', error);
      throw error;
    }
  }

  /**
   * Send detailed price update with liquidity data to Telegram
   */
  private async sendDetailedPriceUpdate(startTime: number): Promise<void> {
    logger.info('📱 Fetching live prices for Telegram alert...');

    try {
      // Top pairs to check
      const pairsToCheck = [
        ['WETH', 'USDC'],
        ['WETH', 'ARB'],
        ['ARB', 'USDC'],
      ];

      let message = `🔍 *SCAN #${this.scanCount} - LIVE PRICE DATA*\n`;
      message += `⏰ ${new Date().toLocaleTimeString()}\n\n`;

      for (const [tokenA, tokenB] of pairsToCheck) {
        const tokenAAddr = (TOKENS as any)[tokenA];
        const tokenBAddr = (TOKENS as any)[tokenB];

        if (!tokenAAddr || !tokenBAddr) continue;

        try {
          const priceData = await this.priceOracle.getRealTimePrices(tokenAAddr, tokenBAddr);

          message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
          message += `💱 *${tokenA} / ${tokenB}*\n\n`;

          if (priceData.prices.length === 0) {
            message += `⚠️ No liquidity pools found\n\n`;
            continue;
          }

          // Show top 3 DEXs with best prices
          const sortedPrices = [...priceData.prices].sort((a, b) => b.liquidity - a.liquidity);
          sortedPrices.slice(0, 3).forEach((p) => {
            const liquidityUSD = p.liquidity * 2000;
            const liquidityStr = liquidityUSD >= 1_000_000 
              ? `$${(liquidityUSD / 1_000_000).toFixed(2)}M`
              : liquidityUSD >= 1_000
              ? `$${(liquidityUSD / 1_000).toFixed(2)}K`
              : `$${liquidityUSD.toFixed(0)}`;

            message += `📊 ${p.dex}\n`;
            message += `   Price: ${p.price.toFixed(6)}\n`;
            message += `   Liq: ${liquidityStr}\n\n`;
          });

          // Show spread
          if (priceData.prices.length >= 2) {
            message += `📈 Spread: ${priceData.spreadPercent.toFixed(3)}%\n`;
            if (priceData.spreadPercent > 0.5) {
              message += `✅ Profitable spread!\n`;
            } else {
              message += `ℹ️ Spread too small\n`;
            }
          }

          message += '\n';

        } catch (error) {
          message += `⚠️ Error fetching prices\n\n`;
        }
      }

      message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `📊 *Scan Stats:*\n`;
      message += `✅ Total Scans: ${this.scanCount}\n`;
      message += `📈 Opportunities: ${this.totalOpportunitiesFound}\n`;
      message += `🔄 Next scan: 2 minutes\n\n`;
      message += `⚠️ *SCAN-ONLY MODE*\n`;
      message += `No trades executed`;

      await this.telegramBot.sendMessage(message);

    } catch (error) {
      logger.error('Error sending price update:', error);
    }
  }

  /**
   * Send scan-only alert (no execution)
   */
  private async sendScanOnlyAlert(opportunity: any, totalFound: number): Promise<void> {
    logger.info('📱 Sending opportunity alert to Telegram...');

    try {
      // Build message with SCAN-ONLY banner
      const timestamp = new Date(opportunity.timestamp).toLocaleTimeString();
      
      let message = '🎯 *ARBITRAGE OPPORTUNITY DETECTED*\n';
      message += '🔍 *[SCAN-ONLY MODE - NO EXECUTION]*\n\n';
      
      // Type and path
      if (opportunity.type === 'direct') {
        message += `📊 Type: Direct (Bidirectional)\n`;
        message += `🔄 Path: ${opportunity.path[0]} → ${opportunity.path[1]} → ${opportunity.path[0]}\n\n`;
      } else {
        message += `📊 Type: Triangular\n`;
        message += `🔄 Path: ${opportunity.path.join(' → ')}\n\n`;
      }

      // DEX information
      message += `💱 *DEX Route:*\n`;
      opportunity.dexPath.forEach((dex: string, index: number) => {
        message += `  ${index + 1}. ${dex}\n`;
      });
      message += '\n';

      // Price details
      message += `💰 *Price Details:*\n`;
      opportunity.priceDetails.slice(0, 3).forEach((detail: any, index: number) => {
        message += `  ${index + 1}. ${detail.token}\n`;
        message += `     DEX: ${detail.dex}\n`;
        message += `     Price: ${detail.price.toFixed(6)}\n`;
        message += `     Liquidity: $${this.formatNumber(detail.liquidity)}\n`;
      });
      message += '\n';

      // Spread and profit
      message += `📈 *Opportunity Details:*\n`;
      message += `  Spread: ${opportunity.spreadPercent.toFixed(3)}%\n`;
      message += `  Profit %: ${opportunity.profitPercentage.toFixed(3)}%\n`;
      message += `  Gross Profit: $${opportunity.profitUSD.toFixed(2)}\n`;
      message += `  Gas Cost: $${opportunity.gasCostUSD.toFixed(2)}\n`;
      message += `  *Net Profit: $${opportunity.netProfitUSD.toFixed(2)}* ✅\n\n`;

      // Technical details
      message += `🔧 *Technical Details:*\n`;
      message += `  Total Liquidity: $${this.formatNumber(opportunity.liquidity)}\n`;
      message += `  Gas Estimate: ${this.formatNumber(opportunity.gasEstimate)}\n`;
      message += `  Time: ${timestamp}\n\n`;

      // Scan stats
      message += `📊 *Scan #${this.scanCount}:*\n`;
      message += `  Opportunities Found: ${totalFound}\n`;
      message += `  Total Found: ${this.totalOpportunitiesFound}\n\n`;

      // Status
      message += '⚠️ *SCAN-ONLY MODE*\n';
      message += 'This is a test. No trades will be executed.\n';
      message += 'Fund your wallet to enable trading!\n\n';
      message += '🔄 Next scan in 2 minutes...';

      await this.telegramBot.sendMessage(message);

    } catch (error) {
      logger.error('Error sending Telegram alert:', error);
    }
  }

  /**
   * Format number with commas
   */
  private formatNumber(num: number): string {
    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(2) + 'M';
    } else if (num >= 1_000) {
      return (num / 1_000).toFixed(2) + 'K';
    }
    return num.toFixed(2);
  }

  /**
   * Stop the bot
   */
  stop(): void {
    logger.info('');
    logger.info('🛑 Stopping scan-only bot...');
    this.isRunning = false;
    
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════════════════');
    logger.info('   SCAN-ONLY SESSION STATISTICS');
    logger.info('═══════════════════════════════════════════════════════════════════');
    logger.info(`Total Scans: ${this.scanCount}`);
    logger.info(`Total Opportunities: ${this.totalOpportunitiesFound}`);
    logger.info(`Average per Scan: ${(this.totalOpportunitiesFound / this.scanCount).toFixed(1)}`);
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
  const bot = new ScanOnlyBot();

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
