import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Network Configuration
  arbitrum: {
    rpcUrl: process.env.ALCHEMY_URL || 'https://arb-mainnet.g.alchemy.com/v2/wuLT9bA29g4SF1zeOlgpg',
    chainId: 42161,
    name: 'Arbitrum One'
  },

  // Token Configuration
  tokens: {
    WETH: {
      address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      symbol: 'WETH',
      decimals: 18,
      name: 'Wrapped Ether'
    },
    USDC: {
      address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      symbol: 'USDC',
      decimals: 6,
      name: 'USD Coin'
    },
    USDT: {
      address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      symbol: 'USDT',
      decimals: 6,
      name: 'Tether USD'
    }
  },

  // DEX Configuration
  dexs: {
    uniswapV3: {
      name: 'Uniswap V3',
      router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      feeTiers: [500, 3000, 10000] // 0.05%, 0.3%, 1%
    },
    sushiswap: {
      name: 'SushiSwap',
      router: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
      factory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4'
    },
    curve: {
      name: 'Curve',
      router: '0x094d12e5b541784701FD8d65F11fc0598FBC6332',
      pools: [
        '0x7f90122BF0700F9E7e1F688fe926940E8839F353', // USDC/WETH
        '0x960ea3e3C7FB317332d990873d354E18d3fA0B2C'  // USDT/WETH
      ]
    },
    balancer: {
      name: 'Balancer V2',
      vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
      pools: [
        '0x64541216bafffeec8ea535bb71fbc927831d0595' // WETH/USDC
      ]
    },
    camelot: {
      name: 'Camelot',
      router: '0xc873fEcbd354f5A56E00E710B90EF4201db2448d',
      factory: '0x6EcCab422D763aC0312105C4eDd4e7C05E6f9F05'
    },
    kyber: {
      name: 'KyberSwap',
      router: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
      factory: '0x5F1dddbf348bC2f7517D4D2C2e0b5c4C3b2C3C3'
    }
  },

  // Monitoring Configuration
  monitoring: {
    updateInterval: parseInt(process.env.UPDATE_INTERVAL_MS) || 1000,
    maxPriceAge: parseInt(process.env.MAX_PRICE_AGE_MS) || 5000,
    minLiquidity: 10000, // Minimum liquidity in USD
    minArbitrageSpread: 0.5 // Minimum 0.5% spread for arbitrage
  }
};

export default config;