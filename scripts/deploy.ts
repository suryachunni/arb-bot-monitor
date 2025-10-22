import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('🚀 Deploying Flash Loan Arbitrage Contract to Arbitrum...\n');

  const [deployer] = await ethers.getSigners();
  console.log('📍 Deploying with account:', deployer.address);
  
  const balance = await deployer.getBalance();
  console.log('💰 Account balance:', ethers.utils.formatEther(balance), 'ETH\n');

  // Deploy contract
  console.log('📝 Deploying FlashLoanArbitrage contract...');
  const FlashLoanArbitrage = await ethers.getContractFactory('FlashLoanArbitrage');
  const contract = await FlashLoanArbitrage.deploy();
  
  await contract.deployed();
  
  console.log('✅ Contract deployed to:', contract.address);
  console.log('🔗 View on Arbiscan: https://arbiscan.io/address/' + contract.address);
  console.log('');

  // Update .env file with contract address
  const envPath = path.join(__dirname, '..', '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
    
    // Update or add contract address
    if (envContent.includes('ARBITRAGE_CONTRACT_ADDRESS=')) {
      envContent = envContent.replace(
        /ARBITRAGE_CONTRACT_ADDRESS=.*/,
        `ARBITRAGE_CONTRACT_ADDRESS=${contract.address}`
      );
    } else {
      envContent += `\nARBITRAGE_CONTRACT_ADDRESS=${contract.address}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Updated .env file with contract address');
  }

  // Save deployment info
  const deploymentInfo = {
    contractAddress: contract.address,
    deployer: deployer.address,
    network: 'arbitrum',
    timestamp: new Date().toISOString(),
    blockNumber: contract.deployTransaction.blockNumber,
    transactionHash: contract.deployTransaction.hash,
  };

  const deploymentPath = path.join(__dirname, '..', 'deployment.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log('✅ Saved deployment info to deployment.json');

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ DEPLOYMENT COMPLETE!');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('📋 Next steps:');
  console.log('1. Verify your .env file has been updated');
  console.log('2. Run: npm run build');
  console.log('3. Run: npm start');
  console.log('');
  console.log('⚠️  Important:');
  console.log('- Make sure your wallet has ETH for gas fees');
  console.log('- Monitor the Telegram bot for alerts');
  console.log('- The bot will auto-execute profitable trades');
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
