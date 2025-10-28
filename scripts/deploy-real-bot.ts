import { ethers } from 'ethers';
import { config } from '../src/config/config';

async function deployRealBot() {
  console.log('🚀 DEPLOYING REAL ARBITRAGE BOT TO ARBITRUM MAINNET');
  console.log('='.repeat(60));
  console.log();

  try {
    // Connect to Arbitrum
    const provider = new ethers.providers.JsonRpcProvider(config.network.rpcUrl);
    const wallet = new ethers.Wallet(config.wallet.privateKey, provider);
    
    console.log('📡 Connected to Arbitrum mainnet');
    console.log(`👤 Deployer: ${wallet.address}`);
    
    const balance = await wallet.getBalance();
    console.log(`💰 Balance: ${ethers.utils.formatEther(balance)} ETH`);
    console.log();

    // Aave V3 Pool address on Arbitrum
    const AAVE_V3_POOL = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';
    
    console.log('📋 Contract Details');
    console.log('─'.repeat(25));
    console.log(`🏦 Aave V3 Pool: ${AAVE_V3_POOL}`);
    console.log(`🔗 Network: Arbitrum Mainnet`);
    console.log(`⛽ Gas Price: ${ethers.utils.formatUnits(await provider.getGasPrice(), 'gwei')} gwei`);
    console.log();

    // Deploy contract
    console.log('🔨 Deploying RealArbitrageBot...');
    
    const RealArbitrageBot = await ethers.getContractFactory('RealArbitrageBot');
    
    // Estimate gas
    const gasEstimate = await RealArbitrageBot.signer.estimateGas(
      RealArbitrageBot.getDeployTransaction(AAVE_V3_POOL)
    );
    
    console.log(`⛽ Estimated gas: ${gasEstimate.toString()}`);
    
    // Deploy with gas settings
    const contract = await RealArbitrageBot.deploy(AAVE_V3_POOL, {
      gasLimit: gasEstimate.mul(120).div(100), // 20% buffer
    });
    
    console.log(`📝 Transaction hash: ${contract.deployTransaction.hash}`);
    console.log('⏳ Waiting for confirmation...');
    
    await contract.deployed();
    
    console.log('✅ Contract deployed successfully!');
    console.log(`📍 Contract address: ${contract.address}`);
    console.log();

    // Verify deployment
    console.log('🔍 Verifying deployment...');
    
    const aavePool = await contract.getAavePool();
    const isReady = await contract.isReady();
    
    console.log(`🏦 Aave Pool: ${aavePool}`);
    console.log(`✅ Ready: ${isReady}`);
    console.log();

    // Update .env file
    console.log('📝 Updating .env file...');
    
    const fs = require('fs');
    const path = require('path');
    
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update or add contract address
    if (envContent.includes('CONTRACT_ADDRESS=')) {
      envContent = envContent.replace(
        /CONTRACT_ADDRESS=.*/,
        `CONTRACT_ADDRESS=${contract.address}`
      );
    } else {
      envContent += `\nCONTRACT_ADDRESS=${contract.address}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file updated');
    console.log();

    // Send Telegram notification
    console.log('📱 Sending Telegram notification...');
    
    try {
      const { EnhancedTelegramNotifier } = require('../src/services/EnhancedTelegramNotifier');
      const notifier = new EnhancedTelegramNotifier();
      
      await notifier.sendDeploymentNotification({
        contractAddress: contract.address,
        network: 'Arbitrum Mainnet',
        deployer: wallet.address,
        gasUsed: gasEstimate.toString(),
        transactionHash: contract.deployTransaction.hash
      });
      
      console.log('✅ Telegram notification sent');
    } catch (error) {
      console.log('⚠️ Telegram notification failed:', error.message);
    }

    console.log();
    console.log('🎯 DEPLOYMENT SUMMARY');
    console.log('='.repeat(40));
    console.log(`✅ Status: SUCCESS`);
    console.log(`📍 Contract: ${contract.address}`);
    console.log(`🏦 Aave Pool: ${aavePool}`);
    console.log(`👤 Owner: ${wallet.address}`);
    console.log(`⛽ Gas Used: ${gasEstimate.toString()}`);
    console.log(`📝 TX Hash: ${contract.deployTransaction.hash}`);
    console.log();
    console.log('🚀 NEXT STEPS:');
    console.log('1. Fund the contract with some ETH for gas');
    console.log('2. Test with small amounts first');
    console.log('3. Monitor for arbitrage opportunities');
    console.log('4. Start automated trading');
    console.log();
    console.log('⚠️ IMPORTANT:');
    console.log('• This is a REAL contract on mainnet');
    console.log('• Test with small amounts first');
    console.log('• Monitor gas costs and profits');
    console.log('• Keep private key secure');

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    console.log();
    console.log('🔧 TROUBLESHOOTING:');
    console.log('• Check private key and RPC URL');
    console.log('• Ensure sufficient ETH balance');
    console.log('• Verify network connection');
    console.log('• Check gas price settings');
  }
}

// Run deployment
if (require.main === module) {
  deployRealBot().catch(console.error);
}

export { deployRealBot };