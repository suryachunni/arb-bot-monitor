/**
 * ═══════════════════════════════════════════════════════════════════
 * PRODUCTION CONFIGURATION
 * Ultra-Fast Flash Loan Arbitrage Bot
 * ═══════════════════════════════════════════════════════════════════
 */

import * as dotenv from 'dotenv';
import { ethers } from 'ethers';

// Load environment variables
dotenv.config({ path: '.env.production' });

export interface ProductionConfig {
  // Network
  network: {
    rpcUrl: string;
    alchemyKey: string;
    chainId: number;
    name: string;
  };

  // Wallet
  wallet: {
    privateKey: string;
  };

  // Telegram
  telegram: {
    botToken: string;
    chatId: string;
  };

  // Flash Loan
  flashLoan: {
    minLoanAmountUSD: number;
    maxLoanAmountUSD: number;
    minProfitUSD: number;
    minProfitPercentage: number;
    aaveFeeBps: number;
  };

  // Trading
  trading: {
    maxSlippageBps: number;
    gasPriceMultiplier: number;
    maxGasPriceGwei: number;
    txDeadlineSeconds: number;
  };

  // Scanning
  scanning: {
    scanIntervalMs: number;
    priceUpdateIntervalMs: number;
    enableBidirectional: boolean;
  };

  // MEV Protection
  mev: {
    enabled: boolean;
    flashbotsRpcUrl: string;
  };

  // Automation
  automation: {
    autoExecute: boolean;
    sendTelegramAlerts: boolean;
    requireManualConfirmation: boolean;
  };

  // Contract Addresses
  contracts: {
    flashLoanContract: string;
    aavePoolProvider: string;
    uniswapV3Router: string;
    sushiswapRouter: string;
    camelotRouter: string;
    balancerVault: string;
  };

  // Monitoring
  monitoring: {
    logLevel: string;
    enablePerformanceMonitoring: boolean;
    enableTradeLogging: boolean;
  };
}

/**
 * Validate and parse production configuration
 */
export function loadProductionConfig(): ProductionConfig {
  const config: ProductionConfig = {
    network: {
      rpcUrl: process.env.RPC_URL || '',
      alchemyKey: process.env.ALCHEMY_API_KEY || '',
      chainId: parseInt(process.env.CHAIN_ID || '42161'),
      name: process.env.NETWORK || 'arbitrum',
    },

    wallet: {
      privateKey: process.env.PRIVATE_KEY || '',
    },

    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: process.env.TELEGRAM_CHAT_ID || '',
    },

    flashLoan: {
      minLoanAmountUSD: parseFloat(process.env.MIN_LOAN_AMOUNT_USD || '50000'),
      maxLoanAmountUSD: parseFloat(process.env.MAX_LOAN_AMOUNT_USD || '500000'),
      minProfitUSD: parseFloat(process.env.MIN_PROFIT_USD || '100'),
      minProfitPercentage: parseFloat(process.env.MIN_PROFIT_PERCENTAGE || '0.5'),
      aaveFeeBps: parseInt(process.env.AAVE_FLASH_LOAN_FEE_BPS || '5'),
    },

    trading: {
      maxSlippageBps: parseInt(process.env.MAX_SLIPPAGE_BPS || '50'),
      gasPriceMultiplier: parseFloat(process.env.GAS_PRICE_MULTIPLIER || '1.5'),
      maxGasPriceGwei: parseFloat(process.env.MAX_GAS_PRICE_GWEI || '0.5'),
      txDeadlineSeconds: parseInt(process.env.TX_DEADLINE_SECONDS || '120'),
    },

    scanning: {
      scanIntervalMs: parseInt(process.env.SCAN_INTERVAL_MS || '600000'), // 10 minutes
      priceUpdateIntervalMs: parseInt(process.env.PRICE_UPDATE_INTERVAL_MS || '1000'),
      enableBidirectional: process.env.ENABLE_BIDIRECTIONAL_SCAN === 'true',
    },

    mev: {
      enabled: process.env.ENABLE_MEV_PROTECTION === 'true',
      flashbotsRpcUrl: process.env.FLASHBOTS_RPC_URL || 'https://rpc.flashbots.net',
    },

    automation: {
      autoExecute: process.env.AUTO_EXECUTE === 'true',
      sendTelegramAlerts: process.env.SEND_TELEGRAM_ALERTS === 'true',
      requireManualConfirmation: process.env.REQUIRE_MANUAL_CONFIRMATION === 'true',
    },

    contracts: {
      flashLoanContract: process.env.FLASH_LOAN_CONTRACT_ADDRESS || '',
      aavePoolProvider: process.env.AAVE_POOL_PROVIDER || '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb',
      uniswapV3Router: process.env.UNISWAP_V3_ROUTER || '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      sushiswapRouter: process.env.SUSHISWAP_ROUTER || '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
      camelotRouter: process.env.CAMELOT_ROUTER || '0xc873fEcbd354f5A56E00E710B90EF4201db2448d',
      balancerVault: process.env.BALANCER_VAULT || '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    },

    monitoring: {
      logLevel: process.env.LOG_LEVEL || 'info',
      enablePerformanceMonitoring: process.env.ENABLE_PERFORMANCE_MONITORING === 'true',
      enableTradeLogging: process.env.ENABLE_TRADE_LOGGING === 'true',
    },
  };

  // Validate critical configuration
  validateProductionConfig(config);

  return config;
}

/**
 * Validate production configuration
 */
function validateProductionConfig(config: ProductionConfig): void {
  const errors: string[] = [];

  // Network validation
  if (!config.network.rpcUrl) {
    errors.push('RPC_URL is required');
  }

  // Wallet validation
  if (!config.wallet.privateKey || config.wallet.privateKey === 'YOUR_PRIVATE_KEY_HERE') {
    errors.push('PRIVATE_KEY is required - please set your wallet private key in .env.production');
  } else {
    try {
      new ethers.Wallet(config.wallet.privateKey);
    } catch (error) {
      errors.push('PRIVATE_KEY is invalid - please check your private key format');
    }
  }

  // Telegram validation
  if (!config.telegram.botToken) {
    errors.push('TELEGRAM_BOT_TOKEN is required');
  }
  if (!config.telegram.chatId) {
    errors.push('TELEGRAM_CHAT_ID is required');
  }

  // Contract validation
  if (!config.contracts.flashLoanContract) {
    console.warn('⚠️  WARNING: FLASH_LOAN_CONTRACT_ADDRESS not set. Please deploy contract first.');
  }

  // Throw error if validation failed
  if (errors.length > 0) {
    throw new Error(`Production configuration validation failed:\n${errors.join('\n')}`);
  }

  console.log('✅ Production configuration validated successfully');
}

// Export singleton instance
export const productionConfig = loadProductionConfig();
