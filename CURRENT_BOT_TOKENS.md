# 🎯 YOUR BOT - CURRENT TOKENS & SCANNING

## 📊 TOKENS YOUR BOT IS MONITORING:

### 1. **WETH** (Wrapped ETH) ⭐⭐⭐⭐⭐
```
Address: 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1
Decimals: 18
Current Price: ~$4,017
Why: Most liquid token on Arbitrum
Volatility: High
Best for: Arbitrage with everything
```

### 2. **ARB** (Arbitrum Token) ⭐⭐⭐⭐⭐
```
Address: 0x912CE59144191C1204E64559FE8253a0e49E6548
Decimals: 18
Current Price: ~$0.33
Why: Native Arbitrum token, very volatile
Volatility: Very High
Best for: WETH/ARB pair ($680M liquidity!)
```

### 3. **USDC** (USD Coin) ⭐⭐⭐⭐
```
Address: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
Decimals: 6
Current Price: $1.00
Why: Stablecoin, good for measuring profits
Volatility: Low
Best for: Pairing with volatile tokens
```

### 4. **USDT** (Tether) ⭐⭐⭐
```
Address: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9
Decimals: 6
Current Price: $1.00
Why: Another stablecoin option
Volatility: Low
Best for: Alternative to USDC
```

### 5. **WBTC** (Wrapped Bitcoin) ⭐⭐⭐⭐
```
Address: 0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f
Decimals: 8
Current Price: ~$113,000
Why: BTC on Arbitrum, high value
Volatility: High
Best for: Large value trades
```

### 6. **LINK** (Chainlink) ⭐⭐⭐
```
Address: 0xf97f4df75117a78c1A5a0DBb814Af92458539FB4
Decimals: 18
Current Price: ~$18
Why: Popular DeFi token
Volatility: Medium-High
Best for: Diversification
```

---

## 🔄 PAIRS YOUR BOT SCANS (6 TOTAL):

### 1. **WETH/ARB** ⭐⭐⭐⭐⭐ BEST PAIR
```
Why: Highest liquidity ($680M on SushiSwap!)
Volatility: Very High
Opportunity Frequency: Highest
Current Spread: ~5.4%
Recommended: YES - This is your money maker
```

### 2. **WETH/USDC** ⭐⭐⭐⭐
```
Why: Most common pair, reliable
Volatility: Medium
Opportunity Frequency: Medium
Current Spread: ~7%
Recommended: YES
```

### 3. **WETH/WBTC** ⭐⭐⭐
```
Why: Two major assets
Volatility: Medium
Opportunity Frequency: Low
Current Spread: Variable
Recommended: Maybe (low liquidity issues)
```

### 4. **WETH/LINK** ⭐⭐⭐
```
Why: Decent DeFi pair
Volatility: Medium
Opportunity Frequency: Low-Medium
Current Spread: Variable
Recommended: Maybe
```

### 5. **ARB/USDC** ⭐⭐⭐⭐
```
Why: ARB is volatile
Volatility: High
Opportunity Frequency: Medium
Current Spread: High (but low liquidity)
Recommended: Borderline
```

### 6. **WETH/USDT** ⭐⭐⭐
```
Why: Alternative to USDC
Volatility: Low
Opportunity Frequency: Low
Current Spread: ~6%
Recommended: Maybe
```

---

## 🏦 DEXS YOUR BOT CHECKS:

### 1. **Uniswap V3** ✅ PRIMARY
```
Why: Highest liquidity on Arbitrum
Reliability: Excellent
Price Accuracy: Best
Status: Always checked first
```

### 2. **SushiSwap** ✅ SECONDARY
```
Why: Good backup, decent liquidity
Reliability: Good
Price Accuracy: Good
Status: Checked for arbitrage opportunities
Note: Smaller pools than Uniswap V3
```

### 3. **Camelot** ❌ REMOVED
```
Why: Too low liquidity
Status: Removed (you caught this!)
Reason: Caused fake price signals
```

---

## 📊 CURRENT SCAN SETTINGS:

```
Scan Interval: Every 10 minutes
Test Amount: $10,000 worth
Min Liquidity: $50,000
Min Profit: $50 (after all fees)
Min Spread: 0.5% (after costs)
```

---

## 🎯 SCANNING STRATEGY:

Your bot does this EVERY 10 MINUTES:

```
1. Get WETH price from Uniswap V3 & SushiSwap
2. Get ARB price from Uniswap V3 & SushiSwap
3. Get USDC price from Uniswap V3 & SushiSwap
4. Get USDT price from Uniswap V3 & SushiSwap
5. Get WBTC price from Uniswap V3 & SushiSwap
6. Get LINK price from Uniswap V3 & SushiSwap

For each pair:
├─ Check liquidity (must be >$50k)
├─ Calculate spread between DEXs
├─ Estimate slippage
├─ Calculate net profit
└─ Alert if profitable (>$50)
```

---

## 💡 SHOULD WE ADD/CHANGE TOKENS?

### Currently Using: ✅ GOOD SELECTION
- WETH ✅ (best)
- ARB ✅ (best)
- USDC ✅ (necessary)
- USDT ✅ (backup)
- WBTC ✅ (high value)
- LINK ✅ (diversification)

### Could Add (if you want):

**High Potential:**
- **GMX** (0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a)
  - Gaming token, high volatility
  - Good liquidity
  - ⭐⭐⭐⭐

- **PENDLE** (0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8)
  - DeFi token, volatile
  - Medium liquidity
  - ⭐⭐⭐

**Lower Priority:**
- DAI (another stablecoin - not needed)
- USDC.e (bridged USDC - confusing)

---

## 🔥 MY RECOMMENDATION:

### CURRENT SETUP: ✅ EXCELLENT

**Best Pairs (Keep Focus):**
1. WETH/ARB ⭐⭐⭐⭐⭐ (YOUR BEST OPPORTUNITY)
2. WETH/USDC ⭐⭐⭐⭐
3. ARB/USDC ⭐⭐⭐⭐

**Can Remove (Low Value):**
- WETH/WBTC (low liquidity)
- WETH/LINK (low opportunities)
- WETH/USDT (duplicate of WETH/USDC)

### OPTIMIZED SETUP (Recommended):

**Focus on 3 HIGH-QUALITY pairs:**
1. WETH/ARB ($680M liquidity!)
2. WETH/USDC (most reliable)
3. ARB/USDC (volatile)

This gives you:
- ✅ Best liquidity
- ✅ Highest volatility
- ✅ Most opportunities
- ✅ Faster scanning

---

## ❓ WANT ME TO:

1. **Keep current setup** (6 pairs)?
2. **Optimize to 3 best pairs** (faster, more focused)?
3. **Add new volatile tokens** (GMX, PENDLE)?
4. **Change strategy completely**?

Tell me what you want! 🚀
