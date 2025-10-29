require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("hardhat-contract-sizer");
require('dotenv').config({ path: '.env.production' });

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0000000000000000000000000000000000000000000000000000000000000000";
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000000, // Optimize for gas efficiency
      },
      viaIR: true, // Enable IR-based code generation for better optimization
    },
  },
  
  networks: {
    hardhat: {
      chainId: 31337,
      forking: {
        url: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
        enabled: false,
      },
    },
    
    arbitrum: {
      url: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      chainId: 42161,
      accounts: PRIVATE_KEY !== "0000000000000000000000000000000000000000000000000000000000000000" 
        ? [PRIVATE_KEY] 
        : [],
      gasPrice: 100000000, // 0.1 gwei (Arbitrum is cheap)
    },
    
    'arbitrum-sepolia': {
      url: `https://arb-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      chainId: 421614,
      accounts: PRIVATE_KEY !== "0000000000000000000000000000000000000000000000000000000000000000" 
        ? [PRIVATE_KEY] 
        : [],
    },
  },

  etherscan: {
    apiKey: {
      arbitrumOne: process.env.ARBISCAN_API_KEY || "",
    },
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },

  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },

  mocha: {
    timeout: 200000, // 200 seconds
  },
};
