# 🤖 Arbitrum Arbitrage Bot - Real-Time Price Scanner & Telegram Alerter

A sophisticated arbitrage bot that monitors real-time prices across multiple DEXs on Arbitrum mainnet and sends profitable opportunity alerts to your Telegram.

## 🌟 Features

- ✅ **Real-time price monitoring** - Ultra-accurate, live prices from Arbitrum mainnet
- 🔄 **Direct Arbitrage** - Bidirectional scanning (buy low on DEX A, sell high on DEX B)
- 🔺 **Triangular Arbitrage** - Multi-path arbitrage opportunities (A→B→C→A)
- 💎 **WETH Focus** - Detailed WETH price tracking across all DEXs
- 📱 **Telegram Alerts** - Instant notifications with detailed opportunity data
- ⚡ **Flash Loan Ready** - Monitors tokens with easy flash loan access (WETH, ARB, USDC, LINK, MAGIC, etc.)
- 🏦 **Multi-DEX Support** - Uniswap V3, Sushiswap, Camelot
- ⏰ **Scheduled Scanning** - Automated scans every 3 minutes

## 🎯 Monitored Tokens

Primary tokens (flash loan supported):
- **WETH** (Wrapped Ethereum)
- **ARB** (Arbitrum)
- **USDC** (USD Coin)
- **USDT** (Tether)
- **DAI** (Dai Stablecoin)
- **LINK** (Chainlink)
- **MAGIC** (Treasure)
- **WBTC** (Wrapped Bitcoin)
- **RDNT** (Radiant)
- **GMX** (GMX)

## 🏦 Supported DEXs

1. **Uniswap V3** - Multiple fee tiers (0.05%, 0.3%, 1%)
2. **Sushiswap** - V2 AMM
3. **Camelot** - Native Arbitrum DEX

## 🚀 Quick Start

### Prerequisites

- Node.js v18 or higher
- Telegram Bot Token and Chat ID
- Arbitrum RPC endpoint (public or private)

### Installation

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your settings

# Start the bot
npm start
```

### Environment Variables

Edit `.env` file:

```env
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
SCAN_INTERVAL=180000  # 3 minutes in milliseconds
MIN_PROFIT_PERCENTAGE=0.5  # Minimum 0.5% profit to alert
```

## 📊 How It Works

### 1. Direct Arbitrage (Bidirectional)

The bot scans each token pair in **both directions**:
- Direction 1: Token A → Token B (compare prices across DEXs)
- Direction 2: Token B → Token A (reverse comparison)

**Example:**
```
WETH → USDC
Buy WETH/USDC on Uniswap V3: 1 WETH = 2,500 USDC
Sell WETH/USDC on Sushiswap: 1 WETH = 2,512 USDC
Profit: 0.48% (12 USDC)
```

### 2. Triangular Arbitrage (Bidirectional)

The bot tests multi-hop paths in **both directions**:
- Forward: A → B → C → A
- Reverse: A → C → B → A

**Example:**
```
WETH → USDC → ARB → WETH
1. Swap 1 WETH → 2,500 USDC (Uniswap V3)
2. Swap 2,500 USDC → 2,000 ARB (Sushiswap)
3. Swap 2,000 ARB → 1.015 WETH (Camelot)
Profit: 1.5% (0.015 WETH)
```

### 3. WETH Price Monitoring

Every scan provides real-time WETH prices across all DEXs for major pairs:
- WETH/USDC
- WETH/USDT
- WETH/ARB
- WETH/LINK
- WETH/MAGIC
- And more...

## 📱 Telegram Alerts

You'll receive formatted alerts containing:

```
🚨 ARBITRAGE SCAN RESULTS 🚨
⏰ Time: 2025-10-21 10:30:00
📊 Total Opportunities: 3

💎 WETH LIVE PRICES
━━━━━━━━━━━━━━━━━━━━

WETH/USDC:
  • Uniswap V3: 2,500.234 USDC (0.3% fee)
  • Sushiswap: 2,498.123 USDC
  • Camelot: 2,501.456 USDC

🎯 DIRECT ARBITRAGE (2)
━━━━━━━━━━━━━━━━━━━━

1. WETH → USDC
   💰 Profit: 0.65% (16.25 USDC)
   📈 Buy: Sushiswap @ 2,498.123
   📉 Sell: Camelot @ 2,501.456
```

## 🛠️ Project Structure

```
arbitrum-arbitrage-bot/
├── src/
│   ├── config/
│   │   ├── tokens.js      # Token addresses & DEX configs
│   │   └── abis.js        # Smart contract ABIs
│   ├── services/
│   │   ├── priceFetcher.js      # Fetches real-time prices
│   │   ├── arbitrageScanner.js  # Scans for opportunities
│   │   └── telegramNotifier.js  # Sends alerts
│   └── index.js          # Main bot logic
├── .env                  # Your configuration
├── .env.example         # Example configuration
├── package.json
└── README.md
```

## ⚙️ Configuration

### Adjust Scan Interval

```env
SCAN_INTERVAL=180000  # 3 minutes (default)
# or
SCAN_INTERVAL=60000   # 1 minute
```

### Adjust Profit Threshold

```env
MIN_PROFIT_PERCENTAGE=0.5  # 0.5% minimum (default)
# or
MIN_PROFIT_PERCENTAGE=1.0  # 1% minimum (more selective)
```

## 🔒 Security Notes

- Never commit your `.env` file
- Keep your Telegram bot token private
- Use a dedicated RPC endpoint for production
- Consider rate limits when adjusting scan intervals

## 📈 Performance Tips

1. **Use a private RPC** - Public RPCs may have rate limits
2. **Optimize scan interval** - Balance between frequency and API limits
3. **Filter by profit threshold** - Higher thresholds = fewer false positives
4. **Monitor gas costs** - Real profits = spread - gas fees

## 🐛 Troubleshooting

### Bot not starting?
- Check your RPC URL is correct
- Verify Telegram bot token and chat ID
- Ensure Node.js version is 18+

### No opportunities found?
- Normal - profitable arbitrage is rare
- Lower `MIN_PROFIT_PERCENTAGE` to see more opportunities
- Check that RPC is returning live data

### Telegram not receiving messages?
- Verify bot token and chat ID
- Start a conversation with your bot first
- Check bot permissions

## 📝 License

MIT License - feel free to modify and use for your own trading!

## ⚠️ Disclaimer

This bot is for educational and informational purposes only. Trading cryptocurrencies involves risk. Always do your own research and consider transaction costs, slippage, and gas fees before executing trades.

## 🤝 Contributing

Contributions welcome! Feel free to submit issues and pull requests.

---

**Built with ❤️ for the Arbitrum ecosystem**
