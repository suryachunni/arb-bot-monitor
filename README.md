# WETH Price Monitor for Arbitrum

A real-time WETH price monitoring system that fetches prices from multiple DEXs on Arbitrum mainnet and sends arbitrage alerts to Telegram every 3 minutes.

## Features

- 🔄 **Real-time monitoring** every 3 minutes
- 🏪 **Multiple DEX support**: Uniswap V3, SushiSwap, Camelot, Arbidex
- 📱 **Telegram alerts** with price details and arbitrage opportunities
- ⚡ **Arbitrage detection** with spread calculations
- 🚀 **High accuracy** using direct on-chain data

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment:**
   The `.env` file is already configured with your credentials:
   - Alchemy API key
   - Telegram bot token
   - Telegram chat ID

3. **Test the system:**
   ```bash
   python test_monitor.py
   ```

4. **Start monitoring:**
   ```bash
   python weth_price_monitor.py
   ```

## How it Works

1. **Price Fetching**: Connects to Arbitrum mainnet via Alchemy and queries WETH/USDC prices from multiple DEXs
2. **Arbitrage Detection**: Compares prices across DEXs to find profitable arbitrage opportunities
3. **Telegram Alerts**: Sends formatted messages with current prices and arbitrage opportunities
4. **Continuous Monitoring**: Runs every 3 minutes automatically

## DEXs Monitored

- **Uniswap V3**: Uses Quoter contract for accurate pricing
- **SushiSwap**: Uses router's getAmountsOut function
- **Camelot**: Uses router's getAmountsOut function  
- **Arbidex**: Uses router's getAmountsOut function

## Telegram Alert Format

```
🚀 WETH Price Alert 🚀
⏰ Time: 2024-01-15 14:30:00 UTC

💰 Current WETH Prices (USDC):
• Uniswap V3: $2,450.1234
• SushiSwap: $2,451.5678
• Camelot: $2,449.9876
• Arbidex: $2,450.5432

🎯 Arbitrage Opportunities:
• SushiSwap → Uniswap V3
  Spread: 0.15% ($3.67)
  Buy: $2,449.9876 → Sell: $2,451.5678
```

## Configuration

The system is pre-configured with your credentials. If you need to modify settings, edit the `.env` file:

- `ALCHEMY_API_KEY`: Your Alchemy API key
- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
- `TELEGRAM_CHAT_ID`: Your Telegram chat ID

## Error Handling

- Automatic retry on network errors
- Graceful handling of DEX failures
- Detailed logging for debugging
- Continues monitoring even if some DEXs fail

## Requirements

- Python 3.8+
- Internet connection
- Valid Alchemy API key
- Valid Telegram bot token and chat ID

## Security Note

Your API keys and tokens are stored in the `.env` file. Keep this file secure and never commit it to version control.