# 🚀 START TELEGRAM EXECUTOR BOT

## ✅ This gives you EXECUTE BUTTONS in Telegram!

### Quick Start:

```bash
python3 telegram_executor_bot.py
```

Then in Telegram:
1. Send `/start` to your bot
2. Send `/scan` to find opportunities
3. Click the **⚡ EXECUTE** button
4. Trade executes automatically!

---

## 📱 How It Works:

```
You: /scan

Bot: 💰 Opportunity #1
     ARB/USDT
     Profit: $1,918.57
     ROI: 3.84%
     
     [⚡ EXECUTE - $1,918 profit] ← Click this!

You: *clicks button*

Bot: ⚡ EXECUTING TRADE...
     
     ✅ TRADE SUCCESSFUL!
     Profit: $1,918.57
```

---

## ⚙️ Before You Start:

1. Make sure you've set up `.env`:
   ```bash
   cp .env.example .env
   # Edit .env and add your PRIVATE_KEY
   ```

2. (Optional) Deploy smart contract:
   ```bash
   python3 deploy_contract.py
   ```
   
   OR just scan without execution (monitor only)

---

## 🎯 Commands:

- `/start` - Start the bot
- `/scan` - Scan for opportunities NOW
- `/monitor` - Start continuous monitoring
- `/stop` - Stop monitoring  
- `/stats` - View statistics

---

## 🔒 Safety:

- Private key in `.env` (NOT in code)
- You approve EACH trade by clicking button
- Shows NET profit AFTER all costs
- Only validated, real opportunities

---

**START NOW:**
```bash
python3 telegram_executor_bot.py
```
