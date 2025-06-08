// src/lib/config/app.ts
import { NetworkConfig, AppConfig, FeatureFlags, AppLimits } from '@/types';

// Network Configurations
export const NETWORKS: Record<string, NetworkConfig> = {
  'base-mainnet': {
    chainId: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  'base-sepolia': {
    chainId: 84532,
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia-explorer.base.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  'ethereum-mainnet': {
    chainId: 1,
    name: 'Ethereum',
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/' + (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || ''),
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  'ethereum-sepolia': {
    chainId: 11155111,
    name: 'Ethereum Sepolia',
    rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/' + (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || ''),
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
  },
};

// Feature Flags
export const FEATURE_FLAGS: FeatureFlags = {
  enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
  enableNotifications: true,
  enableAutoExecution: process.env.NEXT_PUBLIC_ENABLE_AUTO_EXECUTION !== 'false',
  enableAdvancedStrategies: process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_ENABLE_ADVANCED === 'true',
  enableBetaFeatures: process.env.NODE_ENV === 'development',
};

// Application Limits
export const APP_LIMITS: AppLimits = {
  maxGroupMembers: 50,
  maxProposalsPerGroup: 100,
  maxVotingDuration: 168, // 7 days in hours
  minProposalAmount: '10', // USDC
  maxProposalAmount: '1000000', // USDC
};

// Supported DeFi Protocols
export const SUPPORTED_PROTOCOLS = {
  // Lending/Borrowing
  aave: {
    name: 'Aave',
    category: 'lending',
    description: 'Decentralized lending and borrowing',
    riskLevel: 'medium',
    supportedAssets: ['USDC', 'USDT', 'DAI', 'ETH', 'WBTC'],
  },
  compound: {
    name: 'Compound',
    category: 'lending',
    description: 'Algorithmic money markets',
    riskLevel: 'medium',
    supportedAssets: ['USDC', 'USDT', 'DAI', 'ETH'],
  },
  
  // DEX/AMM
  uniswap: {
    name: 'Uniswap',
    category: 'dex',
    description: 'Decentralized exchange and liquidity provision',
    riskLevel: 'medium',
    supportedAssets: ['ETH', 'USDC', 'USDT', 'DAI'],
  },
  sushiswap: {
    name: 'SushiSwap',
    category: 'dex',
    description: 'Community-driven DEX',
    riskLevel: 'medium',
    supportedAssets: ['ETH', 'USDC', 'USDT'],
  },
  
  // Yield Farming
  curve: {
    name: 'Curve',
    category: 'yield',
    description: 'Stablecoin and similar assets trading',
    riskLevel: 'low',
    supportedAssets: ['USDC', 'USDT', 'DAI'],
  },
  convex: {
    name: 'Convex',
    category: 'yield',
    description: 'Boosted Curve yields',
    riskLevel: 'medium',
    supportedAssets: ['USDC', 'USDT', 'DAI'],
  },
  
  // Liquid Staking
  lido: {
    name: 'Lido',
    category: 'staking',
    description: 'Liquid staking for ETH',
    riskLevel: 'low',
    supportedAssets: ['ETH'],
  },
  rocketpool: {
    name: 'Rocket Pool',
    category: 'staking',
    description: 'Decentralized ETH staking',
    riskLevel: 'low',
    supportedAssets: ['ETH'],
  },
};

// Default Investment Strategies
export const DEFAULT_STRATEGIES = [
  {
    id: 'conservative',
    name: 'Conservative Yield',
    description: 'Low-risk yield generation through liquid staking and stable lending',
    targetApy: 4.5,
    riskLevel: 'low' as const,
    allocations: {
      'ETH-Staking': 60, // Lido stETH
      'USDC-Lending': 30, // Aave USDC
      'Curve-3Pool': 10, // Curve stable LP
    },
    rebalanceThreshold: 5, // Rebalance if allocation drifts >5%
  },
  {
    id: 'balanced',
    name: 'Balanced Growth',
    description: 'Moderate risk with diversified DeFi exposure',
    targetApy: 8.2,
    riskLevel: 'medium' as const,
    allocations: {
      'ETH-Staking': 40,
      'USDC-Lending': 25,
      'Uniswap-LP': 20,
      'Convex-Farming': 15,
    },
    rebalanceThreshold: 7,
  },
  {
    id: 'aggressive',
    name: 'High Yield Hunter',
    description: 'Higher risk strategies for maximum yield',
    targetApy: 15.8,
    riskLevel: 'high' as const,
    allocations: {
      'Yield-Farming': 50,
      'LP-Provision': 30,
      'Leveraged-Lending': 20,
    },
    rebalanceThreshold: 10,
  },
];

// Asset Configurations
export const SUPPORTED_ASSETS = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    coingeckoId: 'ethereum',
    isNative: true,
  },
  WETH: {
    symbol: 'WETH',
    name: 'Wrapped Ethereum',
    decimals: 18,
    coingeckoId: 'weth',
    addresses: {
      'base-mainnet': '0x4200000000000000000000000000000000000006',
      'base-sepolia': '0x4200000000000000000000000000000000000006',
    },
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    coingeckoId: 'usd-coin',
    addresses: {
      'base-mainnet': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    },
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    coingeckoId: 'tether',
    addresses: {
      'base-mainnet': '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    },
  },
  DAI: {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    coingeckoId: 'dai',
    addresses: {
      'base-mainnet': '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    },
  },
};

// API Endpoints
export const API_ENDPOINTS = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || '/api',
  GROUPS: '/api/groups',
  PROPOSALS: '/api/proposals',
  VOTES: '/api/votes',
  ANALYTICS: '/api/analytics',
  AGENT: '/api/agent',
  PORTFOLIO: '/api/portfolio',
};

// XMTP Configuration
export const XMTP_CONFIG = {
  ENV: (process.env.NEXT_PUBLIC_XMTP_ENV as 'production' | 'dev') || 'dev',
  DB_PATH: 'echofi-xmtp',
  ENABLE_LOGGING: process.env.NODE_ENV === 'development',
};

// Agent Configuration
export const AGENT_CONFIG = {
  MODEL: 'gpt-4o-mini',
  TEMPERATURE: 0.1,
  MAX_TOKENS: 2000,
  DEFAULT_SLIPPAGE: 0.5, // 0.5%
  MAX_SLIPPAGE: 5.0, // 5%
  GAS_MULTIPLIER: 1.2, // 20% buffer for gas estimation
  RETRY_ATTEMPTS: 3,
  TIMEOUT: 30000, // 30 seconds
};

// UI Configuration
export const UI_CONFIG = {
  ANIMATION_DURATION: 300,
  DEBOUNCE_DELAY: 500,
  NOTIFICATION_DURATION: 5000,
  POLLING_INTERVAL: 30000, // 30 seconds
  PRICE_UPDATE_INTERVAL: 60000, // 1 minute
};

// Validation Rules
export const VALIDATION_RULES = {
  GROUP_NAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z0-9\s\-_]+$/,
  },
  PROPOSAL_TITLE: {
    MIN_LENGTH: 5,
    MAX_LENGTH: 100,
  },
  PROPOSAL_DESCRIPTION: {
    MIN_LENGTH: 20,
    MAX_LENGTH: 1000,
  },
  INVESTMENT_AMOUNT: {
    MIN: 10,
    MAX: 1000000,
  },
  WALLET_ADDRESS: {
    PATTERN: /^0x[a-fA-F0-9]{40}$/,
  },
};

