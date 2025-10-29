/**
 * ═══════════════════════════════════════════════════════════════════
 * MONITORING BOT - Scans and Alerts via Telegram
 * No private key needed - just monitoring mode
 * ═══════════════════════════════════════════════════════════════════
 */

import { ethers, Contract, BigNumber } from 'ethers';
import TelegramBot from 'node-telegram-bot-api';

const RPC_URL = 'https://arb1.arbitrum.io/rpc';
const TELEGRAM_BOT_TOKEN = '7990738699:AAFfoPA4VGO_90DyQauHNiwbHnfwOTmfbgU';
const TELEGRAM_CHAT_ID = '8305086804';

const SCAN_INTERVAL_MINUTES = 10;

const TOKENS = {
  USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6, symbol: 'USDC' },
  USDT: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6, symbol: 'USDT' },
  WETH: { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18, symbol: 'WETH' },
  ARB: { address: '0x912CE59144191C1204E64559FE8253a0e49E6548', decimals: 18, symbol: 'ARB' },
};

const DEXS = {
  UNISWAP_V3: {
    name: 'Uniswap V3',
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  },
  SUSHISWAP: {
    name: 'SushiSwap',
    factory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
  },
  CAMELOT: {
    name: 'Camelot',
    factory: '0x6EcCab422D763aC031210895C81787E87B43A652',
  },
};

const QUOTER_ABI = ['function quoteExactInputSingle(address,address,uint24,uint256,uint160) external returns (uint256)'];
const V2_FACTORY_ABI = ['function getPair(address,address) external view returns (address)'];
const V2_PAIR_ABI = [
  'function getReserves() external view returns (uint112,uint112,uint32)',
  'function token0() external view returns (address)',
];

