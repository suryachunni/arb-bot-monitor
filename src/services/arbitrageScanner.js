import { ethers } from 'ethers';
import { TOKENS, TRADING_PAIRS, TRIANGULAR_PATHS } from '../config/tokens.js';
import { PriceFetcher } from './priceFetcher.js';

export class ArbitrageScanner {
  constructor(provider) {
    this.provider = provider;
    this.priceFetcher = new PriceFetcher(provider);
    this.opportunities = [];
  }

  // Scan for direct arbitrage (buy on DEX A, sell on DEX B)
  async scanDirectArbitrage(minProfitPercentage = 0.5) {
    console.log('🔍 Scanning for direct arbitrage opportunities...');
    const opportunities = [];

    for (const pair of TRADING_PAIRS) {
      try {
        const { tokenA, tokenB } = pair;
        
        // Use 1 unit of tokenA for testing
        const amountIn = ethers.parseUnits('1', TOKENS[tokenA].decimals);

        // Get prices from all DEXs
        const prices = await this.priceFetcher.getAllPrices(tokenA, tokenB, amountIn);

        if (prices.length < 2) continue;

        // Find best buy (max output) and best sell (min output for reverse)
        const sortedPrices = [...prices].sort((a, b) => Number(b.amountOut) - Number(a.amountOut));
        const bestBuy = sortedPrices[0];
        const worstBuy = sortedPrices[sortedPrices.length - 1];

        // Calculate profit
        const profitAmount = Number(bestBuy.amountOut) - Number(worstBuy.amountOut);
        const profitPercentage = (profitAmount / Number(worstBuy.amountOut)) * 100;

        if (profitPercentage >= minProfitPercentage) {
          const opportunity = {
            type: 'DIRECT',
            direction: `${tokenA} → ${tokenB}`,
            path: [tokenA, tokenB],
            buyDex: bestBuy.dex,
            sellDex: worstBuy.dex,
            buyPrice: this.formatPrice(bestBuy.amountOut, TOKENS[tokenB].decimals),
            sellPrice: this.formatPrice(worstBuy.amountOut, TOKENS[tokenB].decimals),
            profitPercentage: profitPercentage.toFixed(4),
            profitAmount: this.formatPrice(BigInt(Math.floor(profitAmount)), TOKENS[tokenB].decimals),
            timestamp: new Date().toISOString(),
            allPrices: prices.map(p => ({
              dex: p.dex,
              price: this.formatPrice(p.amountOut, TOKENS[tokenB].decimals)
            }))
          };
          opportunities.push(opportunity);
        }

        // Check reverse direction (tokenB → tokenA)
        const amountInReverse = ethers.parseUnits('1', TOKENS[tokenB].decimals);
        const pricesReverse = await this.priceFetcher.getAllPrices(tokenB, tokenA, amountInReverse);

        if (pricesReverse.length >= 2) {
          const sortedPricesReverse = [...pricesReverse].sort((a, b) => Number(b.amountOut) - Number(a.amountOut));
          const bestBuyReverse = sortedPricesReverse[0];
          const worstBuyReverse = sortedPricesReverse[sortedPricesReverse.length - 1];

          const profitAmountReverse = Number(bestBuyReverse.amountOut) - Number(worstBuyReverse.amountOut);
          const profitPercentageReverse = (profitAmountReverse / Number(worstBuyReverse.amountOut)) * 100;

          if (profitPercentageReverse >= minProfitPercentage) {
            const opportunity = {
              type: 'DIRECT',
              direction: `${tokenB} → ${tokenA}`,
              path: [tokenB, tokenA],
              buyDex: bestBuyReverse.dex,
              sellDex: worstBuyReverse.dex,
              buyPrice: this.formatPrice(bestBuyReverse.amountOut, TOKENS[tokenA].decimals),
              sellPrice: this.formatPrice(worstBuyReverse.amountOut, TOKENS[tokenA].decimals),
              profitPercentage: profitPercentageReverse.toFixed(4),
              profitAmount: this.formatPrice(BigInt(Math.floor(profitAmountReverse)), TOKENS[tokenA].decimals),
              timestamp: new Date().toISOString(),
              allPrices: pricesReverse.map(p => ({
                dex: p.dex,
                price: this.formatPrice(p.amountOut, TOKENS[tokenA].decimals)
              }))
            };
            opportunities.push(opportunity);
          }
        }
      } catch (error) {
        console.error(`Error scanning ${pair.tokenA}/${pair.tokenB}:`, error.message);
      }
    }

    return opportunities;
  }

