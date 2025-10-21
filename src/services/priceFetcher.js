import { ethers } from 'ethers';
import {
  UNISWAP_V2_ROUTER_ABI,
  UNISWAP_V2_FACTORY_ABI,
  UNISWAP_V2_PAIR_ABI,
  UNISWAP_V3_QUOTER_ABI,
  UNISWAP_V3_FACTORY_ABI,
  UNISWAP_V3_POOL_ABI
} from '../config/abis.js';
import { DEXS, TOKENS } from '../config/tokens.js';

export class PriceFetcher {
  constructor(provider) {
    this.provider = provider;
    this.initializeContracts();
  }

  initializeContracts() {
    // Uniswap V3
    this.uniV3Quoter = new ethers.Contract(
      DEXS.UNISWAP_V3.quoter,
      UNISWAP_V3_QUOTER_ABI,
      this.provider
    );
    this.uniV3Factory = new ethers.Contract(
      DEXS.UNISWAP_V3.factory,
      UNISWAP_V3_FACTORY_ABI,
      this.provider
    );

    // Uniswap V2-style (Sushiswap, Camelot)
    this.sushiRouter = new ethers.Contract(
      DEXS.SUSHISWAP.router,
      UNISWAP_V2_ROUTER_ABI,
      this.provider
    );
    this.sushiFactory = new ethers.Contract(
      DEXS.SUSHISWAP.factory,
      UNISWAP_V2_FACTORY_ABI,
      this.provider
    );

    this.camelotRouter = new ethers.Contract(
      DEXS.CAMELOT.router,
      UNISWAP_V2_ROUTER_ABI,
      this.provider
    );
    this.camelotFactory = new ethers.Contract(
      DEXS.CAMELOT.factory,
      UNISWAP_V2_FACTORY_ABI,
      this.provider
    );
  }

  // Get price from Uniswap V3
  async getUniswapV3Price(tokenIn, tokenOut, amountIn) {
    try {
      const tokenInAddress = TOKENS[tokenIn].address;
      const tokenOutAddress = TOKENS[tokenOut].address;
      const fees = [500, 3000, 10000]; // 0.05%, 0.3%, 1%

      let bestQuote = null;
      let bestFee = null;

      for (const fee of fees) {
        try {
          // Check if pool exists
          const poolAddress = await this.uniV3Factory.getPool(
            tokenInAddress,
            tokenOutAddress,
            fee
          );

          if (poolAddress === ethers.ZeroAddress) continue;

          // Get quote
          const quote = await this.uniV3Quoter.quoteExactInputSingle.staticCall(
            tokenInAddress,
            tokenOutAddress,
            fee,
            amountIn,
            0
          );

          if (!bestQuote || quote > bestQuote) {
            bestQuote = quote;
            bestFee = fee;
          }
        } catch (err) {
          // Pool doesn't exist or no liquidity
          continue;
        }
      }

      if (bestQuote) {
        return {
          amountOut: bestQuote,
          price: Number(bestQuote) / Number(amountIn),
          fee: bestFee,
          dex: 'Uniswap V3'
        };
      }

      return null;
    } catch (error) {
      console.error(`Error getting Uniswap V3 price for ${tokenIn}/${tokenOut}:`, error.message);
      return null;
    }
  }

  // Get price from V2-style DEX
  async getV2StylePrice(tokenIn, tokenOut, amountIn, dexName) {
    try {
      const router = dexName === 'Sushiswap' ? this.sushiRouter : this.camelotRouter;
      const factory = dexName === 'Sushiswap' ? this.sushiFactory : this.camelotFactory;
      
      const tokenInAddress = TOKENS[tokenIn].address;
      const tokenOutAddress = TOKENS[tokenOut].address;

      // Check if pair exists
      const pairAddress = await factory.getPair(tokenInAddress, tokenOutAddress);
      if (pairAddress === ethers.ZeroAddress) {
        return null;
      }

      // Get quote
      const path = [tokenInAddress, tokenOutAddress];
      const amounts = await router.getAmountsOut(amountIn, path);

      return {
        amountOut: amounts[1],
        price: Number(amounts[1]) / Number(amountIn),
        dex: dexName
      };
    } catch (error) {
      console.error(`Error getting ${dexName} price for ${tokenIn}/${tokenOut}:`, error.message);
      return null;
    }
  }

  // Get prices from all DEXs
  async getAllPrices(tokenIn, tokenOut, amountIn) {
    const prices = [];

    // Fetch from all DEXs in parallel
    const [uniV3Price, sushiPrice, camelotPrice] = await Promise.all([
      this.getUniswapV3Price(tokenIn, tokenOut, amountIn),
      this.getV2StylePrice(tokenIn, tokenOut, amountIn, 'Sushiswap'),
      this.getV2StylePrice(tokenIn, tokenOut, amountIn, 'Camelot')
    ]);

    if (uniV3Price) prices.push(uniV3Price);
    if (sushiPrice) prices.push(sushiPrice);
    if (camelotPrice) prices.push(camelotPrice);

    return prices;
  }

  // Get best price across all DEXs
  async getBestPrice(tokenIn, tokenOut, amountIn, type = 'buy') {
    const prices = await this.getAllPrices(tokenIn, tokenOut, amountIn);

    if (prices.length === 0) {
      return null;
    }

    // For buying, we want the maximum amountOut (best rate)
    // For selling, we want the minimum amountIn (best rate to sell at)
    const bestPrice = prices.reduce((best, current) => {
      if (type === 'buy') {
        return current.amountOut > best.amountOut ? current : best;
      }
      return current.amountOut < best.amountOut ? current : best;
    });

    return bestPrice;
  }

  // Format price for display
  formatPrice(amount, decimals) {
    return Number(ethers.formatUnits(amount, decimals));
  }

  // Get human-readable price
  async getReadablePrice(tokenIn, tokenOut, displayAmount = '1') {
    const tokenInDecimals = TOKENS[tokenIn].decimals;
    const tokenOutDecimals = TOKENS[tokenOut].decimals;
    
    const amountIn = ethers.parseUnits(displayAmount, tokenInDecimals);
    const prices = await this.getAllPrices(tokenIn, tokenOut, amountIn);

    return prices.map(p => ({
      dex: p.dex,
      fee: p.fee,
      price: this.formatPrice(p.amountOut, tokenOutDecimals),
      pricePerUnit: this.formatPrice(p.amountOut, tokenOutDecimals) / Number(displayAmount),
      raw: p
    }));
  }
}
