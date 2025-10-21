import TelegramBot from 'node-telegram-bot-api';

export class TelegramNotifier {
  constructor(botToken, chatId) {
    this.bot = new TelegramBot(botToken, { polling: false });
    this.chatId = chatId;
  }

  // Send a formatted message
  async sendMessage(message) {
    try {
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'HTML' });
      console.log('✅ Telegram alert sent');
    } catch (error) {
      console.error('❌ Error sending Telegram message:', error.message);
    }
  }

  // Format and send arbitrage opportunities
  async sendArbitrageAlert(scanResults) {
    const { direct, triangular, wethPrices, totalOpportunities, timestamp } = scanResults;

    let message = `🚨 <b>ARBITRAGE SCAN RESULTS</b> 🚨\n`;
    message += `⏰ Time: ${new Date(timestamp).toLocaleString()}\n`;
    message += `📊 Total Opportunities: ${totalOpportunities}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // WETH Prices Section
    message += `💎 <b>WETH LIVE PRICES</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    
    for (const [token, prices] of Object.entries(wethPrices)) {
      if (prices && prices.length > 0) {
        message += `\n<b>WETH/${token}:</b>\n`;
        prices.forEach(p => {
          message += `  • ${p.dex}: ${p.price.toFixed(6)} ${token}`;
          if (p.fee !== 'N/A') message += ` (${p.fee/10000}% fee)`;
          message += `\n`;
        });
      }
    }

    message += `\n━━━━━━━━━━━━━━━━━━━━\n`;

    // Direct Arbitrage Opportunities
    if (direct.length > 0) {
      message += `\n🎯 <b>DIRECT ARBITRAGE (${direct.length})</b>\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n`;

      // Sort by profit percentage
      const sortedDirect = [...direct].sort((a, b) => parseFloat(b.profitPercentage) - parseFloat(a.profitPercentage));
      
      sortedDirect.slice(0, 5).forEach((opp, idx) => {
        message += `\n${idx + 1}. <b>${opp.direction}</b>\n`;
        message += `   💰 Profit: ${opp.profitPercentage}% (${opp.profitAmount})\n`;
        message += `   📈 Buy: ${opp.buyDex} @ ${opp.buyPrice}\n`;
        message += `   📉 Sell: ${opp.sellDex} @ ${opp.sellPrice}\n`;
        
        if (opp.allPrices) {
          message += `   📊 All Prices:\n`;
          opp.allPrices.forEach(p => {
            message += `      • ${p.dex}: ${p.price}\n`;
          });
        }
      });
    }

    // Triangular Arbitrage Opportunities
    if (triangular.length > 0) {
      message += `\n\n🔺 <b>TRIANGULAR ARBITRAGE (${triangular.length})</b>\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n`;

      // Sort by profit percentage
      const sortedTriangular = [...triangular].sort((a, b) => parseFloat(b.profitPercentage) - parseFloat(a.profitPercentage));
      
      sortedTriangular.slice(0, 5).forEach((opp, idx) => {
        message += `\n${idx + 1}. <b>${opp.direction}</b>\n`;
        message += `   💰 Profit: ${opp.profitPercentage}% (${opp.profitAmount})\n`;
        message += `   🔄 Path:\n`;
        opp.steps.forEach((step, i) => {
          message += `      ${i + 1}. ${step.from} → ${step.to} via ${step.dex}: ${step.amount}\n`;
        });
      });
    }

    // No opportunities found
    if (totalOpportunities === 0) {
      message += `\n❌ <b>No profitable opportunities found</b>\n`;
      message += `Continue monitoring...\n`;
    }

    message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    message += `✅ <i>Next scan in 3 minutes</i>`;

    // Split message if too long (Telegram has 4096 char limit)
    if (message.length > 4000) {
      const messages = this.splitMessage(message, 4000);
      for (const msg of messages) {
        await this.sendMessage(msg);
        await TelegramNotifier.sleep(1000); // Wait 1 second between messages
      }
    } else {
      await this.sendMessage(message);
    }
  }

  // Send startup message
  async sendStartupMessage() {
    const message = `
🤖 <b>ARBITRAGE BOT STARTED</b> 🤖

📍 Network: Arbitrum Mainnet
🔄 Scan Interval: 3 minutes
💎 Monitored Tokens: WETH, ARB, USDC, USDT, DAI, LINK, MAGIC, WBTC, GMX, RDNT

🏦 DEXs:
• Uniswap V3 (0.05%, 0.3%, 1%)
• Sushiswap
• Camelot

🎯 Strategies:
• Direct Arbitrage (Bidirectional)
• Triangular Arbitrage (Bidirectional)

⚡ Real-time price monitoring active!
Waiting for profitable opportunities...
    `;

    await this.sendMessage(message);
  }

  // Send error message
  async sendError(error) {
    const message = `
❌ <b>ERROR DETECTED</b> ❌

${error.message || error}

Time: ${new Date().toLocaleString()}
    `;

    await this.sendMessage(message);
  }

  // Split long messages
  splitMessage(text, maxLength) {
    const messages = [];
    let currentMessage = '';

    const lines = text.split('\n');
    for (const line of lines) {
      if ((currentMessage + line + '\n').length > maxLength) {
        messages.push(currentMessage);
        currentMessage = line + '\n';
      } else {
        currentMessage += line + '\n';
      }
    }

    if (currentMessage) {
      messages.push(currentMessage);
    }

    return messages;
  }

  // Utility sleep function
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
