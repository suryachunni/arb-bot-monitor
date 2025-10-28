import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { TOKENS, DEX_ROUTERS, UNISWAP_V3_FEES, MULTICALL3_ADDRESS, UNISWAP_V3_QUOTER_V2 } from '../config/constants';
import { config } from '../config/config';

// Multicall3 ABI (for batching calls)
const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) returns (tuple(bool success, bytes returnData)[] returnData)',
];

// Quoter V2 ABI (more accurate than V1)
const QUOTER_V2_ABI = [
  'function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
];

const UNISWAP_V2_ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)',
];

export interface FastPricePair {
  tokenA: string;
  tokenB: string;
  tokenAAddress: string;
  tokenBAddress: string;
  priceAtoB: number;
  priceBtoA: number;
  dex: string;
  fee?: number;
  gasEstimate?: number;
  priceImpact?: number;
  timestamp: number;
}

export class FastPriceScanner {
  private provider: ethers.providers.WebSocketProvider;
  private multicall: ethers.Contract;
  private quoterV2Interface: ethers.utils.Interface;
  private routerInterface: ethers.utils.Interface;
  private tokenDecimals: Map<string, number> = new Map();
  private lastScanTime: number = 0;

  constructor() {
    // Use WebSocket for INSTANT updates (not HTTP polling)
    const wsUrl = config.network.rpcUrl.replace('https://', 'wss://').replace('/v2/', '/v2/ws/');
    this.provider = new ethers.providers.WebSocketProvider(wsUrl);
    
    this.multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, this.provider);
    this.quoterV2Interface = new ethers.utils.Interface(QUOTER_V2_ABI);
    this.routerInterface = new ethers.utils.Interface(UNISWAP_V2_ROUTER_ABI);

    // Pre-load token decimals
    this.preloadTokenDecimals();

