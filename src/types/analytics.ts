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

export interface AnalyticsEvent {
  type: string;
  properties: Record<string, unknown>;
  userId?: string;
  timestamp: number;
  sessionId?: string;
}

export interface ChartDataPoint {
  x: string | number;
  y: number;
  label?: string;
  color?: string;
}