# ⚡ Bot Features & Capabilities

## 🎯 Core Features

### 1. Real-Time Price Monitoring
- **Ultra-accurate live prices** directly from Arbitrum mainnet
- **No mock data** - All prices fetched from actual DEX smart contracts
- **Multi-DEX comparison** - Simultaneous price fetching from:
  - Uniswap V3 (3 fee tiers: 0.05%, 0.3%, 1%)
  - Sushiswap V2
  - Camelot DEX

### 2. Direct Arbitrage Scanner (Bidirectional)
Scans **both directions** for every token pair:
```
Direction 1: WETH → USDC
Direction 2: USDC → WETH
```

**How it works:**
1. Fetches prices from all DEXs simultaneously
2. Compares prices to find spreads
3. Calculates profit percentage
4. Alerts if profit > threshold (default 0.5%)

**Example Opportunity:**
```
WETH → ARB
Buy on Sushiswap: 1 WETH = 2,000 ARB
Sell on Uniswap V3: 1 WETH = 2,015 ARB
Profit: 0.75% (15 ARB)
```

### 3. Triangular Arbitrage Scanner (Bidirectional)
Tests complex multi-hop paths in **both directions**:
```
Forward:  WETH → USDC → ARB → WETH
Reverse:  WETH → ARB → USDC → WETH
```

**Pre-configured paths include:**
- WETH → USDC → ARB → WETH
- WETH → USDC → LINK → WETH
- WETH → USDC → MAGIC → WETH
- ARB → USDC → WETH → ARB
- Many more combinations...

**Example Opportunity:**
```
Path: WETH → USDC → ARB → WETH
Step 1: 1 WETH → 2,500 USDC (Uniswap V3)
Step 2: 2,500 USDC → 2,000 ARB (Sushiswap)
Step 3: 2,000 ARB → 1.02 WETH (Camelot)
Final: 1.02 WETH
Profit: 2.0% (0.02 WETH)
```

### 4. WETH Price Dashboard
Every scan includes comprehensive WETH prices across all DEXs for major pairs:
- WETH/USDC
- WETH/USDT
- WETH/DAI
- WETH/ARB
- WETH/LINK
- WETH/MAGIC
- WETH/WBTC
- WETH/GMX
- WETH/RDNT

### 5. Telegram Integration
**Instant alerts** with rich formatting:
- 🚨 Scan start/completion notifications
- 💎 Real-time price tables
- 🎯 Direct arbitrage opportunities (sorted by profit)
- 🔺 Triangular arbitrage opportunities (sorted by profit)
- 📊 Detailed execution paths
- ⏰ Timestamps for all data

## 🔧 Technical Capabilities

### Smart Contract Integration
- **Uniswap V3 Quoter** - Precise quotes with fee tier optimization
- **V2 Router** - AMM price quotes from Sushiswap & Camelot
- **Factory Contracts** - Liquidity pool verification
- **ERC20 Interface** - Token metadata and balances

### Price Fetching Strategy
1. **Parallel Fetching** - All DEXs queried simultaneously for speed
2. **Fee Tier Optimization** - Tests all Uniswap V3 fee tiers, returns best
3. **Pool Verification** - Checks pool existence before querying
4. **Error Handling** - Graceful fallbacks if a DEX is unavailable

### Profit Calculation
- **Accurate decimals handling** - Respects each token's decimal places
- **Percentage-based thresholds** - Configurable minimum profit
- **Absolute profit amounts** - Shows both % and token amounts
- **Gas cost awareness** - (Note: actual gas not calculated, manual review needed)

## 💰 Monitored Tokens

### Flash Loan Supported (Priority)
1. **WETH** - Wrapped Ethereum (18 decimals)
2. **ARB** - Arbitrum Token (18 decimals)
3. **USDC** - USD Coin (6 decimals)
4. **USDT** - Tether (6 decimals)
5. **DAI** - Dai Stablecoin (18 decimals)
6. **LINK** - Chainlink (18 decimals)
7. **MAGIC** - Treasure (18 decimals)
8. **WBTC** - Wrapped Bitcoin (8 decimals)
9. **RDNT** - Radiant Capital (18 decimals)

### Additional Tokens
10. **GMX** - GMX Protocol (18 decimals)