  // Scan for triangular arbitrage
  async scanTriangularArbitrage(minProfitPercentage = 0.5) {
    console.log('🔺 Scanning for triangular arbitrage opportunities...');
    const opportunities = [];

    for (const path of TRIANGULAR_PATHS) {
      try {
        // Forward direction: A → B → C → A
        const forwardOpp = await this.checkTriangularPath(path, minProfitPercentage);
        if (forwardOpp) opportunities.push(forwardOpp);

        // Reverse direction: A → C → B → A
        const reversePath = [path[0], path[2], path[1]];
        const reverseOpp = await this.checkTriangularPath(reversePath, minProfitPercentage);
        if (reverseOpp) opportunities.push(reverseOpp);

      } catch (error) {
        console.error(`Error scanning triangular path ${path.join(' → ')}:`, error.message);
      }
    }

    return opportunities;
  }

  async checkTriangularPath(path, minProfitPercentage) {
    const [tokenA, tokenB, tokenC] = path;
    
    // Start with 1 unit of tokenA
    const initialAmount = ethers.parseUnits('1', TOKENS[tokenA].decimals);

    // Step 1: A → B
    const step1 = await this.priceFetcher.getBestPrice(tokenA, tokenB, initialAmount, 'buy');
    if (!step1) return null;

    // Step 2: B → C
    const step2 = await this.priceFetcher.getBestPrice(tokenB, tokenC, step1.amountOut, 'buy');
    if (!step2) return null;

    // Step 3: C → A
    const step3 = await this.priceFetcher.getBestPrice(tokenC, tokenA, step2.amountOut, 'buy');
    if (!step3) return null;

    // Calculate profit
    const finalAmount = step3.amountOut;
    const profitAmount = Number(finalAmount) - Number(initialAmount);
    const profitPercentage = (profitAmount / Number(initialAmount)) * 100;

    if (profitPercentage >= minProfitPercentage) {
      return {
        type: 'TRIANGULAR',
        direction: path.join(' → ') + ' → ' + path[0],
        path: [...path, path[0]],
        steps: [
          { from: tokenA, to: tokenB, dex: step1.dex, amount: this.formatPrice(step1.amountOut, TOKENS[tokenB].decimals) },
          { from: tokenB, to: tokenC, dex: step2.dex, amount: this.formatPrice(step2.amountOut, TOKENS[tokenC].decimals) },
          { from: tokenC, to: tokenA, dex: step3.dex, amount: this.formatPrice(step3.amountOut, TOKENS[tokenA].decimals) }
        ],
        startAmount: this.formatPrice(initialAmount, TOKENS[tokenA].decimals),
        endAmount: this.formatPrice(finalAmount, TOKENS[tokenA].decimals),
        profitPercentage: profitPercentage.toFixed(4),
        profitAmount: this.formatPrice(BigInt(Math.floor(profitAmount)), TOKENS[tokenA].decimals),
        timestamp: new Date().toISOString()
      };
    }

    return null;
  }

  // Get detailed WETH prices across all DEXs
  async getWETHPrices() {
    console.log('💰 Fetching WETH prices across all DEXs...');
    const wethPrices = {};
    
    // Key pairs to monitor
    const keyPairs = ['USDC', 'USDT', 'DAI', 'ARB', 'LINK', 'MAGIC', 'WBTC'];

    for (const token of keyPairs) {
      try {
        const amountIn = ethers.parseUnits('1', TOKENS.WETH.decimals);
        const prices = await this.priceFetcher.getAllPrices('WETH', token, amountIn);
        
        if (prices.length > 0) {
          wethPrices[token] = prices.map(p => ({
            dex: p.dex,
            price: this.formatPrice(p.amountOut, TOKENS[token].decimals),
            fee: p.fee || 'N/A'
          }));
        }
      } catch (error) {
        console.error(`Error fetching WETH/${token} price:`, error.message);
      }
    }

    return wethPrices;
  }

  // Comprehensive scan
  async scanAll(minProfitPercentage = 0.5) {
    console.log('\n========================================');
    console.log('🚀 Starting comprehensive arbitrage scan');
    console.log('========================================\n');

    const [directOpportunities, triangularOpportunities, wethPrices] = await Promise.all([
      this.scanDirectArbitrage(minProfitPercentage),
      this.scanTriangularArbitrage(minProfitPercentage),
      this.getWETHPrices()
    ]);

    return {
      direct: directOpportunities,
      triangular: triangularOpportunities,
      wethPrices,
      totalOpportunities: directOpportunities.length + triangularOpportunities.length,
      timestamp: new Date().toISOString()
    };
  }

  formatPrice(amount, decimals) {
    return Number(ethers.formatUnits(amount, decimals));
  }
}
