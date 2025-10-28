import { ethers } from 'hardhat';
import { logger } from '../src/utils/logger';

async function main() {
  logger.info('🚀 Deploying Flash Loan Arbitrage Contract to Arbitrum...');

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  logger.info(`Deploying with account: ${deployer.address}`);

  // Check balance
  const balance = await deployer.getBalance();
  logger.info(`Account balance: ${ethers.utils.formatEther(balance)} ETH`);

  if (balance.lt(ethers.utils.parseEther('0.01'))) {
    throw new Error('Insufficient balance for deployment. Need at least 0.01 ETH');
  }

  // Deploy the contract
  const FlashLoanArbitrageV2 = await ethers.getContractFactory('FlashLoanArbitrageV2');
  
  logger.info('Deploying contract...');
  const contract = await FlashLoanArbitrageV2.deploy(deployer.address);
  
  logger.info(`Contract deployed to: ${contract.address}`);
  logger.info(`Transaction hash: ${contract.deployTransaction.hash}`);
  
  // Wait for deployment to be mined
  await contract.deployed();
  logger.info('✅ Contract deployed successfully!');

  // Verify deployment
  const owner = await contract.owner();
  const profitReceiver = await contract.profitReceiver();
  
  logger.info(`Contract owner: ${owner}`);
  logger.info(`Profit receiver: ${profitReceiver}`);

  // Update .env file with contract address
  const fs = require('fs');
  const envPath = '.env';
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  if (envContent.includes('ARBITRAGE_CONTRACT_ADDRESS=')) {
    envContent = envContent.replace(
      /ARBITRAGE_CONTRACT_ADDRESS=.*/,
      `ARBITRAGE_CONTRACT_ADDRESS=${contract.address}`
    );
  } else {
    envContent += `\nARBITRAGE_CONTRACT_ADDRESS=${contract.address}`;
  }
  
  fs.writeFileSync(envPath, envContent);
  logger.info('✅ Updated .env file with contract address');

  // Display deployment summary
  logger.info('');
  logger.info('═══════════════════════════════════════════════════════');
  logger.info('   DEPLOYMENT SUCCESSFUL!');
  logger.info('═══════════════════════════════════════════════════════');
  logger.info(`Contract Address: ${contract.address}`);
  logger.info(`Owner: ${owner}`);
  logger.info(`Profit Receiver: ${profitReceiver}`);
  logger.info(`Network: Arbitrum Mainnet`);
  logger.info('');
  logger.info('Next steps:');
  logger.info('1. Fund your wallet with ETH for gas fees');
  logger.info('2. Add your private key to .env file');
  logger.info('3. Run: npm run start');
  logger.info('');
  logger.info('🔗 View on Arbiscan:');
  logger.info(`https://arbiscan.io/address/${contract.address}`);
  logger.info('═══════════════════════════════════════════════════════');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error('Deployment failed:', error);
    process.exit(1);
  });