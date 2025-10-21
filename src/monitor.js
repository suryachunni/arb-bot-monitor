import PriceFetcher from './priceFetcher.js';
import ArbitrageCalculator from './arbitrageCalculator.js';
import TelegramArbitrageBot from './telegramBot.js';
import { config } from './config.js';
import chalk from 'chalk';
import { table } from 'table';

class ArbitrumMonitor {
  constructor() {
    this.priceFetcher = new PriceFetcher();
    this.arbitrageCalculator = new ArbitrageCalculator();
    this.telegramBot = new TelegramArbitrageBot();
    this.isRunning = false;
    this.stats = {
      totalUpdates: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      bestOpportunity: null,
      startTime: Date.now()
    };
    this.lastTelegramUpdate = 0;
    this.telegramUpdateInterval = 60000; // 1 minute
  }

  // Start monitoring
  async start() {
    console.log(chalk.blue.bold('🚀 Starting Arbitrum WETH Price Monitor...'));
    console.log(chalk.gray(`📊 Monitoring ${Object.keys(config.dexs).length} DEXs on Arbitrum Mainnet`));
    console.log(chalk.gray(`⏱️  Update interval: ${config.monitoring.updateInterval}ms`));
    console.log(chalk.gray(`💰 Min spread threshold: ${config.monitoring.minArbitrageSpread}%`));
    console.log('');

    // Initialize Telegram bot
    const botInitialized = await this.telegramBot.initialize();
    if (!botInitialized) {
      console.log(chalk.yellow('⚠️  Telegram bot failed to initialize, continuing without notifications'));
    }

    this.isRunning = true;
    this.stats.startTime = Date.now();

    // Initial price fetch
    await this.updatePrices();

    // Start monitoring loop
    this.monitoringInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.updatePrices();
      }
    }, config.monitoring.updateInterval);

    // Start display loop
    this.displayInterval = setInterval(() => {
      if (this.isRunning) {
        this.displayDashboard();
      }
    }, 2000); // Update display every 2 seconds

    // Start Telegram update loop
    this.telegramInterval = setInterval(() => {
      if (this.isRunning && botInitialized) {
        this.sendTelegramUpdates();
      }
    }, this.telegramUpdateInterval);
  }

  // Stop monitoring
  stop() {
    console.log(chalk.red.bold('\n🛑 Stopping monitor...'));
    this.isRunning = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.displayInterval) {
      clearInterval(this.displayInterval);
    }
    
    if (this.telegramInterval) {
      clearInterval(this.telegramInterval);
    }
    
    // Stop Telegram bot
    this.telegramBot.stop();
    
    this.displayFinalStats();
  }

  // Update prices from all DEXs
  async updatePrices() {
    try {
      this.stats.totalUpdates++;
      
      const prices = await this.priceFetcher.fetchAllWETHPrices();
      
      if (prices.length > 0) {
        this.stats.successfulUpdates++;
        
        // Calculate arbitrage opportunities
        const opportunities = this.arbitrageCalculator.calculateArbitrageOpportunities(prices);
        
        // Update best opportunity
        const bestOpportunity = this.arbitrageCalculator.getBestOpportunity(opportunities);
        if (bestOpportunity) {
          this.stats.bestOpportunity = bestOpportunity;
          
          // Send Telegram notification for new best opportunity
          if (this.telegramBot.isRunning) {
            await this.telegramBot.sendArbitrageNotification(bestOpportunity, prices);
          }
        }
        
        // Store current data
        this.currentPrices = prices;
        this.currentOpportunities = opportunities;
        
      } else {
        this.stats.failedUpdates++;
        console.log(chalk.red('❌ No prices fetched'));
      }
      
    } catch (error) {
      this.stats.failedUpdates++;
      console.error(chalk.red('❌ Price update error:'), error.message);
    }
  }

  // Display real-time dashboard
  displayDashboard() {
    // Clear console
    console.clear();
    
    // Header
    console.log(chalk.blue.bold('🔍 Arbitrum WETH Arbitrage Monitor'));
    console.log(chalk.gray(`⏰ ${new Date().toLocaleTimeString()} | Uptime: ${this.getUptime()}`));
    console.log('');

    // Statistics
    this.displayStats();

    // Current prices
    if (this.currentPrices && this.currentPrices.length > 0) {
      this.displayPrices();
    }

    // Arbitrage opportunities
    if (this.currentOpportunities && this.currentOpportunities.length > 0) {
      this.displayOpportunities();
    }

    // Best opportunity
    if (this.stats.bestOpportunity) {
      this.displayBestOpportunity();
    }

    console.log(chalk.gray('\nPress Ctrl+C to stop monitoring'));
  }

  // Display statistics
  displayStats() {
    const successRate = this.stats.totalUpdates > 0 
      ? ((this.stats.successfulUpdates / this.stats.totalUpdates) * 100).toFixed(1)
      : 0;

    console.log(chalk.yellow.bold('📊 Statistics:'));
    console.log(`   Updates: ${this.stats.successfulUpdates}/${this.stats.totalUpdates} (${successRate}% success)`);
    console.log(`   Failed: ${this.stats.failedUpdates}`);
    console.log(`   Fresh prices: ${this.priceFetcher.arePricesFresh() ? '✅' : '❌'}`);
    console.log('');
  }

  // Display current prices
  displayPrices() {
    console.log(chalk.green.bold('💰 Current WETH Prices:'));
    
    const tableData = [
      ['DEX', 'Price (USDC)', 'Liquidity', 'Age', 'Status']
    ];

    this.currentPrices.forEach(price => {
      const age = Math.round((Date.now() - price.timestamp) / 1000);
      const ageStr = age < 5 ? '🟢 Fresh' : age < 10 ? '🟡 OK' : '🔴 Stale';
      
      tableData.push([
        price.dex + (price.fee ? ` (${price.fee/100}%)` : ''),
        `$${price.price.toFixed(4)}`,
        price.liquidity ? `${Number(price.liquidity).toFixed(0)} ETH` : 'N/A',
        `${age}s`,
        ageStr
      ]);
    });

    console.log(table(tableData, {
      border: {
        topBody: '─',
        topJoin: '┬',
        topLeft: '┌',
        topRight: '┐',
        bottomBody: '─',
        bottomJoin: '┴',
        bottomLeft: '└',
        bottomRight: '┘',
        bodyLeft: '│',
        bodyRight: '│',
        bodyJoin: '│',
        joinBody: '─',
        joinLeft: '├',
        joinRight: '┤',
        joinJoin: '┼'
      }
    }));
    console.log('');
  }

  // Display arbitrage opportunities
  displayOpportunities() {
    if (this.currentOpportunities.length === 0) {
      console.log(chalk.red('❌ No arbitrage opportunities found'));
      return;
    }

    console.log(chalk.cyan.bold(`🎯 Arbitrage Opportunities (${this.currentOpportunities.length}):`));
    
    const tableData = [
      ['Buy DEX', 'Sell DEX', 'Spread', 'Profit %', 'Net Profit', 'Risk']
    ];

    this.currentOpportunities.slice(0, 10).forEach(opp => {
      const netProfit = this.arbitrageCalculator.calculateNetProfit(opp);
      const riskScore = this.arbitrageCalculator.calculateRiskScore(opp);
      const riskColor = riskScore < 30 ? '🟢' : riskScore < 60 ? '🟡' : '🔴';
      
      tableData.push([
        opp.buyDex,
        opp.sellDex,
        `${opp.spread.toFixed(2)}%`,
        `${opp.profitPercentage.toFixed(2)}%`,
        `$${netProfit.netProfit.toFixed(2)}`,
        `${riskColor} ${riskScore}`
      ]);
    });

    console.log(table(tableData, {
      border: {
        topBody: '─',
        topJoin: '┬',
        topLeft: '┌',
        topRight: '┐',
        bottomBody: '─',
        bottomJoin: '┴',
        bottomLeft: '└',
        bottomRight: '┘',
        bodyLeft: '│',
        bodyRight: '│',
        bodyJoin: '│',
        joinBody: '─',
        joinLeft: '├',
        joinRight: '┤',
        joinJoin: '┼'
      }
    }));
    console.log('');
  }

  // Display best opportunity
  displayBestOpportunity() {
    const opp = this.stats.bestOpportunity;
    const netProfit = this.arbitrageCalculator.calculateNetProfit(opp);
    const riskScore = this.arbitrageCalculator.calculateRiskScore(opp);
    
    console.log(chalk.magenta.bold('🏆 Best Arbitrage Opportunity:'));
    console.log(`   Buy on: ${chalk.green(opp.buyDex)} at $${opp.buyPrice.toFixed(4)}`);
    console.log(`   Sell on: ${chalk.red(opp.sellDex)} at $${opp.sellPrice.toFixed(4)}`);
    console.log(`   Spread: ${chalk.yellow(opp.spread.toFixed(2))}%`);
    console.log(`   Net Profit: ${chalk.green(`$${netProfit.netProfit.toFixed(2)}`)} (${netProfit.netProfitPercentage.toFixed(2)}%)`);
    console.log(`   Risk Score: ${riskScore < 30 ? chalk.green(riskScore) : riskScore < 60 ? chalk.yellow(riskScore) : chalk.red(riskScore)}`);
    console.log('');
  }

  // Get uptime string
  getUptime() {
    const uptime = Date.now() - this.stats.startTime;
    const minutes = Math.floor(uptime / 60000);
    const seconds = Math.floor((uptime % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  // Display final statistics
  displayFinalStats() {
    console.log(chalk.blue.bold('\n📈 Final Statistics:'));
    console.log(`   Total runtime: ${this.getUptime()}`);
    console.log(`   Total updates: ${this.stats.totalUpdates}`);
    console.log(`   Successful updates: ${this.stats.successfulUpdates}`);
    console.log(`   Failed updates: ${this.stats.failedUpdates}`);
    console.log(`   Success rate: ${((this.stats.successfulUpdates / this.stats.totalUpdates) * 100).toFixed(1)}%`);
    
    if (this.stats.bestOpportunity) {
      console.log(chalk.green('\n🏆 Best opportunity found:'));
      const opp = this.stats.bestOpportunity;
      const netProfit = this.arbitrageCalculator.calculateNetProfit(opp);
      console.log(`   ${opp.buyDex} → ${opp.sellDex}: ${opp.spread.toFixed(2)}% spread, $${netProfit.netProfit.toFixed(2)} profit`);
    }
  }

  // Send Telegram updates
  async sendTelegramUpdates() {
    if (!this.telegramBot.isRunning) return;

    const now = Date.now();
    if (now - this.lastTelegramUpdate < this.telegramUpdateInterval) return;

    this.lastTelegramUpdate = now;

    // Send status update
    await this.telegramBot.sendStatusUpdate(this.stats);

    // Send price update if we have fresh prices
    if (this.currentPrices && this.currentPrices.length > 0) {
      await this.telegramBot.sendPriceUpdate(this.currentPrices);
    }
  }

  // Get current data for external use
  getCurrentData() {
    return {
      prices: this.currentPrices || [],
      opportunities: this.currentOpportunities || [],
      bestOpportunity: this.stats.bestOpportunity,
      stats: this.stats
    };
  }
}

export default ArbitrumMonitor;