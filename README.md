# Arbitrum WETH Price Monitor

A real-time price monitoring system that fetches WETH prices from all major DEXs on Arbitrum mainnet and sends arbitrage alerts to Telegram every 3 minutes.

## Features

- 🔄 **Real-time monitoring** - Fetches prices every 3 minutes
- 🏪 **Multi-DEX support** - Monitors Uniswap V3, SushiSwap, Camelot, and more
- 💰 **Arbitrage detection** - Automatically calculates price spreads and opportunities
- 📱 **Telegram alerts** - Sends detailed price reports and arbitrage opportunities
- ⚡ **Ultra-fast** - Uses direct contract calls for maximum speed and accuracy

## Supported DEXs

- **Uniswap V3** - Multiple fee tiers (0.05%, 0.3%, 1%)
- **SushiSwap** - AMM-based pricing
- **Camelot** - Arbitrum-native DEX
- **Balancer V2** - Weighted pools
- **Curve** - Stablecoin pools

## Price Pairs Monitored

- WETH/USDC
- WETH/USDT  
- WETH/ARB

## Quick Start

### 1. Prerequisites

- Python 3.8 or higher
- pip3 package manager
- Valid Alchemy API key for Arbitrum
- Telegram bot token and chat ID

### 2. Installation

```bash
# Clone or download the project
cd /workspace

# Install dependencies
pip3 install -r requirements.txt
```

### 3. Configuration

The system is already configured with your credentials in `.env`:

```env
ALCHEMY_API_KEY=wuLT9bA29g4SF1zeOlgpg
TELEGRAM_BOT_TOKEN=7990738699:AAFfoPA4VGO_90DyQauHNiwbHnfwOTmfbgU
TELEGRAM_CHAT_ID=8305086804
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/wuLT9bA29g4SF1zeOlgpg
```

### 4. Test the Setup

```bash
# Test all connections and functionality
python3 test_connection.py
```

### 5. Start Monitoring

```bash
# Option 1: Use the startup script (recommended)
./run_monitor.sh

# Option 2: Run directly
python3 arbitrum_price_monitor.py
```

## How It Works

### Price Fetching
1. **Direct Contract Calls** - Uses Web3.py to call DEX contracts directly
2. **Multiple DEXs** - Fetches prices from all major Arbitrum DEXs simultaneously
3. **Real-time Data** - Gets the most current prices from on-chain sources

### Arbitrage Detection
1. **Price Comparison** - Compares WETH prices across all DEXs
2. **Spread Calculation** - Calculates percentage spreads between DEXs
3. **Opportunity Ranking** - Ranks opportunities by potential profit

### Telegram Alerts
- **Current Prices** - Shows WETH prices from all DEXs
- **Arbitrage Opportunities** - Highlights profitable spreads
- **Detailed Information** - Includes buy/sell DEXs, prices, and profit calculations

## Sample Alert Format

```
🚀 Arbitrum WETH Price Alert 🚀
⏰ Time: 2024-01-15 14:30:00 UTC

💰 Current WETH Prices:

📊 WETH/USDC
  • Uniswap V3: $2000.50
  • SushiSwap: $2001.25
  • Camelot: $2000.75

🎯 Arbitrage Opportunities:

💡 WETH/USDC
  • Buy on: Uniswap V3 ($2000.50)
  • Sell on: SushiSwap ($2001.25)
  • Spread: 0.037%
  • Profit per WETH: $0.75

🔗 Network: Arbitrum Mainnet
```

## Configuration Options

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ALCHEMY_API_KEY` | Your Alchemy API key for Arbitrum | Yes |
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token | Yes |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID | Yes |
| `ARBITRUM_RPC_URL` | Arbitrum RPC endpoint | Yes |

### Customization

You can modify the following in `arbitrum_price_monitor.py`:

- **Monitoring interval** - Change `await asyncio.sleep(180)` to adjust frequency
- **Minimum spread threshold** - Modify `spread_percentage > 0.1` to change sensitivity
- **Price pairs** - Add/remove pairs in the `pairs` list
- **DEXs** - Add/remove DEXs in the `dexs` dictionary

## Troubleshooting

### Common Issues

1. **"No prices fetched"**
   - Check your Alchemy API key
   - Verify Arbitrum network connectivity
   - Ensure DEX contracts are accessible

2. **"Telegram error"**
   - Verify bot token and chat ID
   - Check if bot is added to your chat
   - Ensure bot has permission to send messages

3. **"Web3 connection failed"**
   - Check your RPC URL
   - Verify Alchemy API key is valid
   - Check network connectivity

### Logs

The system creates detailed logs in `price_monitor.log`:

```bash
# View logs in real-time
tail -f price_monitor.log

# View recent logs
tail -n 100 price_monitor.log
```

## Performance

- **Speed** - Fetches prices in under 10 seconds
- **Accuracy** - Direct on-chain data, no API delays
- **Reliability** - Automatic retry and error handling
- **Efficiency** - Minimal resource usage

## Security

- **No private keys** - Only reads public blockchain data
- **Read-only access** - Cannot execute transactions
- **Secure storage** - Credentials stored in environment variables

## Support

For issues or questions:
1. Check the logs in `price_monitor.log`
2. Run `python3 test_connection.py` to diagnose issues
3. Verify all environment variables are set correctly

## License

This project is for educational and personal use. Please ensure compliance with all applicable terms of service for the DEXs and services used.