import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import { ArbitrageOpportunity } from './ArbitrageDetector';

export class TelegramNotifier {
  private bot: TelegramBot;
  private chatId: string;
  private executeCallback?: (opportunity: ArbitrageOpportunity) => Promise<void>;

  constructor() {
    this.bot = new TelegramBot(config.telegram.botToken, { polling: true });
    this.chatId = config.telegram.chatId;
    this.setupCommands();
    this.sendMessage('🤖 Flash Loan Arbitrage Bot Started!\n\nScanning for opportunities on Arbitrum...');
  }

  /**
   * Setup bot commands
   */
  private setupCommands() {
    this.bot.onText(/\/start/, (msg) => {
      this.bot.sendMessage(
        msg.chat.id,
        '🤖 *Flash Loan Arbitrage Bot*\n\n' +
        '✅ Bot is running and scanning for opportunities\n\n' +
        'Commands:\n' +
        '/status - Check bot status\n' +
        '/balance - Check wallet balance\n' +
        '/config - View configuration\n' +
        '/help - Show this message',
        { parse_mode: 'Markdown' }
      );
    });

    this.bot.onText(/\/status/, (msg) => {
      this.sendStatus();
    });

    this.bot.onText(/\/help/, (msg) => {
      this.bot.sendMessage(
        msg.chat.id,
        '📖 *Help*\n\n' +
        'The bot automatically scans DEXs for arbitrage opportunities.\n' +
        'When a profitable opportunity is found:\n' +
        '1. You receive an alert with details\n' +
        '2. Click "Execute Trade" to proceed\n' +
        '3. Bot executes flash loan and arbitrage\n' +
        '4. Profits are sent to your wallet\n\n' +
        'The bot handles everything automatically!',
        { parse_mode: 'Markdown' }
      );
    });

    // Handle callback queries (button clicks)
    this.bot.on('callback_query', async (query) => {
      const data = query.data;
      
      if (data?.startsWith('execute_')) {
        const opportunityJson = data.replace('execute_', '');
        try {
          const opportunity = JSON.parse(decodeURIComponent(opportunityJson));
          
          await this.bot.answerCallbackQuery(query.id, {
            text: '⚡ Executing trade...',
          });
          
          await this.bot.sendMessage(
            query.message!.chat.id,
            '⚡ *Trade Execution Started*\n\nExecuting flash loan arbitrage...',
            { parse_mode: 'Markdown' }
          );
          
          if (this.executeCallback) {
            await this.executeCallback(opportunity);
          }
        } catch (error) {
          logger.error('Error executing trade from Telegram:', error);
          await this.bot.sendMessage(
            query.message!.chat.id,
            '❌ *Execution Failed*\n\nError: ' + (error as Error).message,
            { parse_mode: 'Markdown' }
          );
        }
      } else if (data === 'cancel') {
        await this.bot.answerCallbackQuery(query.id, {
          text: 'Trade cancelled',
        });
        await this.bot.sendMessage(
          query.message!.chat.id,
          '❌ Trade cancelled',
        );
      }
    });

    logger.info('Telegram bot commands setup complete');
  }

  /**
   * Register execute callback
   */
  onExecute(callback: (opportunity: ArbitrageOpportunity) => Promise<void>) {
    this.executeCallback = callback;
  }

  /**
   * Send a simple message
   */
  async sendMessage(message: string) {
    try {
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Failed to send Telegram message:', error);
    }
  }

