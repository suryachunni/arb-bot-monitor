# WETH Price Monitor for Arbitrum Mainnet

A real-time WETH price monitoring system that tracks prices across multiple DEXs on Arbitrum mainnet and sends alerts via Telegram every 3 minutes.

## Features

- 🔴 **Real-time Price Monitoring**: Fetches WETH prices from major DEXs on Arbitrum
- 📊 **Multi-DEX Support**: Uniswap V3, SushiSwap, Camelot, KyberSwap
- 🚀 **Arbitrage Detection**: Automatically detects arbitrage opportunities
- 📱 **Telegram Alerts**: Sends price updates and arbitrage alerts to Telegram
- ⚡ **Ultra-Fast**: Updates every 3 minutes with immediate alerts
- 🎯 **Accurate**: Direct on-chain price fetching for maximum accuracy

## Supported DEXs

- **Uniswap V3** - Multiple fee tiers (0.05%, 0.3%, 1%)
- **SushiSwap** - AMM-based pricing
- **Camelot** - Arbitrum-native DEX
- **KyberSwap** - Multi-protocol aggregator

## Setup

### 1. Install Dependencies

```bash
python setup.py
```

### 2. Configure Environment

Your `.env` file should contain:

```env
ALCHEMY_URL=https://arb-mainnet.g.alchemy.com/v2/your_key
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

### 3. Run the Monitor

```bash
python weth_monitor.py
```

## Configuration

Edit `config.py` to customize:

- **Monitoring Interval**: Default 3 minutes (180 seconds)
- **Arbitrage Threshold**: Minimum 0.5% difference to trigger alerts
- **DEX Addresses**: Add or modify DEX configurations
- **Token Addresses**: WETH and USDC addresses on Arbitrum

## Telegram Alerts

The bot sends two types of alerts:

### 1. Price Updates (Every 3 minutes)
- Current WETH prices from all DEXs
- Average price across all DEXs
- Price range (min-max)
- Top arbitrage opportunities

### 2. Arbitrage Alerts (Immediate)
- High-profit opportunities (>0.5% difference)
- Buy/sell recommendations
- Profit percentage
- Real-time notifications

## Example Alert

```
🔴 WETH Price Alert 🔴

📊 Current WETH Prices on Arbitrum:

• Uniswap V3: $2,450.32
• SushiSwap: $2,448.91
• Camelot: $2,451.15
• KyberSwap: $2,449.78

📈 Average Price: $2,450.04
📊 Price Range: $2,448.91 - $2,451.15

🚀 Arbitrage Opportunities:

1. Camelot ↔ SushiSwap
   • Buy from: SushiSwap ($2,448.91)
   • Sell to: Camelot ($2,451.15)
   • Profit: 0.09%

⏰ Last Updated: 2024-01-15 14:30:25 UTC
```

## Logging

The system logs all activities to:
- Console output
- `weth_monitor.log` file

## Error Handling

- Automatic retry on network errors
- Telegram error notifications
- Graceful shutdown on interruption
- Comprehensive error logging

## Requirements

- Python 3.8+
- Web3.py for blockchain interaction
- python-telegram-bot for Telegram integration
- aiohttp for async HTTP requests

## Security

- Environment variables for sensitive data
- No hardcoded credentials
- Secure Web3 connections
- Error message sanitization

## Troubleshooting

### Common Issues

1. **Telegram Connection Failed**
   - Check bot token and chat ID
   - Ensure bot is started with `/start`

2. **No Prices Retrieved**
   - Verify Alchemy URL is correct
   - Check network connectivity
   - Ensure sufficient RPC rate limits

3. **Arbitrage Alerts Not Working**
   - Check minimum threshold in config
   - Verify DEX addresses are correct
   - Monitor logs for errors

### Logs

Check `weth_monitor.log` for detailed error information and debugging.

## License

MIT License - Feel free to modify and distribute.

## Support

For issues or questions, check the logs and ensure all environment variables are correctly set.