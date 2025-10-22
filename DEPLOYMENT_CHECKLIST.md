# ✅ PRODUCTION DEPLOYMENT CHECKLIST

## Pre-Deployment (30-60 minutes)

### 1. Install Dependencies
```bash
- [ ] npm install
- [ ] Verify no vulnerabilities: npm audit
- [ ] Install Slither (optional): pip3 install slither-analyzer
```

### 2. Security Audit
```bash
- [ ] Run: npm run security-audit
- [ ] Review: cat security-audit-*/AUDIT_SUMMARY.md
- [ ] Fix any critical/high issues
- [ ] Document any accepted risks
```

### 3. Test Suite
```bash
- [ ] Run: npm test
- [ ] All tests passing (50+)
- [ ] No gas estimation failures
- [ ] No revert errors
```

### 4. Key Management
```bash
- [ ] Run: npm run key:migrate
- [ ] Enter strong password (12+ chars)
- [ ] Backup encrypted keystore
- [ ] Verify: npm run key:verify
- [ ] Remove PRIVATE_KEY from .env (keep backup elsewhere)
```

### 5. Configuration
```bash
- [ ] Update .env with correct values:
      - RPC_URL (Alchemy/Infura)
      - TELEGRAM_BOT_TOKEN
      - TELEGRAM_CHAT_ID
      - MIN_PROFIT_USD=50
      - MAX_GAS_PRICE_GWEI=1.0
      
- [ ] Set PROFIT_RECEIVER address
- [ ] Verify all token addresses (constants.ts)
```

---

## Testnet Deployment (1-2 hours)

### 6. Deploy to Arbitrum Sepolia
```bash
- [ ] Fund deployer wallet: 0.1 ETH (Sepolia)
- [ ] Check balance: await wallet.getBalance()
- [ ] Deploy: npm run deploy:testnet
- [ ] Save contract address from output
- [ ] Verify deployment succeeded
```

### 7. Verify Contract
```bash
- [ ] Run: npm run verify -- --network arbitrum-sepolia <ADDRESS> <PROFIT_RECEIVER>
- [ ] Check Arbiscan Sepolia for verified source
- [ ] Verify configuration via getConfiguration()
```

### 8. Test Execution (Testnet)
```bash
- [ ] Start bot: npm run dev
- [ ] Verify Telegram connection
- [ ] Monitor for 1-2 hours
- [ ] Test /status, /balance, /pause, /resume commands
- [ ] Execute 5-10 test trades (if opportunities found)
- [ ] Verify slippage protection works
- [ ] Verify profit threshold enforcement
- [ ] Check emergency stop: /stop
```

### 9. Analyze Results
```bash
- [ ] Review logs: tail -f logs/combined.log
- [ ] Check success rate (expect 40-70%)
- [ ] Verify gas costs ($0.01-0.05 per trade)
- [ ] Confirm profit > costs
- [ ] No unexpected reverts
```

---

## Mainnet Deployment (30 minutes)

### 10. Final Security Check
```bash
- [ ] Re-run security audit: npm run security-audit
- [ ] Review all reports
- [ ] Confirm no critical issues
- [ ] Backup all code and keys
```

### 11. Deploy to Arbitrum Mainnet
```bash
- [ ] Fund deployer wallet: 0.05+ ETH (Arbitrum ONE)
- [ ] Verify RPC_URL points to mainnet
- [ ] Deploy: npm run deploy
- [ ] SAVE CONTRACT ADDRESS (critical!)
- [ ] Verify deployment on Arbiscan
```

### 12. Verify Contract (Mainnet)
```bash
- [ ] Run: npm run verify -- --network arbitrum <ADDRESS> <PROFIT_RECEIVER>
- [ ] Check on Arbiscan: https://arbiscan.io/address/<ADDRESS>
- [ ] Verify source code matches
- [ ] Check configuration
```

### 13. Initial Configuration
```bash
- [ ] Verify profit receiver: getConfiguration()
- [ ] Check min profit: 50 basis points (0.5%)
- [ ] Check max slippage: 50 basis points (0.5%)
- [ ] Verify emergency stop is OFF
- [ ] Test owner-only functions
```

---

## Production Start (30 minutes)

