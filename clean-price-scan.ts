/**
 * ═══════════════════════════════════════════════════════════════════
 * CLEAN PRICE SCAN - ONLY RELIABLE DEXS
 * Uniswap V3 + SushiSwap (Camelot removed - bad liquidity)
 * ═══════════════════════════════════════════════════════════════════
 */

import { ethers, Contract, BigNumber } from 'ethers';

const RPC_URL = 'https://arb1.arbitrum.io/rpc';

const TOKENS = {
  WETH: { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18, symbol: 'WETH' },
  USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6, symbol: 'USDC' },
  ARB: { address: '0x912CE59144191C1204E64559FE8253a0e49E6548', decimals: 18, symbol: 'ARB' },
  USDT: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6, symbol: 'USDT' },
};

const DEXS = {
  UNISWAP_V3: { quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6' },
  SUSHISWAP: { factory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4' },
};

const QUOTER_ABI = ['function quoteExactInputSingle(address,address,uint24,uint256,uint160) external returns (uint256)'];
const V2_FACTORY_ABI = ['function getPair(address,address) external view returns (address)'];
const V2_PAIR_ABI = [
  'function getReserves() external view returns (uint112,uint112,uint32)',
  'function token0() external view returns (address)',
];

async function cleanScan() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('   ✅ CLEAN PRICE SCAN - RELIABLE DEXS ONLY');
  console.log('   Uniswap V3 + SushiSwap (Camelot REMOVED)');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('\n');

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL, { name: 'arbitrum', chainId: 42161 });
  const block = await provider.getBlockNumber();
  
  console.log(`📦 Block: #${block.toLocaleString()}`);
  console.log(`⏰ Time: ${new Date().toISOString()}\n`);

  const pairs = [
    { t0: TOKENS.WETH, t1: TOKENS.USDC, label: 'WETH/USDC', amount: '1' },
    { t0: TOKENS.WETH, t1: TOKENS.ARB, label: 'WETH/ARB', amount: '1' },
    { t0: TOKENS.ARB, t1: TOKENS.USDC, label: 'ARB/USDC', amount: '1000' },
    { t0: TOKENS.WETH, t1: TOKENS.USDT, label: 'WETH/USDT', amount: '1' },
  ];

  console.log('═══════════════════════════════════════════════════════════════════\n');

  for (const pair of pairs) {
    console.log(`\n🔍 ${pair.label} (Testing ${pair.amount} ${pair.t0.symbol})\n`);
    
    const amount = ethers.utils.parseUnits(pair.amount, pair.t0.decimals);
    
    // Uniswap V3
    let uniPrice = null;
    try {
      const quoter = new Contract(DEXS.UNISWAP_V3.quoter, QUOTER_ABI, provider);
      for (const fee of [500, 3000, 10000]) {
        try {
          const out = await quoter.callStatic.quoteExactInputSingle(pair.t0.address, pair.t1.address, fee, amount, 0);
          if (out.gt(0)) {
            uniPrice = parseFloat(ethers.utils.formatUnits(out, pair.t1.decimals));
            console.log(`   ✅ Uniswap V3: ${uniPrice.toFixed(6)} ${pair.t1.symbol}`);
            break;
          }
        } catch (e) { continue; }
      }
    } catch (e) {}
    
    if (!uniPrice) console.log(`   ❌ Uniswap V3: Not available`);
    
    // SushiSwap
    let sushiPrice = null;
    let sushiLiquidity = 0;
    try {
      const factory = new Contract(DEXS.SUSHISWAP.factory, V2_FACTORY_ABI, provider);
      const pairAddr = await factory.getPair(pair.t0.address, pair.t1.address);
      
      if (pairAddr !== ethers.constants.AddressZero) {
        const pairContract = new Contract(pairAddr, V2_PAIR_ABI, provider);
        const [r0, r1] = await pairContract.getReserves();
        const token0Addr = await pairContract.token0();
        
        if (r0.gt(0) && r1.gt(0)) {
          const isToken0 = token0Addr.toLowerCase() === pair.t0.address.toLowerCase();
          const [reserveIn, reserveOut] = isToken0 ? [r0, r1] : [r1, r0];
          
          sushiLiquidity = parseFloat(ethers.utils.formatUnits(reserveOut, pair.t1.decimals));
          
          const amountInWithFee = amount.mul(997);
          const numerator = amountInWithFee.mul(reserveOut);
          const denominator = reserveIn.mul(1000).add(amountInWithFee);
          const amountOut = numerator.div(denominator);
          
          sushiPrice = parseFloat(ethers.utils.formatUnits(amountOut, pair.t1.decimals));
          
          console.log(`   ✅ SushiSwap: ${sushiPrice.toFixed(6)} ${pair.t1.symbol}`);
          console.log(`      Liquidity: ${sushiLiquidity.toLocaleString(undefined, {maximumFractionDigits: 0})} ${pair.t1.symbol}`);
        }
      }
    } catch (e) {}
    
    if (!sushiPrice) console.log(`   ❌ SushiSwap: Not available`);
    
    // Arbitrage analysis
    if (uniPrice && sushiPrice) {
      const spread = Math.abs(uniPrice - sushiPrice);
      const spreadPct = (spread / Math.min(uniPrice, sushiPrice)) * 100;
      
      console.log(`\n   💰 ARBITRAGE:`);
      console.log(`      Spread: ${spreadPct.toFixed(4)}%`);
      
      if (spreadPct > 0.5) {
        console.log(`      ✅ Potentially profitable (>${0.5}%)`);
      } else {
        console.log(`      ❌ Too small (need >0.5% after fees)`);
      }
    } else if (!uniPrice && !sushiPrice) {
      console.log(`\n   ❌ NO LIQUIDITY on either DEX`);
    } else {
      console.log(`\n   ⚠️  Only 1 DEX available (need 2+ for arbitrage)`);
    }
    
    console.log('');
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('   ✅ CLEAN SCAN COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  console.log('📌 All prices from RELIABLE DEXs with REAL liquidity');
  console.log('📌 Camelot removed - insufficient liquidity on most pairs\n');
}

cleanScan().then(() => process.exit(0));
