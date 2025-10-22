/**
 * RPC Configuration with Fallback Support
 * 
 * Provides redundancy by supporting multiple RPC endpoints
 * Auto-switches to backup if primary fails
 */

export interface RPCEndpoint {
  url: string;
  name: string;
  priority: number;
  maxRetries?: number;
}

export const RPC_ENDPOINTS: RPCEndpoint[] = [
  // Primary: User's Alchemy endpoint
  {
    url: process.env.RPC_URL || 'https://arb-mainnet.g.alchemy.com/v2/wuLT9bA29g4SF1zeOlgpg',
    name: 'Alchemy (Primary)',
    priority: 1,
    maxRetries: 3,
  },
  
  // Backup 1: Public Arbitrum RPC
  {
    url: 'https://arb1.arbitrum.io/rpc',
    name: 'Arbitrum Public RPC',
    priority: 2,
    maxRetries: 2,
  },
  
  // Backup 2: Ankr
  {
    url: 'https://rpc.ankr.com/arbitrum',
    name: 'Ankr',
    priority: 3,
    maxRetries: 2,
  },
  
  // Backup 3: 1RPC
  {
    url: 'https://1rpc.io/arb',
    name: '1RPC',
    priority: 4,
    maxRetries: 2,
  },
];

export function getPrimaryRPC(): string {
  return RPC_ENDPOINTS[0].url;
}

export function getBackupRPCs(): string[] {
  return RPC_ENDPOINTS.slice(1).map(endpoint => endpoint.url);
}

export function getAllRPCs(): RPCEndpoint[] {
  return RPC_ENDPOINTS;
}
