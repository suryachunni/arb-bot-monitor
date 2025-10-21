# Quick Start Guide - WETH Price Monitor

## ✅ Setup Complete!

Your WETH price monitor is fully configured and ready to run.

### Configuration Summary:
- **Network**: Arbitrum Mainnet (Chain ID: 42161)
- **RPC Provider**: Alchemy
- **Telegram Bot**: @Rise2203_bot
- **Monitoring Interval**: Every 3 minutes
- **DEXs Monitored**: Uniswap V3 (3 fee tiers), SushiSwap, Camelot

---

## 🚀 Start the Monitor

### Option 1: Simple Start (Recommended)
```bash
./run_monitor.sh
```

### Option 2: Direct Python
```bash
python3 weth_price_monitor.py
```

### Option 3: Background Process
```bash
nohup python3 -u weth_price_monitor.py > monitor.log 2>&1 &

# View logs
tail -f monitor.log
```

### Option 4: Docker (if you have Docker installed)
```bash
docker-compose up -d

# View logs
docker-compose logs -f
```

---

## 📱 What to Expect

### Telegram Messages
You'll receive alerts every 3 minutes with:
- Current WETH prices from all DEXs
- Price statistics (average, min, max, range)
- Top arbitrage opportunities ranked by spread %
- Real-time timestamps

### Console Output
The monitor will display:
- Connection status
- Price fetching progress
- Arbitrage opportunities
- Telegram delivery confirmations

---

## 🛑 Stop the Monitor

### If running in foreground:
Press `Ctrl+C`

### If running in background:
```bash
pkill -f weth_price_monitor.py
```

### If using Docker:
```bash
docker-compose down
```

---

## 🧪 Test Your Setup

Run the verification script anytime:
```bash
python3 test_setup.py
```

This checks:
- Python dependencies
- Environment configuration
- Arbitrum RPC connection
- Telegram bot connectivity

---

## 📊 Sample Telegram Alert

```
🚨 WETH Price Alert - Arbitrum 🚨
⏰ 2025-10-21 19:15:07
===================================

💰 Current WETH Prices:
  • Uniswap V3 (0.05%): $4,020.86
  • Uniswap V3 (0.3%): $4,000.55
  • Uniswap V3 (1.0%): $3,921.89
  • SushiSwap: $3,775.72

📈 Statistics:
  • Average: $3,929.76
  • Highest: $4,020.86
  • Lowest: $3,775.72
  • Range: $245.14

⚡ Top Arbitrage Opportunities:

1. Buy: SushiSwap ($3,775.72)
   Sell: Uniswap V3 (0.05%) ($4,020.86)
   💎 Spread: 6.090%

2. Buy: SushiSwap ($3,775.72)
   Sell: Uniswap V3 (0.3%) ($4,000.55)
   💎 Spread: 5.628%

===================================
🤖 Auto-monitoring every 3 minutes
```

---

## ⚙️ Customize Settings

Edit `.env` file to change:

```env
# Monitoring interval (in seconds)
INTERVAL_SECONDS=180  # Change to 60 for 1-minute updates

# Your credentials (already configured)
ALCHEMY_RPC_URL=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

After editing, restart the monitor.

---

## 🔥 Tips for Best Results

1. **Arbitrage Spreads**: Remember to account for:
   - Gas fees on Arbitrum (~$0.01-0.05 per swap)
   - Slippage (especially on lower liquidity pairs)
   - Transaction time (prices change fast!)

2. **DEX Liquidity**: 
   - Uniswap V3 typically has the deepest liquidity
   - Camelot may show unusual prices due to low WETH/USDC liquidity
   - Always verify large trades on the DEX directly

3. **Monitoring**:
   - Keep the script running 24/7 for continuous alerts
   - Consider using a VPS or cloud server for reliability
   - Set up systemd service for auto-restart on crashes

4. **Alchemy Rate Limits**:
   - Free tier: 300M compute units/month
   - This script uses minimal CUs (should be well within limits)
   - Monitor usage at: https://dashboard.alchemy.com

---

## 🆘 Troubleshooting

### No Telegram messages?
```bash
# Test Telegram manually
curl -X POST "https://api.telegram.org/bot7990738699:AAFfoPA4VGO_90DyQauHNiwbHnfwOTmfbgU/sendMessage" \
  -d "chat_id=8305086804&text=Manual test"
```

### Connection errors?
```bash
# Verify Alchemy connection
python3 -c "from web3 import Web3; w3 = Web3(Web3.HTTPProvider('https://arb-mainnet.g.alchemy.com/v2/wuLT9bA29g4SF1zeOlgpg')); print('Connected:', w3.is_connected(), 'Block:', w3.eth.block_number)"
```

### Missing dependencies?
```bash
pip install -r requirements.txt
```

---

## 📞 Next Steps

1. **Start the monitor**: `./run_monitor.sh`
2. **Check your Telegram**: You should receive a startup message
3. **Wait 3 minutes**: First price alert will arrive
4. **Monitor arbitrage**: Look for high-spread opportunities
5. **Take action**: When you see good spreads, verify and execute trades!

---

## 🎯 Ready to Start?

```bash
./run_monitor.sh
```

**Happy arbitrage hunting! 🚀💰**
