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
  
  // Re-export XMTP content types for investment coordination
  export type { InvestmentProposal, InvestmentVote } from '@/lib/content-types';