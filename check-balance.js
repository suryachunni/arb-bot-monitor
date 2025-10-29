const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.providers.JsonRpcProvider('https://arb-mainnet.g.alchemy.com/v2/wuLT9bA29g4SF1zeOlgpg');
  const wallet = new ethers.Wallet('0x586db7ecc59c675b03436ac19f3dd4ed040905ce5edd6c9e53c0dde87a25ee95', provider);
  
  const balance = await wallet.getBalance();
  const balanceInEth = ethers.utils.formatEther(balance);
  
  console.log('Wallet Address:', wallet.address);
  console.log('Balance:', balanceInEth, 'ETH');
  
  if (parseFloat(balanceInEth) < 0.01) {
    console.log('\n⚠️  WARNING: Low balance! Recommended: 0.05 ETH for gas fees');
    console.log('Please fund this wallet before proceeding.');
    process.exit(1);
  } else {
    console.log('✅ Sufficient balance for deployment');
  }
}

main().catch(console.error);
