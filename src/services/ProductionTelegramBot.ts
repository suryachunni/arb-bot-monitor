import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger';
import { ArbitrageOpportunity } from './ProductionArbitrageScanner';

/**
 * PRODUCTION-GRADE TELEGRAM BOT
 * 
 * Features:
 * - Detailed arbitrage alerts with all price data
 * - Automatic execution on opportunity detection
 * - Manual execution button for review
 * - Real-time profit tracking
 * - Error notifications
 * - Transaction confirmations
 */

export class ProductionTelegramBot {
  private bot: TelegramBot;
  private chatId: string;
  private autoExecute: boolean;
  private executeCallback?: (opportunity: ArbitrageOpportunity) => Promise<void>;
  private pendingOpportunities: Map<string, ArbitrageOpportunity> = new Map();

  constructor(botToken: string, chatId: string, autoExecute: boolean = true) {
    this.bot = new TelegramBot(botToken, { polling: true });
    this.chatId = chatId;
    this.autoExecute = autoExecute;

    this.setupHandlers();
    logger.info('✅ Telegram bot initialized');
  }

  /**
   * Setup bot command handlers
   */
  private setupHandlers() {
    // Start command
    this.bot.onText(/\/start/, (msg) => {
      this.sendMessage(
        '🚀 *Flash Loan Arbitrage Bot - PRODUCTION MODE*\n\n' +
        '✅ Bot is running and scanning for opportunities\n' +
        '✅ Auto-execution: ' + (this.autoExecute ? 'ENABLED' : 'DISABLED') + '\n\n' +
        'Commands:\n' +
        '/status - Check bot status\n' +
        '/auto_on - Enable auto-execution\n' +
        '/auto_off - Disable auto-execution\n' +
        '/help - Show help'
      );
    });

    // Status command
    this.bot.onText(/\/status/, (msg) => {
      this.sendMessage(
        '📊 *Bot Status*\n\n' +
        '🟢 Status: RUNNING\n' +
        '⚡ Auto-execution: ' + (this.autoExecute ? 'ON' : 'OFF') + '\n' +
        '🔍 Scanning every 2 minutes\n' +
        '💰 Flash loan range: $1,000 - $2,000,000\n' +
        '📈 Min profit: $50 after gas\n\n' +
        'Waiting for profitable opportunities...'
      );
    });

    // Auto-execution toggle
    this.bot.onText(/\/auto_on/, (msg) => {
      this.autoExecute = true;
      this.sendMessage('✅ *Auto-execution ENABLED*\n\nBot will automatically execute profitable trades.');
    });

    this.bot.onText(/\/auto_off/, (msg) => {
      this.autoExecute = false;
      this.sendMessage('⚠️ *Auto-execution DISABLED*\n\nYou will need to manually approve trades.');
    });

    // Help command
    this.bot.onText(/\/help/, (msg) => {
      this.sendMessage(
        '📖 *Help - Flash Loan Arbitrage Bot*\n\n' +
        '*How it works:*\n' +
        '1. Bot scans all DEXs every 2 minutes\n' +
        '2. Detects arbitrage opportunities\n' +
        '3. Sends detailed alert to you\n' +
        '4. Automatically executes (if enabled)\n' +
        '5. Sends profit to your wallet\n\n' +
        '*Features:*\n' +
        '✅ Real-time price scanning\n' +
        '✅ Direct & triangular arbitrage\n' +
        '✅ MEV protection\n' +
        '✅ Gas optimization\n' +
        '✅ Slippage protection\n\n' +
        '*Commands:*\n' +
        '/status - Bot status\n' +
        '/auto_on - Enable auto-execution\n' +
        '/auto_off - Disable auto-execution'
      );
    });

    // Handle callback queries (button clicks)
    this.bot.on('callback_query', async (query) => {
      const data = query.data;
      
      if (data?.startsWith('execute_')) {
        const oppId = data.replace('execute_', '');
        const opportunity = this.pendingOpportunities.get(oppId);
        
        if (opportunity && this.executeCallback) {
          await this.bot.answerCallbackQuery(query.id, { text: 'Executing trade...' });
          await this.executeCallback(opportunity);
        } else {
          await this.bot.answerCallbackQuery(query.id, { text: 'Opportunity expired' });
        }
      } else if (data?.startsWith('skip_')) {
        await this.bot.answerCallbackQuery(query.id, { text: 'Trade skipped' });
        this.bot.sendMessage(this.chatId, '⏭️ Trade skipped. Waiting for next opportunity...');
      }
    });
  }

