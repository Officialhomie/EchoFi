import { NetworkConfig, AppConfig, FeatureFlags, AppLimits } from '@/types';

// Network Configurations with Base Sepolia prioritized for development
export const NETWORKS: Record<string, NetworkConfig> = {
  'base-sepolia': { // MOVED TO FIRST POSITION - DEFAULT FOR DEVELOPMENT
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
  'ethereum-sepolia': { // KEPT FOR COMPATIBILITY BUT NOT DEFAULT
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
  'ethereum-mainnet': { // REMOVED FROM DEFAULT OPTIONS FOR DEVELOPMENT
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

// FIXED: Supported DeFi Protocols - Focus on Base ecosystem
export const SUPPORTED_PROTOCOLS = {
  // Lending/Borrowing - Base-first
  aave: {
    name: 'Aave',
    category: 'lending',
    description: 'Decentralized lending and borrowing',
    riskLevel: 'medium',
    supportedAssets: ['USDC', 'USDT', 'DAI', 'ETH', 'WBTC'],
    chains: [8453, 84532], // Base Mainnet and Sepolia
  },
  compound: {
    name: 'Compound',
    category: 'lending',
    description: 'Algorithmic money markets',
    riskLevel: 'medium',
    supportedAssets: ['USDC', 'USDT', 'DAI', 'ETH'],
    chains: [8453], // Base Mainnet
  },
  
  // DEX/AMM - Base native
  uniswap: {
    name: 'Uniswap',
    category: 'dex',
    description: 'Decentralized exchange and liquidity provision',
    riskLevel: 'medium',
    supportedAssets: ['ETH', 'USDC', 'USDT', 'DAI'],
    chains: [8453, 84532], // Available on Base
  },
  aerodrome: {
    name: 'Aerodrome',
    category: 'dex',
    description: 'Next-generation AMM designed for Base',
    riskLevel: 'medium',
    supportedAssets: ['ETH', 'USDC', 'USDT'],
    chains: [8453], // Base native
  },
  
  // Yield Farming - Base ecosystem
  curve: {
    name: 'Curve',
    category: 'yield',
    description: 'Stablecoin and similar assets trading',
    riskLevel: 'low',
    supportedAssets: ['USDC', 'USDT', 'DAI'],
    chains: [8453], // Base Mainnet
  },
  
  // Liquid Staking
  lido: {
    name: 'Lido',
    category: 'staking',
    description: 'Liquid staking for ETH',
    riskLevel: 'low',
    supportedAssets: ['ETH'],
    chains: [8453, 84532], // Available on Base
  },
};

// FIXED: Default Investment Strategies optimized for Base ecosystem
export const DEFAULT_STRATEGIES = [
  {
    id: 'conservative-base',
    name: 'Conservative Base Yield',
    description: 'Low-risk yield generation on Base using liquid staking and stable lending',
    targetApy: 4.8,
    riskLevel: 'low' as const,
    allocations: {
      'ETH-Staking-Base': 50, // Lido on Base
      'USDC-Aave-Base': 35, // Aave USDC on Base
      'Base-Native-Yield': 15, // Base ecosystem opportunities
    },
    rebalanceThreshold: 5,
    preferredChain: 84532, // Base Sepolia for testing
  },
  {
    id: 'balanced-base',
    name: 'Balanced Base Growth',
    description: 'Moderate risk with diversified Base DeFi exposure',
    targetApy: 9.2,
    riskLevel: 'medium' as const,
    allocations: {
      'ETH-Staking-Base': 30,
      'USDC-Lending-Base': 25,
      'Aerodrome-LP': 25,
      'Uniswap-Base-LP': 20,
    },
    rebalanceThreshold: 7,
    preferredChain: 84532, // Base Sepolia for testing
  },
  {
    id: 'aggressive-base',
    name: 'Base Yield Hunter',
    description: 'Higher risk strategies leveraging Base ecosystem opportunities',
    targetApy: 16.5,
    riskLevel: 'high' as const,
    allocations: {
      'Base-Yield-Farming': 40,
      'Aerodrome-LP-Farming': 30,
      'Leveraged-Base-Strategies': 30,
    },
    rebalanceThreshold: 10,
    preferredChain: 84532, // Base Sepolia for testing
  },
];

// FIXED: Asset Configurations with Base-specific addresses
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
      'base-sepolia': '0x0000000000000000000000000000000000000000', // Not available on testnet
    },
  },
  DAI: {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    coingeckoId: 'dai',
    addresses: {
      'base-mainnet': '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      'base-sepolia': '0x0000000000000000000000000000000000000000', // Not available on testnet
    },
  },
};

// API Endpoints
export const API_ENDPOINTS = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || '/api',
  GROUPS: '/api/groups',
  USER_GROUPS: '/api/user-groups',
  PROPOSALS: '/api/proposals',
  VOTES: '/api/votes',
  ANALYTICS: '/api/analytics',
  AGENT: '/api/agent',
  PORTFOLIO: '/api/portfolio',
} as const;

