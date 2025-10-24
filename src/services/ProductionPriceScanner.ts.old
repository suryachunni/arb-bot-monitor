import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { TOKENS, DEX_ROUTERS, UNISWAP_V3_FEES, MULTICALL3_ADDRESS, UNISWAP_V3_QUOTER_V2 } from '../config/constants';
import { config } from '../config/config';

// Multicall3 ABI
const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) returns (tuple(bool success, bytes returnData)[] returnData)',
];

// Quoter V2 ABI
const QUOTER_V2_ABI = [
  'function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
];

const UNISWAP_V2_ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)',
];

const ERC20_ABI = [
  'function decimals() view returns (uint8)',
];

export interface ValidatedPrice {
  tokenA: string;
  tokenB: string;
  tokenAAddress: string;
  tokenBAddress: string;
  priceAtoB: number;
  priceBtoA: number;
  dex: string;
  fee?: number;
  gasEstimate?: number;
  liquidity?: number;
  isValid: boolean;
  validationError?: string;
  timestamp: number;
}

export class ProductionPriceScanner {
  private provider: ethers.providers.JsonRpcProvider;
  private multicall: ethers.Contract;
  private quoterV2Interface: ethers.utils.Interface;
  private routerInterface: ethers.utils.Interface;
  private tokenDecimals: Map<string, number> = new Map();

