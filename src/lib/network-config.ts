// src/lib/network-config.ts
// Comprehensive network configuration for EchoFi external service integrations

export interface NetworkEndpoint {
  url: string;
  name: string;
  priority: number; // Lower = higher priority
  timeout?: number;
  rateLimit?: number;
}

export interface ServiceConfig {
  name: string;
  endpoints: NetworkEndpoint[];
  timeout: number;
  retries: number;
  retryDelay: number;
  circuitBreakerThreshold: number;
  healthCheckInterval: number;
  cacheTtl?: number;
}

export interface NetworkConfiguration {
  global: {
    defaultTimeout: number;
    defaultRetries: number;
    defaultRetryDelay: number;
    maxConcurrentRequests: number;
    enableCircuitBreaker: boolean;
    enableCaching: boolean;
    enableMetrics: boolean;
  };
  services: {
    coinbase: ServiceConfig;
    xmtp: ServiceConfig;
    blockchain: ServiceConfig;
  };
  rpcEndpoints: Record<string, NetworkEndpoint[]>;
  environment: 'development' | 'production' | 'testing';
}

// Environment-specific configurations
const DEVELOPMENT_CONFIG: NetworkConfiguration = {
  global: {
    defaultTimeout: 15000, // 15 seconds for dev (more forgiving)
    defaultRetries: 3,
    defaultRetryDelay: 2000, // 2 seconds
    maxConcurrentRequests: 10,
    enableCircuitBreaker: true,
    enableCaching: true,
    enableMetrics: true,
  },
  services: {
    coinbase: {
      name: 'Coinbase Developer Platform',
      endpoints: [
        {
          url: 'https://api.developer.coinbase.com',
          name: 'Primary CDP API',
          priority: 1,
          timeout: 12000,
        }
      ],
      timeout: 12000,
      retries: 2, // Fewer retries in dev to fail fast
      retryDelay: 3000,
      circuitBreakerThreshold: 3, // More forgiving in dev
      healthCheckInterval: 60000, // 1 minute
      cacheTtl: 30000, // 30 seconds cache
    },
    xmtp: {
      name: 'XMTP Messaging Protocol',
      endpoints: [
        {
          url: 'https://dev.xmtp.network',
          name: 'XMTP Dev Network',
          priority: 1,
          timeout: 10000,
        }
      ],
      timeout: 10000,
      retries: 2,
      retryDelay: 2000,
      circuitBreakerThreshold: 4,
      healthCheckInterval: 45000,
      cacheTtl: 60000, // 1 minute cache
    },
    blockchain: {
      name: 'Blockchain RPC',
      endpoints: [], // Will be populated from rpcEndpoints
      timeout: 8000,
      retries: 3,
      retryDelay: 1500,
      circuitBreakerThreshold: 3,
      healthCheckInterval: 30000,
      cacheTtl: 15000, // 15 seconds cache
    },
  },
  rpcEndpoints: {
    'base-sepolia': [
      {
        url: 'https://sepolia.base.org',
        name: 'Base Sepolia Official',
        priority: 1,
        timeout: 8000,
        rateLimit: 100, // requests per minute
      },
      {
        url: 'https://base-sepolia-rpc.publicnode.com',
        name: 'PublicNode Base Sepolia',
        priority: 2,
        timeout: 10000,
        rateLimit: 80,
      },
      {
        url: 'https://base-sepolia.blockpi.network/v1/rpc/public',
        name: 'BlockPI Base Sepolia',
        priority: 3,
        timeout: 12000,
        rateLimit: 60,
      }
    ],
    'base-mainnet': [
      {
        url: 'https://mainnet.base.org',
        name: 'Base Mainnet Official',
        priority: 1,
        timeout: 6000,
        rateLimit: 150,
      },
      {
        url: 'https://base-rpc.publicnode.com',
        name: 'PublicNode Base Mainnet',
        priority: 2,
        timeout: 8000,
        rateLimit: 120,
      }
    ]
  },
  environment: 'development',
};

