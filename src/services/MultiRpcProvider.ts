import { ethers } from 'ethers';
import { logger } from '../utils/logger';

/**
 * MULTI-RPC PROVIDER
 * 
 * Uses multiple RPC endpoints for reliability and speed
 * Auto-failover if one fails
 */

export class MultiRpcProvider {
  private providers: ethers.providers.JsonRpcProvider[];
  private currentIndex: number = 0;
  
  constructor(rpcUrls: string[]) {
    this.providers = rpcUrls.map(url => new ethers.providers.JsonRpcProvider(url));
    logger.info(`🌐 Multi-RPC initialized with ${rpcUrls.length} endpoints`);
  }
  
  /**
   * Get current active provider
   */
  getProvider(): ethers.providers.JsonRpcProvider {
    return this.providers[this.currentIndex];
  }
  
  /**
   * Call with auto-failover
   */
  async call<T>(fn: (provider: ethers.providers.JsonRpcProvider) => Promise<T>): Promise<T> {
    for (let i = 0; i < this.providers.length; i++) {
      const providerIndex = (this.currentIndex + i) % this.providers.length;
      const provider = this.providers[providerIndex];
      
      try {
        const result = await fn(provider);
        
        // Success - update current index if we failed over
        if (i > 0) {
          this.currentIndex = providerIndex;
          logger.info(`✅ Switched to RPC endpoint #${providerIndex + 1}`);
        }
        
        return result;
        
      } catch (error: any) {
        logger.warn(`⚠️ RPC #${providerIndex + 1} failed: ${error.message}`);
        
        // Try next provider
        if (i < this.providers.length - 1) {
          continue;
        }
        
        // All providers failed
        throw new Error('All RPC endpoints failed');
      }
    }
    
    throw new Error('All RPC endpoints failed');
  }
  
  /**
   * Call all providers in parallel and return fastest
   */
  async race<T>(fn: (provider: ethers.providers.JsonRpcProvider) => Promise<T>): Promise<T> {
    const promises = this.providers.map(provider => fn(provider));
    return Promise.race(promises);
  }
}
