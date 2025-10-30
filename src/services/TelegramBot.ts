import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import { ArbitrageOpportunity } from './ArbitrageDetector';

export class TelegramNotifier {
  private bot: TelegramBot;
  private chatId: string;
  private executeCallback?: (opportunity: ArbitrageOpportunity) => Promise<void>;
  private startBotCallback?: () => void;
  private stopBotCallback?: () => void;
  private pauseBotCallback?: () => void;
  private resumeBotCallback?: () => void;
  private opportunityCache: Map<string, ArbitrageOpportunity> = new Map();

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
        '/pause - Pause bot (stop scanning)\n' +
        '/resume - Resume bot (restart scanning)\n' +
        '/stop - Stop bot completely\n' +
        '/help - Show this message',
        { parse_mode: 'Markdown' }
      );
    });

    this.bot.onText(/\/status/, (msg) => {
      this.sendStatus();
    });

    this.bot.onText(/\/pause/, (msg) => {
      if (this.pauseBotCallback) {
        this.pauseBotCallback();
        this.bot.sendMessage(msg.chat.id, '⏸️ *Bot Paused*\n\nScanning stopped. Send /resume to continue.', { parse_mode: 'Markdown' });
      }
    });

    this.bot.onText(/\/resume/, (msg) => {
      if (this.resumeBotCallback) {
        this.resumeBotCallback();
        this.bot.sendMessage(msg.chat.id, '▶️ *Bot Resumed*\n\nScanning restarted!', { parse_mode: 'Markdown' });
      }
    });

    this.bot.onText(/\/stop/, (msg) => {
      if (this.stopBotCallback) {
        this.bot.sendMessage(msg.chat.id, '🛑 *Bot Stopping*\n\nShutting down gracefully...', { parse_mode: 'Markdown' });
        setTimeout(() => {
          this.stopBotCallback!();
        }, 1000);
      }
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
        const opportunityId = data.replace('execute_', '');
        const opportunity = this.opportunityCache.get(opportunityId);

        if (!opportunity) {
          await this.bot.answerCallbackQuery(query.id, {
            text: 'Opportunity expired',
            show_alert: true,
          });
          return;
        }

        try {
          await this.bot.answerCallbackQuery(query.id, {
            text: '⚡ Executing trade...',
          });

          await this.bot.sendMessage(
            query.message!.chat.id,
            '⚡ *Trade Execution Started*\n\nExecuting flash-loan arbitrage...',
            { parse_mode: 'Markdown' }
          );

          if (this.executeCallback) {
            await this.executeCallback(opportunity);
            this.opportunityCache.delete(opportunity.id);
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
   * Register bot control callbacks
   */
  onBotControls(callbacks: {
    start?: () => void;
    stop?: () => void;
    pause?: () => void;
    resume?: () => void;
  }) {
    this.startBotCallback = callbacks.start;
    this.stopBotCallback = callbacks.stop;
    this.pauseBotCallback = callbacks.pause;
    this.resumeBotCallback = callbacks.resume;
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
  async sendArbitrageAlert(
    opportunity: ArbitrageOpportunity,
    autoExecute: boolean = false,
    executionEnabled: boolean = true
  ) {
    const baseMessage = this.formatOpportunityMessage(opportunity);
    const message = executionEnabled
      ? baseMessage
      : `${baseMessage}\n\n🚫 *Execution disabled (scan-only mode).*`;

    if (executionEnabled) {
      this.opportunityCache.set(opportunity.id, opportunity);
    } else {
      this.opportunityCache.delete(opportunity.id);
    }

    try {
      if (executionEnabled && autoExecute) {
        // Auto-execute mode - just send notification
        await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });

        if (this.executeCallback) {
          await this.bot.sendMessage(
            this.chatId,
            '⚡ *AUTO-EXECUTING TRADE...*',
            { parse_mode: 'Markdown' }
          );
          await this.executeCallback(opportunity);
          this.opportunityCache.delete(opportunity.id);
        }
      } else if (executionEnabled) {
        const keyboard = {
          inline_keyboard: [
            [
              {
                text: '✅ Execute Trade',
                callback_data: `execute_${opportunity.id}`,
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
      } else {
        await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
      }
    } catch (error) {
      logger.error('Failed to send arbitrage alert:', error);
    }
  }

  /**
   * Format opportunity message
   */
  private formatOpportunityMessage(opp: ArbitrageOpportunity): string {
    const legsDescription = opp.legs
      .map((leg, idx) => {
        const feePercent = leg.feeBps ? (leg.feeBps / 100).toFixed(2) : '0.00';
        return `L${idx + 1}. ${leg.dex}: ${leg.fromToken.symbol} → ${leg.toToken.symbol} (fee ${feePercent}%)`;
      })
      .join('\n');

    return (
      `🎯 *ARBITRAGE OPPORTUNITY DETECTED!*\n\n` +
      `${this.renderPath(opp)}\n\n` +
      `🔗 *Type:* ${opp.type}\n` +
      `🪙 *Loan Token:* ${opp.borrowToken.symbol} (${opp.borrowAmountHuman.toFixed(4)})\n` +
      `💲 *Loan Token Price:* $${opp.borrowTokenUsd.toFixed(4)}\n` +
      `💵 *Notional:* $${opp.notionalUsd.toFixed(2)}\n` +
      `📈 *Net Profit:* $${opp.expectedProfitUsd.toFixed(2)} (${opp.expectedProfitPercent.toFixed(3)}%)\n` +
      `⛽ *Gas Estimate:* ~$${opp.gasCostUsdEstimate.toFixed(2)}\n` +
      `🧊 *Liquidity Cap:* $${opp.liquidityCapUsd.toFixed(2)}\n` +
      `🕒 *Detected:* ${new Date(opp.blockTimestamp).toLocaleTimeString()}\n\n` +
      `📚 *Route Details:*\n${legsDescription}\n\n` +
      `⚡ Ready to execute flash-loan arbitrage!`
    );
  }

  private renderPath(opp: ArbitrageOpportunity): string {
    const symbols = opp.path.map((token) => token.symbol).join(' → ');
    return `🛣️ *Path:* ${symbols}`;
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
      `💰 Min Profit: $${config.flashLoan.minProfitUsd}\n` +
      `💵 Loan Range: $${config.flashLoan.minLoanAmountUsd.toLocaleString()} - $${config.flashLoan.maxLoanAmountUsd.toLocaleString()}\n` +
      `⛽ Max Gas Price: ${config.execution.maxGasPriceGwei} gwei\n` +
      `📈 Max Slippage: ${config.execution.maxSlippagePercent}%\n\n` +
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