class MonitoringBot {
  private provider: any;
  private telegram: TelegramBot;
  private scanCount = 0;
  private totalOpportunities = 0;

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(RPC_URL, { name: 'arbitrum', chainId: 42161 });
    this.telegram = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
  }

  async sendTelegram(message: string) {
    try {
      await this.telegram.sendMessage(TELEGRAM_CHAT_ID, message, { parse_mode: 'Markdown' });
    } catch (e) {
      console.error('Telegram error:', e);
    }
  }

  async getUniV3Price(t0: any, t1: any, amount: BigNumber) {
    try {
      const quoter = new Contract(DEXS.UNISWAP_V3.quoter, QUOTER_ABI, this.provider);
      for (const fee of [500, 3000, 10000]) {
        try {
          const out = await quoter.callStatic.quoteExactInputSingle(t0.address, t1.address, fee, amount, 0);
          if (out.gt(0)) return { success: true, amountOut: out, dex: 'Uniswap V3', fee };
        } catch (e) { continue; }
      }
      return { success: false };
    } catch (e) {
      return { success: false };
    }
  }

  async getV2Price(factory: string, dexName: string, t0: any, t1: any, amount: BigNumber) {
    try {
      const factoryContract = new Contract(factory, V2_FACTORY_ABI, this.provider);
      const pairAddr = await factoryContract.getPair(t0.address, t1.address);
      
      if (pairAddr === ethers.constants.AddressZero) return { success: false };

      const pair = new Contract(pairAddr, V2_PAIR_ABI, this.provider);
      const [r0, r1] = await pair.getReserves();
      const token0Addr = await pair.token0();
      
      if (r0.eq(0) || r1.eq(0)) return { success: false };

      const isToken0 = token0Addr.toLowerCase() === t0.address.toLowerCase();
      const [reserveIn, reserveOut] = isToken0 ? [r0, r1] : [r1, r0];
      
      const liquidityUSD = parseFloat(ethers.utils.formatUnits(reserveOut, t1.decimals)) * 
        (t1.symbol === 'USDC' || t1.symbol === 'USDT' ? 1 : 3000);
      
      if (liquidityUSD < 50000) return { success: false, liquidityUSD };

      const amountInWithFee = amount.mul(997);
      const numerator = amountInWithFee.mul(reserveOut);
      const denominator = reserveIn.mul(1000).add(amountInWithFee);
      const amountOut = numerator.div(denominator);
      
      return { success: true, amountOut, dex: dexName, liquidityUSD };
    } catch (e) {
      return { success: false };
    }
  }

  async scan() {
    this.scanCount++;
    console.log(`\n🔍 SCAN #${this.scanCount} - ${new Date().toISOString()}`);

    const block = await this.provider.getBlockNumber();
    console.log(`📦 Block: #${block.toLocaleString()}`);

    const pairs = [
      { token0: TOKENS.USDC, token1: TOKENS.USDT, label: 'USDC/USDT' },
      { token0: TOKENS.USDC, token1: TOKENS.WETH, label: 'USDC/WETH' },
      { token0: TOKENS.WETH, token1: TOKENS.ARB, label: 'WETH/ARB' },
      { token0: TOKENS.ARB, token1: TOKENS.USDC, label: 'ARB/USDC' },
      { token0: TOKENS.USDT, token1: TOKENS.WETH, label: 'USDT/WETH' },
    ];

    let validPairs = 0;
    let opportunities: any[] = [];

    for (const pair of pairs) {
      const amount = ethers.utils.parseUnits('10000', pair.token0.decimals);

      const prices: any[] = [];

      // Check all DEXs
      const uniPrice = await this.getUniV3Price(pair.token0, pair.token1, amount);
      if (uniPrice.success) prices.push(uniPrice);

      const sushiPrice = await this.getV2Price(DEXS.SUSHISWAP.factory, 'SushiSwap', pair.token0, pair.token1, amount);
      if (sushiPrice.success) prices.push(sushiPrice);

      const camelotPrice = await this.getV2Price(DEXS.CAMELOT.factory, 'Camelot', pair.token0, pair.token1, amount);
      if (camelotPrice.success) prices.push(camelotPrice);

      if (prices.length < 2) continue;
      validPairs++;

      // Test arbitrage
      for (let i = 0; i < prices.length; i++) {
        for (let j = 0; j < prices.length; j++) {
          if (i === j) continue;

          const buyDex = prices[i];
          const sellDex = prices[j];

          const returnQuote = buyDex.dex === 'Uniswap V3' 
            ? await this.getUniV3Price(pair.token1, pair.token0, buyDex.amountOut)
            : buyDex.dex === 'SushiSwap'
            ? await this.getV2Price(DEXS.SUSHISWAP.factory, 'SushiSwap', pair.token1, pair.token0, buyDex.amountOut)
            : await this.getV2Price(DEXS.CAMELOT.factory, 'Camelot', pair.token1, pair.token0, buyDex.amountOut);

          if (!returnQuote.success) continue;

          const profit = returnQuote.amountOut.sub(amount);
          const profitFloat = parseFloat(ethers.utils.formatUnits(profit, pair.token0.decimals));
          const profitPct = (parseFloat(profit.toString()) / parseFloat(amount.toString())) * 100;

          const flashFee = 10000 * 0.0005;
          const gas = 0.5;
          const netProfit = profitFloat - flashFee - gas;

          if (netProfit >= 50) {
            opportunities.push({
              pair: pair.label,
              buyDex: buyDex.dex,
              sellDex: sellDex.dex,
              netProfit,
              profitPct,
            });
          }
        }
      }
    }

    // Send Telegram update
    const msg = this.formatTelegramMessage(block, validPairs, opportunities);
    await this.sendTelegram(msg);

    if (opportunities.length > 0) {
      this.totalOpportunities += opportunities.length;
      console.log(`🎉 FOUND ${opportunities.length} OPPORTUNITIES!`);
    } else {
      console.log(`✅ Scan complete. 0 opportunities (markets efficient)`);
    }
  }

  formatTelegramMessage(block: number, validPairs: number, opportunities: any[]): string {
    let msg = `🤖 *ARBITRAGE BOT - SCAN #${this.scanCount}*\n\n`;
    msg += `📦 Block: #${block.toLocaleString()}\n`;
    msg += `⏰ Time: ${new Date().toLocaleString()}\n`;
    msg += `🔍 Valid Pairs: ${validPairs}\n\n`;

    if (opportunities.length === 0) {
      msg += `✅ *NO OPPORTUNITIES*\n`;
      msg += `Markets are efficient right now.\n\n`;
      msg += `💡 *Bot Status:*\n`;
      msg += `• Scanning every ${SCAN_INTERVAL_MINUTES} minutes\n`;
      msg += `• Monitoring ${validPairs} high-liquidity pairs\n`;
      msg += `• Will alert when opportunities appear\n`;
    } else {
      msg += `🎉 *${opportunities.length} PROFITABLE OPPORTUNITIES!*\n\n`;
      
      for (let i = 0; i < opportunities.length; i++) {
        const opp = opportunities[i];
        msg += `📈 *Opportunity ${i + 1}*\n`;
        msg += `Pair: ${opp.pair}\n`;
        msg += `Route: ${opp.buyDex} → ${opp.sellDex}\n`;
        msg += `Net Profit: *$${opp.netProfit.toFixed(2)}*\n`;
        msg += `ROI: ${opp.profitPct.toFixed(3)}%\n\n`;
      }

      msg += `⚠️ *ADD PRIVATE_KEY TO EXECUTE*\n`;
      msg += `Set your key in .env.production to auto-execute\n`;
    }

    msg += `\n📊 *Session Stats:*\n`;
    msg += `Total Scans: ${this.scanCount}\n`;
    msg += `Total Opportunities: ${this.totalOpportunities}`;

    return msg;
  }

  async start() {
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('   🤖 FLASH LOAN ARBITRAGE BOT - MONITORING MODE');
    console.log('   Telegram: @' + TELEGRAM_CHAT_ID);
    console.log('   Scan Interval: Every ' + SCAN_INTERVAL_MINUTES + ' minutes');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    await this.sendTelegram(
      `🚀 *BOT STARTED - MONITORING MODE*\n\n` +
      `Scanning Arbitrum mainnet every ${SCAN_INTERVAL_MINUTES} minutes.\n\n` +
      `I'll alert you when profitable opportunities appear!`
    );

    // Run first scan immediately
    await this.scan();

    // Then scan every interval
    setInterval(async () => {
      try {
        await this.scan();
      } catch (error: any) {
        console.error('Scan error:', error.message);
        await this.sendTelegram(`❌ Scan error: ${error.message}`);
      }
    }, SCAN_INTERVAL_MINUTES * 60 * 1000);

    console.log('\n✅ Bot running. Press Ctrl+C to stop.\n');
  }
}

// Start the bot
const bot = new MonitoringBot();
bot.start().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
