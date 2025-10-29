import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/**
 * PRODUCTION DEPLOYMENT SCRIPT
 * 
 * Deploys FlashLoanArbitrageProduction contract to Arbitrum mainnet
 * and saves the address to .env file
 */

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('   DEPLOYING FLASH LOAN ARBITRAGE CONTRACT - ARBITRUM MAINNET');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const [deployer] = await ethers.getSigners();
  
  console.log('📍 Deployer address:', deployer.address);
  
  const balance = await deployer.getBalance();
  console.log('💰 Deployer balance:', ethers.utils.formatEther(balance), 'ETH');
  
  if (balance.lt(ethers.utils.parseEther('0.01'))) {
    console.error('❌ Insufficient ETH for deployment. Need at least 0.01 ETH');
    process.exit(1);
  }

  console.log('\n🚀 Deploying FlashLoanArbitrageProduction...\n');

  // Get contract factory
  const FlashLoanArbitrage = await ethers.getContractFactory('FlashLoanArbitrageProduction');

  // Deploy with profit receiver = deployer address
  const contract = await FlashLoanArbitrage.deploy(deployer.address, {
    gasLimit: 3000000, // Set explicit gas limit
  });

  console.log('⏳ Waiting for deployment transaction...');
  await contract.deployed();

  console.log('\n✅ Contract deployed successfully!');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('📝 Contract Address:', contract.address);
  console.log('📝 Deployer Address:', deployer.address);
  console.log('📝 Profit Receiver:', deployer.address);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Save contract address to .env
  const envPath = path.join(__dirname, '..', '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');

  // Update or add ARBITRAGE_CONTRACT_ADDRESS
  if (envContent.includes('ARBITRAGE_CONTRACT_ADDRESS=')) {
    envContent = envContent.replace(
      /ARBITRAGE_CONTRACT_ADDRESS=.*/,
      `ARBITRAGE_CONTRACT_ADDRESS=${contract.address}`
    );
  } else {
    envContent += `\nARBITRAGE_CONTRACT_ADDRESS=${contract.address}\n`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log('✅ Contract address saved to .env file\n');

  // Save deployment info
  const deploymentInfo = {
    network: 'arbitrum',
    contractAddress: contract.address,
    deployerAddress: deployer.address,
    profitReceiver: deployer.address,
    deploymentTime: new Date().toISOString(),
    transactionHash: contract.deployTransaction.hash,
    blockNumber: contract.deployTransaction.blockNumber,
  };

  const deploymentPath = path.join(__dirname, '..', 'deployment.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log('✅ Deployment info saved to deployment.json\n');

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('   NEXT STEPS');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('1. Verify your PRIVATE_KEY is set in .env (your deployer key)');
  console.log('2. Make sure you have ETH in your wallet for gas fees');
  console.log('3. Start the bot: npm run start:production');
  console.log('4. Monitor Telegram for alerts');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log('🎉 Deployment complete! Your bot is ready to start.\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
