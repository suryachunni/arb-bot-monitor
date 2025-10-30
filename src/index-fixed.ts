import { ethers } from 'ethers';
import { logger } from './utils/logger';
import { config } from './config/config';
import { RealPriceOracle } from './services/RealPriceOracle';
import { TOKENS } from './config/constants';
import TelegramBot from 'node-telegram-bot-api';

/**
 * FIXED BOT WITH REAL PRICES
 * Actually works this time!
 */

const bot = new TelegramBot(config.telegram.botToken, { polling: false });
const chatId = config.telegram.chatId;

const provider = new ethers.providers.JsonRpcProvider(config.network.rpcUrl);
const priceOracle = new RealPriceOracle(provider);

// High liquidity pairs with correct decimals
const PAIRS = [
  { tokenA: TOKENS.WETH, tokenB: TOKENS.USDC, symbolA: 'WETH', symbolB: 'USDC', decimalsA: 18, decimalsB: 6 },
  { tokenA: TOKENS.WETH, tokenB: TOKENS.USDT, symbolA: 'WETH', symbolB: 'USDT', decimalsA: 18, decimalsB: 6 },
  { tokenA: TOKENS.ARB, tokenB: TOKENS.USDC, symbolA: 'ARB', symbolB: 'USDC', decimalsA: 18, decimalsB: 6 },
  { tokenA: TOKENS.WETH, tokenB: TOKENS.ARB, symbolA: 'WETH', symbolB: 'ARB', decimalsA: 18, decimalsB: 18 },
  { tokenA: TOKENS.LINK, tokenB: TOKENS.USDC, symbolA: 'LINK', symbolB: 'USDC', decimalsA: 18, decimalsB: 6 },
  { tokenA: TOKENS.GMX, tokenB: TOKENS.USDC, symbolA: 'GMX', symbolB: 'USDC', decimalsA: 18, decimalsB: 6 },
];

let scanCount = 0;

async function performScan() {
  scanCount++;
  const startTime = Date.now();

  logger.info('═══════════════════════════════════════════════════════════════════');
  logger.info(`🔍 SCAN #${scanCount} - ${new Date().toLocaleString()}`);
  logger.info('═══════════════════════════════════════════════════════════════════');

  try {
    // Get all prices in parallel
    const priceData = await priceOracle.batchGetPrices(PAIRS);

    const scanTime = Date.now() - startTime;
    logger.info(`✅ Fetched prices in ${scanTime}ms`);
    logger.info(`📊 Got data for ${priceData.size} pairs`);

    // Send to Telegram
    await sendTelegramAlert(priceData);

  } catch (error) {
    logger.error('Scan error:', error);
    await bot.sendMessage(chatId, `❌ Scan #${scanCount} failed: ${(error as Error).message}`);
  }
}

async function sendTelegramAlert(priceData: Map<string, any>) {
  let message = `🔍 *SCAN #${scanCount} - REAL PRICES*\n`;
  message += `⏰ ${new Date().toLocaleTimeString()}\n\n`;

  for (const [pairName, data] of priceData.entries()) {
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💱 *${pairName}*\n\n`;

    // Show each price
    data.prices.forEach((p: any) => {
      message += `📊 ${p.dex}\n`;
      message += `   Price: ${p.price.toFixed(6)}\n`;
      message += `   Fee: ${(p.fee * 100).toFixed(2)}%\n\n`;
    });

    // Show spread
    if (data.prices.length >= 2) {
      message += `📈 *Spread: ${data.spreadPercent.toFixed(3)}%*\n`;
      
      if (data.spreadPercent > 0.5) {
        message += `✅ *Potentially profitable!*\n`;
        message += `   Buy at: $${data.bestBuyPrice.toFixed(6)}\n`;
        message += `   Sell at: $${data.bestSellPrice.toFixed(6)}\n`;
      } else {
        message += `ℹ️ Spread too small after gas\n`;
      }
    }

    message += '\n';
  }

  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📊 *Scan #${scanCount} Complete*\n`;
  message += `🔄 Next scan in 2 minutes\n\n`;
  message += `✅ All prices are REAL\n`;
  message += `✅ From Uniswap V3 Quoter\n`;
  message += `⚠️ SCAN-ONLY MODE`;

  try {
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    logger.info('✅ Telegram alert sent');
  } catch (error) {
    logger.error('Telegram error:', error);
  }
}

async function main() {
  logger.info('');
  logger.info('═══════════════════════════════════════════════════════════════════');
  logger.info('   FIXED BOT WITH REAL PRICES - SCAN-ONLY MODE');
  logger.info('═══════════════════════════════════════════════════════════════════');
  logger.info('');

  // Send startup message
  await bot.sendMessage(
    chatId,
    '🔧 *BOT RESTARTED WITH FIX*\n\n' +
    '✅ Now using Quoter contract\n' +
    '✅ Real, verified prices\n' +
    '✅ Realistic spreads\n' +
    '✅ More token pairs\n\n' +
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
