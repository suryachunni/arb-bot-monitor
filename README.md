# ⚡ ULTRA-FAST Flash Loan Arbitrage Bot v2.0 - Arbitrum

A **production-grade**, **lightning-fast**, **fully automated** flash loan arbitrage bot for Arbitrum mainnet. This bot uses event-driven architecture with Multicall3 to scan DEXs in real-time (every 0.25s), detects profitable arbitrage opportunities with accurate profit calculation, and executes trades in under 1 second using Aave V3 flash loans.

## 🚀 VERSION 2.0 - ULTRA-FAST UPGRADES

- ⚡ **40x faster** scanning (0.25s vs 10s intervals)
- 📊 **Multicall3** - All prices in ONE RPC call
- 🔔 **Event-driven** - Reacts to every block instantly
- 💰 **Accurate profits** - Shows NET profit after ALL costs
- 🎯 **Focused** - Only ultra-liquid pairs (Uniswap V3 + SushiSwap)
- ⚡ **Sub-second execution** - From detection to transaction in < 1s

## 🌟 Features

### Core Features
- ✅ **Real-time Price Scanning** - Ultra-fast price monitoring across all major Arbitrum DEXs
- ✅ **Automated Execution** - Fully automated trade execution with zero manual intervention
- ✅ **Flash Loan Integration** - Uses Aave V3 for capital-efficient arbitrage
- ✅ **Bi-directional Scanning** - Scans both A→B and B→A arbitrage routes
- ✅ **Telegram Alerts** - Real-time notifications with detailed trade information
- ✅ **MEV Protection** - Gas optimization and private RPC support
- ✅ **Multi-DEX Support** - Uniswap V3, SushiSwap, Camelot, and more

### Advanced Features
- 🚀 **Millisecond-level Execution** - Optimized for speed to catch fleeting opportunities
- 💰 **Profit Maximization** - Automatic loan amount optimization
- 🛡️ **Risk Management** - Slippage protection, gas price limits, profit thresholds
- 🔒 **Security** - Non-custodial, you control your private keys
- 📊 **Smart Contract** - Gas-optimized Solidity contract with emergency controls
- ⚡ **EIP-1559 Support** - Dynamic gas pricing for optimal transaction speed

## 📋 Supported DEXs

- **Uniswap V3** (All fee tiers: 0.01%, 0.05%, 0.3%, 1%)
- **SushiSwap**
- **Camelot**
- **Balancer** (coming soon)
- **Curve** (coming soon)

## 💎 Supported Tokens

High-liquidity tokens on Arbitrum:
- WETH, USDC, USDT, ARB, WBTC, DAI
- LINK, UNI, FRAX, GMX, GNS, MAGIC

## 🚀 Quick Start (3 Steps!)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Add Your Private Key
Edit `.env` and add your wallet private key:
```env
PRIVATE_KEY=your_private_key_here
```

✅ Everything else is pre-configured (Telegram, RPC, etc.)

### Step 3: Deploy & Run
```bash
# Compile and deploy contract
npm run compile
npm run deploy

# Start the ULTRA-FAST bot
npm run build
npm start
```

## ✅ You're Live!

Your bot is now:
- ⚡ Scanning every 0.25 seconds
- 🎯 Detecting arbitrage automatically  
- 💰 Executing profitable trades
- 📱 Sending Telegram alerts

**See START_HERE.md for detailed walkthrough!**

## 🎯 How It Works

### 1. Price Scanning
The bot continuously scans token pairs across multiple DEXs every 10 seconds (configurable). It fetches real-time prices using:
- Uniswap V3 Quoter for precise quotes
- Direct router calls for V2-style DEXs
- Parallel fetching for maximum speed

### 2. Arbitrage Detection
For each token pair, the bot:
- Compares prices across all DEX combinations
- Checks both directions (A→B and B→A)
- Calculates profit after fees and gas
- Filters by minimum profit threshold

### 3. Automatic Execution
When a profitable opportunity is found:
1. **Alert** - Sends detailed alert to Telegram
2. **Verification** - Re-checks prices for accuracy
3. **Gas Check** - Ensures gas price is acceptable
4. **Execution** - Executes flash loan + arbitrage in one atomic transaction
5. **Result** - Sends success/failure notification with details

### 4. Transaction Flow
```
1. Borrow X tokens via Aave flash loan
2. Swap X tokens for Y tokens on DEX A
3. Swap Y tokens back to X tokens on DEX B
4. Repay flash loan + premium
5. Keep the profit
```

## ⚙️ Configuration

