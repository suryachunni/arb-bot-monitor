import { config } from './config.js';

class ArbitrageCalculator {
  constructor() {
    this.opportunities = [];
    this.minSpread = config.monitoring.minArbitrageSpread;
  }

  // Calculate arbitrage opportunities from price data
  calculateArbitrageOpportunities(prices) {
    const opportunities = [];
    
    // Sort prices by value
    const sortedPrices = prices
      .filter(price => price.price > 0)
      .sort((a, b) => a.price - b.price);

    if (sortedPrices.length < 2) return opportunities;

    // Find all possible arbitrage pairs
    for (let i = 0; i < sortedPrices.length; i++) {
      for (let j = i + 1; j < sortedPrices.length; j++) {
        const buyPrice = sortedPrices[i];
        const sellPrice = sortedPrices[j];
        
        const spread = this.calculateSpread(buyPrice.price, sellPrice.price);
        const profitPercentage = this.calculateProfitPercentage(buyPrice.price, sellPrice.price);
        
        if (spread >= this.minSpread) {
          const opportunity = {
            id: `${buyPrice.dex}-${sellPrice.dex}-${Date.now()}`,
            buyDex: buyPrice.dex,
            sellDex: sellPrice.dex,
            buyPrice: buyPrice.price,
            sellPrice: sellPrice.price,
            spread: spread,
            profitPercentage: profitPercentage,
            potentialProfit: this.calculatePotentialProfit(buyPrice.price, sellPrice.price),
            buyFee: buyPrice.fee || 0,
            sellFee: sellPrice.fee || 0,
            liquidity: this.calculateLiquidity(buyPrice, sellPrice),
            timestamp: Date.now(),
            status: 'active'
          };
          
          opportunities.push(opportunity);
        }
      }
    }

    // Sort by profit percentage (highest first)
    opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
    
    this.opportunities = opportunities;
    return opportunities;
  }

  // Calculate spread percentage
  calculateSpread(buyPrice, sellPrice) {
    if (buyPrice <= 0 || sellPrice <= 0) return 0;
    return ((sellPrice - buyPrice) / buyPrice) * 100;
  }

  // Calculate profit percentage
  calculateProfitPercentage(buyPrice, sellPrice) {
    if (buyPrice <= 0 || sellPrice <= 0) return 0;
    return ((sellPrice - buyPrice) / buyPrice) * 100;
  }

  // Calculate potential profit for 1 WETH
  calculatePotentialProfit(buyPrice, sellPrice) {
    if (buyPrice <= 0 || sellPrice <= 0) return 0;
    return sellPrice - buyPrice;
  }

  // Calculate combined liquidity
  calculateLiquidity(buyPrice, sellPrice) {
    const buyLiquidity = buyPrice.liquidity || 0;
    const sellLiquidity = sellPrice.liquidity || 0;
    
    // Return the minimum of the two (bottleneck)
    return Math.min(buyLiquidity, sellLiquidity);
  }

  // Calculate gas costs for arbitrage transaction
  calculateGasCosts() {
    // Estimated gas costs for arbitrage on Arbitrum
    const gasPrice = 0.1; // gwei
    const gasLimit = 500000; // Estimated gas for complex arbitrage
    const gasCostETH = (gasPrice * gasLimit) / 1e9;
    
    return {
      gasPrice: gasPrice,
      gasLimit: gasLimit,
      gasCostETH: gasCostETH,
      gasCostUSD: gasCostETH * 2000 // Assuming ETH = $2000
    };
  }

  // Calculate net profit after gas costs
  calculateNetProfit(opportunity) {
    const gasCosts = this.calculateGasCosts();
    const grossProfit = opportunity.potentialProfit;
    const netProfit = grossProfit - gasCosts.gasCostUSD;
    
    return {
      grossProfit: grossProfit,
      gasCosts: gasCosts.gasCostUSD,
      netProfit: netProfit,
      netProfitPercentage: (netProfit / opportunity.buyPrice) * 100
    };
  }

