/**
 * ═══════════════════════════════════════════════════════════════════
 * PRODUCTION DEPLOYMENT SCRIPT
 * Deploy Flash Loan Contract to Arbitrum Mainnet
 * ═══════════════════════════════════════════════════════════════════
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  DEPLOYING FLASH LOAN CONTRACT - ARBITRUM MAINNET');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  const balance = await deployer.getBalance();

  console.log('📍 Deployer Address:', deployer.address);
  console.log('💰 Deployer Balance:', ethers.utils.formatEther(balance), 'ETH');

  if (balance.lt(ethers.utils.parseEther('0.01'))) {
    console.error('\n❌ Insufficient ETH balance for deployment (need at least 0.01 ETH)');
    process.exit(1);
  }

  console.log('\n🔨 Compiling contracts...');

  // Deploy FlashLoanArbitrageV2
  console.log('\n📦 Deploying FlashLoanArbitrageV2...');
  
  const FlashLoanArbitrage = await ethers.getContractFactory('FlashLoanArbitrageV2');
  const flashLoanContract = await FlashLoanArbitrage.deploy(
    deployer.address // Profit receiver
  );

  await flashLoanContract.deployed();

  console.log('✅ Contract deployed at:', flashLoanContract.address);
  console.log('🔗 Transaction:', flashLoanContract.deployTransaction.hash);

  // Wait for confirmations
  console.log('\n⏳ Waiting for confirmations...');
  await flashLoanContract.deployTransaction.wait(5);
  console.log('✅ 5 confirmations received');

  // Verify contract configuration
  console.log('\n🔍 Verifying contract configuration...');
  
  const config = await flashLoanContract.getConfiguration();
  console.log('├─ Min Profit (bps):', config.minProfit.toString());
  console.log('├─ Max Slippage (bps):', config.maxSlippage.toString());
  console.log('├─ Profit Receiver:', config.receiver);
  console.log('└─ Emergency Stop:', config.stopped);

  // Get contract statistics
  const stats = await flashLoanContract.getStatistics();
  console.log('\n📊 Contract Statistics:');
  console.log('├─ Total Arbitrages:', stats.executed.toString());
  console.log('├─ Total Profit:', ethers.utils.formatEther(stats.profit), 'ETH');
  console.log('└─ Total Gas Used:', stats.gasUsed.toString());

  // Update .env.production file
  console.log('\n📝 Updating .env.production...');
  
  const envPath = path.join(__dirname, '..', '.env.production');
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Update contract address
  envContent = envContent.replace(
    /FLASH_LOAN_CONTRACT_ADDRESS=.*/,
    `FLASH_LOAN_CONTRACT_ADDRESS=${flashLoanContract.address}`
  );
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env.production updated');

  // Save deployment info
  const deploymentInfo = {
    network: 'arbitrum',
    chainId: 42161,
    contractAddress: flashLoanContract.address,
    deployerAddress: deployer.address,
    deploymentTxHash: flashLoanContract.deployTransaction.hash,
    blockNumber: flashLoanContract.deployTransaction.blockNumber,
    timestamp: new Date().toISOString(),
    contractName: 'FlashLoanArbitrageV2',
  };

  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const deploymentFile = path.join(deploymentsDir, 'arbitrum-mainnet.json');
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log('✅ Deployment info saved to:', deploymentFile);

  // Print summary
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  DEPLOYMENT SUCCESSFUL!');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('\n📋 DEPLOYMENT SUMMARY:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Contract Address: ${flashLoanContract.address}`);
  console.log(`Transaction Hash: ${flashLoanContract.deployTransaction.hash}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Network: Arbitrum Mainnet`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\n📌 NEXT STEPS:');
  console.log('1. Verify contract on Arbiscan (optional but recommended):');
  console.log(`   npx hardhat verify --network arbitrum ${flashLoanContract.address} "${deployer.address}"`);
  console.log('\n2. Fund the wallet with ETH for gas fees');
  console.log('\n3. Start the bot:');
  console.log('   npm run build');
  console.log('   npm start');
  
  console.log('\n🔗 View on Arbiscan:');
  console.log(`   https://arbiscan.io/address/${flashLoanContract.address}`);
  
  console.log('\n═══════════════════════════════════════════════════════════════════\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  });
