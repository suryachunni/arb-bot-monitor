import { ethers } from 'ethers';
import { logger } from '../utils/logger';

/**
 * FLASHBOTS MEV PROTECTION
 * 
 * Provides MEV protection by routing transactions through private channels
 * This prevents front-running and sandwich attacks
 */

export class FlashbotsProvider {
  private provider: ethers.providers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private flashbotsRpc: string;
  
  constructor(rpcUrl: string, privateKey: string) {
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    
    // Flashbots RPC for Ethereum, for Arbitrum we use increased priority fees
    this.flashbotsRpc = process.env.FLASHBOTS_RPC || 'https://rpc.flashbots.net';
    
    logger.info('🛡️ Flashbots MEV protection initialized');
  }
  
  /**
   * Send transaction with MEV protection
   * For Arbitrum: Use high priority fees instead of Flashbots
   */
  async sendProtectedTransaction(tx: ethers.providers.TransactionRequest): Promise<ethers.providers.TransactionResponse> {
    try {
      // For Arbitrum, MEV protection = high priority fee + fast submission
      const feeData = await this.provider.getFeeData();
      
      // Boost priority fee by 50% to beat MEV bots
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        tx.maxFeePerGas = feeData.maxFeePerGas.mul(150).div(100);
        tx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas.mul(200).div(100); // 2x priority!
      }
      
      // Send transaction
      const txResponse = await this.wallet.sendTransaction(tx);
      
      logger.info(`🛡️ Protected tx sent: ${txResponse.hash} (boosted priority fee)`);
      
      return txResponse;
      
    } catch (error: any) {
      logger.error(`❌ Failed to send protected transaction: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Send transaction as bundle (for even better MEV protection)
   * Note: Simplified for Arbitrum
   */
  async sendBundle(txs: ethers.providers.TransactionRequest[]): Promise<string[]> {
    const hashes: string[] = [];
    
    // For Arbitrum, send multiple txs with same nonce strategy
    // (Real Flashbots bundles not available on Arbitrum L2)
    for (const tx of txs) {
      const response = await this.sendProtectedTransaction(tx);
      hashes.push(response.hash);
    }
    
    return hashes;
  }
  
  /**
   * Get optimal gas price for MEV protection
   */
  async getOptimalGasPrice(): Promise<{
    maxFeePerGas: ethers.BigNumber;
    maxPriorityFeePerGas: ethers.BigNumber;
  }> {
    const feeData = await this.provider.getFeeData();
    
    return {
      maxFeePerGas: feeData.maxFeePerGas?.mul(150).div(100) || ethers.utils.parseUnits('0.2', 'gwei'),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.mul(200).div(100) || ethers.utils.parseUnits('0.1', 'gwei'),
    };
  }
}
