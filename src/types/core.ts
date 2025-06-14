export interface WalletConnection {
    address: string;
    chainId: number;
    isConnected: boolean;
    balance?: string;
  }
  
  export interface NetworkConfig {
    chainId: number;
    name: string;
    rpcUrl: string;
    blockExplorer: string;
    nativeCurrency: {
      name: string;
      symbol: string;
      decimals: number;
    };
  }
  
  export interface Asset {
    symbol: string;
    name: string;
    address: string;
    decimals: number;
    balance: string;
    usdValue: string;
    price: string;
    change24h: number;
  }
  
  export interface Portfolio {
    totalValue: string;
    totalValueUsd: string;
    change24h: number;
    change7d: number;
    assets: Asset[];
    lastUpdated: number;
  }
  
  export interface GroupMember {
    address: string;
    joinedAt: number;
    contributedAmount: string;
    votingPower: number;
    isActive: boolean;
    role: 'admin' | 'member';
  }
  
  export interface GroupSettings {
    minVotingPower: number;
    votingDuration: number; // in hours
    executionDelay: number; // in hours
    quorumPercentage: number;
    proposalThreshold: string; // minimum amount to propose
    autoExecute: boolean;
  }
  
  export interface InvestmentGroup {
    id: string;
    name: string;
    description: string;
    xmtpGroupId: string;
    createdBy: string;
    createdAt: number;
    totalFunds: string;
    memberCount: number;
    members: GroupMember[];
    isActive: boolean;
    settings: GroupSettings;
  }