import TelegramBot from 'node-telegram-bot-api';
import { config } from './config.js';
import chalk from 'chalk';

class TelegramArbitrageBot {
  constructor() {
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    this.isRunning = false;
    this.lastNotification = new Map();
    this.notificationCooldown = 30000; // 30 seconds between notifications
  }

  // Initialize the bot
  async initialize() {
    console.log(chalk.blue.bold('🤖 Initializing Telegram Bot...'));
    
    try {
      // Test bot connection
      const me = await this.bot.getMe();
      console.log(chalk.green(`✅ Bot connected: @${me.username}`));
      
      // Set up command handlers
      this.setupCommands();
      
      // Send startup message
      await this.sendStartupMessage();
      
      this.isRunning = true;
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Telegram bot error:'), error.message);
      return false;
    }
  }

  // Setup bot commands
  setupCommands() {
    // Start command
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      await this.sendMessage(chatId, this.getStartMessage());
    });

    // Status command
    this.bot.onText(/\/status/, async (msg) => {
      const chatId = msg.chat.id;
      await this.sendMessage(chatId, this.getStatusMessage());
    });

    // Prices command
    this.bot.onText(/\/prices/, async (msg) => {
      const chatId = msg.chat.id;
      await this.sendMessage(chatId, this.getPricesMessage());
    });

    // Opportunities command
    this.bot.onText(/\/opportunities/, async (msg) => {
      const chatId = msg.chat.id;
      await this.sendMessage(chatId, this.getOpportunitiesMessage());
    });

    // Help command
    this.bot.onText(/\/help/, async (msg) => {
      const chatId = msg.chat.id;
      await this.sendMessage(chatId, this.getHelpMessage());
    });

    // Stop command
    this.bot.onText(/\/stop/, async (msg) => {
      const chatId = msg.chat.id;
      await this.sendMessage(chatId, '🛑 Bot monitoring stopped. Use /start to resume.');
      this.isRunning = false;
    });

    // Error handling
    this.bot.on('error', (error) => {
      console.error(chalk.red('Telegram bot error:'), error);
    });
  }

  // Send startup message
  async sendStartupMessage() {
    const message = `🚀 *Arbitrum WETH Arbitrage Bot Started!*

🔍 *Monitoring 6 DEXs:*
• Uniswap V3
• SushiSwap  
• Curve Finance
• Balancer V2
• Camelot
• KyberSwap

⚡ *Features:*
• Real-time WETH price monitoring
• Arbitrage opportunity detection
• Risk assessment scoring
• Gas cost calculations

📊 *Commands:*
/status - Bot status
/prices - Current prices
/opportunities - Best opportunities
/help - Help menu

The bot will notify you of profitable arbitrage opportunities!`;

    await this.sendMessage(this.chatId, message);
  }

  // Send arbitrage opportunity notification
  async sendArbitrageNotification(opportunity, prices) {
    if (!this.isRunning) return;

    const opportunityKey = `${opportunity.buyDex}-${opportunity.sellDex}`;
    const now = Date.now();
    
    // Check cooldown
    if (this.lastNotification.has(opportunityKey)) {
      const lastTime = this.lastNotification.get(opportunityKey);
      if (now - lastTime < this.notificationCooldown) {
        return;
      }
    }

    this.lastNotification.set(opportunityKey, now);

    const netProfit = this.calculateNetProfit(opportunity);
    const riskEmoji = this.getRiskEmoji(opportunity);
    
    const message = `🎯 *ARBITRAGE OPPORTUNITY DETECTED!*

💰 *Trade Details:*
• Buy: ${opportunity.buyDex} at $${opportunity.buyPrice.toFixed(4)}
• Sell: ${opportunity.sellDex} at $${opportunity.sellPrice.toFixed(4)}

📈 *Profit Analysis:*
• Spread: ${opportunity.spread.toFixed(2)}%
• Gross Profit: $${opportunity.potentialProfit.toFixed(2)}
• Net Profit: $${netProfit.netProfit.toFixed(2)} (${netProfit.netProfitPercentage.toFixed(2)}%)
• Risk Score: ${riskEmoji} ${this.calculateRiskScore(opportunity)}

⏰ *Timestamp:* ${new Date().toLocaleString()}

⚠️ *Always verify prices before trading!*`;

    await this.sendMessage(this.chatId, message);
  }

  // Send price update
  async sendPriceUpdate(prices) {
    if (!this.isRunning || prices.length === 0) return;

    const message = `💰 *WETH Price Update*

${prices.map(price => {
      const age = Math.round((Date.now() - price.timestamp) / 1000);
      const status = age < 5 ? '🟢' : age < 10 ? '🟡' : '🔴';
      return `• ${price.dex}: $${price.price.toFixed(4)} ${status}`;
    }).join('\n')}

⏰ ${new Date().toLocaleTimeString()}`;

    await this.sendMessage(this.chatId, message);
  }

  // Send status update
  async sendStatusUpdate(stats) {
    if (!this.isRunning) return;

    const successRate = stats.totalUpdates > 0 
      ? ((stats.successfulUpdates / stats.totalUpdates) * 100).toFixed(1)
      : 0;

    const uptime = this.getUptime(stats.startTime);

    const message = `📊 *Bot Status Update*

✅ *Performance:*
• Updates: ${stats.successfulUpdates}/${stats.totalUpdates} (${successRate}% success)
• Uptime: ${uptime}
• Failed: ${stats.failedUpdates}

🎯 *Best Opportunity:*
${stats.bestOpportunity ? 
  `• ${stats.bestOpportunity.buyDex} → ${stats.bestOpportunity.sellDex}
• Spread: ${stats.bestOpportunity.spread.toFixed(2)}%
• Profit: $${this.calculateNetProfit(stats.bestOpportunity).netProfit.toFixed(2)}` :
  '• No opportunities found'}

⏰ ${new Date().toLocaleTimeString()}`;

    await this.sendMessage(this.chatId, message);
  }

  // Helper methods
  calculateNetProfit(opportunity) {
    const gasCosts = {
      gasPrice: 0.1,
      gasLimit: 500000,
      gasCostETH: (0.1 * 500000) / 1e9,
      gasCostUSD: ((0.1 * 500000) / 1e9) * 2000
    };
    
    const grossProfit = opportunity.potentialProfit;
    const netProfit = grossProfit - gasCosts.gasCostUSD;
    
    return {
      grossProfit: grossProfit,
      gasCosts: gasCosts.gasCostUSD,
      netProfit: netProfit,
      netProfitPercentage: (netProfit / opportunity.buyPrice) * 100
    };
  }

  calculateRiskScore(opportunity) {
    let riskScore = 0;
    
    if (opportunity.liquidity < 10000) riskScore += 30;
    else if (opportunity.liquidity < 50000) riskScore += 15;
    else if (opportunity.liquidity < 100000) riskScore += 5;
    
    if (opportunity.spread > 10) riskScore += 20;
    else if (opportunity.spread > 5) riskScore += 10;
    
    const reliableDexs = ['Uniswap V3', 'SushiSwap'];
    if (!reliableDexs.includes(opportunity.buyDex)) riskScore += 10;
    if (!reliableDexs.includes(opportunity.sellDex)) riskScore += 10;
    
    const age = Date.now() - opportunity.timestamp;
    if (age > 30000) riskScore += 20;
    else if (age > 10000) riskScore += 10;
    
    return Math.min(riskScore, 100);
  }

  getRiskEmoji(opportunity) {
    const riskScore = this.calculateRiskScore(opportunity);
    if (riskScore < 30) return '🟢';
    if (riskScore < 60) return '🟡';
    return '🔴';
  }

  getUptime(startTime) {
    const uptime = Date.now() - startTime;
    const minutes = Math.floor(uptime / 60000);
    const seconds = Math.floor((uptime % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  // Message templates
  getStartMessage() {
    return `🚀 *Arbitrum WETH Arbitrage Bot*

Welcome! I'm monitoring WETH prices across 6 DEXs on Arbitrum to find arbitrage opportunities.

Use /help to see all commands.`;
  }

  getStatusMessage() {
    return `📊 *Bot Status*

✅ Bot is running and monitoring
🔍 Scanning 6 DEXs for opportunities
⚡ Real-time price updates every 1 second

Use /prices to see current prices or /opportunities for best trades.`;
  }

  getPricesMessage() {
    return `💰 *Current WETH Prices*

Use /prices to get the latest prices from all DEXs. This command will be updated with live data.`;
  }

  getOpportunitiesMessage() {
    return `🎯 *Arbitrage Opportunities*

Use /opportunities to see the best arbitrage opportunities. I'll notify you automatically when profitable trades are found!`;
  }

  getHelpMessage() {
    return `🤖 *Bot Commands*

/start - Start the bot
/status - Check bot status
/prices - Get current WETH prices
/opportunities - View arbitrage opportunities
/help - Show this help menu
/stop - Stop monitoring

*Features:*
• Real-time WETH price monitoring
• Arbitrage opportunity detection
• Risk assessment scoring
• Automatic notifications

The bot will notify you when profitable arbitrage opportunities are found!`;
  }

  // Send message helper
  async sendMessage(chatId, text, options = {}) {
    try {
      await this.bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        ...options
      });
    } catch (error) {
      console.error(chalk.red('Failed to send Telegram message:'), error.message);
    }
  }

  // Stop the bot
  stop() {
    console.log(chalk.yellow('🛑 Stopping Telegram bot...'));
    this.isRunning = false;
    this.bot.stopPolling();
  }
}

export default TelegramArbitrageBot;