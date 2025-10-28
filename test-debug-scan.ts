import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * DEBUG SCAN - See what's being filtered out
 */

async function debugScan() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║         🔍 DEBUG SCAN - SHOW ALL SPREADS 🔍                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  const provider = new ethers.providers.JsonRpcProvider(
    process.env.RPC_URL || 'https://arb1.arbitrum.io/rpc'
  );

  const TOKENS: any = {
    WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    WBTC: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
  };

  const PAIRS = [
    ['WETH', 'USDC'],
    ['WETH', 'USDT'],
    ['WETH', 'ARB'],
    ['WETH', 'WBTC'],
  ];

  const DECIMALS: any = {
    WETH: 18, USDC: 6, USDT: 6, ARB: 18, WBTC: 8
  };

  const QUOTER = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';
  const QUOTER_ABI = [
    'function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
  ];
  const quoter = new ethers.Contract(QUOTER, QUOTER_ABI, provider);

  const FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
  const FACTORY_ABI = ['function getPool(address, address, uint24) view returns (address)'];
  const factory = new ethers.Contract(FACTORY, FACTORY_ABI, provider);

  const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];

  for (const [symbolA, symbolB] of PAIRS) {
    console.log(`\n🔍 ${symbolA}/${symbolB}:`);
    console.log(`${'─'.repeat(67)}`);

    const tokenA = TOKENS[symbolA];
    const tokenB = TOKENS[symbolB];
    const decimalsA = DECIMALS[symbolA];
    const decimalsB = DECIMALS[symbolB];
    const amountIn = ethers.utils.parseUnits('1', decimalsA);

    const fees = [500, 3000, 10000];
    const feeLabels = ['0.05%', '0.3%', '1%'];
    const feeBps = [5, 30, 100];

    const poolData: any[] = [];

    for (let i = 0; i < fees.length; i++) {
      try {
        const poolAddress = await factory.getPool(tokenA, tokenB, fees[i]);
        
        if (poolAddress === ethers.constants.AddressZero) {
          console.log(`   ${feeLabels[i]}: No pool`);
          continue;
        }

        const result = await quoter.callStatic.quoteExactInputSingle({
          tokenIn: tokenA,
          tokenOut: tokenB,
          amountIn,
          fee: fees[i],
          sqrtPriceLimitX96: 0,
        });

        const price = parseFloat(ethers.utils.formatUnits(result.amountOut, decimalsB));

        // Get REAL reserves
        const token0Contract = new ethers.Contract(tokenA, ERC20_ABI, provider);
        const token1Contract = new ethers.Contract(tokenB, ERC20_ABI, provider);
        const [balance0, balance1] = await Promise.all([
          token0Contract.balanceOf(poolAddress),
          token1Contract.balanceOf(poolAddress)
        ]);

        const reserve0 = parseFloat(ethers.utils.formatUnits(balance0, decimalsA));
        const reserve1 = parseFloat(ethers.utils.formatUnits(balance1, decimalsB));

        // Calculate liquidity in USD
        const prices: any = { WETH: 3800, USDC: 1, USDT: 1, ARB: 0.30, WBTC: 108000 };
        const liquidityUSD = (reserve0 * prices[symbolA] || 0) + (reserve1 * prices[symbolB] || 0);

        poolData.push({ 
          fee: feeLabels[i], 
          feeBps: feeBps[i],
          price, 
          reserve0, 
          reserve1, 
          liquidityUSD,
          poolAddress 
        });

        console.log(`   ${feeLabels[i]}: ${price.toFixed(6)} | Liq: $${(liquidityUSD/1000000).toFixed(1)}M`);

      } catch (e) {
        console.log(`   ${feeLabels[i]}: Error`);
      }
    }

    // Find spreads
    if (poolData.length >= 2) {
      console.log(`\n   📊 SPREADS FOUND:`);
      
      for (let i = 0; i < poolData.length; i++) {
        for (let j = i + 1; j < poolData.length; j++) {
          const p1 = poolData[i];
          const p2 = poolData[j];
          
          const spread = Math.abs(p1.price - p2.price) / Math.min(p1.price, p2.price) * 100;
          const buyFee = p1.price < p2.price ? p1.fee : p2.fee;
          const sellFee = p1.price < p2.price ? p2.fee : p1.fee;
          const buyFeeBps = p1.price < p2.price ? p1.feeBps : p2.feeBps;
          const sellFeeBps = p1.price < p2.price ? p2.feeBps : p1.feeBps;

          const tradeSize = 50000;
          const grossProfit = (tradeSize * spread) / 100;
          const flashLoanFee = tradeSize * 0.0009;
          const dexFees = (tradeSize * (buyFeeBps + sellFeeBps)) / 10000;
          const gas = 2.20;
          
          // Use smaller liquidity for price impact
          const buyLiq = p1.price < p2.price ? p1.liquidityUSD : p2.liquidityUSD;
          const sellLiq = p1.price < p2.price ? p2.liquidityUSD : p1.liquidityUSD;
          const minLiq = Math.min(buyLiq, sellLiq);
          
          // Calculate price impact
          const priceImpact = (tradeSize / minLiq) * 100;
          const slippage = (tradeSize * priceImpact) / 100;
          
          const totalCosts = flashLoanFee + dexFees + gas + slippage;
          const netProfit = grossProfit - totalCosts;

          console.log(`      ${buyFee} → ${sellFee}: ${spread.toFixed(2)}% | NET: $${netProfit.toFixed(0)} | Impact: ${priceImpact.toFixed(2)}%`);
        }
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════\n');
}

debugScan().catch(console.error);