    logger.info('⚡ FastPriceScanner initialized with WebSocket connection');
  }

  /**
   * Pre-load all token decimals (avoid async calls during scanning)
   */
  private async preloadTokenDecimals() {
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

  /**
   * Get token decimals (cached)
   */
  private getDecimals(tokenAddress: string): number {
    return this.tokenDecimals.get(tokenAddress.toLowerCase()) || 18;
  }

  /**
   * ULTRA-FAST: Scan all pairs using Multicall3 (single RPC call!)
   */
  async scanAllPairsUltraFast(tokenPairs: string[][]): Promise<Map<string, FastPricePair[]>> {
    const startTime = Date.now();
    const results = new Map<string, FastPricePair[]>();

    // Build all multicall requests
    const calls: any[] = [];
    const callMetadata: any[] = [];

    for (const [symbolA, symbolB] of tokenPairs) {
      const tokenA = (TOKENS as any)[symbolA];
      const tokenB = (TOKENS as any)[symbolB];
      
      if (!tokenA || !tokenB) continue;

      const decimalsA = this.getDecimals(tokenA);
      const decimalsB = this.getDecimals(tokenB);
      const baseAmountA = ethers.utils.parseUnits('1', decimalsA);
      const baseAmountB = ethers.utils.parseUnits('1', decimalsB);

      // Uniswap V3 calls for all fee tiers
      const fees = [UNISWAP_V3_FEES.LOW, UNISWAP_V3_FEES.MEDIUM, UNISWAP_V3_FEES.HIGH];
      
      for (const fee of fees) {
        // A to B
        calls.push({
          target: UNISWAP_V3_QUOTER_V2,
          allowFailure: true,
          callData: this.quoterV2Interface.encodeFunctionData('quoteExactInputSingle', [{
            tokenIn: tokenA,
            tokenOut: tokenB,
            amountIn: baseAmountA,
            fee: fee,
            sqrtPriceLimitX96: 0,
          }]),
        });
        callMetadata.push({
          pair: [symbolA, symbolB],
          tokenA, tokenB, decimalsA, decimalsB,
          direction: 'AtoB',
          dex: 'UniswapV3',
          fee,
        });

        // B to A
        calls.push({
          target: UNISWAP_V3_QUOTER_V2,
          allowFailure: true,
          callData: this.quoterV2Interface.encodeFunctionData('quoteExactInputSingle', [{
            tokenIn: tokenB,
            tokenOut: tokenA,
            amountIn: baseAmountB,
            fee: fee,
            sqrtPriceLimitX96: 0,
          }]),
        });
        callMetadata.push({
          pair: [symbolA, symbolB],
          tokenA, tokenB, decimalsA, decimalsB,
          direction: 'BtoA',
          dex: 'UniswapV3',
          fee,
        });
      }

      // SushiSwap calls
      // A to B
      calls.push({
        target: DEX_ROUTERS.SUSHISWAP,
        allowFailure: true,
        callData: this.routerInterface.encodeFunctionData('getAmountsOut', [
          baseAmountA,
          [tokenA, tokenB],
        ]),
      });
      callMetadata.push({
        pair: [symbolA, symbolB],
        tokenA, tokenB, decimalsA, decimalsB,
        direction: 'AtoB',
        dex: 'SushiSwap',
      });

      // B to A
      calls.push({
        target: DEX_ROUTERS.SUSHISWAP,
        allowFailure: true,
        callData: this.routerInterface.encodeFunctionData('getAmountsOut', [
          baseAmountB,
          [tokenB, tokenA],
        ]),
      });
      callMetadata.push({
        pair: [symbolA, symbolB],
        tokenA, tokenB, decimalsA, decimalsB,
        direction: 'BtoA',
        dex: 'SushiSwap',
      });
    }

    // Execute ALL calls in ONE multicall (MASSIVE speedup!)
    const multicallResults = await this.multicall.callStatic.aggregate3(calls);

    // Process results and group by pair
    const pairData: Map<string, any> = new Map();

    for (let i = 0; i < multicallResults.length; i++) {
      const { success, returnData } = multicallResults[i];
      if (!success) continue;

      const meta = callMetadata[i];
      const pairKey = `${meta.pair[0]}-${meta.pair[1]}`;

      if (!pairData.has(pairKey)) {
        pairData.set(pairKey, {
          tokenA: meta.pair[0],
          tokenB: meta.pair[1],
          tokenAAddress: meta.tokenA,
          tokenBAddress: meta.tokenB,
          decimalsA: meta.decimalsA,
          decimalsB: meta.decimalsB,
          uniV3Prices: { AtoB: {}, BtoA: {} },
          sushiPrices: { AtoB: null, BtoA: null },
        });
      }

      const pair = pairData.get(pairKey)!;

      try {
        if (meta.dex === 'UniswapV3') {
          const [amountOut, , , gasEstimate] = this.quoterV2Interface.decodeFunctionResult(
            'quoteExactInputSingle',
            returnData
          );
          const price = parseFloat(
            ethers.utils.formatUnits(
              amountOut,
              meta.direction === 'AtoB' ? meta.decimalsB : meta.decimalsA
            )
          );
          pair.uniV3Prices[meta.direction][meta.fee] = {
            price,
            fee: meta.fee,
            gasEstimate: gasEstimate.toNumber(),
          };
        } else if (meta.dex === 'SushiSwap') {
          const [amounts] = this.routerInterface.decodeFunctionResult('getAmountsOut', returnData);
          const price = parseFloat(
            ethers.utils.formatUnits(
              amounts[1],
              meta.direction === 'AtoB' ? meta.decimalsB : meta.decimalsA
            )
          );
          pair.sushiPrices[meta.direction] = price;
        }
      } catch (error) {
        // Silently ignore decode errors
      }
    }

    // Build final results
    const timestamp = Date.now();
    
    for (const [pairKey, pair] of pairData.entries()) {
      const prices: FastPricePair[] = [];

      // Find best Uniswap V3 fee tier for each direction
      let bestV3AtoB: any = null;
      let bestV3BtoA: any = null;

      for (const feeData of Object.values(pair.uniV3Prices.AtoB)) {
        if (!bestV3AtoB || (feeData as any).price > bestV3AtoB.price) {
          bestV3AtoB = feeData;
        }
      }

      for (const feeData of Object.values(pair.uniV3Prices.BtoA)) {
        if (!bestV3BtoA || (feeData as any).price > bestV3BtoA.price) {
          bestV3BtoA = feeData;
        }
      }

      if (bestV3AtoB && bestV3BtoA) {
        prices.push({
          tokenA: pair.tokenA,
          tokenB: pair.tokenB,
          tokenAAddress: pair.tokenAAddress,
          tokenBAddress: pair.tokenBAddress,
          priceAtoB: bestV3AtoB.price,
          priceBtoA: bestV3BtoA.price,
          dex: 'UniswapV3',
          fee: bestV3AtoB.fee,
          gasEstimate: bestV3AtoB.gasEstimate,
          timestamp,
        });
      }

      // SushiSwap prices
      if (pair.sushiPrices.AtoB && pair.sushiPrices.BtoA) {
        prices.push({
          tokenA: pair.tokenA,
          tokenB: pair.tokenB,
          tokenAAddress: pair.tokenAAddress,
          tokenBAddress: pair.tokenBAddress,
          priceAtoB: pair.sushiPrices.AtoB,
          priceBtoA: pair.sushiPrices.BtoA,
          dex: 'SushiSwap',
          timestamp,
        });
      }

      if (prices.length > 0) {
        results.set(pairKey, prices);
      }
    }

    const scanTime = Date.now() - startTime;
    this.lastScanTime = scanTime;
    
    logger.info(`⚡ ULTRA-FAST scan complete in ${scanTime}ms | ${results.size} pairs | ${calls.length} prices in 1 call`);

    return results;
  }

  /**
   * Get last scan time
   */
  getLastScanTime(): number {
    return this.lastScanTime;
  }

  /**
   * Subscribe to new blocks for instant execution
   */
  onNewBlock(callback: (blockNumber: number) => void) {
    this.provider.on('block', callback);
    logger.info('📡 Subscribed to new blocks for instant execution');
  }

  /**
   * Get current gas price (optimized)
   */
  async getCurrentGasPrice(): Promise<{
    gasPrice: ethers.BigNumber;
    maxFeePerGas?: ethers.BigNumber;
    maxPriorityFeePerGas?: ethers.BigNumber;
  }> {
    const feeData = await this.provider.getFeeData();
    
    return {
      gasPrice: feeData.gasPrice || ethers.BigNumber.from(0),
      maxFeePerGas: feeData.maxFeePerGas || undefined,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || undefined,
    };
  }

  /**
   * Clean up WebSocket connection
   */
  destroy() {
    this.provider.removeAllListeners();
    this.provider.destroy();
  }
}
