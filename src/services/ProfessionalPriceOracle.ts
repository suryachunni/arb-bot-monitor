import { ethers } from 'ethers';
import { logger } from '../utils/logger';

/**
 * PROFESSIONAL-GRADE PRICE ORACLE
 * Multi-layer validation, liquidity checks, accurate pricing
 */

const QUOTER_ADDRESS = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';
const FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984';

const QUOTER_ABI = [
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)',
];

const FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)',
];

const POOL_ABI = [
  'function liquidity() external view returns (uint128)',
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
];

export interface ValidatedPrice {
  dex: string;
  fee: number;
  feePercent: string;
  price: number;
  poolAddress: string;
  liquidityUSD: number;
  amountIn: string;
  amountOut: string;
  isValid: boolean;
}

export interface ArbitrageOpportunity {
  tokenA: string;
  tokenB: string;
  buyDex: string;
  sellDex: string;
  buyPrice: number;
  sellPrice: number;
  priceDifference: number;
  spreadPercent: number;
  flashLoanAmount: number;
  flashLoanAmountUSD: number;
  expectedProfit: number;
  flashLoanFee: number;
  estimatedGasCost: number;
  netProfit: number;
  isProfitable: boolean;
  buyLiquidity: number;
  sellLiquidity: number;
}

export class ProfessionalPriceOracle {
  private provider: ethers.providers.JsonRpcProvider;
  private quoter: ethers.Contract;
  private factory: ethers.Contract;
  private minLiquidityUSD = 10000; // $10k minimum (lowered to show more pools)

  constructor(provider: ethers.providers.JsonRpcProvider) {
    this.provider = provider;
    this.quoter = new ethers.Contract(QUOTER_ADDRESS, QUOTER_ABI, provider);
    this.factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
  }

  /**
   * Get validated prices with liquidity checks
   */
  async getValidatedPrices(
    tokenA: string,
    tokenB: string,
    symbolA: string,
    symbolB: string,
    decimalsA: number,
    decimalsB: number
  ): Promise<ValidatedPrice[]> {
    const prices: ValidatedPrice[] = [];
    const fees = [500, 3000, 10000];
    const amountIn = ethers.utils.parseUnits('1', decimalsA);

    for (const fee of fees) {
      try {
        // Get pool address
        const poolAddress = await this.factory.getPool(tokenA, tokenB, fee);
        
        if (poolAddress === ethers.constants.AddressZero) {
          continue;
        }

        // Get pool liquidity
        const pool = new ethers.Contract(poolAddress, POOL_ABI, this.provider);
        const liquidity = await pool.liquidity();
        
        // Skip if liquidity is too low
        const liquidityNum = parseFloat(ethers.utils.formatUnits(liquidity, 18));
        const liquidityUSD = liquidityNum * 2000; // Rough USD estimate
        
        if (liquidityUSD < this.minLiquidityUSD) {
          logger.debug(`Pool ${symbolA}/${symbolB}-${fee}bp has low liquidity: $${liquidityUSD.toFixed(0)}`);
          continue;
        }

        // Get price quote
        const amountOut = await this.quoter.callStatic.quoteExactInputSingle(
          tokenA,
          tokenB,
          fee,
          amountIn,
          0
        );

        const price = parseFloat(ethers.utils.formatUnits(amountOut, decimalsB));

        // Validate price is reasonable
        if (price <= 0 || price > 1000000000) {
          logger.debug(`Invalid price for ${symbolA}/${symbolB}-${fee}bp: ${price}`);
          continue;
        }

        prices.push({
          dex: `UniswapV3-${fee}bp`,
          fee,
          feePercent: (fee / 10000).toFixed(2) + '%',
          price,
          poolAddress,
          liquidityUSD,
          amountIn: amountIn.toString(),
          amountOut: amountOut.toString(),
          isValid: true,
        });

      } catch (error) {
        logger.debug(`Error checking ${symbolA}/${symbolB}-${fee}bp:`, (error as Error).message);
      }
    }

    return prices;
  }

  /**
   * Calculate arbitrage opportunity with profit estimation
   */
  calculateArbitrage(
    symbolA: string,
    symbolB: string,
    prices: ValidatedPrice[],
    tokenPrice: number // USD price of token A (e.g., WETH = $3895)
  ): ArbitrageOpportunity | null {
    if (prices.length < 2) return null;

    // Find best buy (lowest price) and sell (highest price)
    const sortedByPrice = [...prices].sort((a, b) => a.price - b.price);
    const buyDex = sortedByPrice[0];
    const sellDex = sortedByPrice[sortedByPrice.length - 1];

    const buyPrice = buyDex.price;
    const sellPrice = sellDex.price;
    const priceDifference = sellPrice - buyPrice;
    const spreadPercent = (priceDifference / buyPrice) * 100;

    // Calculate flash loan amount based on liquidity
    const maxLoanUSD = Math.min(buyDex.liquidityUSD, sellDex.liquidityUSD) * 0.02; // 2% of liquidity
    const flashLoanAmountUSD = Math.max(10000, Math.min(maxLoanUSD, 100000)); // Between $10k-$100k
    const flashLoanAmount = flashLoanAmountUSD / tokenPrice;

    // Calculate profit
    const boughtAmount = flashLoanAmount * buyPrice;
    const soldAmount = boughtAmount / sellPrice;
    const returnedAmount = soldAmount;
    const grossProfit = (returnedAmount - flashLoanAmount) * tokenPrice;

    // Calculate costs
    const flashLoanFee = flashLoanAmountUSD * 0.0005; // 0.05% Aave fee
    const estimatedGasCost = 15; // ~$15 for flash loan trade on Arbitrum
    
    const netProfit = grossProfit - flashLoanFee - estimatedGasCost;
    const isProfitable = netProfit > 50; // Minimum $50 profit

    return {
      tokenA: symbolA,
      tokenB: symbolB,
      buyDex: buyDex.dex,
      sellDex: sellDex.dex,
      buyPrice,
      sellPrice,
      priceDifference,
      spreadPercent,
      flashLoanAmount,
      flashLoanAmountUSD,
      expectedProfit: grossProfit,
      flashLoanFee,
      estimatedGasCost,
      netProfit,
      isProfitable,
      buyLiquidity: buyDex.liquidityUSD,
      sellLiquidity: sellDex.liquidityUSD,
    };
  }
}
