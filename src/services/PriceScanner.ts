import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { TOKENS, DEX_ROUTERS, UNISWAP_V3_FEES } from '../config/constants';
import { config } from '../config/config';

// ABIs (minimal for price fetching)
const UNISWAP_V3_QUOTER_ABI = [
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)',
];

const UNISWAP_V2_ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)',
];

const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint256)',
];

export interface TokenPrice {
  token: string;
  tokenAddress: string;
  dex: string;
  price: number;
  liquidity: number;
  timestamp: number;
}

export interface PricePair {
  tokenA: string;
  tokenB: string;
  tokenAAddress: string;
  tokenBAddress: string;
  priceAtoB: number;
  priceBtoA: number;
  dex: string;
  fee?: number;
  timestamp: number;
}

export class PriceScanner {
  private provider: ethers.providers.JsonRpcProvider;
  private uniswapV3Quoter: ethers.Contract;
  private sushiswapRouter: ethers.Contract;
  private priceCache: Map<string, PricePair[]> = new Map();
  private tokenDecimals: Map<string, number> = new Map();

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.network.rpcUrl);
    
    // Uniswap V3 Quoter on Arbitrum
    const quoterAddress = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';
    this.uniswapV3Quoter = new ethers.Contract(quoterAddress, UNISWAP_V3_QUOTER_ABI, this.provider);
    
    // SushiSwap Router
    this.sushiswapRouter = new ethers.Contract(DEX_ROUTERS.SUSHISWAP, UNISWAP_V2_ROUTER_ABI, this.provider);
    
    // Camelot removed - focus on reliable DEXs only
  }

  /**
   * Get token decimals
   */
  async getTokenDecimals(tokenAddress: string): Promise<number> {
    if (this.tokenDecimals.has(tokenAddress)) {
      return this.tokenDecimals.get(tokenAddress)!;
    }

    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    const decimals = await tokenContract.decimals();
    this.tokenDecimals.set(tokenAddress, decimals);
    return decimals;
  }

  /**
   * Get price on Uniswap V3 for a specific fee tier
   */
  async getUniswapV3Price(
    tokenIn: string,
    tokenOut: string,
    amountIn: ethers.BigNumber,
    fee: number
  ): Promise<ethers.BigNumber | null> {
    try {
      const amountOut = await this.uniswapV3Quoter.callStatic.quoteExactInputSingle(
        tokenIn,
        tokenOut,
        fee,
        amountIn,
        0
      );
      return amountOut;
    } catch (error) {
      // Pool might not exist for this fee tier
      return null;
    }
  }

  /**
   * Get best price on Uniswap V3 across all fee tiers
   */
  async getBestUniswapV3Price(
    tokenIn: string,
    tokenOut: string,
    amountIn: ethers.BigNumber
  ): Promise<{ amountOut: ethers.BigNumber; fee: number } | null> {
    const fees = [UNISWAP_V3_FEES.LOW, UNISWAP_V3_FEES.MEDIUM, UNISWAP_V3_FEES.HIGH];
    let bestPrice: ethers.BigNumber | null = null;
    let bestFee = fees[0];

    for (const fee of fees) {
      const price = await this.getUniswapV3Price(tokenIn, tokenOut, amountIn, fee);
      if (price && (!bestPrice || price.gt(bestPrice))) {
        bestPrice = price;
        bestFee = fee;
      }
    }

    if (!bestPrice) return null;

    return { amountOut: bestPrice, fee: bestFee };
  }

  /**
   * Get price on Uniswap V2 compatible DEX
   */
  async getUniswapV2Price(
    router: ethers.Contract,
    tokenIn: string,
    tokenOut: string,
    amountIn: ethers.BigNumber
  ): Promise<ethers.BigNumber | null> {
    try {
      const path = [tokenIn, tokenOut];
      const amounts = await router.getAmountsOut(amountIn, path);
      return amounts[1];
    } catch (error) {
      return null;
    }
  }

  /**
   * Scan prices for a token pair across all DEXs
   */
  async scanTokenPair(tokenA: string, tokenB: string, tokenASymbol: string, tokenBSymbol: string): Promise<PricePair[]> {
    const prices: PricePair[] = [];
    
    // Get token decimals
    const decimalsA = await this.getTokenDecimals(tokenA);
    const decimalsB = await this.getTokenDecimals(tokenB);
    
    // Use 1 token as base amount
    const baseAmount = ethers.utils.parseUnits('1', decimalsA);
    
    // Scan Uniswap V3
    if (config.dex.enableUniswapV3) {
      try {
        // A to B
        const priceAtoB = await this.getBestUniswapV3Price(tokenA, tokenB, baseAmount);
        // B to A  
        const baseBAmount = ethers.utils.parseUnits('1', decimalsB);
        const priceBtoA = await this.getBestUniswapV3Price(tokenB, tokenA, baseBAmount);
        
        if (priceAtoB && priceBtoA) {
          prices.push({
            tokenA: tokenASymbol,
            tokenB: tokenBSymbol,
            tokenAAddress: tokenA,
            tokenBAddress: tokenB,
            priceAtoB: parseFloat(ethers.utils.formatUnits(priceAtoB.amountOut, decimalsB)),
            priceBtoA: parseFloat(ethers.utils.formatUnits(priceBtoA.amountOut, decimalsA)),
            dex: 'UniswapV3',
            fee: priceAtoB.fee,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        logger.debug(`Failed to get Uniswap V3 price for ${tokenASymbol}/${tokenBSymbol}`);
      }
    }
    
    // Scan SushiSwap
    if (config.dex.enableSushiSwap) {
      try {
        const priceAtoB = await this.getUniswapV2Price(this.sushiswapRouter, tokenA, tokenB, baseAmount);
        const baseBAmount = ethers.utils.parseUnits('1', decimalsB);
        const priceBtoA = await this.getUniswapV2Price(this.sushiswapRouter, tokenB, tokenA, baseBAmount);
        
        if (priceAtoB && priceBtoA) {
          prices.push({
            tokenA: tokenASymbol,
            tokenB: tokenBSymbol,
            tokenAAddress: tokenA,
            tokenBAddress: tokenB,
            priceAtoB: parseFloat(ethers.utils.formatUnits(priceAtoB, decimalsB)),
            priceBtoA: parseFloat(ethers.utils.formatUnits(priceBtoA, decimalsA)),
            dex: 'SushiSwap',
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        logger.debug(`Failed to get SushiSwap price for ${tokenASymbol}/${tokenBSymbol}`);
      }
    }
    
    // Camelot removed - unreliable, focus on Uniswap V3 + SushiSwap only
    
    return prices;
  }

  /**
   * Scan all configured token pairs
   */
  async scanAllPairs(tokenPairs: string[][]): Promise<Map<string, PricePair[]>> {
    const results = new Map<string, PricePair[]>();
    
    logger.info(`Starting price scan for ${tokenPairs.length} token pairs...`);
    
    const scanPromises = tokenPairs.map(async ([symbolA, symbolB]) => {
      const tokenA = (TOKENS as any)[symbolA];
      const tokenB = (TOKENS as any)[symbolB];
      
      if (!tokenA || !tokenB) {
        logger.warn(`Token not found: ${symbolA} or ${symbolB}`);
        return;
      }
      
      const prices = await this.scanTokenPair(tokenA, tokenB, symbolA, symbolB);
      if (prices.length > 0) {
        const pairKey = `${symbolA}-${symbolB}`;
        results.set(pairKey, prices);
        logger.debug(`Scanned ${symbolA}/${symbolB}: ${prices.length} DEXs`);
      }
    });
    
    await Promise.all(scanPromises);
    
    logger.info(`Price scan complete. Found prices for ${results.size} pairs`);
    this.priceCache = results;
    
    return results;
  }

  /**
   * Get cached prices
   */
  getCachedPrices(): Map<string, PricePair[]> {
    return this.priceCache;
  }

  /**
   * Get real-time price for specific pair and DEX
   */
  async getRealTimePrice(
    tokenIn: string,
    tokenOut: string,
    dex: string,
    amountIn: ethers.BigNumber,
    fee?: number
  ): Promise<ethers.BigNumber | null> {
    if (dex === 'UniswapV3' && fee) {
      return await this.getUniswapV3Price(tokenIn, tokenOut, amountIn, fee);
    } else if (dex === 'SushiSwap') {
      return await this.getUniswapV2Price(this.sushiswapRouter, tokenIn, tokenOut, amountIn);
    }
    return null;
  }
}
