/**
 * ═══════════════════════════════════════════════════════════════════
 * PRODUCTION TELEGRAM BOT
 * Real-time alerts with execution buttons
 * ═══════════════════════════════════════════════════════════════════
 */

import TelegramBot from 'node-telegram-bot-api';
import { productionConfig } from '../config/production.config';
import { ArbitrageOpportunity } from './UltraFastArbitrageScanner';

export class ProductionTelegramBot {
  private bot: TelegramBot;
  private chatId: string;
  private executionCallback: ((opportunity: ArbitrageOpportunity) => Promise<void>) | null = null;
  private pendingOpportunities: Map<number, ArbitrageOpportunity> = new Map();
  private messageIdCounter: number = 0;

  constructor() {
    this.chatId = productionConfig.telegram.chatId;
    
    // Initialize bot
    this.bot = new TelegramBot(productionConfig.telegram.botToken, {
      polling: true,
    });

    // Register command handlers
    this.registerHandlers();

    console.log('✅ Telegram bot initialized');
  }

  /**
   * Register bot command handlers
   */
  private registerHandlers() {
    // Start command
    this.bot.onText(/\/start/, (msg) => {
      this.sendMessage(
        '🤖 *Flash Loan Arbitrage Bot*\n\n' +
        '✅ Bot is running and scanning for arbitrage opportunities\n\n' +
        '*Commands:*\n' +
        '/status - Get bot status\n' +
        '/stats - View trading statistics\n' +
        '/stop - Stop the bot\n\n' +
        '*Auto-Execution:* ' + (productionConfig.automation.autoExecute ? 'ENABLED ✅' : 'DISABLED ❌')
      );
    });

    // Status command
    this.bot.onText(/\/status/, async (msg) => {
      const statusMsg = 
        '📊 *Bot Status*\n\n' +
        `🔄 Scanning: Active\n` +
        `⏱ Scan Interval: ${productionConfig.scanning.scanIntervalMs / 1000 / 60} minutes\n` +
        `💰 Min Loan: $${productionConfig.flashLoan.minLoanAmountUSD.toLocaleString()}\n` +
        `📈 Min Profit: $${productionConfig.flashLoan.minProfitUSD}\n` +
        `🎯 Min Profit %: ${productionConfig.flashLoan.minProfitPercentage}%\n` +
        `🛡 MEV Protection: ${productionConfig.mev.enabled ? 'ON' : 'OFF'}\n` +
        `⚡ Auto-Execute: ${productionConfig.automation.autoExecute ? 'ON' : 'OFF'}`;
      
      await this.sendMessage(statusMsg);
    });

    // Handle callback queries (button presses)
    this.bot.on('callback_query', async (query) => {
      await this.handleCallback(query);
    });
  }

  /**
   * Handle button callback
   */
  private async handleCallback(query: any) {
    const data = query.data;
    const messageId = query.message.message_id;

    if (data.startsWith('execute_')) {
      const opportunityId = parseInt(data.split('_')[1]);
      const opportunity = this.pendingOpportunities.get(opportunityId);

      if (opportunity && this.executionCallback) {
        // Update message to show executing
        await this.bot.editMessageText(
          '⚡ *EXECUTING TRADE...*\n\nPlease wait...',
          {
            chat_id: this.chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
          }
        );

        // Execute the trade
        try {
          await this.executionCallback(opportunity);
        } catch (error) {
          await this.bot.answerCallbackQuery(query.id, {
            text: '❌ Execution failed!',
            show_alert: true,
          });
        }

        // Remove from pending
        this.pendingOpportunities.delete(opportunityId);
      } else {
        await this.bot.answerCallbackQuery(query.id, {
          text: '⚠️ Opportunity expired',
          show_alert: true,
        });
      }
    } else if (data.startsWith('cancel_')) {
      const opportunityId = parseInt(data.split('_')[1]);
      this.pendingOpportunities.delete(opportunityId);

      await this.bot.editMessageText(
        '❌ *Trade Cancelled*',
        {
          chat_id: this.chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
        }
      );

      await this.bot.answerCallbackQuery(query.id, {
        text: 'Trade cancelled',
      });
    }
  }

  /**
   * Send arbitrage opportunity alert
   */
  async sendOpportunityAlert(opportunity: ArbitrageOpportunity, autoExecute: boolean = false) {
    const opportunityId = this.messageIdCounter++;
    
    // Format message
    const message = this.formatOpportunityMessage(opportunity);

    // Create inline keyboard for manual execution
    const keyboard = autoExecute ? undefined : {
      inline_keyboard: [
        [
          { text: '✅ EXECUTE TRADE', callback_data: `execute_${opportunityId}` },
          { text: '❌ CANCEL', callback_data: `cancel_${opportunityId}` },
        ],
      ],
    };

    try {
      const sentMessage = await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });

      // Store opportunity if manual confirmation required
      if (!autoExecute) {
        this.pendingOpportunities.set(opportunityId, opportunity);
        
        // Auto-expire after 2 minutes
        setTimeout(() => {
          this.pendingOpportunities.delete(opportunityId);
        }, 120000);
      }