  // Filter opportunities by minimum profit
  filterProfitableOpportunities(opportunities, minNetProfit = 10) {
    return opportunities.filter(opportunity => {
      const netProfit = this.calculateNetProfit(opportunity);
      return netProfit.netProfit >= minNetProfit;
    });
  }

  // Get best arbitrage opportunity
  getBestOpportunity(opportunities) {
    if (!opportunities || opportunities.length === 0) return null;
    
    const profitableOpportunities = this.filterProfitableOpportunities(opportunities);
    if (profitableOpportunities.length === 0) return null;
    
    // Sort by net profit percentage
    return profitableOpportunities.sort((a, b) => {
      const netProfitA = this.calculateNetProfit(a);
      const netProfitB = this.calculateNetProfit(b);
      return netProfitB.netProfitPercentage - netProfitA.netProfitPercentage;
    })[0];
  }

  // Calculate arbitrage path for complex multi-hop trades
  calculateArbitragePath(prices, maxHops = 3) {
    const paths = [];
    const wethAddress = config.tokens.WETH.address;
    const usdcAddress = config.tokens.USDC.address;
    
    // Simple 2-hop arbitrage: WETH -> USDC -> WETH
    for (const dex1 of prices) {
      for (const dex2 of prices) {
        if (dex1.dex !== dex2.dex) {
          const path = {
            hops: 2,
            path: [wethAddress, usdcAddress, wethAddress],
            dexs: [dex1.dex, dex2.dex],
            prices: [dex1.price, 1/dex2.price], // Invert second price
            totalSpread: this.calculateSpread(dex1.price, 1/dex2.price)
          };
          
          if (path.totalSpread >= this.minSpread) {
            paths.push(path);
          }
        }
      }
    }
    
    return paths.sort((a, b) => b.totalSpread - a.totalSpread);
  }

  // Calculate risk score for arbitrage opportunity
  calculateRiskScore(opportunity) {
    let riskScore = 0;
    
    // Liquidity risk (lower liquidity = higher risk)
    if (opportunity.liquidity < 10000) riskScore += 30;
    else if (opportunity.liquidity < 50000) riskScore += 15;
    else if (opportunity.liquidity < 100000) riskScore += 5;
    
    // Spread risk (very high spreads might be stale prices)
    if (opportunity.spread > 10) riskScore += 20;
    else if (opportunity.spread > 5) riskScore += 10;
    
    // DEX risk (some DEXs are more reliable)
    const reliableDexs = ['Uniswap V3', 'SushiSwap'];
    if (!reliableDexs.includes(opportunity.buyDex)) riskScore += 10;
    if (!reliableDexs.includes(opportunity.sellDex)) riskScore += 10;
    
    // Age risk (older prices are riskier)
    const age = Date.now() - opportunity.timestamp;
    if (age > 30000) riskScore += 20; // 30 seconds
    else if (age > 10000) riskScore += 10; // 10 seconds
    
    return Math.min(riskScore, 100); // Cap at 100
  }

  // Get opportunity summary
  getOpportunitySummary(opportunities) {
    if (!opportunities || opportunities.length === 0) {
      return {
        totalOpportunities: 0,
        profitableOpportunities: 0,
        bestSpread: 0,
        averageSpread: 0,
        totalPotentialProfit: 0
      };
    }

    const profitable = this.filterProfitableOpportunities(opportunities);
    const spreads = opportunities.map(opp => opp.spread);
    const profits = opportunities.map(opp => opp.potentialProfit);

    return {
      totalOpportunities: opportunities.length,
      profitableOpportunities: profitable.length,
      bestSpread: Math.max(...spreads),
      averageSpread: spreads.reduce((a, b) => a + b, 0) / spreads.length,
      totalPotentialProfit: profits.reduce((a, b) => a + b, 0),
      bestOpportunity: this.getBestOpportunity(opportunities)
    };
  }
}

export default ArbitrageCalculator;