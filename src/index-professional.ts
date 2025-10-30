import { ethers } from 'ethers';
import { logger } from './utils/logger';
import { config } from './config/config';
import { ProfessionalPriceOracle } from './services/ProfessionalPriceOracle';
import { TOKENS } from './config/constants';
import TelegramBot from 'node-telegram-bot-api';

/**
 * PROFESSIONAL-GRADE BOT
 * Clear, systematic, validated alerts
 */

const bot = new TelegramBot(config.telegram.botToken, { polling: false });
const chatId = config.telegram.chatId;
const provider = new ethers.providers.JsonRpcProvider(config.network.rpcUrl);
const priceOracle = new ProfessionalPriceOracle(provider);

// Token pairs with USD prices for profit calculations
const PAIRS = [
  { tokenA: TOKENS.WETH, tokenB: TOKENS.USDC, symbolA: 'WETH', symbolB: 'USDC', decimalsA: 18, decimalsB: 6, tokenAPrice: 3895 },
  { tokenA: TOKENS.ARB, tokenB: TOKENS.USDC, symbolA: 'ARB', symbolB: 'USDC', decimalsA: 18, decimalsB: 6, tokenAPrice: 0.31 },
  { tokenA: TOKENS.LINK, tokenB: TOKENS.USDC, symbolA: 'LINK', symbolB: 'USDC', decimalsA: 18, decimalsB: 6, tokenAPrice: 17.15 },
  { tokenA: TOKENS.GMX, tokenB: TOKENS.USDC, symbolA: 'GMX', symbolB: 'USDC', decimalsA: 18, decimalsB: 6, tokenAPrice: 9.88 },
];

let scanCount = 0;

async function performScan() {
  scanCount++;
  const startTime = Date.now();

  logger.info('═══════════════════════════════════════════════════════════════════');
  logger.info(`🔍 SCAN #${scanCount} - ${new Date().toLocaleString()}`);
  logger.info('═══════════════════════════════════════════════════════════════════');

  try {
    const results = [];

    // Scan each pair
    for (const pair of PAIRS) {
      const prices = await priceOracle.getValidatedPrices(
        pair.tokenA,
        pair.tokenB,
        pair.symbolA,
        pair.symbolB,
        pair.decimalsA,
        pair.decimalsB
      );

      if (prices.length > 0) {
        const arbitrage = priceOracle.calculateArbitrage(
          pair.symbolA,
          pair.symbolB,
          prices,
          pair.tokenAPrice
        );

        results.push({ pair, prices, arbitrage });
      }
    }

    const scanTime = Date.now() - startTime;
    logger.info(`✅ Scan completed in ${scanTime}ms`);
    logger.info(`📊 Checked ${results.length} pairs`);

    // Send to Telegram
    await sendProfessionalAlert(results);

  } catch (error) {
    logger.error('Scan error:', error);
    await bot.sendMessage(chatId, `❌ Scan #${scanCount} failed: ${(error as Error).message}`);
  }
}

async function sendProfessionalAlert(results: any[]) {
  let message = `🔍 *SCAN #${scanCount} - VALIDATED PRICES*\n`;
  message += `⏰ ${new Date().toLocaleTimeString()}\n\n`;

  let profitableCount = 0;

  for (const result of results) {
    const { pair, prices, arbitrage } = result;

    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💱 *${pair.symbolA}/${pair.symbolB}*\n\n`;

    // Show prices on each DEX
    message += `📊 *Prices on Different DEXs:*\n`;
    prices.forEach((p: any) => {
      message += `\n   ${p.dex}\n`;
      message += `   Price: $${p.price.toFixed(6)}\n`;
      message += `   Fee: ${p.feePercent}\n`;
      message += `   Liquidity: $${formatNumber(p.liquidityUSD)}\n`;
    });

    message += '\n';

    // Show arbitrage opportunity if exists
    if (arbitrage) {
      message += `📈 *ARBITRAGE DETECTED:*\n`;
      message += `   Buy on: ${arbitrage.buyDex}\n`;
      message += `   Buy Price: $${arbitrage.buyPrice.toFixed(6)}\n`;
      message += `   Sell on: ${arbitrage.sellDex}\n`;
      message += `   Sell Price: $${arbitrage.sellPrice.toFixed(6)}\n`;
      message += `   Price Diff: $${arbitrage.priceDifference.toFixed(6)}\n`;
      message += `   Spread: ${arbitrage.spreadPercent.toFixed(3)}%\n\n`;

      message += `💰 *PROFIT CALCULATION:*\n`;
      message += `   Flash Loan: $${formatNumber(arbitrage.flashLoanAmountUSD)}\n`;
      message += `   Expected Profit: $${arbitrage.expectedProfit.toFixed(2)}\n`;
      message += `   Flash Loan Fee: -$${arbitrage.flashLoanFee.toFixed(2)}\n`;
      message += `   Gas Cost: -$${arbitrage.estimatedGasCost.toFixed(2)}\n`;
      message += `   *NET PROFIT: $${arbitrage.netProfit.toFixed(2)}*\n\n`;

      if (arbitrage.isProfitable) {
        message += `✅ *PROFITABLE! Execute trade?*\n`;
        profitableCount++;
      } else {
        message += `⚠️ Not profitable after costs\n`;
      }
    } else {
      message += `ℹ️ No arbitrage spread detected\n`;
    }

    message += '\n';
  }

  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📊 *Scan #${scanCount} Summary:*\n`;
  message += `✅ Pairs Scanned: ${results.length}\n`;
  message += `💰 Profitable Opportunities: ${profitableCount}\n`;
  message += `🔄 Next scan: 2 minutes\n\n`;
  message += `⚠️ *SCAN-ONLY MODE*\n`;
  message += `No trades executed\n\n`;
  message += `✅ All prices validated\n`;
  message += `✅ Liquidity confirmed\n`;
  message += `✅ Real profit calculations`;

  try {
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    logger.info('✅ Professional alert sent');
  } catch (error) {
    logger.error('Telegram error:', error);
  }
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(2)}K`;
  }
  return num.toFixed(2);
}

async function main() {
  logger.info('');
  logger.info('═══════════════════════════════════════════════════════════════════');
  logger.info('   PROFESSIONAL-GRADE BOT - VALIDATED & CLEAR');
  logger.info('═══════════════════════════════════════════════════════════════════');
  logger.info('');

  await bot.sendMessage(
    chatId,
    '🎯 *PROFESSIONAL BOT STARTED*\n\n' +
    '✅ Multi-layer validation\n' +
    '✅ Liquidity filtering ($500k min)\n' +
    '✅ Real profit calculations\n' +
    '✅ Clear, systematic alerts\n' +
    '✅ Flash loan simulation\n' +
    '✅ Gas cost estimates\n\n' +
    '📊 *What You Get:*\n' +
    '• Token prices on each DEX\n' +
    '• Liquidity data per pool\n' +
    '• Arbitrage detection\n' +
    '• Profit calculations with ALL costs\n' +
    '• Clear buy/sell recommendations\n\n' +
    'Starting first scan in 10 seconds...',
    { parse_mode: 'Markdown' }
  );

  await new Promise(resolve => setTimeout(resolve, 10000));

  while (true) {
    await performScan();
    logger.info('⏳ Waiting 120 seconds until next scan...\n');
    await new Promise(resolve => setTimeout(resolve, 120000));
  }
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
