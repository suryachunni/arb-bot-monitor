# ⚡ EXECUTE BUTTONS IN TELEGRAM - QUICK START

## 🎯 What You Want:

Telegram alerts that look like this:

```
🚨 OPPORTUNITY #1 🚨

ARB/USDT
📈 Buy:  Camelot @ $0.317904
📉 Sell: Sushiswap @ $0.330716
📊 Spread: 4.030%

💰 PROFIT ($50k flash loan):
  Gross:     $2,015.07
  Costs:     -$  96.50
  NET:       $1,918.57
  ROI:          3.84%

[⚡ EXECUTE - $1,918 PROFIT]  ← CLICK THIS!
```

---

## 🚀 START THE BOT (ONE COMMAND):

```bash
./START_AUTO_ALERTS.sh
```

OR:

```bash
python3 auto_alert_with_buttons.py
```

---

## ✅ What Happens:

1. **Bot scans** every 3 minutes
2. **Finds opportunities** (validated, real prices)
3. **Sends Telegram alert** with EXECUTE buttons
4. **You click button** ⚡ EXECUTE
5. **Trade executes** automatically
6. **Profit sent** to your wallet!

---

## 📱 Example Flow:

**Your Telegram receives:**
```
🚨 OPPORTUNITY #1 🚨

ARB/USDT
NET: $1,918.57
ROI: 3.84%

[⚡ EXECUTE - $1,918 PROFIT]
```

**You:** *Click the button*

**Bot replies:**
```
⚡ EXECUTING TRADE...
Please wait...

✅ TRADE SUCCESSFUL!
Profit: $1,918.57
TX: 0xabcd1234...

Total Trades: 1
Total Profit: $1,918.57
```

**Done!** Money in your wallet! 💰

---

## ⚙️ Setup (First Time Only):

### 1. Configure Environment
```bash
cp .env.example .env
# Edit .env and add your PRIVATE_KEY
```

### 2. Deploy Contract (Optional)
```bash
python3 deploy_contract.py
```

If you skip this, you can still see opportunities but can't execute yet.

### 3. Start Bot
```bash
./START_AUTO_ALERTS.sh
```

---

## 🛡️ Safety Features:

✅ **Validated Prices** - Only real opportunities shown
✅ **You Control** - Must click button for each trade
✅ **NET Profit** - All costs already deducted
✅ **Atomic Transaction** - All or nothing, can't lose
✅ **Real-Time** - Fresh prices every scan

---

## 💡 What's Different from Before:

**Before:**
```
Alert comes → No button → Must execute manually
```

**Now:**
```
Alert comes → EXECUTE button → Click → Done! ✅
```

---

## 🎯 Commands:

The bot runs automatically, but if you want manual control:

Run `telegram_executor_bot.py` instead:
```bash
python3 telegram_executor_bot.py
```

Then use:
- `/scan` - Scan NOW for opportunities
- `/monitor` - Start continuous monitoring
- `/stop` - Stop monitoring
- `/stats` - View statistics

---

## 🔥 QUICK START (Copy-Paste):

```bash
# 1. Setup (only once)
cp .env.example .env
nano .env  # Add your PRIVATE_KEY

# 2. Deploy contract (only once, optional)
python3 deploy_contract.py

# 3. Start bot (runs forever)
./START_AUTO_ALERTS.sh

# That's it! Check Telegram for alerts with buttons!
```

---

## ✅ What You'll See in Telegram:

Every 3 minutes (when opportunities exist):

1. **Opportunity #1** with EXECUTE button
2. **Opportunity #2** with EXECUTE button
3. **Opportunity #3** with EXECUTE button
4. **Summary** showing total opportunities

**Click any EXECUTE button → Trade happens!**

---

## 📊 Example Alert You'll Receive:

```
🚨 OPPORTUNITY #1 🚨

ARB/USDT
📈 Buy:  Camelot @ $0.317904
📉 Sell: Sushiswap @ $0.330716
📊 Spread: 4.030%

💰 PROFIT ($50k flash loan):
  Gross:     $2,015.07
  Costs:     -$  96.50
  NET:       $1,918.57
  ROI:          3.84%

[⚡ EXECUTE - $1,918 PROFIT]  ← CLICK!
```

---

## 🚀 START NOW:

```bash
./START_AUTO_ALERTS.sh
```

**Then check your Telegram!**

Within 3 minutes, you'll get alerts with EXECUTE buttons! ⚡
