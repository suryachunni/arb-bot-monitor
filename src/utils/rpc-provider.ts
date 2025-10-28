import { ethers } from 'ethers';
import { logger } from './logger';
import { getAllRPCs, RPCEndpoint } from '../config/rpc-config';

/**
 * Resilient RPC Provider with Automatic Fallback
 * 
 * Features:
 * - Auto-switches to backup RPCs on failure
 * - Retries failed requests
 * - Health monitoring
 * - Connection pooling
 */

export class ResilientRPCProvider {
  private providers: Map<string, ethers.providers.JsonRpcProvider> = new Map();
  private currentEndpointIndex: number = 0;
  private endpoints: RPCEndpoint[];
  private failureCount: Map<string, number> = new Map();
  private readonly MAX_FAILURES = 3;

  constructor() {
    this.endpoints = getAllRPCs();
    this.initializeProviders();
  }

  private initializeProviders() {
    for (const endpoint of this.endpoints) {
      try {
        const provider = new ethers.providers.JsonRpcProvider(endpoint.url);
        this.providers.set(endpoint.url, provider);
        this.failureCount.set(endpoint.url, 0);
        logger.info(`✅ Initialized RPC: ${endpoint.name}`);
      } catch (error: any) {
        logger.warn(`⚠️  Failed to initialize ${endpoint.name}: ${error.message}`);
      }
    }
  }

  /**
   * Get current active provider
   */
  getProvider(): ethers.providers.JsonRpcProvider {
    const endpoint = this.endpoints[this.currentEndpointIndex];
    const provider = this.providers.get(endpoint.url);
    
    if (!provider) {
      throw new Error('No RPC provider available');
    }
    
    return provider;
  }

  /**
   * Execute with automatic fallback
   */
  async executeWithFallback<T>(
    operation: (provider: ethers.providers.JsonRpcProvider) => Promise<T>,
    retries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;
    
    // Try all endpoints
    for (let endpointIndex = 0; endpointIndex < this.endpoints.length; endpointIndex++) {
      const actualIndex = (this.currentEndpointIndex + endpointIndex) % this.endpoints.length;
      const endpoint = this.endpoints[actualIndex];
      const provider = this.providers.get(endpoint.url);
      
      if (!provider) continue;
      
      // Check if endpoint has too many failures
      const failures = this.failureCount.get(endpoint.url) || 0;
      if (failures >= this.MAX_FAILURES) {
        logger.warn(`⚠️  Skipping ${endpoint.name} (too many failures: ${failures})`);
        continue;
      }
      
      // Try operation with retries
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const result = await operation(provider);
          
          // Success! Reset failure count and update current endpoint
          this.failureCount.set(endpoint.url, 0);
          this.currentEndpointIndex = actualIndex;
          
          if (endpointIndex > 0 || attempt > 0) {
            logger.info(`✅ Recovered using ${endpoint.name}`);
          }
          
          return result;
        } catch (error: any) {
          lastError = error;
          logger.warn(`⚠️  ${endpoint.name} attempt ${attempt + 1} failed: ${error.message}`);
          
          // Increment failure count
          this.failureCount.set(endpoint.url, failures + 1);
          
          // Wait before retry
          if (attempt < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          }
        }
      }
    }
    
    // All endpoints failed
    logger.error('❌ All RPC endpoints failed!');
    throw lastError || new Error('All RPC endpoints failed');
  }

  /**
   * Get current endpoint info
   */
  getCurrentEndpoint(): RPCEndpoint {
    return this.endpoints[this.currentEndpointIndex];
  }

  /**
   * Get health status
   */
  getHealthStatus(): { endpoint: string; failures: number }[] {
    return this.endpoints.map(endpoint => ({
      endpoint: endpoint.name,
      failures: this.failureCount.get(endpoint.url) || 0,
    }));
  }

  /**
   * Reset failure counts
   */
  resetFailures() {
    for (const url of this.failureCount.keys()) {
      this.failureCount.set(url, 0);
    }
    logger.info('✅ Reset all RPC failure counts');
  }
}

// Singleton instance
export const rpcProvider = new ResilientRPCProvider();
