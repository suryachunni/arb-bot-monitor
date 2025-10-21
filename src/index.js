import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { ArbitrageScanner } from './services/arbitrageScanner.js';
import { TelegramNotifier } from './services/telegramNotifier.js';

// Load environment variables
dotenv.config();

class ArbitrageBot {
  constructor() {
    this.setupProvider();
    this.scanner = new ArbitrageScanner(this.provider);
    this.notifier = new TelegramNotifier(
      process.env.TELEGRAM_BOT_TOKEN,
      process.env.TELEGRAM_CHAT_ID
    );
    this.scanInterval = parseInt(process.env.SCAN_INTERVAL) || 180000; // 3 minutes
    this.minProfitPercentage = parseFloat(process.env.MIN_PROFIT_PERCENTAGE) || 0.5;
    this.isRunning = false;
  }

  setupProvider() {
    const rpcUrl = process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc';
    console.log('🌐 Connecting to Arbitrum RPC:', rpcUrl);
    
    this.provider = new ethers.JsonRpcProvider(rpcUrl, {
      name: 'arbitrum',
      chainId: 42161
    });
  }

  async start() {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   ARBITRUM ARBITRAGE BOT STARTING...  ║');
    console.log('╚════════════════════════════════════════╝\n');

    try {
      // Verify connection
      const network = await this.provider.getNetwork();
      console.log('✅ Connected to network:', network.name, '(Chain ID:', network.chainId.toString() + ')');

      const blockNumber = await this.provider.getBlockNumber();
      console.log('📦 Current block:', blockNumber);

      // Send startup notification
      await this.notifier.sendStartupMessage();

      // Start scanning
      this.isRunning = true;
      console.log(`\n⏰ Scan interval: ${this.scanInterval / 1000} seconds (${this.scanInterval / 60000} minutes)`);
      console.log(`💰 Minimum profit threshold: ${this.minProfitPercentage}%\n`);

      // Run first scan immediately
      await this.scan();

      // Schedule periodic scans
      this.intervalId = setInterval(() => {
        this.scan();
      }, this.scanInterval);

    } catch (error) {
      console.error('❌ Error starting bot:', error);
      await this.notifier.sendError(error);
      process.exit(1);
    }
  }

  async scan() {
    if (!this.isRunning) return;

    try {
      console.log('\n' + '═'.repeat(60));
      console.log(`🔍 SCAN STARTED: ${new Date().toLocaleString()}`);
      console.log('═'.repeat(60) + '\n');

      // Perform comprehensive scan
      const results = await this.scanner.scanAll(this.minProfitPercentage);

      // Display results
      this.displayResults(results);

      // Send Telegram notification
      await this.notifier.sendArbitrageAlert(results);

      console.log('\n' + '═'.repeat(60));
      console.log(`✅ SCAN COMPLETED: ${new Date().toLocaleString()}`);
      console.log(`⏰ Next scan in ${this.scanInterval / 60000} minutes`);
      console.log('═'.repeat(60) + '\n');

    } catch (error) {
      console.error('❌ Error during scan:', error);
      await this.notifier.sendError(error);
    }
  }

  displayResults(results) {
    const { direct, triangular, wethPrices, totalOpportunities } = results;

    console.log('📊 SCAN RESULTS:');
    console.log('─'.repeat(60));

    // WETH Prices
    console.log('\n💎 WETH PRICES ACROSS DEXs:');
    for (const [token, prices] of Object.entries(wethPrices)) {
      if (prices && prices.length > 0) {
        console.log(`\n  WETH/${token}:`);
        prices.forEach(p => {
          const feeText = p.fee !== 'N/A' ? ` (${p.fee/10000}% fee)` : '';
          console.log(`    • ${p.dex}: ${p.price.toFixed(6)} ${token}${feeText}`);
        });
      }
    }

    // Direct Arbitrage
    if (direct.length > 0) {
      console.log(`\n\n🎯 DIRECT ARBITRAGE OPPORTUNITIES: ${direct.length}`);
      console.log('─'.repeat(60));
      direct.slice(0, 5).forEach((opp, idx) => {
        console.log(`\n${idx + 1}. ${opp.direction}`);
        console.log(`   💰 Profit: ${opp.profitPercentage}% (${opp.profitAmount})`);
        console.log(`   📈 Buy: ${opp.buyDex} @ ${opp.buyPrice}`);
        console.log(`   📉 Sell: ${opp.sellDex} @ ${opp.sellPrice}`);
      });
    } else {
      console.log('\n\n🎯 DIRECT ARBITRAGE: No opportunities found');
    }

    // Triangular Arbitrage
    if (triangular.length > 0) {
      console.log(`\n\n🔺 TRIANGULAR ARBITRAGE OPPORTUNITIES: ${triangular.length}`);
      console.log('─'.repeat(60));
      triangular.slice(0, 5).forEach((opp, idx) => {
        console.log(`\n${idx + 1}. ${opp.direction}`);
        console.log(`   💰 Profit: ${opp.profitPercentage}% (${opp.profitAmount})`);
        console.log(`   🔄 Path:`);
        opp.steps.forEach((step, i) => {
          console.log(`      ${i + 1}. ${step.from} → ${step.to} via ${step.dex}: ${step.amount}`);
        });
      });
    } else {
      console.log('\n\n🔺 TRIANGULAR ARBITRAGE: No opportunities found');
    }

    if (totalOpportunities === 0) {
      console.log('\n❌ No profitable opportunities found this scan');
    } else {
      console.log(`\n\n✅ TOTAL OPPORTUNITIES FOUND: ${totalOpportunities}`);
    }
  }

  async stop() {
    console.log('\n🛑 Stopping bot...');
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    console.log('✅ Bot stopped');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Received SIGINT, shutting down gracefully...');
  if (bot) {
    await bot.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n⚠️  Received SIGTERM, shutting down gracefully...');
  if (bot) {
    await bot.stop();
  }
  process.exit(0);
});

// Start the bot
const bot = new ArbitrageBot();
bot.start().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
