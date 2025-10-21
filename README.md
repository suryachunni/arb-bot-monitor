# Arbitrum WETH Arbitrage Monitor

A real-time WETH price monitoring system for Arbitrum mainnet that identifies arbitrage opportunities across multiple DEXs.

## Features

- **Real-time Price Monitoring**: Fetches live WETH prices from multiple DEXs on Arbitrum
- **Multi-DEX Support**: Uniswap V3, SushiSwap, Curve, Balancer V2, Camelot, and KyberSwap
- **Arbitrage Detection**: Automatically identifies profitable arbitrage opportunities
- **Risk Assessment**: Calculates risk scores for each opportunity
- **Live Dashboard**: Real-time terminal dashboard with color-coded information
- **Gas Cost Calculation**: Includes gas costs in profit calculations

## Supported DEXs

- **Uniswap V3** (0.05%, 0.3%, 1% fee tiers)
- **SushiSwap**
- **Curve Finance**
- **Balancer V2**
- **Camelot**
- **KyberSwap**

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure your Alchemy API key in `.env`:
```env
ALCHEMY_API_KEY=your_alchemy_key_here
ALCHEMY_URL=https://arb-mainnet.g.alchemy.com/v2/your_alchemy_key_here
```

## Usage

### Start Monitoring
```bash
npm start
```

### Run Tests
```bash
npm test
```

### Development Mode (with auto-restart)
```bash
npm run dev
```

## Configuration

The system is configured via the `.env` file and `src/config.js`:

- **Update Interval**: How often to fetch prices (default: 1000ms)
- **Min Spread Threshold**: Minimum spread to consider an arbitrage opportunity (default: 0.5%)
- **Max Price Age**: Maximum age of prices before considering them stale (default: 5000ms)

## Dashboard Features

The real-time dashboard displays:

- **Current Prices**: Live WETH prices from all DEXs
- **Arbitrage Opportunities**: Ranked by profit potential
- **Best Opportunity**: The most profitable arbitrage path
- **Statistics**: Success rate, uptime, and performance metrics
- **Risk Assessment**: Color-coded risk scores for each opportunity

## Arbitrage Calculation

The system calculates:

- **Spread Percentage**: Price difference between DEXs
- **Net Profit**: Profit after gas costs
- **Risk Score**: Based on liquidity, spread, and DEX reliability
- **Gas Costs**: Estimated transaction costs on Arbitrum

## Example Output

```
🔍 Arbitrum WETH Arbitrage Monitor
⏰ 2:30:45 PM | Uptime: 5m 23s

📊 Statistics:
   Updates: 45/45 (100% success)
   Failed: 0
   Fresh prices: ✅

💰 Current WETH Prices:
┌─────────────┬─────────────┬─────────────┬──────┬─────────┐
│ DEX         │ Price (USDC)│ Liquidity   │ Age  │ Status  │
├─────────────┼─────────────┼─────────────┼──────┼─────────┤
│ Uniswap V3  │ $2,150.45   │ 1,250 ETH   │ 1s   │ 🟢 Fresh│
│ SushiSwap   │ $2,149.80   │ 890 ETH     │ 2s   │ 🟢 Fresh│
│ Curve       │ $2,151.20   │ 2,100 ETH   │ 1s   │ 🟢 Fresh│
└─────────────┴─────────────┴─────────────┴──────┴─────────┘

🎯 Arbitrage Opportunities (3):
┌─────────────┬─────────────┬─────────┬──────────┬────────────┬──────┐
│ Buy DEX     │ Sell DEX    │ Spread  │ Profit % │ Net Profit │ Risk │
├─────────────┼─────────────┼─────────┼──────────┼────────────┼──────┤
│ SushiSwap   │ Curve       │ 0.65%   │ 0.65%    │ $13.95     │ 🟢 25│
│ Uniswap V3  │ Curve       │ 0.35%   │ 0.35%    │ $7.50      │ 🟢 15│
└─────────────┴─────────────┴─────────┴──────────┴────────────┴──────┘

🏆 Best Arbitrage Opportunity:
   Buy on: SushiSwap at $2,149.80
   Sell on: Curve at $2,151.20
   Spread: 0.65%
   Net Profit: $13.95 (0.65%)
   Risk Score: 25
```

## API Reference

### PriceFetcher
- `fetchAllWETHPrices()`: Fetches prices from all configured DEXs
- `getCachedPrices()`: Returns cached prices
- `arePricesFresh()`: Checks if cached prices are still valid

### ArbitrageCalculator
- `calculateArbitrageOpportunities(prices)`: Finds arbitrage opportunities
- `getBestOpportunity(opportunities)`: Returns the most profitable opportunity
- `calculateNetProfit(opportunity)`: Calculates profit after gas costs
- `calculateRiskScore(opportunity)`: Assesses risk of an opportunity

## Error Handling

The system includes comprehensive error handling:

- **Network Errors**: Automatic retry with exponential backoff
- **Stale Prices**: Automatic detection and refresh
- **DEX Failures**: Graceful degradation when DEXs are unavailable
- **Rate Limiting**: Built-in rate limiting to avoid API limits

## Performance

- **Update Frequency**: 1 second intervals for real-time monitoring
- **Memory Efficient**: Caches only necessary data
- **Fast Calculations**: Optimized arbitrage calculations
- **Low Latency**: Direct RPC calls for minimal delay

## Security

- **No Private Keys**: Read-only operations only
- **API Key Protection**: Environment variable configuration
- **Input Validation**: All inputs are validated before processing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Check the logs for error messages
- Verify your Alchemy API key is correct
- Ensure you have a stable internet connection
- Check Arbitrum network status

## Disclaimer

This tool is for educational and research purposes. Always verify prices and calculate costs before executing any arbitrage trades. The authors are not responsible for any financial losses.