## 📊 Scan Coverage

### Direct Pairs (Bidirectional)
Total: **38 directions** scanned (19 pairs × 2 directions)

Key pairs:
- WETH pairs: USDC, USDT, DAI, ARB, LINK, MAGIC, WBTC, GMX, RDNT
- Stablecoin pairs: USDC/USDT, USDC/DAI, USDT/DAI
- ARB pairs: USDC, USDT
- Other pairs: LINK/USDC, MAGIC/USDC, WBTC/USDC, etc.

### Triangular Paths (Bidirectional)
Total: **32 paths** scanned (16 paths × 2 directions)

Categories:
- WETH-centric paths (10 paths)
- ARB triangular (6 paths)
- Stablecoin arbitrage (4 paths)
- Complex multi-token paths (12 paths)

## ⚙️ Configuration Options

### Scan Interval
```env
SCAN_INTERVAL=180000  # 3 minutes (default)
```
Options: 60000 (1 min), 180000 (3 min), 300000 (5 min)

### Profit Threshold
```env
MIN_PROFIT_PERCENTAGE=0.5  # 0.5% minimum
```
- Lower = More opportunities (may include false positives)
- Higher = Fewer, higher-quality opportunities

### RPC Endpoint
```env
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc  # Public
```
For production, use:
- Alchemy: `https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY`
- Infura: `https://arbitrum-mainnet.infura.io/v3/YOUR_KEY`

## 🔄 Scan Cycle

Every scan performs:
1. **Connection verification** - Checks Arbitrum RPC
2. **Direct arbitrage scan** - ~30-60 seconds
3. **Triangular arbitrage scan** - ~60-90 seconds
4. **WETH price aggregation** - ~10-20 seconds
5. **Result compilation** - ~1-2 seconds
6. **Telegram notification** - ~1-2 seconds

**Total scan time:** ~2-3 minutes per cycle

## 📈 Performance Characteristics

### Accuracy
- ✅ **100% real-time** - All prices from live blockchain data
- ✅ **No API delays** - Direct smart contract calls
- ✅ **Block-level precision** - Prices accurate to the current block

### Speed
- ⚡ **Parallel execution** - All DEXs queried simultaneously
- ⚡ **Efficient batching** - Minimal RPC calls
- ⚡ **Fast notification** - Telegram alerts within seconds

### Reliability
- 🛡️ **Error handling** - Graceful fallbacks for failed calls
- 🛡️ **Pool verification** - Avoids querying non-existent pools
- 🛡️ **Retry logic** - Built into ethers.js provider

## 🎁 Bonus Features

1. **Startup verification** - Confirms connection before scanning
2. **Graceful shutdown** - Ctrl+C cleanly stops the bot
3. **Detailed logging** - Console output for debugging
4. **Formatted displays** - Pretty console and Telegram output
5. **Top 5 opportunities** - Only shows best opportunities to avoid spam

## 🔮 Future Enhancement Ideas

1. **Gas estimation** - Calculate actual execution costs
2. **Flash loan integration** - Aave/Balancer flash loan execution
3. **MEV protection** - Flashbots integration for private transactions
4. **Historical tracking** - Database of past opportunities
5. **Profit tracking** - If executed, track P&L
6. **More DEXs** - Curve, Balancer V2, GMX
7. **Custom paths** - User-defined triangular paths
8. **Slippage simulation** - Estimate price impact

## 📝 Data Accuracy Notes

### What's Real
✅ Prices are fetched directly from DEX smart contracts
✅ All token addresses are verified Arbitrum mainnet addresses
✅ Pool addresses are verified to exist
✅ Decimal places are accurate per token

### What's Simulated
⚠️ Profit calculations assume zero slippage
⚠️ Gas costs are not included in profit calculations
⚠️ Large trades will have price impact (not shown)
⚠️ MEV/frontrunning risk exists for profitable trades

## 🎯 Best Use Cases

1. **Market Monitoring** - Track real-time price discrepancies
2. **Pattern Recognition** - Identify recurring opportunities
3. **Strategy Development** - Build automated trading strategies
4. **Educational** - Learn about DEX mechanics and arbitrage
5. **Research** - Analyze market efficiency on Arbitrum

---

**This bot provides the intelligence - execution strategy is up to you!** 🚀
