# 🚀 How to Start Your Arbitrage Bot

## Quick Start Guide

### Step 1: Verify Configuration

Make sure your `.env` file has the correct settings:

```bash
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
TELEGRAM_BOT_TOKEN=7990738699:AAFfoPA4VGO_90DyQauHNiwbHnfwOTmfbgU
TELEGRAM_CHAT_ID=8305086804
SCAN_INTERVAL=180000
MIN_PROFIT_PERCENTAGE=0.5
```

✅ **Your Telegram credentials are already configured!**

### Step 2: Start the Bot

```bash
npm start
```

The bot will:
1. Connect to Arbitrum mainnet
2. Send a startup message to your Telegram
3. Begin scanning every 3 minutes
4. Alert you of any profitable opportunities

### Step 3: Monitor

You'll receive Telegram alerts containing:
- 💎 Real-time WETH prices across all DEXs
- 🎯 Direct arbitrage opportunities
- 🔺 Triangular arbitrage opportunities
- 📊 Detailed price comparisons

## What to Expect

### First Message
You'll immediately receive a startup confirmation:
```
🤖 ARBITRAGE BOT STARTED 🤖

📍 Network: Arbitrum Mainnet
🔄 Scan Interval: 3 minutes
💎 Monitored Tokens: WETH, ARB, USDC, USDT, DAI, LINK, MAGIC, WBTC, GMX, RDNT
```

### Scan Results (Every 3 Minutes)
```
🚨 ARBITRAGE SCAN RESULTS 🚨
⏰ Time: [Current Time]
📊 Total Opportunities: X

💎 WETH LIVE PRICES
WETH/USDC:
  • Uniswap V3: 2,500.234 USDC (0.3% fee)
  • Sushiswap: 2,498.123 USDC
  • Camelot: 2,501.456 USDC
...
```

## Stopping the Bot

Press `Ctrl+C` to gracefully stop the bot.

## Running in Background

### Using screen (Recommended for Linux servers)
```bash
# Start a new screen session
screen -S arbitrage-bot

# Start the bot
npm start

# Detach from screen: Press Ctrl+A, then D

# Reattach to screen
screen -r arbitrage-bot

# Kill screen session
screen -X -S arbitrage-bot quit
```

### Using PM2 (Production)
```bash
# Install PM2 globally
npm install -g pm2

# Start bot with PM2
pm2 start src/index.js --name arbitrage-bot

# View logs
pm2 logs arbitrage-bot

# Stop bot
pm2 stop arbitrage-bot

# Restart bot
pm2 restart arbitrage-bot
```

## Troubleshooting

### Issue: No Telegram messages
**Solution:** Make sure you've started a conversation with your bot first. Send `/start` to your bot on Telegram.

### Issue: Bot crashes
**Solution:** Check your RPC URL. Public RPCs may have rate limits. Consider using a private RPC from Alchemy or Infura.

### Issue: No opportunities found
**Solution:** This is normal! Profitable arbitrage opportunities are rare. You can:
- Lower `MIN_PROFIT_PERCENTAGE` in `.env` to see more opportunities
- Be patient - the bot runs continuously

## Understanding Results

### Direct Arbitrage Example
```
WETH → USDC
💰 Profit: 0.65% (16.25 USDC)
📈 Buy: Sushiswap @ 2,498.123
📉 Sell: Camelot @ 2,501.456
```
**Meaning:** Buy WETH/USDC on Sushiswap, immediately sell on Camelot for 0.65% profit.

### Triangular Arbitrage Example
```
WETH → USDC → ARB → WETH
💰 Profit: 1.5% (0.015 WETH)
🔄 Path:
  1. WETH → USDC via Uniswap V3: 2,500
  2. USDC → ARB via Sushiswap: 2,000
  3. ARB → WETH via Camelot: 1.015
```
**Meaning:** Execute 3 swaps in sequence to end up with more WETH than you started with.

## Important Notes

⚠️ **Gas Costs:** Displayed profits don't include gas fees. Always calculate gas costs before executing trades.

⚠️ **Slippage:** Large trades may experience slippage. Start with smaller amounts.

⚠️ **Speed:** Arbitrage is competitive. Manual execution may be too slow.

⚠️ **Flash Loans:** For best results, integrate flash loans to trade without upfront capital.

## Next Steps

Once you identify consistent opportunities:
1. Study the patterns
2. Calculate gas costs
3. Consider implementing automated execution
4. Use flash loans for larger capital efficiency

---

**Happy Trading! 🚀**
