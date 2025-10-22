import { ethers } from 'ethers';

async function checkBalance() {
  const provider = new ethers.providers.JsonRpcProvider('https://arb-mainnet.g.alchemy.com/v2/wuLT9bA29g4SF1zeOlgpg');
  const wallet = new ethers.Wallet('0x40215518bdcf44276dffa73607eebbaf8f395b474ff8f1abc630b1166f66283d', provider);
  
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('   WALLET BALANCE CHECK');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('Wallet Address:', wallet.address);
  
  const balance = await provider.getBalance(wallet.address);
  const ethBalance = parseFloat(ethers.utils.formatEther(balance));
  const usdValue = ethBalance * 2500; // Approximate ETH price
  
  console.log('Balance:', ethBalance.toFixed(6), 'ETH');
  console.log('USD Value: $' + usdValue.toFixed(2));
  console.log('');
  
  if (ethBalance >= 0.02) {
    console.log('✅ SUFFICIENT! Ready to deploy!');
    console.log('   Deploy cost: ~0.008 ETH ($20)');
    console.log('   Remaining: ~' + (ethBalance - 0.008).toFixed(4) + ' ETH for trading');
  } else if (ethBalance > 0) {
    console.log('⚠️  INSUFFICIENT! Current balance too low.');
    console.log('   Need: 0.02 ETH minimum');
    console.log('   Have: ' + ethBalance.toFixed(6) + ' ETH');
    console.log('   Short: ' + (0.02 - ethBalance).toFixed(6) + ' ETH');
  } else {
    console.log('❌ NO FUNDS! Wallet is empty.');
    console.log('   Please add 0.02 ETH to:', wallet.address);
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════');
}

checkBalance().catch(console.error);
