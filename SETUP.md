# 🚀 Setup Guide - Flash Loan Arbitrage Bot

Complete step-by-step guide to get your bot running in production.

## 📋 Prerequisites Checklist

- [ ] Node.js v18 or higher installed
- [ ] Git installed
- [ ] Arbitrum wallet with private key
- [ ] At least 0.05 ETH on Arbitrum for gas fees
- [ ] Telegram account
- [ ] Alchemy API key (already provided)

## 🔧 Step 1: Environment Setup

### 1.1 Install Dependencies

```bash
npm install
```

This installs all required packages including:
- ethers.js for blockchain interaction
- Telegram bot API
- TypeScript and build tools
- Hardhat for smart contract deployment

### 1.2 Configure Environment Variables

Your `.env` file is already partially configured. You only need to add your **PRIVATE_KEY**:

```env
PRIVATE_KEY=your_wallet_private_key_here
```

**How to get your private key:**
- **MetaMask**: Settings → Security & Privacy → Reveal Private Key
- **Keep it secret!** Never share or commit to GitHub

**Pre-configured values:**
```
✅ Telegram Bot Token: Already set
✅ Telegram Chat ID: Already set  
✅ Alchemy RPC URL: Already set
```

## 🏗️ Step 2: Deploy Smart Contract

### 2.1 Compile Contract

```bash
npm run compile
```

Expected output:
```
Compiled 1 Solidity file successfully
```

### 2.2 Deploy to Arbitrum

```bash
npm run deploy
```

**What happens:**
1. Deploys `FlashLoanArbitrage.sol` to Arbitrum mainnet
2. Automatically updates `.env` with contract address
3. Saves deployment info to `deployment.json`

**Expected output:**
```
🚀 Deploying Flash Loan Arbitrage Contract to Arbitrum...
📍 Deploying with account: 0x...
✅ Contract deployed to: 0x...
✅ Updated .env file with contract address
```

**Cost:** ~0.01-0.02 ETH in gas fees

### 2.3 Verify Deployment

Check that your `.env` now has:
```env
ARBITRAGE_CONTRACT_ADDRESS=0x...
```

## 🎯 Step 3: Configure Bot Settings

### 3.1 Review Configuration

Open `.env` and review these settings:

```env
# Minimum profit to execute (in USD)
MIN_PROFIT_USD=100

# Flash loan amount (in USD)  
MIN_LOAN_AMOUNT_USD=50000

# Maximum gas price willing to pay (in gwei)
MAX_GAS_PRICE_GWEI=0.5

# Scan interval (milliseconds)
SCAN_INTERVAL_MS=10000
```

### 3.2 Recommended Settings

**Conservative (Beginner):**
```env
MIN_PROFIT_USD=200
MIN_LOAN_AMOUNT_USD=30000
MAX_GAS_PRICE_GWEI=0.3
```

**Aggressive (Advanced):**
```env
MIN_PROFIT_USD=50
MIN_LOAN_AMOUNT_USD=100000
MAX_GAS_PRICE_GWEI=1.0
```

## 🤖 Step 4: Setup Telegram Bot

### 4.1 Start Telegram Bot

Your bot token is already configured. Just open Telegram and:

1. Search for your bot (use the token to find the bot name)
2. Send `/start` to initialize
3. You should receive a welcome message

### 4.2 Test Telegram Connection

The bot will send you:
- ✅ "Flash Loan Arbitrage Bot Started!"
- ✅ Status updates
- ✅ Arbitrage alerts

**Commands:**
- `/start` - Initialize bot
- `/status` - Check bot status
- `/balance` - View wallet balance
- `/help` - Show help

## 🚀 Step 5: Start the Bot

### 5.1 Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

### 5.2 Start the Bot

```bash
npm start
```

**Expected output:**
```
═══════════════════════════════════════════════════════
   FLASH LOAN ARBITRAGE BOT - ARBITRUM MAINNET
═══════════════════════════════════════════════════════

🚀 Initializing Flash Loan Arbitrage Bot...
✅ Bot initialized successfully
📍 Wallet: 0x...
💰 Min Profit: $100
💵 Loan Amount: $50,000
🎬 Starting arbitrage bot...
💰 Wallet Balance: 0.05 ETH
🔍 Starting scan...
```