  /**
   * Send arbitrage opportunity alert with detailed information
   */
  async sendArbitrageAlert(opportunity: ArbitrageOpportunity): Promise<void> {
    try {
      const oppId = Date.now().toString();
      this.pendingOpportunities.set(oppId, opportunity);

      // Clean up old opportunities
      setTimeout(() => this.pendingOpportunities.delete(oppId), 300000); // 5 minutes

      // Build detailed message
      const message = this.buildOpportunityMessage(opportunity);

      // Send alert
      if (this.autoExecute) {
        await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
        
        // Auto-execute
        await this.sendMessage('⚡ *AUTO-EXECUTING TRADE...*');
        
        if (this.executeCallback) {
          await this.executeCallback(opportunity);
        }
      } else {
        // Send with execute button for manual confirmation
        await this.bot.sendMessage(this.chatId, message, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Execute Trade', callback_data: `execute_${oppId}` },
                { text: '⏭️ Skip', callback_data: `skip_${oppId}` },
              ],
            ],
          },
        });
      }
    } catch (error) {
      logger.error('Error sending Telegram alert:', error);
    }
  }

  /**
   * Build detailed opportunity message
   */
  private buildOpportunityMessage(opp: ArbitrageOpportunity): string {
    const timestamp = new Date(opp.timestamp).toLocaleTimeString();
    
    let message = '🎯 *ARBITRAGE OPPORTUNITY DETECTED*\n\n';
    
    // Type and path
    if (opp.type === 'direct') {
      message += `📊 Type: Direct (Bidirectional)\n`;
      message += `🔄 Path: ${opp.path[0]} → ${opp.path[1]} → ${opp.path[0]}\n\n`;
    } else {
      message += `📊 Type: Triangular\n`;
      message += `🔄 Path: ${opp.path.join(' → ')}\n\n`;
    }

    // DEX information
    message += `💱 *DEX Route:*\n`;
    opp.dexPath.forEach((dex, index) => {
      message += `  ${index + 1}. ${dex}\n`;
    });
    message += '\n';

    // Price details
    message += `💰 *Price Details:*\n`;
    opp.priceDetails.forEach((detail, index) => {
      message += `  ${index + 1}. ${detail.token}\n`;
      message += `     DEX: ${detail.dex}\n`;
      message += `     Price: ${detail.price.toFixed(6)}\n`;
      message += `     Liquidity: $${this.formatNumber(detail.liquidity)}\n`;
    });
    message += '\n';

    // Spread and profit
    message += `📈 *Opportunity Details:*\n`;
    message += `  Spread: ${opp.spreadPercent.toFixed(3)}%\n`;
    message += `  Profit %: ${opp.profitPercentage.toFixed(3)}%\n`;
    message += `  Gross Profit: $${opp.profitUSD.toFixed(2)}\n`;
    message += `  Gas Cost: $${opp.gasCostUSD.toFixed(2)}\n`;
    message += `  *Net Profit: $${opp.netProfitUSD.toFixed(2)}* ✅\n\n`;

    // Liquidity and gas
    message += `🔧 *Technical Details:*\n`;
    message += `  Total Liquidity: $${this.formatNumber(opp.liquidity)}\n`;
    message += `  Gas Estimate: ${this.formatNumber(opp.gasEstimate)}\n`;
    message += `  Flash Loan: $${this.formatNumber(parseFloat(opp.amountIn) * 2000)}\n`;
    message += `  Time: ${timestamp}\n\n`;

    // Status
    if (this.autoExecute) {
      message += '⚡ *STATUS: AUTO-EXECUTING...*';
    } else {
      message += '⏸️ *STATUS: AWAITING CONFIRMATION*';
    }

    return message;
  }

  /**
   * Send execution result
   */
  async sendExecutionResult(
    success: boolean,
    txHash?: string,
    profitUSD?: number,
    error?: string
  ): Promise<void> {
    try {
      if (success && txHash && profitUSD) {
        const message =
          '🎉 *TRADE EXECUTED SUCCESSFULLY!*\n\n' +
          `✅ Transaction: \`${txHash}\`\n` +
          `💰 Profit: $${profitUSD.toFixed(2)}\n` +
          `🔗 Arbitrum Explorer: https://arbiscan.io/tx/${txHash}\n\n` +
          '✨ Profit has been sent to your wallet!';
        
        await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
      } else {
        const message =
          '❌ *TRADE EXECUTION FAILED*\n\n' +
          `Error: ${error || 'Unknown error'}\n\n` +
          '🔄 Continuing to scan for new opportunities...';
        
        await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
      }
    } catch (err) {
      logger.error('Error sending execution result:', err);
    }
  }

  /**
   * Send error notification
   */
  async sendError(error: string): Promise<void> {
    try {
      const message = `⚠️ *ERROR*\n\n\`${error}\``;
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error('Error sending error notification:', err);
    }
  }

  /**
   * Send general message
   */
  async sendMessage(text: string): Promise<void> {
    try {
      await this.bot.sendMessage(this.chatId, text, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Error sending Telegram message:', error);
    }
  }

  /**
   * Register execution callback
   */
  onExecute(callback: (opportunity: ArbitrageOpportunity) => Promise<void>): void {
    this.executeCallback = callback;
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
   * Set auto-execute mode
   */
  setAutoExecute(enabled: boolean): void {
    this.autoExecute = enabled;
  }

  /**
   * Get auto-execute status
   */
  isAutoExecuteEnabled(): boolean {
    return this.autoExecute;
  }
}
