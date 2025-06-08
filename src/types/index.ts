// Wallet and Blockchain Types
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
  
  // Investment and DeFi Types
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
  
  export interface InvestmentStrategy {
    id: string;
    name: string;
    description: string;
    targetAssets: string[];
    riskLevel: 'low' | 'medium' | 'high';
    expectedApy: number;
    minAmount: string;
    protocols: string[];
  }
  
  export interface ExecutionResult {
    success: boolean;
    transactionHash?: string;
    gasUsed?: string;
    executedAmount?: string;
    receivedAmount?: string;
    summary: string;
    error?: string;
    timestamp: number;
  }
  
  // Group and Governance Types
  export interface GroupMember {
    address: string;
    joinedAt: number;
    contributedAmount: string;
    votingPower: number;
    isActive: boolean;
    role: 'admin' | 'member';
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
  
  export interface GroupSettings {
    minVotingPower: number;
    votingDuration: number; // in hours
    executionDelay: number; // in hours
    quorumPercentage: number;
    proposalThreshold: string; // minimum amount to propose
    autoExecute: boolean;
  }
  
  export interface Proposal {
    id: string;
    groupId: string;
    title: string;
    description: string;
    strategy: string;
    requestedAmount: string;
    targetAsset: string;
    proposedBy: string;
    createdAt: number;
    deadline: number;
    status: 'active' | 'approved' | 'rejected' | 'executed' | 'expired';
    requiredVotes: number;
    currentVotes: {
      approve: number;
      reject: number;
      abstain: number;
    };
    execution?: ExecutionResult;
  }
  
  export interface Vote {
    id: string;
    proposalId: string;
    voterAddress: string;
    vote: 'approve' | 'reject' | 'abstain';
    votingPower: number;
    timestamp: number;
    reason?: string;
  }
  
  // XMTP and Messaging Types
  export interface MessageContent {
    type: 'text' | 'proposal' | 'vote' | 'execution' | 'system';
    data: any;
    metadata?: Record<string, any>;
  }
  
  export interface GroupMessage {
    id: string;
    groupId: string;
    sender: string;
    content: MessageContent;
    timestamp: number;
    replyTo?: string;
    reactions?: MessageReaction[];
  }
  
  export interface MessageReaction {
    emoji: string;
    users: string[];
    count: number;
  }
  
  // AI Agent Types
  export interface AgentConfig {
    model: string;
    temperature: number;
    maxTokens: number;
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
    enabledProtocols: string[];
    slippageTolerance: number;
    gasOptimization: boolean;
  }
  
  export interface AgentAnalysis {
    strategy: string;
    riskAssessment: {
      level: 'low' | 'medium' | 'high';
      factors: string[];
      score: number;
    };
    expectedOutcome: {
      bestCase: string;
      worstCase: string;
      mostLikely: string;
    };
    executionPlan: ExecutionStep[];
    recommendations: string[];
    confidence: number;
  }
  
  export interface ExecutionStep {
    step: number;
    action: string;
    protocol: string;
    parameters: Record<string, any>;
    estimatedGas: string;
    expectedOutput: string;
  }
  
  // API Response Types
  export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    timestamp: number;
  }
  
  export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    pagination: {
      page: number;
      limit: number;
      total: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  }
  
  // UI and Component Types
  export interface LoadingState {
    isLoading: boolean;
    operation?: string;
    progress?: number;
  }
  
  export interface ErrorState {
    hasError: boolean;
    error?: Error | string;
    code?: string;
    details?: Record<string, any>;
  }
  
  export interface NotificationOptions {
    title?: string;
    duration?: number;
    persistent?: boolean;
    actions?: NotificationAction[];
  }
  
  export interface NotificationAction {
    label: string;
    action: () => void;
    variant?: 'primary' | 'secondary';
  }
  
  // Form and Validation Types
  export interface FormField {
    name: string;
    label: string;
    type: 'text' | 'number' | 'email' | 'password' | 'textarea' | 'select' | 'checkbox';
    required?: boolean;
    placeholder?: string;
    validation?: ValidationRule[];
    options?: SelectOption[];
  }
  
  export interface ValidationRule {
    type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
    value?: any;
    message: string;
    validator?: (value: any) => boolean;
  }
  
  export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
  }
  
  export interface FormError {
    field: string;
    message: string;
    code?: string;
  }
  
  // Analytics and Metrics Types
  export interface GroupAnalytics {
    groupId: string;
    period: '24h' | '7d' | '30d' | '90d' | '1y';
    metrics: {
      totalValue: string;
      totalReturn: string;
      totalReturnPercentage: number;
      proposalsCount: number;
      executedProposalsCount: number;
      averageExecutionTime: number;
      memberActivity: number;
      gasSpent: string;
    };
    performance: PerformanceMetric[];
    topStrategies: StrategyPerformance[];
  }
  
  export interface PerformanceMetric {
    date: string;
    value: string;
    change: number;
    volume: string;
  }
  
  export interface StrategyPerformance {
    strategy: string;
    executions: number;
    totalReturn: string;
    returnPercentage: number;
    avgExecutionTime: number;
    successRate: number;
  }
  
  export interface UserAnalytics {
    address: string;
    period: '24h' | '7d' | '30d' | '90d' | '1y';
    metrics: {
      totalGroups: number;
      totalProposals: number;
      totalVotes: number;
      totalInvested: string;
      totalReturns: string;
      averageVotingPower: number;
    };
    groupsPerformance: GroupPerformance[];
  }
  
  export interface GroupPerformance {
    groupId: string;
    groupName: string;
    invested: string;
    currentValue: string;
    returns: string;
    returnPercentage: number;
  }
  
  // Event Types
  export interface AppEvent {
    type: string;
    data: any;
    timestamp: number;
    source: 'user' | 'system' | 'agent' | 'blockchain';
  }
  
  export interface ProposalEvent extends AppEvent {
    type: 'proposal_created' | 'proposal_voted' | 'proposal_executed' | 'proposal_expired';
    data: {
      proposalId: string;
      groupId: string;
      actor: string;
    };
  }
  
  export interface GroupEvent extends AppEvent {
    type: 'group_created' | 'member_added' | 'member_removed' | 'settings_updated';
    data: {
      groupId: string;
      actor: string;
      details?: any;
    };
  }
  
  // Configuration Types
  export interface AppConfig {
    networks: NetworkConfig[];
    defaultNetwork: number;
    supportedWallets: string[];
    features: FeatureFlags;
    limits: AppLimits;
  }
  
  export interface FeatureFlags {
    enableAnalytics: boolean;
    enableNotifications: boolean;
    enableAutoExecution: boolean;
    enableAdvancedStrategies: boolean;
    enableBetaFeatures: boolean;
  }
  
  export interface AppLimits {
    maxGroupMembers: number;
    maxProposalsPerGroup: number;
    maxVotingDuration: number;
    minProposalAmount: string;
    maxProposalAmount: string;
  }
  
  // Utility Types
  export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
  export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;
  export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
  };
  
  // Re-export from lib/content-types for convenience
  export type { InvestmentProposal, InvestmentVote } from '@/lib/content-types';