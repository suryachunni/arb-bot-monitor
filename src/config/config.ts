import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Telegram
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN!,
    chatId: process.env.TELEGRAM_CHAT_ID!,
  },
  
  // Network
  network: {
    rpcUrl: process.env.ARBITRUM_RPC_URL!,
    chainId: 42161,
  },
  
  // Wallet
  wallet: {
    privateKey: process.env.PRIVATE_KEY!,
  },
  
  // Flash Loan
  flashLoan: {
    minProfitUSD: parseFloat(process.env.MIN_PROFIT_USD || '100'),
    minLoanAmountUSD: parseFloat(process.env.MIN_LOAN_AMOUNT_USD || '50000'),
    maxLoanAmountUSD: parseFloat(process.env.MAX_LOAN_AMOUNT_USD || '500000'),
    maxGasPriceGwei: parseFloat(process.env.MAX_GAS_PRICE_GWEI || '0.5'),
  },
  
  // MEV Protection
  mev: {
    flashbotsRpc: process.env.FLASHBOTS_RPC || 'https://rpc.flashbots.net',
    usePrivateRpc: process.env.USE_PRIVATE_RPC === 'true',
  },
  
  // Monitoring
  monitoring: {
    scanIntervalMs: parseInt(process.env.SCAN_INTERVAL_MS || '10000'),
    maxSlippagePercent: parseFloat(process.env.MAX_SLIPPAGE_PERCENT || '0.5'),
    gasLimitMultiplier: parseFloat(process.env.GAS_LIMIT_MULTIPLIER || '1.2'),
  },
  
  // Contract
  contract: {
    address: process.env.ARBITRAGE_CONTRACT_ADDRESS || '',
  },
  
  // DEX Configuration
  dex: {
    enableUniswapV3: process.env.ENABLE_UNISWAP_V3 === 'true',
    enableSushiSwap: process.env.ENABLE_SUSHISWAP === 'true',
    enableCamelot: process.env.ENABLE_CAMELOT === 'true',
    enableBalancer: process.env.ENABLE_BALANCER === 'true',
    enableCurve: process.env.ENABLE_CURVE === 'true',
  },
};

export function validateConfig() {
  const required = [
    'telegram.botToken',
    'telegram.chatId',
    'network.rpcUrl',
    'wallet.privateKey',
  ];
  
  for (const key of required) {
    const keys = key.split('.');
    let value: any = config;
    for (const k of keys) {
      value = value[k];
    }
    if (!value || value === 'your_private_key_here') {
      throw new Error(`Missing required config: ${key}`);
    }
  }
}
