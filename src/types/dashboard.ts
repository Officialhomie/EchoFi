import { Address } from 'viem';

// Dashboard Component Types
export interface DashboardProps {
  onViewGroups: () => void;
  onJoinGroup: (groupId: string, groupName: string) => void;
}

export interface PortfolioData {
  totalValue: string;
  change24h: number;
  assets: PortfolioAsset[];
}

export interface PortfolioAsset {
  symbol: string;
  amount: string;
  value: string;
  change24h: number;
}

export interface GroupSummary {
  id: string;
  name: string;
  memberCount: number;
  totalFunds: string;
  activeProposals: number;
  totalProposals: number;
  lastActivity: number;
}

export interface BalanceAsset {
  asset: string;
  amount: string;
  usdValue?: string;
}

export interface BalanceResponse {
  address: string | Address;
  balances: BalanceAsset[];
  totalUsdValue?: string;
}

// Agent API Types
export interface AgentActionParams {
  strategy?: string;
  amount?: string;
  token?: string;
  timeframe?: string;
  metrics?: string[];
  asset?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AgentResponse {
  success: boolean;
  error?: string;
  response?: string;
  details?: {
    stack?: string;
    timestamp?: string;
  };
}

// Group Chat Types
export interface GroupChatMessage {
  id: string;
  sender: Address;
  content: string;
  timestamp: number;
  type: 'text' | 'proposal' | 'vote' | 'system';
  sentAtNs?: bigint;
  isOwnMessage?: boolean;
  senderDisplayName?: string;
}

export interface GroupChatState {
  messages: GroupChatMessage[];
  loading: boolean;
  error: string | null;
  lastActivity?: number | null;
}

// Contract Types
export interface ContractConfig {
  address: Address;
  abi: readonly unknown[];
  chainId: number;
}

export interface ContractState {
  initialized: boolean;
  error: string | null;
  config: ContractConfig | null;
}

// Debug Types
export interface InitializationState {
  status: 'idle' | 'loading' | 'success' | 'error';
  progress: number;
  message: string;
  error?: string;
}

export interface DebugMetrics {
  timestamp: number;
  memoryUsage: number;
  cpuUsage: number;
  networkLatency: number;
}