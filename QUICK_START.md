# ⚡ Quick Start - 5 Minutes to Running

Get your bot running in 5 minutes!

## 🚀 Quick Steps

### 1. Install (30 seconds)
```bash
npm install
```

### 2. Configure (1 minute)
Edit `.env` and add your private key:
```env
PRIVATE_KEY=your_wallet_private_key_here
```

Everything else is already configured! ✅

### 3. Deploy Contract (2 minutes)
```bash
npm run compile
npm run deploy
```

Wait for deployment to complete. Your contract address will be automatically added to `.env`.

### 4. Start Bot (30 seconds)
```bash
npm run build
npm start
```

### 5. Check Telegram (1 minute)
Open Telegram and send `/start` to your bot. You should see:
```
🤖 Flash Loan Arbitrage Bot Started!
Scanning for opportunities on Arbitrum...
```

## ✅ That's It!

Your bot is now:
- 🔍 Scanning DEXs every 10 seconds
- 💰 Looking for profitable arbitrage
- 🤖 Ready to execute trades automatically
- 📱 Sending alerts to Telegram

## 📊 What to Expect

### First Hour
- Bot scans continuously
- You'll see scan logs every 10 seconds
- Opportunities are rare but the bot is working!

### When Opportunity Found
1. 📱 Telegram alert with details
2. ⚡ Auto-execution (if profitable)
3. 💰 Profit sent to your wallet
4. ✅ Success notification

## ⚙️ Quick Settings

Want to adjust? Edit `.env`:

```env
# How much profit needed (USD)
MIN_PROFIT_USD=100

# Flash loan size (USD)
MIN_LOAN_AMOUNT_USD=50000

# How often to scan (milliseconds)
SCAN_INTERVAL_MS=10000
```

## 🆘 Quick Troubleshooting

**No opportunities?** 
- Normal! They're rare. Keep running.

**Bot stopped?**
- Check your ETH balance for gas

**Telegram not working?**
- Verify bot token in `.env`
- Send `/start` to your bot

## 📝 View Logs

```bash
tail -f logs/combined.log
```

## 🎯 What's Next?

1. Monitor Telegram for alerts
2. Review logs occasionally  
3. Adjust settings as needed
4. Let the bot work its magic!

## 💡 Pro Tips

- Start with default settings
- Keep at least 0.05 ETH for gas
- Monitor first few trades closely
- Patience - good opportunities will come!

---

**Need detailed instructions?** See `SETUP.md`

**Questions?** Check `README.md`

**Ready to profit! 🚀💰**