### 5.3 Monitor Telegram

You should start receiving updates in Telegram:
- Scan status updates
- Opportunity alerts
- Execution notifications

## ✅ Step 6: Verify Everything is Working

### 6.1 Check Logs

Logs are saved in `logs/` directory:
```bash
tail -f logs/combined.log
```

### 6.2 Monitor Telegram

You should see:
- ✅ "Bot Started" message
- ✅ Regular scan updates every 10 seconds
- ✅ Opportunity alerts when found

### 6.3 Test Trade (Optional)

Wait for an opportunity alert. The bot will:
1. Send detailed opportunity info
2. Auto-execute the trade (if `autoExecute: true`)
3. Send result notification

## 🔧 Common Issues

### Issue: "Configuration validation failed"
**Solution:** Make sure `PRIVATE_KEY` is set in `.env`

### Issue: "Contract address not set"
**Solution:** Run `npm run deploy` first

### Issue: "Insufficient funds"
**Solution:** Add more ETH to your wallet

### Issue: "Failed to send Telegram message"
**Solution:** Check `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`

### Issue: No opportunities found
**Solution:** This is normal! Arbitrage opportunities are rare. The bot will alert you when found.

## 🎛️ Advanced Configuration

### Enable/Disable DEXs

In `.env`:
```env
ENABLE_UNISWAP_V3=true
ENABLE_SUSHISWAP=true  
ENABLE_CAMELOT=true
ENABLE_BALANCER=false
ENABLE_CURVE=false
```

### Adjust Scan Interval

Faster scanning (more aggressive):
```env
SCAN_INTERVAL_MS=5000  # Scan every 5 seconds
```

Slower scanning (less RPC usage):
```env
SCAN_INTERVAL_MS=30000  # Scan every 30 seconds
```

### MEV Protection

Use private RPC to avoid front-running:
```env
USE_PRIVATE_RPC=true
FLASHBOTS_RPC=https://rpc.flashbots.net
```

## 📊 Production Checklist

Before running in production:

- [ ] Private key is secure and backed up
- [ ] Wallet has sufficient ETH (>0.05)
- [ ] Contract is deployed and verified
- [ ] Telegram bot is responding
- [ ] Configuration is reviewed and optimized
- [ ] Logs directory exists and is writable
- [ ] Tested with small loan amounts first
- [ ] Monitoring is set up (Telegram + logs)

## 🔄 Daily Operations

### Morning
1. Check Telegram for overnight alerts
2. Review logs for any errors
3. Check wallet balance
4. Verify bot is running

### Throughout the Day
1. Monitor Telegram for opportunities
2. Review executed trades
3. Adjust settings if needed

### Evening
1. Review daily performance
2. Check logs for patterns
3. Optimize configuration based on results

## 🎯 Next Steps

1. **Start Small:** Begin with conservative settings
2. **Monitor Closely:** Watch first few trades carefully
3. **Optimize:** Adjust settings based on results
4. **Scale Up:** Increase loan amounts as confidence grows

## 🆘 Support & Resources

- **Logs:** Check `logs/combined.log` for detailed info
- **Telegram:** Use bot commands for real-time status
- **Arbitrum Explorer:** https://arbiscan.io
- **Gas Tracker:** https://arbiscan.io/gastracker

## ⚡ Quick Command Reference

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile

# Deploy contract
npm run deploy

# Build bot
npm run build

# Start bot
npm start

# Development mode
npm run dev

# View logs
tail -f logs/combined.log
```

## 🎉 You're Ready!

Your flash loan arbitrage bot is now configured and ready to make automated profits on Arbitrum! 

The bot will:
- ✅ Scan for opportunities automatically
- ✅ Alert you via Telegram
- ✅ Execute profitable trades
- ✅ Send profits to your wallet

**Remember:**
- Start conservative
- Monitor closely
- Adjust as needed
- Only risk what you can afford to lose

**Good luck and happy arbitraging! 🚀💰**
