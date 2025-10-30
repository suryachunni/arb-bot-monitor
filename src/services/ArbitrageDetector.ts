import { BigNumber, ethers } from 'ethers';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import {
  DexType,
  STABLE_TOKEN_SYMBOLS,
  TOKENS,
  TRIANGULAR_ROUTES,
  TokenMetadata,
} from '../config/constants';
import { MarketSnapshot, TokenPairQuote } from './PriceScanner';

export type OpportunityType = 'DIRECT' | 'TRIANGULAR';

export interface DexLeg {
  dex: DexType;
  poolAddress: string;
  feeBps: number;
  fromToken: TokenMetadata;
  toToken: TokenMetadata;
  price: number;
}

export interface ArbitrageOpportunity {
  id: string;
  type: OpportunityType;
  path: TokenMetadata[];
  legs: DexLeg[];
  borrowToken: TokenMetadata;
  borrowAmount: BigNumber;
  borrowAmountHuman: number;
  borrowTokenUsd: number;
  notionalUsd: number;
  expectedProfitUsd: number;
  expectedProfitPercent: number;
  blockNumber: number;
  blockTimestamp: number;
  maxSlippagePercent: number;
  gasCostUsdEstimate: number;
  liquidityCapUsd: number;
  notes?: string;
}

interface TokenPriceGraphEdge {
  to: string;
  price: number;
  weight: number;
}

export class ArbitrageDetector {
  detect(snapshot: MarketSnapshot): ArbitrageOpportunity[] {
    const usdPrices = this.computeUsdPrices(snapshot.directQuotes);
    const opportunities: ArbitrageOpportunity[] = [];

    const direct = this.detectDirectArbitrage(snapshot, usdPrices);
    opportunities.push(...direct);

    const triangular = this.detectTriangularArbitrage(snapshot, usdPrices);
    opportunities.push(...triangular);

    const filtered = opportunities
      .filter((opp) => opp.expectedProfitUsd >= config.flashLoan.minProfitUsd)
      .sort((a, b) => b.expectedProfitUsd - a.expectedProfitUsd);

    if (filtered.length > 0) {
      logger.info(`Detected ${filtered.length} profitable opportunities (top ${filtered[0].expectedProfitUsd.toFixed(2)} USD)`);
    }

    return filtered;
  }

  private detectDirectArbitrage(snapshot: MarketSnapshot, usdPrices: Map<string, number>): ArbitrageOpportunity[] {
    const byPair = new Map<string, TokenPairQuote[]>();
    for (const quote of snapshot.directQuotes) {
      const key = `${quote.baseToken.symbol}-${quote.quoteToken.symbol}`;
      const list = byPair.get(key) || [];
      list.push(quote);
      byPair.set(key, list);
    }

    const opportunities: ArbitrageOpportunity[] = [];

    for (const [, quotes] of byPair.entries()) {
      if (quotes.length < 2) continue;

      for (let i = 0; i < quotes.length; i++) {
        for (let j = 0; j < quotes.length; j++) {
          if (i === j) continue;
          const buyQuote = quotes[i];
          const sellQuote = quotes[j];

          const opportunity = this.evaluateDirectPath(buyQuote, sellQuote, usdPrices, snapshot.blockNumber);
          if (opportunity) {
            opportunities.push(opportunity);
          }
        }
      }
    }

    return opportunities;
  }

