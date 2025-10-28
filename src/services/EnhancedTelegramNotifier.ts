import { TelegramNotifier } from './TelegramBot';
import { LivePriceData } from './LiveMarketScanner';
import { logger } from '../utils/logger';

export interface DetailedArbitrageAlert {
  tokenA: string;
  tokenB: string;
  buyDex: string;
  sellDex: string;
  profitPercentage: number;
  estimatedProfitUSD: number;
  buyPrice: string;
  sellPrice: string;
  buyLiquidity: string;
  sellLiquidity: string;
  buyLiquidityUSD: number;
  sellLiquidityUSD: number;
  recommendedLoanSize: string;
  recommendedLoanSizeUSD: number;
  priceImpact: number;
  confidence: number;
  riskLevel: string;
  gasEstimate: number;
  gasCostUSD: number;
  netProfitUSD: number;
  roi: number;
  executionPriority: number;
}

export class EnhancedTelegramNotifier extends TelegramNotifier {
  
  /**
   * Send detailed arbitrage alert with all data
   */
  async sendDetailedArbitrageAlert(alert: DetailedArbitrageAlert): Promise<void> {
    try {
      const message = this.formatDetailedAlert(alert);
      await this.sendMessage(message);
      logger.info(`📱 Sent detailed arbitrage alert for ${alert.tokenA}/${alert.tokenB}`);
    } catch (error) {
      logger.error('Failed to send detailed arbitrage alert:', error);
    }
  }

  /**
   * Send live market scan results
   */
  async sendLiveMarketResults(
    prices: LivePriceData[],
    scanTime: number,
    successfulPairs: number,
    totalPairs: number,
    averageLatency: number,
    errors: string[]
  ): Promise<void> {
    try {
      const message = this.formatLiveMarketResults(
        prices,
        scanTime,
        successfulPairs,
        totalPairs,
        averageLatency,
        errors
      );
      await this.sendMessage(message);
      logger.info('📱 Sent live market scan results');
    } catch (error) {
      logger.error('Failed to send live market results:', error);
    }
  }

  /**
   * Format detailed arbitrage alert
   */
  private formatDetailedAlert(alert: DetailedArbitrageAlert): string {
    let message = '';
    
    // Header
    message += '🎯 ARBITRAGE OPPORTUNITY DETECTED\n';
    message += '═'.repeat(40) + '\n\n';
    
    // Basic info
    message += `🪙 Pair: ${alert.tokenA}/${alert.tokenB}\n`;
    message += `💰 Profit: ${alert.profitPercentage.toFixed(3)}%\n`;
    message += `💵 Est. Profit: $${alert.estimatedProfitUSD.toFixed(2)}\n\n`;
    
    // DEX info
    message += '📊 DEX DETAILS\n';
    message += '─'.repeat(20) + '\n';
    message += `🟢 Buy: ${alert.buyDex}\n`;
    message += `   💰 Price: ${alert.buyPrice}\n`;
    message += `   💧 Liquidity: ${alert.buyLiquidity} ($${alert.buyLiquidityUSD.toFixed(0)})\n\n`;
    message += `🔴 Sell: ${alert.sellDex}\n`;
    message += `   💰 Price: ${alert.sellPrice}\n`;
    message += `   💧 Liquidity: ${alert.sellLiquidity} ($${alert.sellLiquidityUSD.toFixed(0)})\n\n`;
    
    // Loan details
    message += '💳 LOAN DETAILS\n';
    message += '─'.repeat(20) + '\n';
    message += `📏 Recommended Size: ${alert.recommendedLoanSize}\n`;
    message += `💵 Loan Value: $${alert.recommendedLoanSizeUSD.toFixed(2)}\n`;
    message += `📊 ROI: ${alert.roi.toFixed(2)}%\n\n`;
    
    // Risk assessment
    message += '⚠️ RISK ASSESSMENT\n';
    message += '─'.repeat(25) + '\n';
    message += `🎯 Risk Level: ${alert.riskLevel}\n`;
    message += `📈 Confidence: ${(alert.confidence * 100).toFixed(1)}%\n`;
    message += `💥 Price Impact: ${(alert.priceImpact * 100).toFixed(2)}%\n`;
    message += `🎯 Priority: ${alert.executionPriority}\n\n`;
    
    // Cost breakdown
    message += '💸 COST BREAKDOWN\n';
    message += '─'.repeat(25) + '\n';
    message += `⛽ Gas Estimate: ${alert.gasEstimate.toLocaleString()}\n`;
    message += `💵 Gas Cost: $${alert.gasCostUSD.toFixed(2)}\n`;
    message += `💰 Net Profit: $${alert.netProfitUSD.toFixed(2)}\n\n`;
    
    // Action
    message += '🚀 ACTION REQUIRED\n';
    message += '─'.repeat(25) + '\n';
    message += '🤖 Bot will execute automatically\n';
    message += '⏰ Execution time: <500ms\n';
    message += '📱 Monitor for results\n\n';
    
    message += '🤖 Bot Status: ACTIVE';
    
    return message;
  }

