import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { TOKENS, DEX_ROUTERS, UNISWAP_V3_FEES, MULTICALL3_ADDRESS } from '../config/constants';
import { config } from '../config/config';

// ABIs (minimal for price fetching)
const UNISWAP_V3_QUOTER_ABI = [
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)',
];

const UNISWAP_V3_QUOTER_V2_ABI = [
  'function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
];

const UNISWAP_V2_ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)',
];

const CAMELOT_ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)',
];

const BALANCER_VAULT_ABI = [
  'function getPool(bytes32 poolId) external view returns (address, uint8)',
  'function getPoolTokens(bytes32 poolId) external view returns (address[] tokens, uint256[] balances, uint256 lastChangeBlock)',
];

const CURVE_POOL_ABI = [
  'function get_dy(int128 i, int128 j, uint256 dx) external view returns (uint256)',
  'function coins(uint256 i) external view returns (address)',
];

const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) external payable returns (tuple(bool success, bytes returnData)[] returnData)',
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
  private uniswapV3QuoterV2: ethers.Contract;
  private sushiswapRouter: ethers.Contract;
  private camelotRouter: ethers.Contract;
  private balancerVault: ethers.Contract;
  private multicall3: ethers.Contract;
  private priceCache: Map<string, PricePair[]> = new Map();
  private tokenDecimals: Map<string, number> = new Map();
  private lastScanTime: number = 0;

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.network.rpcUrl);
    
    // Uniswap V3 Quoter V1 (fallback)
    const quoterAddress = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';
    this.uniswapV3Quoter = new ethers.Contract(quoterAddress, UNISWAP_V3_QUOTER_ABI, this.provider);
    
    // Uniswap V3 Quoter V2 (more accurate)
    const quoterV2Address = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';
    this.uniswapV3QuoterV2 = new ethers.Contract(quoterV2Address, UNISWAP_V3_QUOTER_V2_ABI, this.provider);
    
    // SushiSwap Router
    this.sushiswapRouter = new ethers.Contract(DEX_ROUTERS.SUSHISWAP, UNISWAP_V2_ROUTER_ABI, this.provider);
    
    // Camelot Router (Arbitrum native)
    const camelotRouterAddress = '0xc873fEcbd354f5A56E00E710B90EF4201db2448d';
    this.camelotRouter = new ethers.Contract(camelotRouterAddress, CAMELOT_ROUTER_ABI, this.provider);
    
    // Balancer Vault
    const balancerVaultAddress = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';
    this.balancerVault = new ethers.Contract(balancerVaultAddress, BALANCER_VAULT_ABI, this.provider);
    
    // Multicall3 for batch operations
    this.multicall3 = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, this.provider);
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
   * Get best price on Uniswap V3 across all fee tiers using V2 quoter
   */
  async getBestUniswapV3Price(
    tokenIn: string,
    tokenOut: string,
    amountIn: ethers.BigNumber
  ): Promise<{ amountOut: ethers.BigNumber; fee: number } | null> {
    const fees = [UNISWAP_V3_FEES.LOW, UNISWAP_V3_FEES.MEDIUM, UNISWAP_V3_FEES.HIGH];
    let bestPrice: ethers.BigNumber | null = null;
    let bestFee = fees[0];

    // Try V2 quoter first (more accurate)
    try {
      for (const fee of fees) {
        const params = {
          tokenIn,
          tokenOut,
          amountIn,
          fee,
          sqrtPriceLimitX96: 0
        };
        
        const result = await this.uniswapV3QuoterV2.callStatic.quoteExactInputSingle(params);
        const price = result.amountOut;
        
        if (price && (!bestPrice || price.gt(bestPrice))) {
          bestPrice = price;
          bestFee = fee;
        }
      }
    } catch (error) {
      // Fallback to V1 quoter
      for (const fee of fees) {
        const price = await this.getUniswapV3Price(tokenIn, tokenOut, amountIn, fee);
        if (price && (!bestPrice || price.gt(bestPrice))) {
          bestPrice = price;
          bestFee = fee;
        }
      }
    }

    if (!bestPrice) return null;

    return { amountOut: bestPrice, fee: bestFee };
  }

  /**
   * Get price on Camelot DEX
   */
  async getCamelotPrice(
    tokenIn: string,
    tokenOut: string,
    amountIn: ethers.BigNumber
  ): Promise<ethers.BigNumber | null> {
    try {
      const path = [tokenIn, tokenOut];
      const amounts = await this.camelotRouter.getAmountsOut(amountIn, path);
      return amounts[1];
    } catch (error) {
      return null;
    }
  }

  /**
   * Get price on Balancer (simplified - would need pool ID lookup in production)
   */
  async getBalancerPrice(
    tokenIn: string,
    tokenOut: string,
    amountIn: ethers.BigNumber
  ): Promise<ethers.BigNumber | null> {
    try {
      // This is a simplified implementation
      // In production, you'd need to find the correct pool ID
      // For now, return null to avoid errors
      return null;
    } catch (error) {
      return null;
    }
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
    const baseBAmount = ethers.utils.parseUnits('1', decimalsB);
    
    // Scan Uniswap V3
    if (config.dex.enableUniswapV3) {
      try {
        // A to B
        const priceAtoB = await this.getBestUniswapV3Price(tokenA, tokenB, baseAmount);
        // B to A  
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
    
    // Scan Camelot
    if (config.dex.enableCamelot) {
      try {
        const priceAtoB = await this.getCamelotPrice(tokenA, tokenB, baseAmount);
        const priceBtoA = await this.getCamelotPrice(tokenB, tokenA, baseBAmount);
        
        if (priceAtoB && priceBtoA) {
          prices.push({
            tokenA: tokenASymbol,
            tokenB: tokenBSymbol,
            tokenAAddress: tokenA,
            tokenBAddress: tokenB,
            priceAtoB: parseFloat(ethers.utils.formatUnits(priceAtoB, decimalsB)),
            priceBtoA: parseFloat(ethers.utils.formatUnits(priceBtoA, decimalsA)),
            dex: 'Camelot',
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        logger.debug(`Failed to get Camelot price for ${tokenASymbol}/${tokenBSymbol}`);
      }
    }
    
    // Scan Balancer
    if (config.dex.enableBalancer) {
      try {
        const priceAtoB = await this.getBalancerPrice(tokenA, tokenB, baseAmount);
        const priceBtoA = await this.getBalancerPrice(tokenB, tokenA, baseBAmount);
        
        if (priceAtoB && priceBtoA) {
          prices.push({
            tokenA: tokenASymbol,
            tokenB: tokenBSymbol,
            tokenAAddress: tokenA,
            tokenBAddress: tokenB,
            priceAtoB: parseFloat(ethers.utils.formatUnits(priceAtoB, decimalsB)),
            priceBtoA: parseFloat(ethers.utils.formatUnits(priceBtoA, decimalsA)),
            dex: 'Balancer',
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        logger.debug(`Failed to get Balancer price for ${tokenASymbol}/${tokenBSymbol}`);
      }
    }
    
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
    try {
      if (dex === 'UniswapV3' && fee) {
        return await this.getUniswapV3Price(tokenIn, tokenOut, amountIn, fee);
      } else if (dex === 'SushiSwap') {
        return await this.getUniswapV2Price(this.sushiswapRouter, tokenIn, tokenOut, amountIn);
      } else if (dex === 'Camelot') {
        return await this.getCamelotPrice(tokenIn, tokenOut, amountIn);
      } else if (dex === 'Balancer') {
        return await this.getBalancerPrice(tokenIn, tokenOut, amountIn);
      }
      return null;
    } catch (error) {
      logger.debug(`Failed to get real-time price on ${dex}:`, error);
      return null;
    }
  }

  /**
   * Ultra-fast batch price scanning using multicall
   */
  async batchScanPrices(tokenPairs: string[][]): Promise<Map<string, PricePair[]>> {
    const results = new Map<string, PricePair[]>();
    
    // Process in parallel batches for maximum speed
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < tokenPairs.length; i += batchSize) {
      const batch = tokenPairs.slice(i, i + batchSize);
      batches.push(this.scanBatch(batch));
    }
    
    const batchResults = await Promise.all(batches);
    
    // Combine results
    for (const batchResult of batchResults) {
      for (const [key, value] of batchResult.entries()) {
        results.set(key, value);
      }
    }
    
    this.lastScanTime = Date.now();
    return results;
  }

  /**
   * Scan a batch of token pairs
   */
  private async scanBatch(tokenPairs: string[][]): Promise<Map<string, PricePair[]>> {
    const results = new Map<string, PricePair[]>();
    
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
      }
    });
    
    await Promise.all(scanPromises);
    return results;
  }
}
