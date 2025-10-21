#!/usr/bin/env node

import PriceFetcher from './priceFetcher.js';
import ArbitrageCalculator from './arbitrageCalculator.js';
import { config } from './config.js';
import chalk from 'chalk';

async function testPriceFetcher() {
  console.log(chalk.blue.bold('🧪 Testing Price Fetcher...'));
  console.log('');

  const priceFetcher = new PriceFetcher();

  try {
    console.log('Fetching WETH prices from all DEXs...');
    const prices = await priceFetcher.fetchAllWETHPrices();

    if (prices.length === 0) {
      console.log(chalk.red('❌ No prices fetched'));
      return;
    }

    console.log(chalk.green(`✅ Successfully fetched ${prices.length} prices:`));
    console.log('');

    prices.forEach(price => {
      console.log(`   ${price.dex}: $${price.price.toFixed(4)} USDC`);
      if (price.liquidity) {
        console.log(`      Liquidity: ${Number(price.liquidity).toFixed(2)} ETH`);
      }
      if (price.fee) {
        console.log(`      Fee: ${price.fee/100}%`);
      }
    });

    return prices;

  } catch (error) {
    console.error(chalk.red('❌ Price fetcher error:'), error.message);
    return null;
  }
}

async function testArbitrageCalculator(prices) {
  if (!prices || prices.length === 0) {
    console.log(chalk.yellow('⚠️  No prices to test arbitrage calculator'));
    return;
  }

  console.log(chalk.blue.bold('\n🧪 Testing Arbitrage Calculator...'));
  console.log('');

  const calculator = new ArbitrageCalculator();

  try {
    const opportunities = calculator.calculateArbitrageOpportunities(prices);
    
    console.log(chalk.green(`✅ Found ${opportunities.length} arbitrage opportunities:`));
    console.log('');

    if (opportunities.length > 0) {
      opportunities.slice(0, 5).forEach((opp, index) => {
        console.log(`   ${index + 1}. ${opp.buyDex} → ${opp.sellDex}`);
        console.log(`      Buy: $${opp.buyPrice.toFixed(4)} | Sell: $${opp.sellPrice.toFixed(4)}`);
        console.log(`      Spread: ${opp.spread.toFixed(2)}% | Profit: ${opp.profitPercentage.toFixed(2)}%`);
        console.log('');
      });

      const bestOpportunity = calculator.getBestOpportunity(opportunities);
      if (bestOpportunity) {
        const netProfit = calculator.calculateNetProfit(bestOpportunity);
        console.log(chalk.magenta.bold('🏆 Best Opportunity:'));
        console.log(`   ${bestOpportunity.buyDex} → ${bestOpportunity.sellDex}`);
        console.log(`   Spread: ${bestOpportunity.spread.toFixed(2)}%`);
        console.log(`   Net Profit: $${netProfit.netProfit.toFixed(2)} (${netProfit.netProfitPercentage.toFixed(2)}%)`);
        console.log('');
      }
    } else {
      console.log(chalk.yellow('⚠️  No arbitrage opportunities found with current spread threshold'));
    }

  } catch (error) {
    console.error(chalk.red('❌ Arbitrage calculator error:'), error.message);
  }
}

async function testConfiguration() {
  console.log(chalk.blue.bold('🧪 Testing Configuration...'));
  console.log('');

  console.log(`   RPC URL: ${config.arbitrum.rpcUrl ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Chain ID: ${config.arbitrum.chainId}`);
  console.log(`   WETH Address: ${config.tokens.WETH.address}`);
  console.log(`   DEXs configured: ${Object.keys(config.dexs).length}`);
  console.log(`   Update interval: ${config.monitoring.updateInterval}ms`);
  console.log(`   Min spread: ${config.monitoring.minArbitrageSpread}%`);
  console.log('');
}

async function runTests() {
  console.log(chalk.blue.bold('🚀 Running Arbitrum WETH Monitor Tests'));
  console.log(chalk.gray('=========================================='));
  console.log('');

  // Test configuration
  await testConfiguration();

  // Test price fetcher
  const prices = await testPriceFetcher();

  // Test arbitrage calculator
  await testArbitrageCalculator(prices);

  console.log(chalk.green.bold('✅ All tests completed!'));
  console.log('');
  console.log(chalk.yellow('To start monitoring, run: npm start'));
}

// Run tests
runTests().catch(error => {
  console.error(chalk.red('❌ Test error:'), error);
  process.exit(1);
});