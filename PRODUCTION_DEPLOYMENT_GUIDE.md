# 🚀 PRODUCTION DEPLOYMENT GUIDE
## Flash Loan Arbitrage Bot - Arbitrum Mainnet

> **Enterprise-Grade Setup for Real Trading**

---

## 📋 TABLE OF CONTENTS

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Configuration](#configuration)
4. [Contract Deployment](#contract-deployment)
5. [Bot Deployment](#bot-deployment)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)
8. [Security Best Practices](#security-best-practices)

---

## ⚙️ PREREQUISITES

### Required Software
```bash
Node.js >= 18.0.0
npm >= 9.0.0
Git
PM2 (for production)
```

### Required Accounts & Keys
- ✅ Ethereum wallet with private key
- ✅ Alchemy API key (Arbitrum endpoint)
- ✅ Telegram Bot Token
- ✅ Telegram Chat ID
- ✅ Minimum 0.1 ETH on Arbitrum (for gas fees)

### Recommended Infrastructure
- **VPS**: 2+ CPU cores, 4GB+ RAM
- **OS**: Ubuntu 22.04 LTS or similar
- **Network**: Low latency to Arbitrum nodes (<50ms)
- **Uptime**: 99.9%+ availability

---

## 📦 INITIAL SETUP

### Step 1: Clone & Install

```bash
# Clone the repository
git clone <your-repo-url>
cd flash-loan-arbitrage-bot

# Install dependencies
npm install

# Install PM2 globally (for production)
npm install -g pm2
```

### Step 2: Create Logs Directory

```bash
mkdir -p logs
```

---

## 🔧 CONFIGURATION

### Step 1: Configure Environment

The bot is already pre-configured with your credentials in `.env.production`:

```bash
# Review the configuration
cat .env.production
```

**CRITICAL:** Update your private key:
```bash
# Open .env.production
nano .env.production

# Replace this line:
PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE

# With your actual private key (WITHOUT 0x prefix):
PRIVATE_KEY=abc123def456...
```

### Step 2: Verify Configuration

Key settings to review:

| Setting | Default | Description |
|---------|---------|-------------|
| `MIN_LOAN_AMOUNT_USD` | 50000 | Minimum flash loan size |
| `MIN_PROFIT_USD` | 100 | Minimum profit to execute |
| `MIN_PROFIT_PERCENTAGE` | 0.5 | Minimum profit % |
| `SCAN_INTERVAL_MS` | 600000 | 10 minutes between scans |
| `AUTO_EXECUTE` | true | Auto-execute profitable trades |
| `ENABLE_MEV_PROTECTION` | true | MEV protection enabled |

**To adjust loan size range:**
```bash
MIN_LOAN_AMOUNT_USD=1000      # $1k minimum
MAX_LOAN_AMOUNT_USD=2000000   # $2M maximum
```

---

## 🔨 CONTRACT DEPLOYMENT

### Step 1: Compile Contracts

```bash
npm run compile
```

Expected output:
```
Compiled 1 Solidity file successfully
```

### Step 2: Deploy to Arbitrum Mainnet

```bash
npm run deploy
```

This will:
1. Deploy FlashLoanArbitrageV2 contract
2. Verify configuration
3. Update `.env.production` with contract address
4. Save deployment info to `deployments/arbitrum-mainnet.json`

**Example Output:**
```
✅ Contract deployed at: 0x1234...5678
✅ Transaction: 0xabcd...efgh
✅ 5 confirmations received
```

### Step 3: Verify Contract (Optional but Recommended)

Get an Arbiscan API key from: https://arbiscan.io/myapikey

```bash
# Set API key in .env.production
ARBISCAN_API_KEY=your_api_key_here

# Verify contract
npm run verify <CONTRACT_ADDRESS> "<YOUR_WALLET_ADDRESS>"
```

### Step 4: Fund Your Wallet

Transfer ETH to your wallet for gas fees:

**Recommended amounts:**
- Testing: 0.05 ETH
- Light usage: 0.1 ETH
- Heavy usage: 0.5+ ETH

Check your wallet:
```bash
# Your wallet address is in deployment output
# Send ETH to: 0xYourWalletAddress
```

---

## 🚀 BOT DEPLOYMENT

### Option A: Development Mode (Testing)

```bash
# Build the bot
npm run build

# Start in development mode
npm run dev
```

Use this for:
- Testing configuration
- Verifying Telegram alerts
- Checking opportunity detection

### Option B: Production Mode (24/7 Trading)

```bash
# Build the bot
npm run build

# Start with PM2 (auto-restart, monitoring)
npm run pm2:start
```

### PM2 Management Commands

```bash
# Check status
npm run pm2:status

# View logs (real-time)
npm run pm2:logs

# Restart bot
npm run pm2:restart

# Stop bot
npm run pm2:stop
```

---

## 📊 MONITORING & MAINTENANCE

### Real-Time Monitoring

**1. Telegram Notifications**
- Bot sends alerts for all opportunities
- Execution results (success/failure)
- Error notifications
- Status updates

**2. PM2 Monitoring**
```bash
# Real-time logs
pm2 logs flash-loan-bot

# Detailed monitoring
pm2 monit
```

**3. Log Files**
```bash
# View recent output
tail -f logs/output.log

# View errors
tail -f logs/error.log
```

### Health Checks

**Daily:**
- ✅ Check Telegram for alerts
- ✅ Verify bot is running: `pm2 status`
- ✅ Check wallet balance

**Weekly:**
- ✅ Review profit/loss
- ✅ Check gas consumption
- ✅ Review failed transactions
- ✅ Optimize parameters if needed

**Monthly:**
- ✅ Update dependencies: `npm update`
- ✅ Review overall performance
- ✅ Consider parameter adjustments

### Key Metrics to Track

```
Scans Completed: How many scan cycles ran
Opportunities Found: How many potential trades detected
Trades Executed: How many trades attempted
Success Rate: Percentage of successful trades
Net Profit: Total profit minus costs
```

---

## 🔥 TROUBLESHOOTING

### Bot Not Starting

**Check 1: Dependencies**
```bash
npm install
npm run build
```

**Check 2: Configuration**
```bash
# Verify .env.production has all required values
grep "PRIVATE_KEY" .env.production
grep "FLASH_LOAN_CONTRACT_ADDRESS" .env.production
```

**Check 3: Wallet Balance**
```bash
# Ensure you have ETH for gas
# Check on: https://arbiscan.io/address/YOUR_WALLET
```

### No Opportunities Found

**Reason:** This is actually NORMAL most of the time.

Arbitrage opportunities are rare. Expected frequency:
- High volatility: 5-30 per day
- Normal conditions: 1-10 per day
- Low volatility: 0-3 per day

**What to check:**
- ✅ Bot is running: `pm2 status`
- ✅ No errors in logs: `pm2 logs`
- ✅ Telegram bot is working (send `/status`)

### Trades Failing

**Common causes:**

1. **Prices changed** (most common)
   - Opportunity expired before execution
   - Solution: This is normal, bot will find next one

2. **Insufficient liquidity**
   - Pool too small for trade size
   - Solution: Reduce `MIN_LOAN_AMOUNT_USD`

3. **High slippage**
   - Price impact too large
   - Solution: Already handled by bot

4. **Gas price spike**
   - Network congestion
   - Solution: Increase `MAX_GAS_PRICE_GWEI`

### Circuit Breaker Activated

If you see "CIRCUIT BREAKER ACTIVATED":

**Meaning:** 5 consecutive failures detected, bot stopped to prevent losses

**Steps:**
1. Check logs for errors
2. Investigate why trades failed
3. Fix configuration
4. Restart bot: `npm run pm2:restart`

---

## 🔒 SECURITY BEST PRACTICES

### Private Key Security

**DO:**
- ✅ Use a dedicated wallet for the bot
- ✅ Only fund with what you can afford to lose
- ✅ Regularly withdraw profits
- ✅ Use secure VPS with SSH key auth

**DON'T:**
- ❌ Commit `.env.production` to Git
- ❌ Share your private key
- ❌ Use your main wallet
- ❌ Store large amounts in bot wallet

### Operational Security

```bash
# Restrict file permissions
chmod 600 .env.production

# Use firewall
sudo ufw enable
sudo ufw allow 22/tcp  # SSH only

# Regular backups
pm2 save
```

### Smart Contract Security

The contract has built-in protections:
- ✅ Owner-only execution
- ✅ Reentrancy guards
- ✅ Slippage protection
- ✅ Emergency stop mechanism
- ✅ Profit validation

**Emergency Actions:**

If something goes wrong:
```javascript
// In emergency, toggle emergency stop
// (prevents any trades)
// Contact contract owner to execute
```

---

## 📈 OPTIMIZATION TIPS

### Maximizing Profits

1. **Adjust loan size based on market:**
   - Volatile markets: Increase to $100k+
   - Calm markets: Reduce to $10k-50k

2. **Optimize scan interval:**
   - High volatility: 5 minutes
   - Normal: 10 minutes (default)
   - Low activity: 15-30 minutes

3. **Fine-tune profit threshold:**
   ```bash
   MIN_PROFIT_USD=50          # More opportunities, smaller profits
   MIN_PROFIT_USD=200         # Fewer opportunities, larger profits
   ```

### Reducing Costs

1. **Gas optimization:**
   - Already optimized in contract
   - Use `GAS_PRICE_MULTIPLIER=1.2` (lower)
   
2. **Reduce false executions:**
   - Increase `MIN_PROFIT_PERCENTAGE` to 0.7%
   - Reduces failed attempts

---

## 🎯 EXPECTED PERFORMANCE

### Realistic Expectations

**With $50k capital:**

| Metric | Conservative | Realistic | Optimistic |
|--------|-------------|-----------|------------|
| Trades/month | 5-10 | 10-20 | 20-40 |
| Avg profit/trade | $100 | $200 | $300 |
| Monthly profit | $500-1k | $2k-4k | $6k-12k |
| Success rate | 50-60% | 60-75% | 75-85% |

**Factors affecting performance:**
- Market volatility (higher = more opportunities)
- Competition (varies by time)
- Your VPS latency (lower = better)
- Configuration (tune over time)

---

## 📞 SUPPORT & MONITORING

### Telegram Commands

```
/start   - Start bot interaction
/status  - Get current bot status
/stats   - View trading statistics
```

### Emergency Contacts

Keep these ready:
- VPS provider support
- Wallet backup/seed phrase (secure location)
- Contract address
- Deployment transaction hash

---

## ✅ POST-DEPLOYMENT CHECKLIST

Before going live:

- [ ] Contract deployed and verified
- [ ] Wallet funded with 0.1+ ETH
- [ ] `.env.production` configured correctly
- [ ] Bot builds successfully (`npm run build`)
- [ ] PM2 starts without errors
- [ ] Telegram bot responds to `/status`
- [ ] Logs directory exists
- [ ] Private key secured
- [ ] Emergency stop procedure documented

---

## 🚦 READY TO START

If all checks pass:

```bash
# Final check
npm run build

# Start the bot
npm run pm2:start

# Monitor logs
npm run pm2:logs
```

**You should see:**
- ✅ "BOT STARTED" in logs
- ✅ Telegram notification received
- ✅ "Starting scan..." messages
- ✅ PM2 shows "online" status

---

## 📊 MONITORING DASHBOARD

Create a simple monitoring script:

```bash
# Create monitor.sh
cat > monitor.sh << 'EOF'
#!/bin/bash
echo "🤖 Flash Loan Bot Status"
echo "========================"
pm2 status flash-loan-bot
echo ""
echo "Recent logs:"
pm2 logs flash-loan-bot --lines 20 --nostream
EOF

chmod +x monitor.sh

# Run anytime
./monitor.sh
```

---

## 🎓 LEARNING & IMPROVEMENT

### Week 1: Observation
- Don't touch settings
- Observe what opportunities are found
- Track success/failure reasons

### Week 2-4: Optimization
- Adjust `MIN_PROFIT_USD` based on results
- Fine-tune `MIN_LOAN_AMOUNT_USD`
- Optimize scan interval

### Month 2+: Advanced
- Consider multiple token pairs
- Adjust for market conditions
- Optimize gas settings

---

## ⚠️ FINAL WARNING

**This is real trading with real money.**

- Start small to learn
- Never invest more than you can lose
- Profits are not guaranteed
- Competition is fierce
- Market conditions change

**The bot will work as designed, but profitability depends on market conditions beyond our control.**

---

## 🎉 YOU'RE READY!

Your production-grade flash loan arbitrage bot is ready to trade.

**May your spreads be wide and your gas fees low! 🚀**

---

*Last updated: 2025*
