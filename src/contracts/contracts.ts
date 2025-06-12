// Frontend Integration for EchoFi Smart Contracts
// WAGMI + Viem integration with TypeScript types

import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
} from 'wagmi';
import type { Address } from 'viem';
import { parseUnits, formatUnits } from 'viem';

// =============================================================================
// CONTRACT ABIS (Auto-generated from Foundry)
// =============================================================================

export const EchoFiTreasuryABI = [
  // Core Treasury Functions
  {
    "inputs": [
      {"name": "_type", "type": "uint8"},
      {"name": "_amount", "type": "uint256"},
      {"name": "_target", "type": "address"},
      {"name": "_data", "type": "bytes"},
      {"name": "_description", "type": "string"}
    ],
    "name": "createProposal",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "_proposalId", "type": "uint256"},
      {"name": "_support", "type": "bool"}
    ],
    "name": "vote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "_proposalId", "type": "uint256"}],
    "name": "executeProposal",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // View Functions
  {
    "inputs": [{"name": "_proposalId", "type": "uint256"}],
    "name": "getProposal",
    "outputs": [
      {"name": "id", "type": "uint256"},
      {"name": "proposer", "type": "address"},
      {"name": "proposalType", "type": "uint8"},
      {"name": "amount", "type": "uint256"},
      {"name": "target", "type": "address"},
      {"name": "description", "type": "string"},
      {"name": "votesFor", "type": "uint256"},
      {"name": "votesAgainst", "type": "uint256"},
      {"name": "deadline", "type": "uint256"},
      {"name": "executed", "type": "bool"},
      {"name": "cancelled", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTreasuryBalance",
    "outputs": [
      {"name": "usdcBalance", "type": "uint256"},
      {"name": "aUsdcBalance", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAavePosition",
    "outputs": [
      {"name": "totalCollateral", "type": "uint256"},
      {"name": "availableLiquidity", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Events
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "proposalId", "type": "uint256"},
      {"indexed": true, "name": "proposer", "type": "address"},
      {"indexed": false, "name": "proposalType", "type": "uint8"},
      {"indexed": false, "name": "amount", "type": "uint256"},
      {"indexed": false, "name": "description", "type": "string"}
    ],
    "name": "ProposalCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "proposalId", "type": "uint256"},
      {"indexed": true, "name": "voter", "type": "address"},
      {"indexed": false, "name": "support", "type": "bool"},
      {"indexed": false, "name": "votingPower", "type": "uint256"}
    ],
    "name": "VoteCast",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "proposalId", "type": "uint256"},
      {"indexed": false, "name": "success", "type": "bool"}
    ],
    "name": "ProposalExecuted",
    "type": "event"
  }
] as const;

