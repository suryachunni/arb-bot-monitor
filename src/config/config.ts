import dotenv from 'dotenv';

dotenv.config();

const BASE_REQUIRED_ENV_VARS = [
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'ARBITRUM_RPC_URL',
];

const numberFromEnv = (key: string, fallback: number): number => {
  const raw = process.env[key];
  if (!raw || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid numeric value for ${key}: ${raw}`);
  }
  return parsed;
};

const boolFromEnv = (key: string, fallback: boolean = false): boolean => {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
};

const scanOnly = boolFromEnv('SCAN_ONLY', false);
const autoExecuteEnv = boolFromEnv('AUTO_EXECUTE', true);
const runtimeAutoExecute = scanOnly ? false : autoExecuteEnv;

export const config = {
  env: {
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },

  runtime: {
    scanOnly,
    autoExecute: runtimeAutoExecute,
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },

  network: {
    rpcUrl: process.env.ARBITRUM_RPC_URL || '',
    websocketUrl: process.env.ARBITRUM_WEBSOCKET_URL || '',
    chainId: 42161,
  },

  flashbots: {
    rpcUrl: process.env.FLASHBOTS_RPC_URL || 'https://rpc.flashbots.net',
    enabled: boolFromEnv('USE_FLASHBOTS', true),
  },

  wallet: {
    privateKey: process.env.PRIVATE_KEY || '',
  },

  flashLoan: {
    minProfitUsd: numberFromEnv('MIN_PROFIT_USD', 150),
    minProfitMarginPercent: numberFromEnv('MIN_PROFIT_MARGIN_PERCENT', 0.6),
    minLoanAmountUsd: numberFromEnv('MIN_LOAN_AMOUNT_USD', 1_000),
    maxLoanAmountUsd: numberFromEnv('MAX_LOAN_AMOUNT_USD', 2_000_000),
    loanStepUsd: numberFromEnv('LOAN_STEP_USD', 50_000),
  },

  execution: {
    maxGasPriceGwei: numberFromEnv('MAX_GAS_PRICE_GWEI', 2),
    gasLimitMultiplier: numberFromEnv('GAS_LIMIT_MULTIPLIER', 1.25),
    deadlineSeconds: numberFromEnv('EXECUTION_DEADLINE_SECONDS', 120),
    reverifyToleranceBps: numberFromEnv('REVERIFY_TOLERANCE_BPS', 25),
    maxSlippagePercent: numberFromEnv('MAX_SLIPPAGE_PERCENT', 0.35),
  },

  liquidity: {
    minLiquidityUsd: numberFromEnv('MIN_LIQUIDITY_USD', 5_000_000),
    maxPriceImpactPercent: numberFromEnv('MAX_PRICE_IMPACT_PERCENT', 3),
    maxSpreadPercent: numberFromEnv('MAX_SPREAD_PERCENT', 12),
  },

  monitoring: {
    scanIntervalMs: numberFromEnv('SCAN_INTERVAL_MS', 120_000),
    scanBlockLookback: numberFromEnv('SCAN_BLOCK_LOOKBACK', 0),
    multicallBatchSize: numberFromEnv('MULTICALL_BATCH_SIZE', 20),
    priceCacheMs: numberFromEnv('PRICE_CACHE_MS', 500),
  },

  contract: {
    arbitrageAddress: process.env.ARBITRAGE_CONTRACT_ADDRESS || '',
  },
};

export function validateConfig() {
  const requiredEnvVars = [...BASE_REQUIRED_ENV_VARS];
  if (!config.runtime.scanOnly) {
    requiredEnvVars.push('PRIVATE_KEY');
  }

  const missing = requiredEnvVars.filter((key) => {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      return true;
    }
    if (key === 'PRIVATE_KEY' && value === 'your_private_key_here') {
      return true;
    }
    return false;
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (!config.runtime.scanOnly && !config.contract.arbitrageAddress) {
    throw new Error('Missing required config: contract.arbitrageAddress');
  }

  if (config.flashLoan.minLoanAmountUsd > config.flashLoan.maxLoanAmountUsd) {
    throw new Error('MIN_LOAN_AMOUNT_USD must be <= MAX_LOAN_AMOUNT_USD');
  }

  if (config.flashLoan.loanStepUsd <= 0) {
    throw new Error('LOAN_STEP_USD must be greater than 0');
  }

  if (config.execution.maxGasPriceGwei <= 0) {
    throw new Error('MAX_GAS_PRICE_GWEI must be greater than 0');
  }

  if (config.execution.deadlineSeconds < 30) {
    throw new Error('EXECUTION_DEADLINE_SECONDS must be at least 30 seconds');
  }

  if (config.execution.reverifyToleranceBps < 0 || config.execution.reverifyToleranceBps > 10_000) {
    throw new Error('REVERIFY_TOLERANCE_BPS must be between 0 and 10,000');
  }
}
