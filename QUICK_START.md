# ⚡ QUICK START GUIDE

## Get Your Bot Running in 5 Minutes

---

## 🚀 FASTEST PATH TO TRADING

### Step 1: Configure Your Private Key (30 seconds)

```bash
# Open the config file
nano .env.production

# Find this line:
PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE

# Replace with your actual private key (NO 0x prefix):
PRIVATE_KEY=abc123def456your64characterprivatekeyhere

# Save: Ctrl+X, then Y, then Enter
```

⚠️ **CRITICAL:** Never share this file or commit to Git!

---

### Step 2: Fund Your Wallet (2 minutes)

Send **0.1 ETH** to your wallet address on **Arbitrum**:

Your wallet address is shown when you start the bot, or check `.env.production`.

**Where to get Arbitrum ETH:**
- Bridge from Ethereum: https://bridge.arbitrum.io
- Buy on exchange and withdraw to Arbitrum
- Use a DEX on Arbitrum

---

### Step 3: Run the Startup Script (2 minutes)

```bash
# Make sure you're in the project directory
cd /workspace

# Run the automated startup script
./START_BOT.sh
```

The script will:
1. ✅ Check your configuration
2. ✅ Install dependencies
3. ✅ Build the bot
4. ✅ Deploy the flash loan contract (if needed)
5. ✅ Start the bot

**Choose your mode:**
- Option 1: Development (for testing)
- Option 2: Production (for 24/7 trading)

---

## 🎯 THAT'S IT!

Your bot is now:
- ✅ Scanning for arbitrage opportunities
- ✅ Sending alerts to your Telegram
- ✅ Auto-executing profitable trades

---

## 📱 CHECK TELEGRAM

You should receive a message like:

```
🚀 BOT STARTED

✅ Flash Loan Arbitrage Bot is now running!

Configuration:
👛 Wallet: 0x1234...5678
💰 Balance: 0.1 ETH
💵 Min Loan: $50,000
📈 Min Profit: $100 (0.5%)
⏱ Scan Interval: 10 min
🛡 MEV Protection: ON
⚡ Auto-Execute: ON

The bot is now scanning for profitable arbitrage opportunities...
```

---

## 🔍 MONITORING

### View Logs (Real-time)

**Development mode:**
- Logs appear in your terminal

**Production mode (PM2):**
```bash
pm2 logs flash-loan-bot
```

### Check Status

```bash
pm2 status
```

### Telegram Commands

Send these to your Telegram bot:
- `/status` - Current bot status
- `/stats` - Trading statistics

---

## ⚙️ OPTIONAL: Adjust Settings

Want to change loan size or profit threshold?

```bash
nano .env.production
```

**Common adjustments:**

```bash
# Smaller trades (less capital needed)
MIN_LOAN_AMOUNT_USD=10000    # $10k instead of $50k

# Higher profit requirement (fewer but better trades)
MIN_PROFIT_USD=200           # $200 instead of $100

# Faster scanning (more opportunities, higher costs)
SCAN_INTERVAL_MS=300000      # 5 minutes instead of 10
```

After changes:
```bash
pm2 restart flash-loan-bot
```

---

## 📊 WHAT TO EXPECT

### First Hour
- Bot scans every 10 minutes
- You'll see scan results in logs
- Telegram alerts for opportunities
- Most scans find 0-2 opportunities (normal!)

### First Day
- Expect 1-10 opportunities found
- Maybe 0-3 trades executed
- Some trades may fail (prices changed - normal!)
- Profit: $0-$500 (if market is active)

### First Week
- Bot learns market patterns
- Success rate improves
- You optimize settings based on results
- Profit: $500-$3,000 (if conditions favorable)

---

## ⚠️ TROUBLESHOOTING

### "No opportunities found"
✅ **This is NORMAL!** Arbitrage is rare.
- Keep running
- Check during high volatility
- Lower `MIN_PROFIT_USD` to see more

### "Trade execution failed"
✅ **This is NORMAL!** Prices change fast.
- Bot will find next opportunity
- Some failure is expected
- Check if gas price is too low

### "Insufficient ETH for gas"
❌ **Action needed:** Add more ETH to wallet
- Need at least 0.01 ETH
- Recommended: 0.1+ ETH

### "Circuit breaker activated"
⚠️ **5 consecutive failures**
- Check logs: `pm2 logs`
- Review configuration
- Restart: `pm2 restart flash-loan-bot`

---

## 🎓 LEARNING MODE

**Week 1:** Just observe
- Don't touch settings
- Watch what opportunities appear
- Learn the patterns

**Week 2:** Optimize
- Adjust `MIN_PROFIT_USD`
- Try different `MIN_LOAN_AMOUNT_USD`
- Fine-tune based on results

---

## 🔒 SECURITY REMINDERS

- ✅ Only fund bot wallet with what you can lose
- ✅ Regularly withdraw profits
- ✅ Keep private key secret
- ✅ Use dedicated wallet (not your main one)
- ✅ Monitor daily via Telegram

---

## 📈 SUCCESS TIPS

1. **Be Patient** - Good opportunities take time
2. **Start Small** - Use $10k-$50k loans initially
3. **Monitor Actively** - Check Telegram daily
4. **Withdraw Often** - Don't leave profits in bot
5. **Optimize Gradually** - Adjust based on data, not guesses

---

## 🆘 NEED HELP?

### Check Logs
```bash
# Production mode
pm2 logs flash-loan-bot

# Development mode
# Logs are in your terminal
```

### Check Balance
Visit: `https://arbiscan.io/address/YOUR_WALLET_ADDRESS`

### Emergency Stop
```bash
pm2 stop flash-loan-bot
```

---

## 🎉 YOU'RE READY TO TRADE!

Your professional arbitrage bot is running 24/7, scanning Arbitrum for profitable opportunities.

**The bot will handle everything automatically:**
- 🔍 Scanning 17 token pairs
- 💧 Checking liquidity depth
- 📊 Validating profitability
- ⚡ Executing trades
- 💰 Sending profits to your wallet
- 📱 Alerting you on Telegram

---

**Good luck and happy trading! 🚀💰**

---

*For detailed documentation, see: PRODUCTION_DEPLOYMENT_GUIDE.md*