export const EchoFiFactoryABI = [
  {
    "inputs": [
      {"name": "_name", "type": "string"},
      {"name": "_description", "type": "string"},
      {"name": "_members", "type": "address[]"},
      {"name": "_votingPowers", "type": "uint256[]"}
    ],
    "name": "createTreasury",
    "outputs": [{"name": "", "type": "address"}],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"name": "_user", "type": "address"}],
    "name": "getUserTreasuries",
    "outputs": [{"name": "", "type": "address[]"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getActiveTreasuries",
    "outputs": [{"name": "", "type": "address[]"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "_treasury", "type": "address"}],
    "name": "getTreasuryInfo",
    "outputs": [
      {"name": "treasuryAddress", "type": "address"},
      {"name": "creator", "type": "address"},
      {"name": "name", "type": "string"},
      {"name": "description", "type": "string"},
      {"name": "memberCount", "type": "uint256"},
      {"name": "totalVotingPower", "type": "uint256"},
      {"name": "createdAt", "type": "uint256"},
      {"name": "isActive", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// =============================================================================
// TYPESCRIPT TYPES
// =============================================================================

export enum ProposalType {
  DEPOSIT_AAVE = 0,
  WITHDRAW_AAVE = 1,
  TRANSFER = 2,
  EMERGENCY_WITHDRAW = 3,
  ADD_MEMBER = 4,
  REMOVE_MEMBER = 5
}

export interface Proposal {
  id: number;
  proposer: Address;
  proposalType: ProposalType;
  amount: bigint;
  target: Address;
  description: string;
  votesFor: bigint;
  votesAgainst: bigint;
  deadline: bigint;
  executed: boolean;
  cancelled: boolean;
}

export interface TreasuryInfo {
  treasuryAddress: Address;
  creator: Address;
  name: string;
  description: string;
  memberCount: number;
  totalVotingPower: number;
  createdAt: number;
  isActive: boolean;
}

export interface TreasuryBalance {
  usdcBalance: bigint;
  aUsdcBalance: bigint;
  totalValue: bigint; // Combined value in USDC
}

export interface CreateTreasuryParams {
  name: string;
  description: string;
  members: Address[];
  votingPowers: number[];
}

export interface CreateProposalParams {
  type: ProposalType;
  amount: string; // String amount in USDC (e.g., "1000.50")
  target?: Address;
  description: string;
}

// =============================================================================
// CONTRACT ADDRESSES
// =============================================================================

export const CONTRACTS = {
  [8453]: { // Base Mainnet
    factory: '0x...' as Address,
    helper: '0x...' as Address,
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
  },
  [84532]: { // Base Sepolia
    factory: '0x...' as Address,
    helper: '0x...' as Address,
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address,
  }
} as const;

// =============================================================================
// CUSTOM HOOKS
// =============================================================================

/**
 * Hook to create a new treasury via factory
 */
export function useCreateTreasury(chainId: number) {
  const factoryAddress = CONTRACTS[chainId as keyof typeof CONTRACTS]?.factory;
  const { data: simulation, error: simError, isPending: isSimPending } = useSimulateContract({
    address: factoryAddress,
    abi: EchoFiFactoryABI,
    functionName: 'createTreasury',
  });
  const { data, writeContract, isPending } = useWriteContract();
  const { isPending: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: data,
  });

  const createTreasury = (params: CreateTreasuryParams) => {
    if (!writeContract) return;
    const total = params.votingPowers.reduce((sum, power) => sum + power, 0);
    if (total !== 100) {
      throw new Error('Voting powers must sum to 100');
    }
    writeContract({
      address: factoryAddress,
      abi: EchoFiFactoryABI,
      functionName: 'createTreasury',
      args: [
        params.name,
        params.description,
        params.members,
        params.votingPowers.map((p) => BigInt(p)),
      ],
      value: parseUnits('0.001', 18), // Creation fee
    });
  };

  return {
    createTreasury,
    isLoading: isPending || isConfirming || isSimPending,
    isSuccess,
    txHash: data,
    error: simError,
  };
}

/**
 * Hook to get user's treasuries
 */
export function useUserTreasuries(userAddress: Address, chainId: number) {
  const factoryAddress = CONTRACTS[chainId as keyof typeof CONTRACTS]?.factory;
  const { data, error, isPending } = useReadContract({
    address: factoryAddress,
    abi: EchoFiFactoryABI,
    functionName: 'getUserTreasuries',
    args: [userAddress],
  });
  return {
    treasuries: data || [],
    isError: !!error,
    isLoading: isPending,
  };
}

/**
 * Hook to listen to proposal events
 */
export function useProposalEvents(treasuryAddress: Address) {
  // Listen for new proposals
  useWatchContractEvent({
    address: treasuryAddress,
    abi: EchoFiTreasuryABI,
    eventName: 'ProposalCreated',
    onLogs(logs: any[]) {
      logs.forEach((log) => {
        console.log('New proposal created:', {
          proposalId: log.args.proposalId,
          proposer: log.args.proposer,
          amount: formatUnits(log.args.amount || BigInt(0), 6),
          description: log.args.description,
        });
        // You can trigger notifications, update state, etc.
        // This is where you'd integrate with XMTP messaging
      });
    },
  });   

  // Listen for votes
  useWatchContractEvent({
    address: treasuryAddress,
    abi: EchoFiTreasuryABI,
    eventName: 'VoteCast',
    onLogs(logs: any[]) {
      logs.forEach((log) => {
        console.log('Vote cast:', {
          proposalId: log.args.proposalId,
          voter: log.args.voter,
          support: log.args.support,
          votingPower: log.args.votingPower,
        });
      });
    },
  });
  // Listen for executions
  useWatchContractEvent({
    address: treasuryAddress,
    abi: EchoFiTreasuryABI,
    eventName: 'ProposalExecuted',
    onLogs(logs: any[]) {
      logs.forEach((log) => {
        console.log('Proposal executed:', {
          proposalId: log.args.proposalId,
          success: log.args.success,
        });
      });
    },
  });
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format proposal type for display
 */
export function formatProposalType(type: ProposalType): string {
  switch (type) {
    case ProposalType.DEPOSIT_AAVE:
      return 'Deposit to Aave';
    case ProposalType.WITHDRAW_AAVE:
      return 'Withdraw from Aave';
    case ProposalType.TRANSFER:
      return 'Transfer Funds';
    case ProposalType.EMERGENCY_WITHDRAW:
      return 'Emergency Withdraw';
    case ProposalType.ADD_MEMBER:
      return 'Add Member';
    case ProposalType.REMOVE_MEMBER:
      return 'Remove Member';
    default:
      return 'Unknown';
  }
}

/**
 * Format time remaining in human readable format
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return 'Expired';
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Calculate APY from Aave position (simplified for MVP)
 */
export function calculateAaveAPY(aUsdcBalance: bigint): number {
  // For MVP, use fixed 4.5% APY
  // In production, fetch from Aave contracts
  return 4.5;
}

/**
 * Validate USDC amount input
 */
export function validateUSDCAmount(amount: string, maxAmount?: string): string | null {
  const num = parseFloat(amount);
  
  if (isNaN(num) || num <= 0) {
    return 'Amount must be greater than 0';
  }
  
  if (num < 10) {
    return 'Minimum amount is 10 USDC';
  }
  
  if (num > 1000000) {
    return 'Maximum amount is 1,000,000 USDC';
  }
  
  if (maxAmount && num > parseFloat(maxAmount)) {
    return 'Amount exceeds available balance';
  }
  
  return null;
}

// =============================================================================
// EXAMPLE USAGE IN COMPONENTS
// =============================================================================

/*
// Treasury Dashboard Component
export function TreasuryDashboard({ treasuryAddress }: { treasuryAddress: Address }) {
  const { balance, formattedTotal, isLoading } = useTreasuryBalance(treasuryAddress);
  const { createProposal, isLoading: isCreating } = useCreateProposal(treasuryAddress);
  
  // Listen to events
  useProposalEvents(treasuryAddress);
  
  const handleCreateProposal = () => {
    createProposal({
      type: ProposalType.DEPOSIT_AAVE,
      amount: "1000",
      description: "Invest 1000 USDC in Aave for yield generation"
    });
  };
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      <h2>Treasury Balance: ${formattedTotal} USDC</h2>
      <button onClick={handleCreateProposal} disabled={isCreating}>
        Create Aave Deposit Proposal
      </button>
    </div>
  );
}

// Proposal Voting Component  
export function ProposalCard({ treasuryAddress, proposalId }: { 
  treasuryAddress: Address; 
  proposalId: number; 
}) {
  const { proposal, isActive, formattedAmount, timeRemaining } = useProposal(treasuryAddress, proposalId);
  const { vote, isLoading } = useVoteOnProposal(treasuryAddress);
  
  if (!proposal) return null;
  
  return (
    <div>
      <h3>{formatProposalType(proposal.proposalType)}</h3>
      <p>Amount: ${formattedAmount} USDC</p>
      <p>Description: {proposal.description}</p>
      {isActive && (
        <>
          <p>Time remaining: {formatTimeRemaining(timeRemaining)}</p>
          <button onClick={() => vote(proposalId, true)} disabled={isLoading}>
            Vote Yes
          </button>
          <button onClick={() => vote(proposalId, false)} disabled={isLoading}>
            Vote No
          </button>
        </>
      )}
    </div>
  );
}
*/