  /**
   * Format live market scan results
   */
  private formatLiveMarketResults(
    prices: LivePriceData[],
    scanTime: number,
    successfulPairs: number,
    totalPairs: number,
    averageLatency: number,
    errors: string[]
  ): string {
    let message = '';
    
    // Header
    message += '🔍 LIVE MARKET SCAN RESULTS\n';
    message += '═'.repeat(40) + '\n\n';
    
    // Performance metrics
    message += '⚡ PERFORMANCE METRICS\n';
    message += '─'.repeat(25) + '\n';
    message += `⏱️ Scan Time: ${scanTime}ms\n`;
    message += `📊 Success Rate: ${((successfulPairs / totalPairs) * 100).toFixed(1)}%\n`;
    message += `📈 Pairs Scanned: ${successfulPairs}/${totalPairs}\n`;
    message += `⚡ Avg Latency: ${averageLatency.toFixed(0)}ms\n\n`;
    
    // Price data
    if (prices.length > 0) {
      message += '💰 LIVE PRICES\n';
      message += '─'.repeat(20) + '\n';
      
      // Group by pair
      const pairGroups = this.groupPricesByPair(prices);
      
      for (const [pair, pairPrices] of pairGroups.entries()) {
        message += `\n🪙 ${pair}\n`;
        
        for (const price of pairPrices) {
          message += `  ${price.dex}: ${price.price} `;
          message += `($${price.liquidityUSD.toFixed(0)} liquidity)\n`;
        }
      }
      
      message += '\n';
    }
    
    // Errors
    if (errors.length > 0) {
      message += '❌ ERRORS\n';
      message += '─'.repeat(15) + '\n';
      errors.slice(0, 5).forEach(error => {
        message += `• ${error}\n`;
      });
      if (errors.length > 5) {
        message += `• ... and ${errors.length - 5} more errors\n`;
      }
      message += '\n';
    }
    
    // Summary
    message += '📊 SUMMARY\n';
    message += '─'.repeat(15) + '\n';
    message += `🎯 Total Prices: ${prices.length}\n`;
    message += `⚡ Scan Speed: ${scanTime}ms\n`;
    message += `📱 Status: ${errors.length > 0 ? '⚠️ Some errors' : '✅ All good'}\n\n`;
    
    message += '🤖 Bot Status: ACTIVE\n';
    message += '⏰ Next Scan: 10 minutes';
    
    return message;
  }

  /**
   * Group prices by pair
   */
  private groupPricesByPair(prices: LivePriceData[]): Map<string, LivePriceData[]> {
    const groups = new Map<string, LivePriceData[]>();
    
    for (const price of prices) {
      const pair = `${price.tokenA}/${price.tokenB}`;
      if (!groups.has(pair)) {
        groups.set(pair, []);
      }
      groups.get(pair)!.push(price);
    }
    
    return groups;
  }
}