const PRODUCTION_CONFIG: NetworkConfiguration = {
  global: {
    defaultTimeout: 8000, // Stricter timeouts in production
    defaultRetries: 4,
    defaultRetryDelay: 1000,
    maxConcurrentRequests: 20,
    enableCircuitBreaker: true,
    enableCaching: true,
    enableMetrics: true,
  },
  services: {
    coinbase: {
      name: 'Coinbase Developer Platform',
      endpoints: [
        {
          url: 'https://api.developer.coinbase.com',
          name: 'Primary CDP API',
          priority: 1,
          timeout: 8000,
        }
      ],
      timeout: 8000,
      retries: 4,
      retryDelay: 1000,
      circuitBreakerThreshold: 5,
      healthCheckInterval: 30000,
      cacheTtl: 60000, // 1 minute cache
    },
    xmtp: {
      name: 'XMTP Messaging Protocol',
      endpoints: [
        {
          url: 'https://production.xmtp.network',
          name: 'XMTP Production Network',
          priority: 1,
          timeout: 6000,
        }
      ],
      timeout: 6000,
      retries: 3,
      retryDelay: 1500,
      circuitBreakerThreshold: 6,
      healthCheckInterval: 20000,
      cacheTtl: 120000, // 2 minutes cache
    },
    blockchain: {
      name: 'Blockchain RPC',
      endpoints: [],
      timeout: 5000,
      retries: 4,
      retryDelay: 1000,
      circuitBreakerThreshold: 5,
      healthCheckInterval: 15000,
      cacheTtl: 30000, // 30 seconds cache
    },
  },
  rpcEndpoints: {
    'base-mainnet': [
      {
        url: 'https://mainnet.base.org',
        name: 'Base Mainnet Official',
        priority: 1,
        timeout: 5000,
        rateLimit: 200,
      },
      {
        url: 'https://base-rpc.publicnode.com',
        name: 'PublicNode Base Mainnet',
        priority: 2,
        timeout: 6000,
        rateLimit: 180,
      }
    ],
    'base-sepolia': [
      {
        url: 'https://sepolia.base.org',
        name: 'Base Sepolia Official',
        priority: 1,
        timeout: 6000,
        rateLimit: 150,
      }
    ]
  },
  environment: 'production',
};

// Get current environment configuration
export function getNetworkConfig(): NetworkConfiguration {
  const env = process.env.NODE_ENV || 'development';
  const networkId = process.env.NETWORK_ID || 'base-sepolia';
  
  let config: NetworkConfiguration;
  
  switch (env) {
    case 'production':
      config = PRODUCTION_CONFIG;
      break;
    case 'development':
    case 'test':
    default:
      config = DEVELOPMENT_CONFIG;
      break;
  }
  
  // Populate blockchain service endpoints based on current network
  const rpcEndpoints = config.rpcEndpoints[networkId] || [];
  config.services.blockchain.endpoints = rpcEndpoints.map(endpoint => ({
    url: endpoint.url,
    name: endpoint.name,
    priority: endpoint.priority,
    timeout: endpoint.timeout,
    rateLimit: endpoint.rateLimit,
  }));
  
  // For services that don't need explicit health check endpoints, leave empty
  // but don't mark them as unhealthy
  config.services.coinbase.endpoints = []; // AgentKit handles its own connectivity
  
  return config;
}

// Export current configuration
export const NETWORK_CONFIG = getNetworkConfig();

// Helper functions
export function getRpcEndpoints(networkId: string): NetworkEndpoint[] {
  return NETWORK_CONFIG.rpcEndpoints[networkId] || [];
}

export function getServiceConfig(serviceName: keyof NetworkConfiguration['services']): ServiceConfig {
  return NETWORK_CONFIG.services[serviceName];
}

export function getPrimaryRpcUrl(networkId: string): string {
  const endpoints = getRpcEndpoints(networkId);
  if (endpoints.length === 0) {
    throw new Error(`No RPC endpoints configured for network: ${networkId}`);
  }
  
  // Return the highest priority (lowest priority number) endpoint
  const primary = endpoints.sort((a, b) => a.priority - b.priority)[0];
  return primary.url;
}

export function getFallbackRpcUrls(networkId: string): string[] {
  const endpoints = getRpcEndpoints(networkId);
  return endpoints
    .sort((a, b) => a.priority - b.priority)
    .slice(1) // Skip primary
    .map(endpoint => endpoint.url);
}

// Feature flags
export const FEATURE_FLAGS = {
  enableNetworkRetries: process.env.ENABLE_NETWORK_RETRIES !== 'false',
  enableCircuitBreaker: process.env.ENABLE_CIRCUIT_BREAKER !== 'false',
  enableRequestCaching: process.env.ENABLE_REQUEST_CACHING !== 'false',
  enableHealthChecks: process.env.ENABLE_HEALTH_CHECKS !== 'false',
  enableMetrics: process.env.ENABLE_NETWORK_METRICS !== 'false',
  gracefulDegradation: process.env.ENABLE_GRACEFUL_DEGRADATION !== 'false',
  developmentMode: process.env.NODE_ENV === 'development',
  lenientHealthChecks: process.env.NODE_ENV === 'development' && process.env.STRICT_HEALTH_CHECKS !== 'true',
} as const;

// Error codes for network issues
export const NETWORK_ERROR_CODES = {
  TIMEOUT: 'NETWORK_TIMEOUT',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMITED: 'RATE_LIMITED',
  CIRCUIT_BREAKER_OPEN: 'CIRCUIT_BREAKER_OPEN',
  MAX_RETRIES_EXCEEDED: 'MAX_RETRIES_EXCEEDED',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
} as const;

export type NetworkErrorCode = typeof NETWORK_ERROR_CODES[keyof typeof NETWORK_ERROR_CODES];