### Flash Loan Settings

```env
MIN_PROFIT_USD=100              # Minimum profit to execute trade
MIN_LOAN_AMOUNT_USD=50000       # Flash loan amount ($50k default)
MAX_LOAN_AMOUNT_USD=500000      # Maximum loan amount
MAX_GAS_PRICE_GWEI=0.5          # Maximum acceptable gas price
```

### Monitoring Settings

```env
SCAN_INTERVAL_MS=10000          # Scan every 10 seconds
MAX_SLIPPAGE_PERCENT=0.5        # Maximum slippage tolerance
GAS_LIMIT_MULTIPLIER=1.2        # Gas limit safety multiplier
```

### DEX Configuration

```env
ENABLE_UNISWAP_V3=true
ENABLE_SUSHISWAP=true
ENABLE_CAMELOT=true
ENABLE_BALANCER=true
ENABLE_CURVE=true
```

## 📱 Telegram Commands

Once the bot is running, use these commands:

- `/start` - Initialize bot and show welcome message
- `/status` - Check bot status and configuration
- `/balance` - View wallet balance
- `/help` - Show help information

## 🔐 Security Best Practices

1. **Private Keys**
   - Never share your private key
   - Never commit `.env` to version control
   - Use a dedicated wallet for the bot

2. **Test First**
   - Start with smaller loan amounts
   - Monitor initial trades closely
   - Gradually increase as you gain confidence

3. **Gas Management**
   - Keep ETH in wallet for gas fees
   - Set reasonable gas price limits
   - Monitor Arbitrum gas prices

4. **Risk Management**
   - Set conservative profit thresholds
   - Use slippage protection
   - Don't risk more than you can afford to lose

## 📊 Smart Contract Features

The `FlashLoanArbitrage.sol` contract includes:

- ✅ Aave V3 flash loan integration
- ✅ Multi-DEX swap support
- ✅ Gas optimizations (200k runs, viaIR)
- ✅ Reentrancy protection
- ✅ Owner-only execution
- ✅ Emergency withdraw functions
- ✅ Configurable profit thresholds

## 🛠️ Development

### Build
```bash
npm run build
```

### Run in Development
```bash
npm run dev
```

### Compile Contracts
```bash
npm run compile
```

### Deploy to Arbitrum
```bash
npm run deploy
```

## 📈 Performance Tips

1. **RPC Provider**
   - Use Alchemy or Infura for best reliability
   - Consider multiple RPC endpoints for redundancy

2. **Gas Optimization**
   - The contract is heavily optimized
   - Uses EIP-1559 for dynamic pricing
   - Adds 10% priority fee for faster inclusion

3. **Scan Interval**
   - 10 seconds is recommended for balance of speed vs. rate limits
   - Can be reduced to 5s for more aggressive scanning
   - Monitor RPC rate limits

4. **Token Selection**
   - Focus on high-liquidity pairs
   - Avoid exotic tokens with low volume
   - Prefer stablecoin pairs for consistent opportunities

## 🐛 Troubleshooting

### "Gas estimation failed"
- Price moved since detection
- Insufficient liquidity
- Gas price too low

**Solution:** Increase `GAS_LIMIT_MULTIPLIER` or `MAX_GAS_PRICE_GWEI`

### "Transaction reverted"
- Slippage exceeded
- Profit below minimum
- Front-run by MEV bot

**Solution:** Increase `MAX_SLIPPAGE_PERCENT` or use private RPC

### "Low ETH balance"
- Insufficient gas fees

**Solution:** Add more ETH to your wallet

### No opportunities found
- Market conditions not favorable
- Profit thresholds too high
- DEXs not configured

**Solution:** Lower `MIN_PROFIT_USD` or enable more DEXs

## 📝 Logs

Logs are stored in the `logs/` directory:
- `combined.log` - All logs
- `error.log` - Error logs only

## ⚠️ Disclaimer

This software is provided "as is" without warranty of any kind. Cryptocurrency trading carries substantial risk. You may lose some or all of your capital. Only invest what you can afford to lose.

- Not financial advice
- Use at your own risk
- Test thoroughly before production use
- No guarantees of profit
- Smart contract risks apply

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section
2. Review logs in `logs/` directory
3. Verify configuration in `.env`
4. Check Telegram bot is responding

## 🎉 Success!

If everything is working, you should see:
- ✅ Bot scanning every 10 seconds
- ✅ Telegram receiving status updates
- ✅ Opportunities detected and evaluated
- ✅ Profitable trades executed automatically

**Happy arbitraging! 🚀💰**