  /**
   * Send arbitrage opportunity alert
   */
  async sendArbitrageAlert(opportunity: ArbitrageOpportunity, autoExecute: boolean = false) {
    const message = this.formatOpportunityMessage(opportunity);
    
    try {
      if (autoExecute) {
        // Auto-execute mode - just send notification
        await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
        
        // Auto execute
        if (this.executeCallback) {
          await this.bot.sendMessage(
            this.chatId,
            '⚡ *AUTO-EXECUTING TRADE...*',
            { parse_mode: 'Markdown' }
          );
          await this.executeCallback(opportunity);
        }
      } else {
        // Manual confirmation mode
        const keyboard = {
          inline_keyboard: [
            [
              {
                text: '✅ Execute Trade',
                callback_data: `execute_${encodeURIComponent(JSON.stringify(opportunity))}`,
              },
              {
                text: '❌ Cancel',
                callback_data: 'cancel',
              },
            ],
          ],
        };
        
        await this.bot.sendMessage(this.chatId, message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      }
    } catch (error) {
      logger.error('Failed to send arbitrage alert:', error);
    }
  }

  /**
   * Format opportunity message
   */
  private formatOpportunityMessage(opp: ArbitrageOpportunity): string {
    const direction = opp.direction === 'AtoB' 
      ? `${opp.tokenA} → ${opp.tokenB}`
      : `${opp.tokenB} → ${opp.tokenA}`;
    
    return (
      `🎯 *ARBITRAGE OPPORTUNITY DETECTED!*\n\n` +
      `💱 *Pair:* ${opp.tokenA}/${opp.tokenB}\n` +
      `📊 *Direction:* ${direction}\n\n` +
      `🔵 *Buy on:* ${opp.buyDex}\n` +
      `💰 *Buy Price:* ${opp.buyPrice.toFixed(6)}\n` +
      `${opp.buyFee ? `⚡ Fee Tier: ${opp.buyFee / 10000}%\n` : ''}` +
      `\n` +
      `🔴 *Sell on:* ${opp.sellDex}\n` +
      `💰 *Sell Price:* ${opp.sellPrice.toFixed(6)}\n` +
      `${opp.sellFee ? `⚡ Fee Tier: ${opp.sellFee / 10000}%\n` : ''}` +
      `\n` +
      `📈 *Profit:* ${opp.profitPercentage.toFixed(3)}%\n` +
      `💵 *Est. Profit (USD):* $${opp.estimatedProfitUSD.toFixed(2)}\n` +
      `⏰ *Timestamp:* ${new Date(opp.timestamp).toLocaleString()}\n\n` +
      `⚡ Ready to execute flash loan arbitrage!`
    );
  }

  /**
   * Send trade execution result
   */
  async sendExecutionResult(
    success: boolean,
    txHash?: string,
    profit?: number,
    error?: string
  ) {
    let message: string;
    
    if (success) {
      message = (
        `✅ *TRADE EXECUTED SUCCESSFULLY!*\n\n` +
        `💰 *Profit:* $${profit?.toFixed(2)}\n` +
        `🔗 *Transaction:* \`${txHash}\`\n` +
        `🌐 [View on Arbiscan](https://arbiscan.io/tx/${txHash})\n\n` +
        `💸 Profit has been sent to your wallet!`
      );
    } else {
      message = (
        `❌ *TRADE EXECUTION FAILED*\n\n` +
        `⚠️ *Error:* ${error}\n` +
        `${txHash ? `🔗 *TX:* \`${txHash}\`\n` : ''}` +
        `\nNo funds were lost. Continuing to scan for opportunities...`
      );
    }
    
    await this.sendMessage(message);
  }

  /**
   * Send status update
   */
  async sendStatus() {
    const message = (
      `📊 *Bot Status*\n\n` +
      `✅ Status: Running\n` +
      `🌐 Network: Arbitrum\n` +
      `⏱️ Scan Interval: ${config.monitoring.scanIntervalMs / 1000}s\n` +
      `💰 Min Profit: $${config.flashLoan.minProfitUSD}\n` +
      `💵 Loan Amount: $${config.flashLoan.minLoanAmountUSD.toLocaleString()}\n` +
      `⛽ Max Gas Price: ${config.flashLoan.maxGasPriceGwei} gwei\n` +
      `📈 Max Slippage: ${config.monitoring.maxSlippagePercent}%\n\n` +
      `🔍 Actively scanning for opportunities...`
    );
    
    await this.sendMessage(message);
  }

  /**
   * Send error notification
   */
  async sendError(error: string) {
    const message = `⚠️ *Error*\n\n${error}`;
    await this.sendMessage(message);
  }

  /**
   * Send scan results
   */
  async sendScanResults(pairsScanned: number, opportunitiesFound: number) {
    if (opportunitiesFound === 0) return; // Only send if opportunities found
    
    const message = (
      `🔍 *Scan Complete*\n\n` +
      `📊 Pairs Scanned: ${pairsScanned}\n` +
      `🎯 Opportunities Found: ${opportunitiesFound}\n` +
      `⏰ Time: ${new Date().toLocaleString()}`
    );
    
    await this.sendMessage(message);
  }
}
