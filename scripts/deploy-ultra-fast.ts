import { ethers } from 'ethers';
import { config } from '../src/config/config';
import { logger } from '../src/utils/logger';

async function deployUltraFastContract() {
  try {
    logger.info('🚀 Deploying Ultra-Fast Arbitrage Contract...');
    
    // Setup provider and wallet
    const provider = new ethers.providers.JsonRpcProvider(config.network.rpcUrl);
    const wallet = new ethers.Wallet(config.wallet.privateKey, provider);
    
    // Check wallet balance
    const balance = await wallet.getBalance();
    const balanceETH = parseFloat(ethers.utils.formatEther(balance));
    
    if (balanceETH < 0.1) {
      throw new Error(`Insufficient balance: ${balanceETH} ETH. Need at least 0.1 ETH for deployment.`);
    }
    
    logger.info(`💰 Wallet balance: ${balanceETH.toFixed(4)} ETH`);
    
    // Deploy contract
    const contractFactory = new ethers.ContractFactory(
      getContractABI(),
      getContractBytecode(),
      wallet
    );
    
    logger.info('📝 Deploying contract...');
    const contract = await contractFactory.deploy();
    
    logger.info(`⏳ Waiting for deployment confirmation...`);
    await contract.deployed();
    
    const contractAddress = contract.address;
    logger.info(`✅ Contract deployed at: ${contractAddress}`);
    
    // Verify contract deployment
    const owner = await contract.owner();
    const profitReceiver = await contract.profitReceiver();
    
    logger.info(`👤 Owner: ${owner}`);
    logger.info(`💰 Profit Receiver: ${profitReceiver}`);
    
    // Update .env file
    await updateEnvFile(contractAddress);
    
    // Send deployment notification
    await sendDeploymentNotification(contractAddress, balanceETH);
    
    logger.info('🎉 Ultra-Fast Arbitrage Contract deployment completed successfully!');
    logger.info('📋 Next steps:');
    logger.info('1. Fund the contract with ETH for gas fees');
    logger.info('2. Start the ultra-fast bot: npm run start:ultra');
    logger.info('3. Monitor via Telegram for real-time updates');
    
  } catch (error) {
    logger.error('❌ Deployment failed:', error);
    throw error;
  }
}

async function updateEnvFile(contractAddress: string) {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update or add contract address
    if (envContent.includes('ARBITRAGE_CONTRACT_ADDRESS=')) {
      envContent = envContent.replace(
        /ARBITRAGE_CONTRACT_ADDRESS=.*/,
        `ARBITRAGE_CONTRACT_ADDRESS=${contractAddress}`
      );
    } else {
      envContent += `\nARBITRAGE_CONTRACT_ADDRESS=${contractAddress}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    logger.info('✅ Updated .env file with contract address');
    
  } catch (error) {
    logger.error('❌ Failed to update .env file:', error);
    throw error;
  }
}

async function sendDeploymentNotification(contractAddress: string, balance: number) {
  try {
    const { TelegramNotifier } = await import('../src/services/TelegramBot');
    const telegram = new TelegramNotifier();
    
    await telegram.sendMessage(
      `🚀 Ultra-Fast Arbitrage Contract Deployed!\n\n` +
      `📝 Contract: ${contractAddress}\n` +
      `💰 Wallet Balance: ${balance.toFixed(4)} ETH\n` +
      `⏰ Deployed at: ${new Date().toISOString()}\n\n` +
      `✅ Ready for ultra-fast arbitrage trading!`
    );
    
  } catch (error) {
    logger.warn('Failed to send deployment notification:', error);
  }
}

function getContractABI(): any[] {
  return [
    'constructor(address _profitReceiver)',
    'function executeArbitrage(tuple(address tokenBorrow, address tokenTarget, uint256 amountBorrow, uint8 dexBuy, uint8 dexSell, bytes dexDataBuy, bytes dexDataSell, uint256 minAmountOutBuy, uint256 minAmountOutSell, uint256 minProfit, uint256 estimatedGasCost, uint256 deadline) params) external',
    'function owner() view returns (address)',
    'function profitReceiver() view returns (address)',
    'function getStatistics() view returns (uint256 totalTrades, uint256 totalProfit, uint256 totalGasUsed)',
    'function getConfiguration() view returns (uint256 minProfit, uint256 maxLoanAmount, uint256 maxSlippage)',
    'function emergencyStop() external',
    'function emergencyWithdraw(address token) external',
    'function setProfitReceiver(address _profitReceiver) external',
    'function setMinProfit(uint256 _minProfit) external',
    'function setMaxLoanAmount(uint256 _maxLoanAmount) external',
    'function setMaxSlippage(uint256 _maxSlippage) external',
    'event ArbitrageExecuted(address indexed tokenBorrow, address indexed tokenTarget, uint256 amountBorrow, uint256 profit, uint256 gasUsed)',
    'event EmergencyStop()',
    'event EmergencyWithdraw(address indexed token, uint256 amount)',
    'event ProfitReceiverUpdated(address indexed newReceiver)',
    'event ConfigurationUpdated(uint256 minProfit, uint256 maxLoanAmount, uint256 maxSlippage)'
  ];
}

function getContractBytecode(): string {
  // This would contain the actual compiled bytecode
  // For now, return a placeholder
  return '0x608060405234801561001057600080fd5b506040516...';
}

// Run deployment
if (require.main === module) {
  deployUltraFastContract()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { deployUltraFastContract };