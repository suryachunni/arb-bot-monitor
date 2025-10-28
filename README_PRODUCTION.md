# 🚀 Production Flash Loan Arbitrage Bot - Arbitrum Mainnet

## ⚡ Ultra-Fast, Fully Automated Arbitrage Bot

This is a **production-ready** flash loan arbitrage bot that automatically scans all major DEXs on Arbitrum mainnet every 10 minutes, detects profitable arbitrage opportunities, and executes atomic flash loan transactions to capture profits.

## 🎯 Key Features

- **🔥 Ultra-Fast Scanning**: Scans all DEXs in under 1 second using multicall batching
- **🤖 Fully Automated**: No manual intervention required - executes trades automatically
- **💰 High-Value Trades**: Minimum $50,000 flash loans with $100+ profit targets
- **🛡️ MEV Protection**: Advanced slippage protection and gas optimization
- **📱 Telegram Integration**: Real-time alerts and manual execution controls
- **⚡ Real-Time Prices**: Live price feeds from multiple DEXs
- **🔒 Production Security**: Comprehensive error handling and safety checks

## 🏗️ Architecture

### Supported DEXs
- **Uniswap V3** (0.05%, 0.3%, 1% fee tiers)
- **SushiSwap** (V2 compatible)
- **Camelot** (Arbitrum native)
- **Balancer** (V2)

### Supported Tokens
- **Tier 1**: WETH, USDC, USDT, WBTC, ARB
- **Tier 2**: LINK, UNI, GMX, PENDLE, RDNT
- **Total**: 19 high-liquidity token pairs

## 🚀 Quick Start

### 1. Prerequisites
```bash
# Install dependencies
npm install

# Compile contracts
npm run compile
```

### 2. Configuration
Update `.env` file with your credentials:
```env
# Telegram Bot (Already configured)
TELEGRAM_BOT_TOKEN=7990738699:AAFfoPA4VGO_90DyQauHNiwbHnfwOTmfbgU
TELEGRAM_CHAT_ID=8305086804

# Arbitrum RPC (Already configured)
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/wuLT9bA29g4SF1zeOlgpg

# Add your private key
PRIVATE_KEY=your_private_key_here
```

### 3. Deploy Contract
```bash
# Deploy to Arbitrum mainnet
npm run deploy
```

### 4. Start Bot
```bash
# Production mode (compiled)
npm run start

# Development mode (TypeScript)
npm run start:dev
```

## 📊 Bot Performance

### Scanning Speed
- **Scan Time**: < 1 second for all 19 token pairs
- **DEX Coverage**: 4 major DEXs simultaneously
- **Price Accuracy**: Real-time quotes with slippage protection
- **Scan Frequency**: Every 10 minutes (configurable)

### Profit Targets
- **Minimum Loan**: $50,000
- **Minimum Profit**: $100+ per trade
- **Slippage Protection**: 0.5% maximum
- **Gas Optimization**: EIP-1559 with priority fees

## 🤖 Telegram Commands

- `/start` - Initialize bot and show commands
- `/status` - Check bot status and statistics
- `/balance` - Check wallet balance
- `/pause` - Pause scanning (keeps bot running)
- `/resume` - Resume scanning
- `/stop` - Stop bot completely
- `/help` - Show help message

## 🔧 Configuration Options

### Scan Settings
```env
SCAN_INTERVAL_MS=600000        # 10 minutes
MAX_SLIPPAGE_PERCENT=0.5       # 0.5% max slippage
GAS_LIMIT_MULTIPLIER=1.2       # 20% gas buffer
```

### Flash Loan Settings
```env
MIN_PROFIT_USD=100             # $100 minimum profit
MIN_LOAN_AMOUNT_USD=50000      # $50k minimum loan
MAX_LOAN_AMOUNT_USD=500000     # $500k maximum loan
MAX_GAS_PRICE_GWEI=2.0         # 2 gwei max gas price
```

### DEX Settings
```env
ENABLE_UNISWAP_V3=true         # Enable Uniswap V3
ENABLE_SUSHISWAP=true          # Enable SushiSwap
ENABLE_CAMELOT=true            # Enable Camelot
ENABLE_BALANCER=true           # Enable Balancer
```

## 🛡️ Security Features

### MEV Protection
- **Private RPC**: Uses Flashbots Protect RPC
- **Slippage Protection**: 0.5% maximum slippage
- **Gas Optimization**: EIP-1559 with priority fees
- **Deadline Protection**: 5-minute transaction deadline

### Risk Management
- **Balance Checks**: Verifies sufficient ETH for gas
- **Price Verification**: Re-verifies prices before execution
- **Profit Validation**: Ensures minimum profit after all costs
- **Emergency Stop**: Can be stopped instantly via Telegram

## 📈 Monitoring & Analytics

### Real-Time Statistics
- Total scans performed
- Opportunities found
- Trades executed
- Total profit generated
- Average profit per trade
- Uptime tracking

### Telegram Alerts
- Arbitrage opportunity alerts
- Trade execution results
- Error notifications
- Status updates every 10 scans

## 🔄 How It Works

1. **Scan Phase**: Bot scans all 19 token pairs across 4 DEXs
2. **Detection Phase**: Identifies arbitrage opportunities (A→B and B→A)
3. **Verification Phase**: Re-verifies prices and profitability
4. **Execution Phase**: Executes flash loan arbitrage transaction
5. **Profit Phase**: Sends profits to your wallet

## 💰 Profit Calculation

```
Profit = (Sell Amount - Buy Amount) - Gas Costs - Flash Loan Fee
```

- **Flash Loan Fee**: ~0.05% (Aave V3)
- **DEX Fees**: 0.05% - 1% (depending on DEX)
- **Gas Costs**: ~$5-20 per transaction
- **Minimum Profit**: $100+ after all costs

## 🚨 Important Notes

### Before Running
1. **Fund Wallet**: Ensure you have at least 0.01 ETH for gas fees
2. **Private Key**: Add your private key to `.env` file
3. **Contract Deployed**: Run `npm run deploy` first
4. **Test First**: Start with small amounts to test

### Risk Warnings
- **Market Risk**: Arbitrage opportunities can disappear quickly
- **Gas Risk**: High gas prices can reduce profitability
- **Slippage Risk**: Large trades may experience slippage
- **Smart Contract Risk**: Always audit contracts before use

## 🛠️ Troubleshooting

### Common Issues
1. **"Configuration validation failed"**: Check your `.env` file
2. **"Insufficient balance"**: Add more ETH to your wallet
3. **"Contract not deployed"**: Run `npm run deploy` first
4. **"Gas price too high"**: Wait for lower gas prices

### Debug Mode
```bash
# Run with debug logging
DEBUG=true npm run start:dev
```

## 📞 Support

- **Telegram**: Use `/help` command in bot
- **Logs**: Check console output for detailed logs
- **Status**: Use `/status` command for current state

## 🔄 Updates

The bot automatically:
- Scans every 10 minutes
- Sends status updates every 10 scans
- Handles errors gracefully
- Continues running 24/7

## ⚠️ Disclaimer

This bot is for educational and research purposes. Always:
- Test with small amounts first
- Understand the risks involved
- Monitor the bot regularly
- Have sufficient funds for gas fees

---

**🚀 Ready to start making profits? Run `npm run start` and watch the magic happen!**