      return sentMessage.message_id;
    } catch (error) {
      console.error('Failed to send Telegram alert:', error);
      return null;
    }
  }

  /**
   * Format opportunity message
   */
  private formatOpportunityMessage(opp: ArbitrageOpportunity): string {
    const emoji = opp.confidence >= 80 ? '🔥' : opp.confidence >= 60 ? '⚡' : '💡';
    
    return (
      `${emoji} *ARBITRAGE OPPORTUNITY DETECTED!*\n\n` +
      `*Pair:* ${opp.token0Symbol}/${opp.token1Symbol}\n` +
      `*Direction:* ${opp.direction === 'forward' ? '→' : '←'}\n\n` +
      
      `*Trade Route:*\n` +
      `1️⃣ Borrow ${opp.flashLoanAmountUSD.toLocaleString()} ${opp.token0Symbol}\n` +
      `2️⃣ Buy ${opp.token1Symbol} on ${opp.buyDex} @ $${opp.buyPrice.toFixed(6)}\n` +
      `3️⃣ Sell ${opp.token1Symbol} on ${opp.sellDex} @ $${opp.sellPrice.toFixed(6)}\n` +
      `4️⃣ Repay loan + profit\n\n` +
      
      `*Price Spread:*\n` +
      `📊 ${opp.spreadPercentage.toFixed(3)}%\n\n` +
      
      `*Profit Analysis:*\n` +
      `💵 Gross Profit: $${opp.estimatedProfitUSD.toFixed(2)}\n` +
      `💸 Flash Loan Fee: $${(parseFloat(opp.flashLoanFee.toString()) / 1e6).toFixed(2)}\n` +
      `⛽ Gas Cost: ~$${(parseFloat(opp.estimatedGasCost.toString()) / 1e18 * 2000).toFixed(2)}\n` +
      `━━━━━━━━━━━━━━━\n` +
      `✅ *NET PROFIT: $${opp.netProfitUSD.toFixed(2)}* (${opp.netProfitPercentage.toFixed(2)}%)\n\n` +
      
      `*Execution Details:*\n` +
      `🎯 Confidence: ${opp.confidence}%\n` +
      `🛡 Slippage Protection: ${productionConfig.trading.maxSlippageBps / 100}%\n` +
      `⏱ Deadline: ${productionConfig.trading.txDeadlineSeconds}s\n\n` +
      
      `*Status:* ${productionConfig.automation.autoExecute ? '⚡ Auto-executing...' : '⏳ Awaiting confirmation'}`
    );
  }

  /**
   * Send execution result
   */
  async sendExecutionResult(
    success: boolean,
    txHash?: string,
    profitUSD?: number,
    error?: string
  ) {
    let message: string;

    if (success && txHash) {
      message = (
        `✅ *TRADE EXECUTED SUCCESSFULLY!*\n\n` +
        `💰 *Net Profit: $${profitUSD?.toFixed(2)}*\n\n` +
        `🔗 Transaction:\n` +
        `\`${txHash}\`\n\n` +
        `[View on Arbiscan](https://arbiscan.io/tx/${txHash})`
      );
    } else {
      message = (
        `❌ *TRADE EXECUTION FAILED*\n\n` +
        `Error: ${error || 'Unknown error'}\n\n` +
        `The bot will continue scanning for new opportunities.`
      );
    }

    await this.sendMessage(message);
  }

  /**
   * Send scan summary
   */
  async sendScanSummary(
    pairsScanned: number,
    opportunitiesFound: number,
    bestOpportunity?: ArbitrageOpportunity
  ) {
    let message = (
      `🔍 *Scan Complete*\n\n` +
      `📊 Pairs Scanned: ${pairsScanned}\n` +
      `💡 Opportunities Found: ${opportunitiesFound}\n`
    );

    if (bestOpportunity) {
      message += (
        `\n*Best Opportunity:*\n` +
        `${bestOpportunity.token0Symbol}/${bestOpportunity.token1Symbol} - ` +
        `$${bestOpportunity.netProfitUSD.toFixed(2)} profit`
      );
    }

    await this.sendMessage(message);
  }

  /**
   * Send generic message
   */
  async sendMessage(text: string) {
    try {
      await this.bot.sendMessage(this.chatId, text, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      });
    } catch (error) {
      console.error('Failed to send Telegram message:', error);
    }
  }

  /**
   * Send error alert
   */
  async sendError(error: string) {
    await this.sendMessage(`⚠️ *ERROR*\n\n${error}`);
  }

  /**
   * Register execution callback
   */
  onExecute(callback: (opportunity: ArbitrageOpportunity) => Promise<void>) {
    this.executionCallback = callback;
  }

  /**
   * Send bot started notification
   */
  async sendStartupNotification(walletAddress: string, balance: string) {
    const message = (
      `🚀 *BOT STARTED*\n\n` +
      `✅ Flash Loan Arbitrage Bot is now running!\n\n` +
      `*Configuration:*\n` +
      `👛 Wallet: \`${walletAddress}\`\n` +
      `💰 Balance: ${balance} ETH\n` +
      `💵 Min Loan: $${productionConfig.flashLoan.minLoanAmountUSD.toLocaleString()}\n` +
      `📈 Min Profit: $${productionConfig.flashLoan.minProfitUSD} (${productionConfig.flashLoan.minProfitPercentage}%)\n` +
      `⏱ Scan Interval: ${productionConfig.scanning.scanIntervalMs / 1000 / 60} min\n` +
      `🛡 MEV Protection: ${productionConfig.mev.enabled ? 'ON' : 'OFF'}\n` +
      `⚡ Auto-Execute: ${productionConfig.automation.autoExecute ? 'ON' : 'OFF'}\n\n` +
      `The bot is now scanning for profitable arbitrage opportunities...`
    );

    await this.sendMessage(message);
  }

  /**
   * Stop the bot
   */
  stop() {
    this.bot.stopPolling();
    console.log('🛑 Telegram bot stopped');
  }
}
