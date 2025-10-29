/**
 * ═══════════════════════════════════════════════════════════════════
 * LIQUIDITY VALIDATOR
 * Multi-layer validation for trade quality and liquidity depth
 * ═══════════════════════════════════════════════════════════════════
 */

import { ethers, Contract, BigNumber } from 'ethers';
import { productionConfig } from '../config/production.config';
import { ArbitrageOpportunity } from './UltraFastArbitrageScanner';

const PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
];

const QUOTER_ABI = [
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)',
];

export interface LiquidityAnalysis {
  isValid: boolean;
  liquidityUSD: number;
  depthScore: number; // 0-100
  slippageEstimate: number; // percentage
  recommendation: 'EXECUTE' | 'REJECT' | 'REDUCE_SIZE';
  optimalLoanSize?: BigNumber;
  reason?: string;
}

/**
 * Advanced liquidity validation and depth analysis
 */
export class LiquidityValidator {
  private provider: ethers.providers.JsonRpcProvider;
  
  // Minimum liquidity thresholds (USD)
  private readonly MIN_LIQUIDITY_USD = 100000; // $100k minimum
  private readonly OPTIMAL_LIQUIDITY_USD = 1000000; // $1M optimal
  private readonly MAX_SLIPPAGE_PERCENT = 0.5; // 0.5% max acceptable slippage

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(
      productionConfig.network.rpcUrl,
      productionConfig.network.chainId
    );
  }

  /**
   * Validate opportunity has sufficient liquidity
   */
  async validateOpportunity(opportunity: ArbitrageOpportunity): Promise<LiquidityAnalysis> {
    console.log('\n🔍 LIQUIDITY VALIDATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Check liquidity on both DEXs
      const buyDexLiquidity = await this.checkDexLiquidity(
        opportunity.token0,
        opportunity.token1,
        opportunity.buyDex
      );

      const sellDexLiquidity = await this.checkDexLiquidity(
        opportunity.token0,
        opportunity.token1,
        opportunity.sellDex
      );

      console.log(`💧 ${opportunity.buyDex} Liquidity: $${buyDexLiquidity.toLocaleString()}`);
      console.log(`💧 ${opportunity.sellDex} Liquidity: $${sellDexLiquidity.toLocaleString()}`);

      // Use minimum liquidity of both DEXs
      const minLiquidity = Math.min(buyDexLiquidity, sellDexLiquidity);

      // VALIDATION LAYER 1: Minimum liquidity check
      if (minLiquidity < this.MIN_LIQUIDITY_USD) {
        console.log(`❌ REJECTED: Liquidity too low ($${minLiquidity.toLocaleString()} < $${this.MIN_LIQUIDITY_USD.toLocaleString()})`);
        return {
          isValid: false,
          liquidityUSD: minLiquidity,
          depthScore: 0,
          slippageEstimate: 100,
          recommendation: 'REJECT',
          reason: `Insufficient liquidity: $${minLiquidity.toLocaleString()}`,
        };
      }

      // VALIDATION LAYER 2: Calculate optimal loan size based on liquidity
      const optimalLoanSize = this.calculateOptimalLoanSize(
        minLiquidity,
        opportunity.flashLoanAmount
      );

      // VALIDATION LAYER 3: Estimate slippage
      const slippageEstimate = this.estimateSlippage(
        opportunity.flashLoanAmountUSD,
        minLiquidity
      );

      console.log(`📊 Estimated Slippage: ${slippageEstimate.toFixed(3)}%`);

      if (slippageEstimate > this.MAX_SLIPPAGE_PERCENT) {
        console.log(`⚠️  WARNING: High slippage (${slippageEstimate.toFixed(3)}%)`);
        
        if (optimalLoanSize.lt(opportunity.flashLoanAmount)) {
          console.log(`📉 RECOMMENDATION: Reduce loan size to ${ethers.utils.formatUnits(optimalLoanSize, 6)}`);
          return {
            isValid: true,
            liquidityUSD: minLiquidity,
            depthScore: this.calculateDepthScore(minLiquidity, slippageEstimate),
            slippageEstimate,
            recommendation: 'REDUCE_SIZE',
            optimalLoanSize,
            reason: 'High slippage - reduce trade size',
          };
        } else {
          console.log(`❌ REJECTED: Slippage too high even with size reduction`);
          return {
            isValid: false,
            liquidityUSD: minLiquidity,
            depthScore: 0,
            slippageEstimate,
            recommendation: 'REJECT',
            reason: `Slippage too high: ${slippageEstimate.toFixed(2)}%`,
          };
        }
      }

      // VALIDATION LAYER 4: Calculate depth score
      const depthScore = this.calculateDepthScore(minLiquidity, slippageEstimate);

      console.log(`✅ VALIDATION PASSED`);
      console.log(`🎯 Depth Score: ${depthScore}/100`);
      console.log(`💰 Liquidity: $${minLiquidity.toLocaleString()}`);

      return {
        isValid: true,
        liquidityUSD: minLiquidity,
        depthScore,
        slippageEstimate,
        recommendation: 'EXECUTE',
        optimalLoanSize: opportunity.flashLoanAmount,
      };

    } catch (error: any) {
      console.error('❌ Liquidity validation error:', error.message);
      return {
        isValid: false,
        liquidityUSD: 0,
        depthScore: 0,
        slippageEstimate: 100,
        recommendation: 'REJECT',
        reason: `Validation error: ${error.message}`,
      };
    }
  }

  /**
   * Check liquidity on a specific DEX
   */
  private async checkDexLiquidity(
    token0: string,
    token1: string,
    dexName: string
  ): Promise<number> {
    try {
      if (dexName === 'Uniswap V3') {
        return await this.checkUniswapV3Liquidity(token0, token1);
      } else if (dexName === 'SushiSwap' || dexName === 'Camelot') {
        return await this.checkV2Liquidity(token0, token1, dexName);
      }
      
      // Default fallback
      return 0;
    } catch (error) {
      console.warn(`Failed to check liquidity on ${dexName}:`, error);
      return 0;
    }
  }

  /**
   * Check Uniswap V3 liquidity (using quoter)
   */
  private async checkUniswapV3Liquidity(token0: string, token1: string): Promise<number> {
    // For V3, we can estimate liquidity by trying different trade sizes
    const testAmount = ethers.utils.parseEther('1000'); // Test with 1000 units
    
    try {
      const quoter = new Contract(
        '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
        QUOTER_ABI,
        this.provider
      );

      const amountOut = await quoter.callStatic.quoteExactInputSingle(
        token0,
        token1,
        3000, // 0.3% fee tier
        testAmount,
        0
      );

      // Rough estimation: if we can swap 1000, assume 10x that in liquidity
      const estimatedLiquidity = parseFloat(ethers.utils.formatEther(amountOut)) * 10;
      
      return estimatedLiquidity * 2000; // Convert to USD (rough estimate)
    } catch (error) {
      return 0;
    }
  }

  /**
   * Check V2-style liquidity (SushiSwap, Camelot)
   */
  private async checkV2Liquidity(
    token0: string,
    token1: string,
    dexName: string
  ): Promise<number> {
    try {
      const factoryAddress = dexName === 'SushiSwap'
        ? '0xc35DADB65012eC5796536bD9864eD8773aBc74C4'
        : '0x6EcCab422D763aC031210895C81787E87B43A652';

      const factory = new Contract(
        factoryAddress,
        ['function getPair(address,address) view returns (address)'],
        this.provider
      );

      const pairAddress = await factory.getPair(token0, token1);
      
      if (pairAddress === ethers.constants.AddressZero) {
        return 0;
      }

      const pair = new Contract(pairAddress, PAIR_ABI, this.provider);
      const [reserve0, reserve1] = await pair.getReserves();

      // Convert reserves to USD (simplified - assumes stablecoin or known price)
      const reserve0USD = parseFloat(ethers.utils.formatEther(reserve0)) * 2000; // Rough estimate
      const reserve1USD = parseFloat(ethers.utils.formatEther(reserve1)) * 2000;

      return Math.min(reserve0USD, reserve1USD); // Use smaller reserve
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate optimal loan size based on liquidity
   */
  private calculateOptimalLoanSize(
    liquidityUSD: number,
    requestedLoanAmount: BigNumber
  ): BigNumber {
    // Rule: Loan size should not exceed 5% of liquidity to minimize slippage
    const maxSafeLoanUSD = liquidityUSD * 0.05;

    const requestedLoanUSD = parseFloat(ethers.utils.formatUnits(requestedLoanAmount, 6));

    if (requestedLoanUSD <= maxSafeLoanUSD) {
      return requestedLoanAmount; // Requested amount is safe
    }

    // Reduce to safe size
    const optimalLoanUSD = Math.floor(maxSafeLoanUSD);
    return ethers.utils.parseUnits(optimalLoanUSD.toString(), 6);
  }

  /**
   * Estimate slippage based on trade size vs liquidity
   */
  private estimateSlippage(tradeSizeUSD: number, liquidityUSD: number): number {
    // Simplified slippage model
    // Slippage increases exponentially with trade size relative to liquidity
    const tradeRatio = tradeSizeUSD / liquidityUSD;

    if (tradeRatio < 0.01) {
      return 0.05; // <1% of liquidity: ~0.05% slippage
    } else if (tradeRatio < 0.05) {
      return 0.1; // 1-5% of liquidity: ~0.1% slippage
    } else if (tradeRatio < 0.1) {
      return 0.3; // 5-10% of liquidity: ~0.3% slippage
    } else if (tradeRatio < 0.2) {
      return 0.6; // 10-20% of liquidity: ~0.6% slippage
    } else {
      return 1.5; // >20% of liquidity: ~1.5%+ slippage
    }
  }

  /**
   * Calculate depth score (0-100)
   */
  private calculateDepthScore(liquidityUSD: number, slippagePercent: number): number {
    let score = 0;

    // Liquidity score (max 60 points)
    if (liquidityUSD >= 10000000) {
      score += 60; // >$10M
    } else if (liquidityUSD >= 5000000) {
      score += 50; // $5-10M
    } else if (liquidityUSD >= 1000000) {
      score += 40; // $1-5M
    } else if (liquidityUSD >= 500000) {
      score += 30; // $500k-1M
    } else if (liquidityUSD >= 100000) {
      score += 20; // $100k-500k
    } else {
      score += 10; // <$100k
    }

    // Slippage score (max 40 points)
    if (slippagePercent < 0.1) {
      score += 40; // Excellent
    } else if (slippagePercent < 0.2) {
      score += 30; // Good
    } else if (slippagePercent < 0.3) {
      score += 20; // Acceptable
    } else if (slippagePercent < 0.5) {
      score += 10; // Marginal
    } else {
      score += 0; // Poor
    }

    return Math.min(100, score);
  }

  /**
   * Batch validate multiple opportunities
   */
  async validateBatch(opportunities: ArbitrageOpportunity[]): Promise<{
    opportunity: ArbitrageOpportunity;
    analysis: LiquidityAnalysis;
  }[]> {
    const results = await Promise.all(
      opportunities.map(async (opp) => ({
        opportunity: opp,
        analysis: await this.validateOpportunity(opp),
      }))
    );

    // Filter to only valid opportunities
    return results.filter(r => r.analysis.isValid);
  }
}