### 14. Fund Executor Wallet
```bash
- [ ] Send 0.02-0.05 ETH to executor wallet
- [ ] Verify balance: npm run dev (check startup logs)
- [ ] Keep reserve for gas (0.01 ETH minimum)
```

### 15. Start Bot (Production)
```bash
- [ ] Build: npm run build
- [ ] Start: npm start (or use PM2/systemd)
- [ ] Verify Telegram alerts working
- [ ] Test /status command
- [ ] Monitor logs in real-time
```

### 16. Initial Monitoring (24-48 hours)
```bash
- [ ] Check logs every 2-4 hours
- [ ] Monitor Telegram for alerts
- [ ] Track success rate
- [ ] Track profit vs. costs
- [ ] Check for unexpected errors
- [ ] Verify slippage protection working
```

---

## Ongoing Operations

### 17. Daily Checks
```bash
- [ ] Check Telegram for execution alerts
- [ ] Review daily profit/loss
- [ ] Monitor gas costs
- [ ] Check wallet balance (top up if needed)
- [ ] Review error logs
```

### 18. Weekly Checks
```bash
- [ ] Analyze success rate (aim for 40-70%)
- [ ] Review total profit
- [ ] Check for contract updates needed
- [ ] Verify RPC provider performance
- [ ] Update token pairs if needed
```

### 19. Monthly Checks
```bash
- [ ] Run security audit
- [ ] Update dependencies
- [ ] Review profitability vs. expectations
- [ ] Optimize configuration if needed
- [ ] Backup all data and keys
```

---

## Emergency Procedures

### If Bot is Losing Money
```bash
- [ ] Telegram: /pause (immediate stop)
- [ ] Toggle emergency stop on contract
- [ ] Review logs for issues
- [ ] Analyze failed trades
- [ ] Fix issues before resuming
```

### If Contract is Compromised
```bash
- [ ] Toggle emergency stop
- [ ] Withdraw all funds: emergencyWithdraw()
- [ ] Revoke all token approvals
- [ ] Deploy new contract
- [ ] Update bot configuration
```

### If Private Key is Compromised
```bash
- [ ] Immediately transfer all funds to new wallet
- [ ] Deploy new contract with new owner
- [ ] Generate new encrypted keystore
- [ ] Update all configurations
- [ ] Review all past transactions
```

---

## Success Metrics

### Expected Performance (30-60 days)

```
✅ Success Rate:        40-70%
✅ Daily Trades:        10-30
✅ Avg Profit/Trade:    $50-200
✅ Monthly Profit:      $1,500-12,000
✅ Gas Cost/Trade:      $0.01-0.05
✅ Execution Time:      1-2 seconds
✅ Uptime:              >95%
```

### Red Flags (Stop and Investigate)

```
🚨 Success Rate <30%
🚨 Losses > Profits (3+ days)
🚨 Gas costs > Profit
🚨 Frequent reverts (>50%)
🚨 Execution time >10 seconds
🚨 Unexpected errors in logs
```

---

## Checklist Summary

### Pre-Deployment: 5 items
- [ ] Dependencies installed
- [ ] Security audit passed
- [ ] Tests passing
- [ ] Keys encrypted
- [ ] Configuration updated

### Testnet: 4 items
- [ ] Deployed to Sepolia
- [ ] Contract verified
- [ ] Test trades executed
- [ ] Results analyzed

### Mainnet: 3 items
- [ ] Deployed to Arbitrum
- [ ] Contract verified
- [ ] Configuration confirmed

### Production: 3 items
- [ ] Wallet funded
- [ ] Bot started
- [ ] Monitoring active

**Total: 15 critical items before production**

---

## Quick Start Commands

```bash
# Security audit
npm run security-audit

# Run tests
npm test

# Encrypt key
npm run key:migrate

# Deploy testnet
npm run deploy:testnet

# Deploy mainnet
npm run deploy

# Start bot
npm run build && npm start

# Monitor logs
tail -f logs/combined.log
```

---

## Support Resources

- 📖 Full documentation: `README.md`
- 🔒 Security details: `PRODUCTION_UPGRADE_REPORT.md`
- 🐛 Troubleshooting: `logs/error.log`
- 📊 Contract stats: Telegram `/stats`
- ⚠️ Emergency: Telegram `/stop`

---

**🎯 Complete this checklist before deploying to production! 🎯**

_Last Updated: October 22, 2025_
