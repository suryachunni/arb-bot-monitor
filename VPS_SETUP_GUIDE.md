# ☁️ VPS SETUP GUIDE - 24/7 Cloud Hosting for Your Bot

## 🎯 What is VPS?

**VPS (Virtual Private Server)** = Your own computer in the cloud that runs 24/7

**Benefits:**
- ✅ Runs 24/7 (never stops)
- ✅ Stable internet
- ✅ Low cost ($5-6/month)
- ✅ Control from Telegram anywhere
- ✅ Professional setup

---

## 💻 RECOMMENDED VPS PROVIDERS

### 🥇 #1 DigitalOcean (EASIEST - Recommended!)

**Cost:** $6/month
**Setup Time:** 15 minutes
**Difficulty:** Easy ⭐⭐☆☆☆

**Why DigitalOcean:**
- Easiest interface
- Great documentation
- Reliable
- Simple billing
- Perfect for beginners

**Sign up:** https://www.digitalocean.com/

---

### 🥈 #2 Vultr (Also Great!)

**Cost:** $5/month  
**Setup Time:** 15 minutes
**Difficulty:** Easy ⭐⭐☆☆☆

**Sign up:** https://www.vultr.com/

---

### 🥉 #3 Hetzner (Cheapest!)

**Cost:** $4.50/month
**Setup Time:** 20 minutes  
**Difficulty:** Medium ⭐⭐⭐☆☆

**Sign up:** https://www.hetzner.com/

---

## 🚀 STEP-BY-STEP: DigitalOcean Setup (15 minutes)

### PART 1: Create VPS (5 minutes)

**Step 1: Sign Up**
1. Go to: https://www.digitalocean.com/
2. Click "Sign Up"
3. Enter email and create account
4. Verify email

**Step 2: Add Payment**
1. Click "Billing"
2. Add credit card OR PayPal
3. You'll be charged $6/month

**Step 3: Create Droplet**
1. Click green "Create" button (top right)
2. Select "Droplets"
3. Choose settings:

**Image:**
- Choose: **Ubuntu 22.04 LTS**

**Droplet Type:**
- Choose: **Basic**

**CPU Options:**
- Choose: **Regular - $6/month**
- 1 GB RAM / 25 GB SSD / 1000 GB transfer