  private detectTriangularArbitrage(snapshot: MarketSnapshot, usdPrices: Map<string, number>): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];

    const quoteIndex = new Map<string, TokenPairQuote[]>();
    for (const quote of snapshot.directQuotes) {
      const key = `${quote.baseToken.symbol}->${quote.quoteToken.symbol}`;
      const list = quoteIndex.get(key) || [];
      list.push(quote);
      quoteIndex.set(key, list);
    }

    for (const route of TRIANGULAR_ROUTES) {
      const [a, b, c] = route;
      const legsOptions = [
        quoteIndex.get(`${a}->${b}`),
        quoteIndex.get(`${b}->${c}`),
        quoteIndex.get(`${c}->${a}`),
      ];

      if (legsOptions.some((options) => !options || options.length === 0)) continue;

      for (const leg1 of legsOptions[0]!) {
        for (const leg2 of legsOptions[1]!) {
          for (const leg3 of legsOptions[2]!) {
            const opportunity = this.evaluateTriangularPath([
              leg1,
              leg2,
              leg3,
            ], usdPrices, snapshot.blockNumber);
            if (opportunity) {
              opportunities.push(opportunity);
            }
          }
        }
      }
    }

    return opportunities;
  }

  private evaluateDirectPath(
    buyQuote: TokenPairQuote,
    sellQuote: TokenPairQuote,
    usdPrices: Map<string, number>,
    blockNumber: number
  ): ArbitrageOpportunity | null {
    if (buyQuote.dex === sellQuote.dex) return null;

    const buyFeePercent = this.getSwapFeePercent(buyQuote.dex, buyQuote.feeTier);
    const sellFeePercent = this.getSwapFeePercent(sellQuote.dex, sellQuote.feeTier);
    const slippageBuffer = config.execution.maxSlippagePercent;
    const totalCostPercent = buyFeePercent + sellFeePercent + slippageBuffer;

    // Borrow base token, move through buy -> sell
    const grossRatio = buyQuote.priceBaseToQuote * sellQuote.priceQuoteToBase;
    if (!Number.isFinite(grossRatio) || grossRatio <= 0) return null;

    const grossPercent = (grossRatio - 1) * 100;
    const netPercent = grossPercent - totalCostPercent;

    if (netPercent <= config.flashLoan.minProfitMarginPercent) {
      return null;
    }

    const borrowToken = buyQuote.baseToken;
    const borrowTokenUsd = usdPrices.get(borrowToken.symbol);
    if (!borrowTokenUsd || borrowTokenUsd <= 0) {
      return null;
    }

    const liquidityUsd = this.estimateLiquidityUsd(buyQuote, sellQuote, usdPrices);
    if (liquidityUsd < config.liquidity.minLiquidityUsd) {
      return null;
    }

    const notionalUsd = Math.min(
      Math.max(config.flashLoan.minLoanAmountUsd, liquidityUsd * 0.2),
      config.flashLoan.maxLoanAmountUsd
    );

    const borrowAmountHuman = notionalUsd / borrowTokenUsd;
    const borrowAmount = ethers.utils.parseUnits(
      borrowAmountHuman.toFixed(borrowToken.decimals > 6 ? 6 : borrowToken.decimals),
      borrowToken.decimals
    );

    const expectedProfitUsd = (notionalUsd * netPercent) / 100;
    const gasCostUsdEstimate = this.estimateGasCostUsd();

    const netProfitAfterGas = expectedProfitUsd - gasCostUsdEstimate;
    if (netProfitAfterGas < config.flashLoan.minProfitUsd) {
      return null;
    }

    const opp: ArbitrageOpportunity = {
      id: `${buyQuote.baseToken.symbol}-${buyQuote.quoteToken.symbol}-${buyQuote.poolAddress}-${sellQuote.poolAddress}-${blockNumber}`,
      type: 'DIRECT',
      path: [buyQuote.baseToken, buyQuote.quoteToken, buyQuote.baseToken],
      legs: [
        {
          dex: buyQuote.dex,
          poolAddress: buyQuote.poolAddress,
          feeBps: this.getSwapFeeBps(buyQuote.dex, buyQuote.feeTier),
          fromToken: buyQuote.baseToken,
          toToken: buyQuote.quoteToken,
          price: buyQuote.priceBaseToQuote,
        },
        {
          dex: sellQuote.dex,
          poolAddress: sellQuote.poolAddress,
          feeBps: this.getSwapFeeBps(sellQuote.dex, sellQuote.feeTier),
          fromToken: sellQuote.quoteToken,
          toToken: sellQuote.baseToken,
          price: sellQuote.priceQuoteToBase,
        },
      ],
      borrowToken,
      borrowAmount,
      borrowAmountHuman,
      borrowTokenUsd: borrowTokenUsd,
      notionalUsd,
      expectedProfitUsd: netProfitAfterGas,
      expectedProfitPercent: netPercent,
      blockNumber,
      blockTimestamp: Date.now(),
      maxSlippagePercent: slippageBuffer,
      gasCostUsdEstimate,
      liquidityCapUsd: liquidityUsd,
      notes: `Direct arbitrage ${buyQuote.dex} -> ${sellQuote.dex}`,
    };

    return opp;
  }

  private evaluateTriangularPath(
    legs: [TokenPairQuote, TokenPairQuote, TokenPairQuote],
    usdPrices: Map<string, number>,
    blockNumber: number
  ): ArbitrageOpportunity | null {
    const [leg1, leg2, leg3] = legs;

    const tokens = [leg1.baseToken, leg1.quoteToken, leg2.quoteToken];
    const borrowToken = tokens[0];
    const borrowTokenUsd = usdPrices.get(borrowToken.symbol);
    if (!borrowTokenUsd || borrowTokenUsd <= 0) return null;

    const feesPercent =
      this.getSwapFeePercent(leg1.dex, leg1.feeTier) +
      this.getSwapFeePercent(leg2.dex, leg2.feeTier) +
      this.getSwapFeePercent(leg3.dex, leg3.feeTier) +
      config.execution.maxSlippagePercent;

    const grossRatio =
      leg1.priceBaseToQuote * leg2.priceBaseToQuote * leg3.priceBaseToQuote;
    if (!Number.isFinite(grossRatio) || grossRatio <= 0) return null;

    const grossPercent = (grossRatio - 1) * 100;
    const netPercent = grossPercent - feesPercent;

    if (netPercent <= config.flashLoan.minProfitMarginPercent) return null;

    const liquidityUsd = Math.min(
      this.estimateLegLiquidityUsd(leg1, usdPrices),
      this.estimateLegLiquidityUsd(leg2, usdPrices),
      this.estimateLegLiquidityUsd(leg3, usdPrices)
    );

    if (liquidityUsd < config.liquidity.minLiquidityUsd) return null;

    const notionalUsd = Math.min(
      Math.max(config.flashLoan.minLoanAmountUsd, liquidityUsd * 0.15),
      config.flashLoan.maxLoanAmountUsd
    );

    const borrowAmountHuman = notionalUsd / borrowTokenUsd;
    const borrowAmount = ethers.utils.parseUnits(
      borrowAmountHuman.toFixed(borrowToken.decimals > 6 ? 6 : borrowToken.decimals),
      borrowToken.decimals
    );

    const expectedProfitUsd = (notionalUsd * netPercent) / 100;
    const gasCostUsdEstimate = this.estimateGasCostUsd(1.5);
    const netProfitAfterGas = expectedProfitUsd - gasCostUsdEstimate;

    if (netProfitAfterGas < config.flashLoan.minProfitUsd) return null;

    return {
      id: `TRI-${legs.map((leg) => leg.poolAddress.slice(0, 6)).join('-')}-${blockNumber}`,
      type: 'TRIANGULAR',
      path: [legs[0].baseToken, legs[0].quoteToken, legs[1].quoteToken, legs[2].quoteToken],
      legs: [
        this.toDexLeg(leg1),
        this.toDexLeg(leg2),
        this.toDexLeg(leg3),
      ],
      borrowToken,
      borrowAmount,
      borrowAmountHuman,
      borrowTokenUsd: borrowTokenUsd,
      notionalUsd,
      expectedProfitUsd: netProfitAfterGas,
      expectedProfitPercent: netPercent,
      blockNumber,
      blockTimestamp: Date.now(),
      maxSlippagePercent: config.execution.maxSlippagePercent,
      gasCostUsdEstimate,
      liquidityCapUsd: liquidityUsd,
      notes: 'Triangular arbitrage route',
    };
  }

  private computeUsdPrices(quotes: TokenPairQuote[]): Map<string, number> {
    const adjacency = new Map<string, TokenPriceGraphEdge[]>();

    const pushEdge = (from: string, to: string, price: number, weight: number) => {
      if (!Number.isFinite(price) || price <= 0) return;
      const list = adjacency.get(from) || [];
      list.push({ to, price, weight });
      adjacency.set(from, list);
    };

    for (const quote of quotes) {
      pushEdge(quote.baseToken.symbol, quote.quoteToken.symbol, quote.priceBaseToQuote, quote.liquidity);
      pushEdge(quote.quoteToken.symbol, quote.baseToken.symbol, quote.priceQuoteToBase, quote.liquidity);
    }

    const prices = new Map<string, { value: number; weight: number }>();
    const queue: string[] = [];

    for (const stableKey of STABLE_TOKEN_SYMBOLS) {
      const token = TOKENS[stableKey];
      if (!token) continue;
      prices.set(token.symbol, { value: 1, weight: 1 });
      queue.push(token.symbol);
    }

    while (queue.length > 0) {
      const tokenSymbol = queue.shift()!;
      const base = prices.get(tokenSymbol);
      if (!base) continue;

      const edges = adjacency.get(tokenSymbol) || [];
      for (const edge of edges) {
        const derivedValue = base.value * edge.price;
        if (!Number.isFinite(derivedValue) || derivedValue <= 0) continue;

        const existing = prices.get(edge.to);
        const newWeight = (existing?.weight || 0) + edge.weight;
        const newValue = existing
          ? (existing.value * existing.weight + derivedValue * edge.weight) / newWeight
          : derivedValue;

        if (!existing || Math.abs(existing.value - newValue) / existing.value > 0.05) {
          prices.set(edge.to, { value: newValue, weight: newWeight });
          queue.push(edge.to);
        }
      }
    }

    const result = new Map<string, number>();
    for (const [token, { value }] of prices.entries()) {
      result.set(token, value);
    }

    return result;
  }

  private estimateLiquidityUsd(
    buyQuote: TokenPairQuote,
    sellQuote: TokenPairQuote,
    usdPrices: Map<string, number>
  ): number {
    const buyLiquidity = this.estimateLegLiquidityUsd(buyQuote, usdPrices);
    const sellLiquidity = this.estimateLegLiquidityUsd(sellQuote, usdPrices);
    return Math.min(buyLiquidity, sellLiquidity);
  }

  private estimateLegLiquidityUsd(quote: TokenPairQuote, usdPrices: Map<string, number>): number {
    const baseUsd = usdPrices.get(quote.baseToken.symbol) || 0;
    const quoteUsd = usdPrices.get(quote.quoteToken.symbol) || 0;
    if (baseUsd === 0 || quoteUsd === 0) {
      return 0;
    }

    if (quote.dex === 'SushiSwap') {
      // We can estimate from reserves stored as liquidity on snapshot
      const baseValue = quote.liquidity * baseUsd;
      return baseValue * 2; // approximate total value of pool
    }

    // For Uniswap v3 we rely on aggregated liquidity number heuristics
    return quote.liquidity * ((baseUsd + quoteUsd) / 2);
  }

  private getSwapFeePercent(dex: DexType, feeTier?: number): number {
    return this.getSwapFeeBps(dex, feeTier) / 10000;
  }

  private getSwapFeeBps(dex: DexType, feeTier?: number): number {
    if (dex === 'UniswapV3') {
      return feeTier ?? 3000;
    }
    if (dex === 'SushiSwap') {
      return 3000;
    }
    if (dex === 'Balancer') {
      return 1500;
    }
    if (dex === 'Curve') {
      return 400;
    }
    return 3000;
  }

  private estimateGasCostUsd(multiplier = 1): number {
    const baseGasCostUsd = 15; // conservative assumption on Arbitrum
    return baseGasCostUsd * multiplier;
  }

  private toDexLeg(quote: TokenPairQuote): DexLeg {
    return {
      dex: quote.dex,
      poolAddress: quote.poolAddress,
      feeBps: this.getSwapFeeBps(quote.dex, quote.feeTier),
      fromToken: quote.baseToken,
      toToken: quote.quoteToken,
      price: quote.priceBaseToQuote,
    };
  }
}
