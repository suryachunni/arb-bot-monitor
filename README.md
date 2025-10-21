# WETH Price Monitor - Arbitrum DEX Scanner

Real-time WETH price monitoring across multiple DEXs on Arbitrum mainnet with Telegram alerts for arbitrage opportunities.

## 🎯 Features

- **Real-time Price Tracking**: Monitors WETH prices every 3 minutes
- **Multiple DEX Support**: 
  - Uniswap V3 (0.05%, 0.3%, 1.0% fee tiers)
  - SushiSwap
  - Camelot
- **Arbitrage Detection**: Automatically calculates price spreads between DEXs
- **Telegram Alerts**: Sends formatted price updates and arbitrage opportunities to your Telegram
- **High Accuracy**: Uses direct on-chain price queries via Alchemy RPC

## 📋 Prerequisites

- Python 3.8 or higher
- Alchemy API key for Arbitrum mainnet
- Telegram Bot Token and Chat ID

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

The `.env` file is already configured with your credentials:
- Alchemy RPC URL
- Telegram Bot Token
- Telegram Chat ID
- Monitoring interval (180 seconds = 3 minutes)

### 3. Run the Monitor

**Option A: Simple Run**
```bash
python3 weth_price_monitor.py
```

**Option B: Using the helper script**
```bash
./run_monitor.sh
```

**Option C: Run in background**
```bash
nohup python3 -u weth_price_monitor.py > monitor.log 2>&1 &
```

## 📊 Sample Output

```
🚀 Starting WETH Price Monitor for Arbitrum
⏱️  Monitoring interval: 180 seconds
✅ Connected to Arbitrum (Chain ID: 42161)

============================================================
🔍 Fetching WETH prices at 2025-10-21 19:15:07
============================================================
📊 Uniswap V3 (0.05%): $4,020.86
📊 Uniswap V3 (0.3%): $4,000.55
📊 Uniswap V3 (1.0%): $3,921.89
📊 SushiSwap: $3,775.72

⚡ Top Arbitrage Spread: 6.09%
   Buy on SushiSwap @ $3,775.72
   Sell on Uniswap V3 (0.05%) @ $4,020.86

✅ Telegram message sent successfully
⏳ Waiting 180 seconds until next check...
```

## 📱 Telegram Message Format

You'll receive messages like:

```
🚨 WETH Price Alert - Arbitrum 🚨
⏰ 2025-10-21 19:15:07
===================================

💰 Current WETH Prices:
  • Uniswap V3 (0.05%): $4,020.86
  • Uniswap V3 (0.3%): $4,000.55
  • SushiSwap: $3,775.72

📈 Statistics:
  • Average: $3,932.38
  • Highest: $4,020.86
  • Lowest: $3,775.72
  • Range: $245.14

⚡ Top Arbitrage Opportunities:

1. Buy: SushiSwap ($3,775.72)
   Sell: Uniswap V3 (0.05%) ($4,020.86)
   💎 Spread: 6.090%

===================================
🤖 Auto-monitoring every 3 minutes
```

## ⚙️ Configuration

Edit `.env` to customize:

```env
ALCHEMY_RPC_URL=your_alchemy_url
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
INTERVAL_SECONDS=180  # Monitoring interval in seconds
```

## 🔧 Advanced Usage

### Run as a System Service (Linux)

1. Create a systemd service file:
```bash
sudo nano /etc/systemd/system/weth-monitor.service
```

2. Add this content:
```ini
[Unit]
Description=WETH Price Monitor for Arbitrum
After=network.target

[Service]
Type=simple
User=your_username
WorkingDirectory=/path/to/workspace
ExecStart=/usr/bin/python3 -u /path/to/workspace/weth_price_monitor.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

3. Enable and start:
```bash
sudo systemctl enable weth-monitor
sudo systemctl start weth-monitor
sudo systemctl status weth-monitor
```

### View Logs
```bash
sudo journalctl -u weth-monitor -f
```

## 📝 Notes

- **Camelot Prices**: May show unusual prices due to low liquidity in certain pairs or routing issues
- **Gas Costs**: Arbitrage spreads shown are gross spreads - always account for gas fees and slippage
- **Rate Limits**: Alchemy free tier has rate limits; monitor your usage
- **Network Issues**: The monitor will automatically retry on connection failures

## 🛠️ Troubleshooting

**Connection Issues:**
```bash
# Test Alchemy connection
python3 -c "from web3 import Web3; w3 = Web3(Web3.HTTPProvider('YOUR_ALCHEMY_URL')); print('Connected:', w3.is_connected())"
```

**Telegram Issues:**
```bash
# Test Telegram bot
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/sendMessage" \
  -d "chat_id=<YOUR_CHAT_ID>&text=Test message"
```

## 📈 Future Enhancements

- [ ] Add more DEXs (Balancer, Curve, TraderJoe)
- [ ] Include WETH/ETH pairs
- [ ] Add price history tracking
- [ ] Implement profit calculation with gas estimates
- [ ] Add database for historical data
- [ ] Web dashboard for monitoring

## ⚠️ Disclaimer

This tool is for informational purposes only. Always verify prices and do your own research before executing any trades. Trading cryptocurrencies carries significant risk.

## 📄 License

MIT License - Feel free to use and modify for your needs.