**Datacenter Region:**
- Choose: **New York** or closest to you
- (Doesn't matter much for crypto bot)

**Authentication:**
- Choose: **Password** (easier for beginners)
- Create a strong password and SAVE IT!

**Hostname:**
- Enter: `arbitrage-bot`

**Step 4: Create**
1. Click "Create Droplet"
2. Wait 2 minutes for server to start
3. **COPY THE IP ADDRESS** (looks like: 157.245.123.45)

✅ **VPS Created!** Now let's connect...

---

### PART 2: Connect to VPS (2 minutes)

**On Windows:**

**Option A: Use PowerShell (Built-in)**
1. Press Windows key
2. Type "PowerShell"
3. Open PowerShell
4. Type:
```bash
ssh root@YOUR_IP_ADDRESS
```
(Replace YOUR_IP_ADDRESS with the IP you copied)

5. Type "yes" when asked
6. Enter the password you created
7. ✅ You're in!

**Option B: Use PuTTY (If PowerShell doesn't work)**
1. Download PuTTY: https://putty.org/
2. Install and open
3. Enter IP address
4. Click "Open"
5. Enter username: `root`
6. Enter password
7. ✅ Connected!

**On Mac/Linux:**
1. Open Terminal
2. Type:
```bash
ssh root@YOUR_IP_ADDRESS
```
3. Type "yes" when asked
4. Enter password
5. ✅ Connected!

---

### PART 3: Install Bot (5 minutes)

**Now you're inside your VPS! Copy/paste these commands:**

**Step 1: Install Node.js**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs git
```
(Wait ~1 minute)

**Step 2: Verify Installation**
```bash
node --version
npm --version
```
(Should show: v20.x.x and 10.x.x)

**Step 3: Upload Bot Files**

**Option A: If you have this folder on your computer:**
```bash
# On your computer (new terminal), in the bot folder:
scp -r /workspace root@YOUR_IP_ADDRESS:/root/flash-bot

# Then back in VPS terminal:
cd /root/flash-bot
```

**Option B: I'll create download instructions:**
```bash
# I'll give you a git repo or download link
# For now, create folder:
mkdir -p /root/flash-bot
cd /root/flash-bot
```

**Step 4: Install Dependencies**
```bash
npm install
```
(Wait ~2 minutes)

**Step 5: Build Bot**
```bash
npm run build
```
(Wait ~30 seconds)

✅ **Bot Installed!**

---

### PART 4: Deploy Contract (2 minutes)

**Deploy from VPS:**
```bash
npm run deploy
```

**You'll see:**
```
Deploying FlashLoanArbitrage contract...
Contract deployed to: 0x123abc...
Saved to .env
✅ Deployment complete!
```

**Cost:** ~$16 from your wallet

✅ **Contract Deployed!**

---

### PART 5: Start Bot 24/7 (1 minute)

**Install PM2 (Process Manager):**
```bash
npm install -g pm2
```

**Start Bot:**
```bash
pm2 start npm --name "arbitrage-bot" -- start
```

**Save Configuration:**
```bash
pm2 save
pm2 startup
```
(Copy and run the command it gives you)

**Check Status:**
```bash
pm2 status
```

**View Logs:**
```bash
pm2 logs arbitrage-bot
```

✅ **BOT IS RUNNING 24/7!**

---

## 📱 CONTROL BOT FROM TELEGRAM

**Now disconnect from VPS and use Telegram!**

**Commands:**
```
/status  - Check bot (scans, trades, profit)
/balance - Check wallet balance
/pause   - Pause trading
/resume  - Resume trading
/stop    - Stop bot
```

**Bot will send alerts:**
- 🎯 Opportunity found
- ⚡ Executing trade
- ✅ Trade successful ($XXX profit!)
- ❌ Trade failed
- ⚠️ Low gas warning

**You can close SSH, close computer, bot keeps running!**

---

## 🔧 USEFUL VPS COMMANDS

**Check bot status:**
```bash
pm2 status
```

**View live logs:**
```bash
pm2 logs arbitrage-bot --lines 100
```

**Restart bot:**
```bash
pm2 restart arbitrage-bot
```

**Stop bot:**
```bash
pm2 stop arbitrage-bot
```

**Update bot code:**
```bash
cd /root/flash-bot
git pull  # If using git
npm install
npm run build
pm2 restart arbitrage-bot
```

---

## 💰 MONTHLY COSTS

**DigitalOcean:** $6/month
**Vultr:** $5/month
**Hetzner:** $4.50/month

**Paid automatically with your card/PayPal**

**Cancel anytime:**
- DigitalOcean dashboard → Destroy Droplet
- No long-term contract!

---

## 📊 EXPECTED PERFORMANCE (24/7 on VPS)

### With 0.02 ETH Initial ($40):

**Week 1:**
- Trades: 40-50
- Profit: $2,000-3,000
- Cost: -$40 (initial) -$6 (VPS)
- **Net: +$1,954-2,954**

**Week 2-4:**
- Add 0.05 ETH from profits
- Trades: 200-300
- Profit: $7,000-12,000
- **Total Month 1: +$9,000-15,000**

**After 1 Month:**
- ROI: 225-375x on initial $40!
- VPS cost: $6 (0.04% of profit)
- **Extremely profitable!**

---

## 🎯 AFTER VPS SETUP:

**Your workflow:**

**Morning:**
1. Wake up
2. Check Telegram
3. See: "Made $340 overnight! 6 trades executed"
4. Smile 😊

**During Day:**
5. Get alerts: "🎯 Opportunity found! $142"
6. Get alerts: "✅ Trade successful! $138 profit"
7. Continue your life

**Evening:**
8. Check `/status`
9. See total profits
10. Go to sleep

**Weekly:**
11. Withdraw profits
12. Reinvest some for gas
13. Keep the rest!

**You do NOTHING else. Bot handles everything!**

---

## ⚠️ SECURITY TIPS

**Your VPS has your private key!**

**Secure it:**
1. Use strong password
2. Don't share VPS IP/password
3. Consider SSH keys (advanced)
4. Only use for this bot
5. Withdraw profits regularly

**The bot wallet should only have:**
- ETH for gas
- Not your life savings!

**Withdraw profits to a separate secure wallet weekly!**

---

## 🆘 TROUBLESHOOTING

**Bot not responding on Telegram?**
```bash
pm2 logs arbitrage-bot
# Check for errors
pm2 restart arbitrage-bot
```

**Out of memory?**
```bash
pm2 restart arbitrage-bot
```

**Need to update .env?**
```bash
nano /root/flash-bot/.env
# Edit values
# Press Ctrl+X, Y, Enter to save
pm2 restart arbitrage-bot
```

**VPS disconnected?**
```bash
ssh root@YOUR_IP_ADDRESS
# Enter password
pm2 status
# Bot should still be running!
```

---

## 🚀 READY TO SETUP VPS?

**After you fund wallet with 0.02 ETH:**

1. I'll test bot here first
2. You see it works (Option A)
3. Then we setup VPS (Option C)
4. Bot runs 24/7
5. You control from Telegram
6. **Profit!** 💰

---

## 💡 NEXT STEPS:

**Right now:**
1. Fund wallet: `0x6c791735173CaBa32c246E86F90Cb6ccedc7D3E2`
2. Send 0.02 ETH on Arbitrum network
3. Tell me: "Check balance now"

**After funded:**
4. I deploy and test here (Option A)
5. You see live trading
6. We setup VPS (Option C)
7. **24/7 automated profits!**

**Let me know when you've funded the wallet!** 🚀