  // PRODUCTION: Min liquidity thresholds (in USD)
  private readonly MIN_LIQUIDITY_USD = 100000; // $100k minimum
  private readonly MAX_PRICE_IMPACT_PERCENT = 5; // 5% max impact for $50k trade

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.network.rpcUrl);
    this.multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, this.provider);
    this.quoterV2Interface = new ethers.utils.Interface(QUOTER_V2_ABI);
    this.routerInterface = new ethers.utils.Interface(UNISWAP_V2_ROUTER_ABI);

    // Pre-load decimals
    this.preloadDecimals();
  }

  private async preloadDecimals() {
    const decimalsMap: { [key: string]: number } = {
      [TOKENS.WETH]: 18,
      [TOKENS.USDC]: 6,
      [TOKENS.USDT]: 6,
      [TOKENS.ARB]: 18,
      [TOKENS.WBTC]: 8,
      [TOKENS.DAI]: 18,
    };

    for (const [address, decimals] of Object.entries(decimalsMap)) {
      this.tokenDecimals.set(address.toLowerCase(), decimals);
    }
  }

  private getDecimals(tokenAddress: string): number {
    return this.tokenDecimals.get(tokenAddress.toLowerCase()) || 18;
  }

  /**
   * PRODUCTION: Validate price is realistic
   */
  private validatePrice(
    tokenA: string,
    tokenB: string,
    priceAtoB: number,
    priceBtoA: number
  ): { isValid: boolean; error?: string } {
    // Check 1: Prices must be positive
    if (priceAtoB <= 0 || priceBtoA <= 0) {
      return { isValid: false, error: 'Invalid price: zero or negative' };
    }

    // Check 2: Prices must be reasonable (not extreme)
    if (priceAtoB > 1e12 || priceBtoA > 1e12) {
      return { isValid: false, error: 'Invalid price: too large' };
    }

    // Check 3: Reciprocal check (priceAtoB * priceBtoA should be close to 1)
    const product = priceAtoB * priceBtoA;
    if (product < 0.5 || product > 2) {
      return { isValid: false, error: `Invalid reciprocal: ${product.toFixed(4)} (should be ~1)` };
    }

    // Check 4: USDC/USDT pairs should be close to 1:1
    if ((tokenA === 'USDC' && tokenB === 'USDT') || (tokenA === 'USDT' && tokenB === 'USDC')) {
      if (priceAtoB < 0.95 || priceAtoB > 1.05) {
        return { isValid: false, error: `Stablecoin price out of range: ${priceAtoB.toFixed(4)}` };
      }
    }

    return { isValid: true };
  }

  /**
   * PRODUCTION: Scan with full validation
   */
  async scanAllPairsProduction(tokenPairs: string[][]): Promise<Map<string, ValidatedPrice[]>> {
    const startTime = Date.now();
    const results = new Map<string, ValidatedPrice[]>();

    logger.info(`🔍 PRODUCTION SCAN: ${tokenPairs.length} pairs...`);

    for (const [symbolA, symbolB] of tokenPairs) {
      const tokenA = (TOKENS as any)[symbolA];
      const tokenB = (TOKENS as any)[symbolB];
      
      if (!tokenA || !tokenB) {
        logger.warn(`Token not found: ${symbolA} or ${symbolB}`);
        continue;
      }

      const decimalsA = this.getDecimals(tokenA);
      const decimalsB = this.getDecimals(tokenB);
      const baseAmountA = ethers.utils.parseUnits('1', decimalsA);
      const baseAmountB = ethers.utils.parseUnits('1', decimalsB);

      const pairPrices: ValidatedPrice[] = [];

      // Scan Uniswap V3 with validation
      if (config.dex.enableUniswapV3) {
        const uniV3Price = await this.scanUniswapV3WithValidation(
          tokenA, tokenB, symbolA, symbolB,
          baseAmountA, baseAmountB, decimalsA, decimalsB
        );
        if (uniV3Price && uniV3Price.isValid) {
          pairPrices.push(uniV3Price);
        } else if (uniV3Price && !uniV3Price.isValid) {
          logger.debug(`❌ UniV3 ${symbolA}/${symbolB}: ${uniV3Price.validationError}`);
        }
      }

      // Scan SushiSwap with validation
      if (config.dex.enableSushiSwap) {
        const sushiPrice = await this.scanSushiSwapWithValidation(
          tokenA, tokenB, symbolA, symbolB,
          baseAmountA, baseAmountB, decimalsA, decimalsB
        );
        if (sushiPrice && sushiPrice.isValid) {
          pairPrices.push(sushiPrice);
        } else if (sushiPrice && !sushiPrice.isValid) {
          logger.debug(`❌ Sushi ${symbolA}/${symbolB}: ${sushiPrice.validationError}`);
        }
      }

      // Only add pair if we have at least 2 valid prices
      if (pairPrices.length >= 2) {
        const pairKey = `${symbolA}-${symbolB}`;
        results.set(pairKey, pairPrices);
      }
    }

    const scanTime = Date.now() - startTime;
    logger.info(`✅ PRODUCTION SCAN: ${results.size} valid pairs in ${scanTime}ms`);

    return results;
  }

  /**
   * PRODUCTION: Scan Uniswap V3 with validation
   */
  private async scanUniswapV3WithValidation(
    tokenA: string, tokenB: string, symbolA: string, symbolB: string,
    baseAmountA: ethers.BigNumber, baseAmountB: ethers.BigNumber,
    decimalsA: number, decimalsB: number
  ): Promise<ValidatedPrice | null> {
    try {
      const quoterContract = new ethers.Contract(
        UNISWAP_V3_QUOTER_V2,
        QUOTER_V2_ABI,
        this.provider
      );

      // Try multiple fee tiers and pick best
      const fees = [UNISWAP_V3_FEES.LOW, UNISWAP_V3_FEES.MEDIUM, UNISWAP_V3_FEES.HIGH];
      let bestPriceAtoB: number = 0;
      let bestPriceBtoA: number = 0;
      let bestFee: number = fees[0];
      let bestGasEstimate: number = 0;

      for (const fee of fees) {
        try {
          // A to B
          const resultAtoB = await quoterContract.callStatic.quoteExactInputSingle({
            tokenIn: tokenA,
            tokenOut: tokenB,
            amountIn: baseAmountA,
            fee: fee,
            sqrtPriceLimitX96: 0,
          });
          const priceAtoB = parseFloat(ethers.utils.formatUnits(resultAtoB.amountOut, decimalsB));

          // B to A
          const resultBtoA = await quoterContract.callStatic.quoteExactInputSingle({
            tokenIn: tokenB,
            tokenOut: tokenA,
            amountIn: baseAmountB,
            fee: fee,
            sqrtPriceLimitX96: 0,
          });
          const priceBtoA = parseFloat(ethers.utils.formatUnits(resultBtoA.amountOut, decimalsA));

          // Validate prices
          const validation = this.validatePrice(symbolA, symbolB, priceAtoB, priceBtoA);
          if (!validation.isValid) continue;

          // Use best price
          if (priceAtoB > bestPriceAtoB) {
            bestPriceAtoB = priceAtoB;
            bestPriceBtoA = priceBtoA;
            bestFee = fee;
            bestGasEstimate = resultAtoB.gasEstimate?.toNumber() || 0;
          }
        } catch (error) {
          // Pool doesn't exist for this fee tier
          continue;
        }
      }

      if (bestPriceAtoB === 0) return null;

      // Final validation
      const validation = this.validatePrice(symbolA, symbolB, bestPriceAtoB, bestPriceBtoA);

      return {
        tokenA: symbolA,
        tokenB: symbolB,
        tokenAAddress: tokenA,
        tokenBAddress: tokenB,
        priceAtoB: bestPriceAtoB,
        priceBtoA: bestPriceBtoA,
        dex: 'UniswapV3',
        fee: bestFee,
        gasEstimate: bestGasEstimate,
        isValid: validation.isValid,
        validationError: validation.error,
        timestamp: Date.now(),
      };

    } catch (error: any) {
      return null;
    }
  }

  /**
   * PRODUCTION: Scan SushiSwap with validation
   */
  private async scanSushiSwapWithValidation(
    tokenA: string, tokenB: string, symbolA: string, symbolB: string,
    baseAmountA: ethers.BigNumber, baseAmountB: ethers.BigNumber,
    decimalsA: number, decimalsB: number
  ): Promise<ValidatedPrice | null> {
    try {
      const routerContract = new ethers.Contract(
        DEX_ROUTERS.SUSHISWAP,
        UNISWAP_V2_ROUTER_ABI,
        this.provider
      );

      // A to B
      const amountsAtoB = await routerContract.getAmountsOut(baseAmountA, [tokenA, tokenB]);
      const priceAtoB = parseFloat(ethers.utils.formatUnits(amountsAtoB[1], decimalsB));

      // B to A
      const amountsBtoA = await routerContract.getAmountsOut(baseAmountB, [tokenB, tokenA]);
      const priceBtoA = parseFloat(ethers.utils.formatUnits(amountsBtoA[1], decimalsA));

      // Validate prices
      const validation = this.validatePrice(symbolA, symbolB, priceAtoB, priceBtoA);

      return {
        tokenA: symbolA,
        tokenB: symbolB,
        tokenAAddress: tokenA,
        tokenBAddress: tokenB,
        priceAtoB,
        priceBtoA,
        dex: 'SushiSwap',
        isValid: validation.isValid,
        validationError: validation.error,
        timestamp: Date.now(),
      };

    } catch (error: any) {
      return null;
    }
  }
}