// FIXED: XMTP Configuration with Base Sepolia defaults
export const XMTP_CONFIG = {
  ENV: (process.env.NEXT_PUBLIC_XMTP_ENV as 'production' | 'dev') || 'dev',
  DB_PATH: 'echofi-xmtp-base',
  ENABLE_LOGGING: process.env.NODE_ENV === 'development',
  PREFERRED_NETWORK: 'base-sepolia', // Default to Base Sepolia for development
};

// FIXED: Agent Configuration optimized for Base
export const AGENT_CONFIG = {
  MODEL: 'gpt-4o-mini',
  TEMPERATURE: 0.1,
  MAX_TOKENS: 2000,
  DEFAULT_SLIPPAGE: 0.5, // 0.5%
  MAX_SLIPPAGE: 5.0, // 5%
  GAS_MULTIPLIER: 1.2, // 20% buffer for gas estimation
  RETRY_ATTEMPTS: 3,
  TIMEOUT: 30000, // 30 seconds
  PREFERRED_CHAIN: 84532, // Base Sepolia for development
  BASE_RPC_URL: 'https://sepolia.base.org', // Default RPC for Base Sepolia
};

// UI Configuration
export const UI_CONFIG = {
  ANIMATION_DURATION: 300,
  DEBOUNCE_DELAY: 500,
  NOTIFICATION_DURATION: 5000,
  POLLING_INTERVAL: 30000, // 30 seconds
  PRICE_UPDATE_INTERVAL: 60000, // 1 minute
  THEME: 'light' as const,
  DEFAULT_NETWORK_DISPLAY: 'Base Sepolia', // Show Base Sepolia as default
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

// FIXED: Main App Configuration with Base Sepolia as default
export const APP_CONFIG: AppConfig = {
  networks: Object.values(NETWORKS),
  defaultNetwork: NETWORKS['base-sepolia'].chainId, // FIXED: Default to Base Sepolia instead of mainnet
  supportedWallets: ['MetaMask', 'Coinbase Wallet', 'WalletConnect'],
  features: FEATURE_FLAGS,
  limits: APP_LIMITS,
};

// FIXED: Environment-specific configurations with Base Sepolia prioritization
export const getNetworkConfig = (networkId?: string): NetworkConfig => {
  // FIXED: Default to Base Sepolia for development, Base Mainnet for production
  let defaultNetworkId: string;
  
  if (process.env.NODE_ENV === 'production') {
    defaultNetworkId = 'base-mainnet';
  } else {
    defaultNetworkId = 'base-sepolia'; // Always default to Base Sepolia in development
  }
  
  const id = networkId || process.env.NEXT_PUBLIC_NETWORK_ID || defaultNetworkId;
  const network = NETWORKS[id];
  
  if (!network) {
    console.warn(`⚠️ Unsupported network: ${id}, falling back to Base Sepolia`);
    return NETWORKS['base-sepolia'];
  }
  
  console.log('🌐 Using network configuration:', network.name, `(Chain ID: ${network.chainId})`);
  return network;
};

export const getCurrentNetwork = (): NetworkConfig => {
  return getNetworkConfig();
};

// FIXED: Chain validation functions that prioritize Base ecosystem
export const isTestnet = (chainId: number): boolean => {
  return [84532, 11155111].includes(chainId); // Base Sepolia, Ethereum Sepolia
};

export const isMainnet = (chainId: number): boolean => {
  return [8453, 1].includes(chainId); // Base, Ethereum
};

export const isBaseChain = (chainId: number): boolean => {
  return [8453, 84532].includes(chainId); // Base Mainnet or Sepolia
};

export const isSupportedChain = (chainId: number): boolean => {
  return isBaseChain(chainId); // Only Base chains are fully supported
};

// FIXED: Helper function to get the appropriate Base chain for current environment
export const getDefaultBaseChain = (): number => {
  if (process.env.NODE_ENV === 'production') {
    return 8453; // Base Mainnet in production
  }
  return 84532; // Base Sepolia in development/testing
};

// FIXED: Get RPC URL for current network
export const getCurrentRpcUrl = (): string => {
  const network = getCurrentNetwork();
  return network.rpcUrl;
};

// FIXED: Error Messages with Base-specific guidance
export const ERROR_MESSAGES = {
  WALLET_NOT_CONNECTED: 'Please connect your wallet to continue',
  NETWORK_NOT_SUPPORTED: 'Please switch to Base Sepolia (testnet) or Base Mainnet',
  WRONG_NETWORK: 'Please switch to Base network. Currently EchoFi only supports Base ecosystem.',
  INSUFFICIENT_BALANCE: 'Insufficient balance for this transaction',
  TRANSACTION_FAILED: 'Transaction failed. Please try again',
  INVALID_ADDRESS: 'Please enter a valid Ethereum address',
  INVALID_AMOUNT: 'Please enter a valid amount',
  PROPOSAL_EXPIRED: 'This proposal has expired',
  ALREADY_VOTED: 'You have already voted on this proposal',
  NOT_GROUP_MEMBER: 'You are not a member of this group',
  AGENT_NOT_INITIALIZED: 'Investment agent is not initialized',
  XMTP_NOT_INITIALIZED: 'Secure messaging is not initialized',
  XMTP_SIGNATURE_REQUIRED: 'Please sign the message to enable secure group messaging',
  BASE_REQUIRED: 'This feature requires connection to Base network',
} as const;

// FIXED: Success Messages with Base-specific context
export const SUCCESS_MESSAGES = {
  WALLET_CONNECTED: 'Wallet connected successfully to Base network',
  NETWORK_SWITCHED: 'Successfully switched to Base network',
  GROUP_CREATED: 'Investment group created successfully',
  PROPOSAL_CREATED: 'Investment proposal created successfully',
  VOTE_SUBMITTED: 'Vote submitted successfully',
  STRATEGY_EXECUTED: 'Investment strategy executed successfully on Base',
  MEMBER_ADDED: 'Member added to group successfully',
  XMTP_INITIALIZED: 'Secure messaging initialized successfully',
} as const;

// FIXED: Development helpers for Base ecosystem
export const DEV_HELPERS = {
  BASE_SEPOLIA_FAUCET: 'https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet',
  BASE_BRIDGE: 'https://bridge.base.org/',
  BASE_DOCS: 'https://docs.base.org/',
  METAMASK_ADD_BASE: {
    chainId: '0x14a34', // Base Sepolia
    chainName: 'Base Sepolia',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://sepolia.base.org'],
    blockExplorerUrls: ['https://sepolia-explorer.base.org'],
  },
};

// Export helper to add Base Sepolia to MetaMask
export const addBaseSepoliaToWallet = async () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [DEV_HELPERS.METAMASK_ADD_BASE],
      });
      console.log('✅ Base Sepolia added to wallet successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to add Base Sepolia to wallet:', error);
      return false;
    }
  }
  return false;
};