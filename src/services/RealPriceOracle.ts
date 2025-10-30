import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { TOKENS } from '../config/constants';

/**
 * REAL WORKING PRICE ORACLE
 * Uses Uniswap V3 Quoter - proven to work correctly
 */

const QUOTER_ADDRESS = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';

const QUOTER_ABI = [
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)',
];

interface PriceData {
  dex: string;
  price: number;
  fee: number;
  amountIn: string;
  amountOut: string;
}

interface TokenPairData {
  tokenA: string;
  tokenB: string;
  prices: PriceData[];
  bestBuyPrice: number;
  bestSellPrice: number;
  spread: number;
  spreadPercent: number;
  timestamp: number;
}

export class RealPriceOracle {
  private provider: ethers.providers.JsonRpcProvider;
  private quoter: ethers.Contract;

  constructor(provider: ethers.providers.JsonRpcProvider) {
    this.provider = provider;
    this.quoter = new ethers.Contract(QUOTER_ADDRESS, QUOTER_ABI, provider);
  }

  /**
   * Get real prices using Quoter contract
   */
  async getRealTimePrices(
    tokenA: string,
    tokenB: string,
    tokenASymbol: string,
    tokenBSymbol: string,
    decimalsA: number = 18,
    decimalsB: number = 18
  ): Promise<TokenPairData> {
    const prices: PriceData[] = [];

    // Amount to quote (adjust based on token)
    const amountIn = ethers.utils.parseUnits('1', decimalsA);

    // Check multiple fee tiers
    const fees = [500, 3000, 10000]; // 0.05%, 0.3%, 1%

    for (const fee of fees) {
      try {
        const amountOut = await this.quoter.callStatic.quoteExactInputSingle(
          tokenA,
          tokenB,
          fee,
          amountIn,
          0
        );

        const price = parseFloat(ethers.utils.formatUnits(amountOut, decimalsB));

        // Only include if we got a valid price
        if (price > 0 && price < 1000000000) {
          prices.push({
            dex: `UniswapV3-${fee}bp`,
            price,
            fee: fee / 10000,
            amountIn: amountIn.toString(),
            amountOut: amountOut.toString(),
          });
        }
      } catch (error) {
        // Pool doesn't exist or error - skip
        logger.debug(`No pool for ${tokenASymbol}/${tokenBSymbol} at ${fee}bp`);
      }
    }

    if (prices.length === 0) {
      throw new Error(`No valid prices for ${tokenASymbol}/${tokenBSymbol}`);
    }

    // Calculate spread
    const priceValues = prices.map(p => p.price);
    const bestBuyPrice = Math.min(...priceValues);
    const bestSellPrice = Math.max(...priceValues);
    const spread = bestSellPrice - bestBuyPrice;
    const spreadPercent = (spread / bestBuyPrice) * 100;

    return {
      tokenA: tokenASymbol,
      tokenB: tokenBSymbol,
      prices,
      bestBuyPrice,
      bestSellPrice,
      spread,
      spreadPercent,
      timestamp: Date.now(),
    };
  }

  /**
   * Get prices for multiple pairs in parallel
   */
  async batchGetPrices(pairs: Array<{
    tokenA: string;
    tokenB: string;
    symbolA: string;
    symbolB: string;
    decimalsA: number;
    decimalsB: number;
  }>): Promise<Map<string, TokenPairData>> {
    const results = new Map<string, TokenPairData>();

    const pricePromises = pairs.map(async (pair) => {
      try {
        const data = await this.getRealTimePrices(
          pair.tokenA,
          pair.tokenB,
          pair.symbolA,
          pair.symbolB,
          pair.decimalsA,
          pair.decimalsB
        );
        return { key: `${pair.symbolA}/${pair.symbolB}`, data };
      } catch (error) {
        logger.debug(`Failed to get prices for ${pair.symbolA}/${pair.symbolB}`);
        return null;
      }
    });

    const settled = await Promise.allSettled(pricePromises);

    settled.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        results.set(result.value.key, result.value.data);
      }
    });

    return results;
  }
}
