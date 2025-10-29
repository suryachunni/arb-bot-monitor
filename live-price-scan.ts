/**
 * ═══════════════════════════════════════════════════════════════════
 * LIVE PRICE SCANNER - Real-time prices across all DEXs
 * Shows actual prices and spreads
 * ═══════════════════════════════════════════════════════════════════
 */

import { ethers, Contract, BigNumber } from 'ethers';

const RPC_URL = 'https://arb1.arbitrum.io/rpc';

const TOKENS = {
  WETH: { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18, symbol: 'WETH' },
  USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6, symbol: 'USDC' },
  ARB: { address: '0x912CE59144191C1204E64559FE8253a0e49E6548', decimals: 18, symbol: 'ARB' },
  WBTC: { address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', decimals: 8, symbol: 'WBTC' },
  LINK: { address: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4', decimals: 18, symbol: 'LINK' },
  USDT: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6, symbol: 'USDT' },
};

const DEXS = {
  UNISWAP_V3: { name: 'Uniswap V3', quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6' },
  SUSHISWAP: { name: 'SushiSwap', factory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4' },
  CAMELOT: { name: 'Camelot', factory: '0x6EcCab422D763aC031210895C81787E87B43A652' },
};

const QUOTER_ABI = ['function quoteExactInputSingle(address,address,uint24,uint256,uint160) external returns (uint256)'];
const V2_FACTORY_ABI = ['function getPair(address,address) external view returns (address)'];
const V2_PAIR_ABI = [
  'function getReserves() external view returns (uint112,uint112,uint32)',
  'function token0() external view returns (address)',
];

interface PriceData {
  dex: string;
  price: number;
  amountOut: string;
  liquidity?: number;
  available: boolean;
}

async function getUniV3Price(provider: any, t0: any, t1: any, amount: BigNumber): Promise<PriceData> {
  try {
    const quoter = new Contract(DEXS.UNISWAP_V3.quoter, QUOTER_ABI, provider);
    
    for (const fee of [500, 3000, 10000]) {
      try {
        const out = await quoter.callStatic.quoteExactInputSingle(t0.address, t1.address, fee, amount, 0);
        if (out.gt(0)) {
          const price = parseFloat(ethers.utils.formatUnits(out, t1.decimals)) / 
                       parseFloat(ethers.utils.formatUnits(amount, t0.decimals));
          return {
            dex: 'Uniswap V3',
            price,
            amountOut: ethers.utils.formatUnits(out, t1.decimals),
            available: true,
          };
        }
      } catch (e) { continue; }
    }
    return { dex: 'Uniswap V3', price: 0, amountOut: '0', available: false };
  } catch (e) {
    return { dex: 'Uniswap V3', price: 0, amountOut: '0', available: false };
  }
}

async function getV2Price(provider: any, factory: string, dexName: string, t0: any, t1: any, amount: BigNumber): Promise<PriceData> {
  try {
    const factoryContract = new Contract(factory, V2_FACTORY_ABI, provider);
    const pairAddr = await factoryContract.getPair(t0.address, t1.address);
    
    if (pairAddr === ethers.constants.AddressZero) {
      return { dex: dexName, price: 0, amountOut: '0', available: false };
    }

    const pair = new Contract(pairAddr, V2_PAIR_ABI, provider);
    const [r0, r1] = await pair.getReserves();
    const token0Addr = await pair.token0();
    
    if (r0.eq(0) || r1.eq(0)) {
      return { dex: dexName, price: 0, amountOut: '0', available: false };
    }

    const isToken0 = token0Addr.toLowerCase() === t0.address.toLowerCase();
    const [reserveIn, reserveOut] = isToken0 ? [r0, r1] : [r1, r0];
    
    const liquidity = parseFloat(ethers.utils.formatUnits(reserveOut, t1.decimals));

    const amountInWithFee = amount.mul(997);
    const numerator = amountInWithFee.mul(reserveOut);
    const denominator = reserveIn.mul(1000).add(amountInWithFee);
    const amountOut = numerator.div(denominator);
    
    const price = parseFloat(ethers.utils.formatUnits(amountOut, t1.decimals)) / 
                 parseFloat(ethers.utils.formatUnits(amount, t0.decimals));
    
    return {
      dex: dexName,
      price,
      amountOut: ethers.utils.formatUnits(amountOut, t1.decimals),
      liquidity,
      available: true,
    };
  } catch (e) {
    return { dex: dexName, price: 0, amountOut: '0', available: false };
  }
}

async function scanLivePrices() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('   📊 LIVE PRICE SCANNER - REAL-TIME MARKET DATA');
  console.log('   Scanning prices across all DEXs on Arbitrum');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('\n');

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL, { name: 'arbitrum', chainId: 42161 });

  const block = await provider.getBlockNumber();
  
  console.log(`✅ Connected to Arbitrum Mainnet`);
  console.log(`📦 Block: #${block.toLocaleString()}`);
  console.log(`⏰ Time: ${new Date().toISOString()}`);
  console.log(`\n`);

  const pairs = [
    { t0: TOKENS.WETH, t1: TOKENS.USDC, label: 'WETH/USDC', testAmount: '1' },
    { t0: TOKENS.WETH, t1: TOKENS.ARB, label: 'WETH/ARB', testAmount: '1' },
    { t0: TOKENS.ARB, t1: TOKENS.USDC, label: 'ARB/USDC', testAmount: '1000' },
    { t0: TOKENS.WETH, t1: TOKENS.WBTC, label: 'WETH/WBTC', testAmount: '1' },
    { t0: TOKENS.WETH, t1: TOKENS.LINK, label: 'WETH/LINK', testAmount: '1' },
    { t0: TOKENS.WETH, t1: TOKENS.USDT, label: 'WETH/USDT', testAmount: '1' },
  ];

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('   💰 LIVE PRICES BY PAIR');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    
    console.log(`\n┌─────────────────────────────────────────────────────────────────┐`);
    console.log(`│ ${i + 1}. ${pair.label}`);
    console.log(`│ Testing: ${pair.testAmount} ${pair.t0.symbol} → ${pair.t1.symbol}`);
    console.log(`└─────────────────────────────────────────────────────────────────┘\n`);

    const amount = ethers.utils.parseUnits(pair.testAmount, pair.t0.decimals);

    // Get prices from all DEXs
    const [uniPrice, sushiPrice, camelotPrice] = await Promise.all([
      getUniV3Price(provider, pair.t0, pair.t1, amount),
      getV2Price(provider, DEXS.SUSHISWAP.factory, 'SushiSwap', pair.t0, pair.t1, amount),
      getV2Price(provider, DEXS.CAMELOT.factory, 'Camelot', pair.t0, pair.t1, amount),
    ]);

    const prices = [uniPrice, sushiPrice, camelotPrice].filter(p => p.available);

    if (prices.length === 0) {
      console.log(`   ❌ No liquidity available on any DEX\n`);
      continue;
    }

    console.log(`   📊 LIVE PRICES:\n`);

    for (const p of prices) {
      const priceStr = p.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
      const outStr = parseFloat(p.amountOut).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
      
      console.log(`   ${p.dex.padEnd(15)} ${pair.testAmount} ${pair.t0.symbol} → ${outStr} ${pair.t1.symbol}`);
      console.log(`   ${''.padEnd(15)} Price: 1 ${pair.t0.symbol} = ${priceStr} ${pair.t1.symbol}`);
      
      if (p.liquidity) {
        const liqStr = p.liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 });
        console.log(`   ${''.padEnd(15)} Liquidity: ${liqStr} ${pair.t1.symbol}`);
      }
      console.log('');
    }

    // Calculate arbitrage opportunity
    if (prices.length >= 2) {
      const sortedPrices = [...prices].sort((a, b) => a.price - b.price);
      const buyDex = sortedPrices[0];
      const sellDex = sortedPrices[sortedPrices.length - 1];
      
      const spread = ((sellDex.price - buyDex.price) / buyDex.price) * 100;
      
      console.log(`   💡 ARBITRAGE ANALYSIS:\n`);
      console.log(`   Best Buy:  ${buyDex.dex} @ ${buyDex.price.toFixed(6)} ${pair.t1.symbol}`);
      console.log(`   Best Sell: ${sellDex.dex} @ ${sellDex.price.toFixed(6)} ${pair.t1.symbol}`);
      console.log(`   Spread: ${spread >= 0 ? '+' : ''}${spread.toFixed(4)}%`);
      
      if (spread > 0.5) {
        console.log(`   ✅ POTENTIAL OPPORTUNITY (>${0.5}% spread)`);
      } else if (spread > 0.1) {
        console.log(`   ⚠️  Small spread (needs large volume)`);
      } else {
        console.log(`   ❌ Spread too small (not profitable after fees)`);
      }
    }

    console.log('');
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('   ✅ LIVE SCAN COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log('📌 NOTES:\n');
  console.log('• All prices are LIVE from Arbitrum mainnet');
  console.log('• Prices update every block (~0.25 seconds)');
  console.log('• Spreads show potential arbitrage opportunities');
  console.log('• Profitable trades need >0.5% spread after fees\n');
}

scanLivePrices().then(() => process.exit(0));