// Main App Configuration
export const APP_CONFIG: AppConfig = {
  networks: Object.values(NETWORKS),
  defaultNetwork: NETWORKS[process.env.NEXT_PUBLIC_NETWORK_ID || 'base-sepolia'].chainId,
  supportedWallets: ['MetaMask', 'Coinbase Wallet', 'WalletConnect'],
  features: FEATURE_FLAGS,
  limits: APP_LIMITS,
};

// Environment-specific configurations
export const getNetworkConfig = (networkId?: string): NetworkConfig => {
  const id = networkId || process.env.NEXT_PUBLIC_NETWORK_ID || 'base-sepolia';
  const network = NETWORKS[id];
  
  if (!network) {
    throw new Error(`Unsupported network: ${id}`);
  }
  
  return network;
};

export const getCurrentNetwork = (): NetworkConfig => {
  return getNetworkConfig();
};

export const isTestnet = (chainId: number): boolean => {
  return [84532, 11155111].includes(chainId); // Base Sepolia, Ethereum Sepolia
};

export const isMainnet = (chainId: number): boolean => {
  return [8453, 1].includes(chainId); // Base, Ethereum
};

// Error Messages
export const ERROR_MESSAGES = {
  WALLET_NOT_CONNECTED: 'Please connect your wallet to continue',
  NETWORK_NOT_SUPPORTED: 'Please switch to a supported network',
  INSUFFICIENT_BALANCE: 'Insufficient balance for this transaction',
  TRANSACTION_FAILED: 'Transaction failed. Please try again',
  INVALID_ADDRESS: 'Please enter a valid Ethereum address',
  INVALID_AMOUNT: 'Please enter a valid amount',
  PROPOSAL_EXPIRED: 'This proposal has expired',
  ALREADY_VOTED: 'You have already voted on this proposal',
  NOT_GROUP_MEMBER: 'You are not a member of this group',
  AGENT_NOT_INITIALIZED: 'Investment agent is not initialized',
  XMTP_NOT_INITIALIZED: 'XMTP client is not initialized',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  WALLET_CONNECTED: 'Wallet connected successfully',
  GROUP_CREATED: 'Investment group created successfully',
  PROPOSAL_CREATED: 'Investment proposal created successfully',
  VOTE_SUBMITTED: 'Vote submitted successfully',
  STRATEGY_EXECUTED: 'Investment strategy executed successfully',
  MEMBER_ADDED: 'Member added to group successfully',
} as const;