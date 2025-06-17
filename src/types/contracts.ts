// Contract-specific TypeScript types for EchoFi
// Matches the actual contract interfaces and ABIs

import type { Address } from 'viem';

// =============================================================================
// CORE CONTRACT ENUMS
// =============================================================================

/**
 * Proposal types as defined in EchoFiTreasury.sol
 */
export enum ProposalType {
  DEPOSIT_AAVE = 0,
  WITHDRAW_AAVE = 1,
  TRANSFER = 2,
  EMERGENCY_WITHDRAW = 3,
  ADD_MEMBER = 4,
  REMOVE_MEMBER = 5
}

/**
 * Proposal status enum for UI display
 */
export enum ProposalStatus {
  ACTIVE = 'active',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXECUTED = 'executed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

/**
 * Treasury status
 */
export enum TreasuryStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PAUSED = 'paused'
}

// =============================================================================
// FACTORY CONTRACT TYPES
// =============================================================================

/**
 * Treasury information from Factory contract
 */
export interface FactoryTreasuryInfo {
  treasuryAddress: Address;
  creator: Address;
  name: string;
  description: string;
  memberCount: bigint;
  totalVotingPower: bigint;
  createdAt: bigint;
  isActive: boolean;
}

/**
 * Factory statistics
 */
export interface FactoryStats {
  totalTreasuries: bigint;
  activeTreasuries: bigint;
  totalMembers: bigint;
  totalFeesCollected: bigint;
}

/**
 * Parameters for creating a new treasury
 */
export interface CreateTreasuryParams {
  name: string;
  description: string;
  members: Address[];
  votingPowers: number[]; // Percentages that must sum to 100
}

/**
 * Parameters for creating a new group
 */
export interface CreateGroupParams {
  name: string;
  xmtpGroupId: string;
}

// =============================================================================
// HELPER CONTRACT TYPES
// =============================================================================

/**
 * Basic proposal information from Helper contract
 */
export interface ProposalBasicInfo {
  id: bigint;
  proposer: Address;
  proposalType: ProposalType;
  amount: bigint;
  description: string;
}

/**
 * Voting information for a proposal
 */
export interface ProposalVotingInfo {
  votesFor: bigint;
  votesAgainst: bigint;
  deadline: bigint;
  executed: boolean;
  cancelled: boolean;
  canExecute: boolean;
  status: string;
}

/**
 * Complete proposal details from Helper contract
 */
export interface ProposalDetails {
  basic: ProposalBasicInfo;
  voting: ProposalVotingInfo;
}

/**
 * Treasury details from Helper contract
 */
export interface TreasuryDetails {
  treasuryAddress: Address;
  name: string;
  memberCount: bigint;
  totalVotingPower: bigint;
  usdcBalance: bigint;
  aUsdcBalance: bigint;
  activeProposals: bigint;
  isActive: boolean;
}

/**
 * Member information
 */
export interface MemberInfo {
  memberAddress: Address;
  votingPower: bigint;
  hasProposerRole: boolean;
  hasVoterRole: boolean;
  hasExecutorRole: boolean;
}

/**
 * Treasury statistics
 */
export interface TreasuryStats {
  totalProposals: bigint;
  activeProposals: bigint;
  executedProposals: bigint;
  totalVotingPower: bigint;
  treasuryValue: bigint;
}

/**
 * Can user vote result
 */
export interface CanVoteResult {
  canVote: boolean;
  reason: string;
}

// =============================================================================
// TREASURY CONTRACT TYPES
// =============================================================================

/**
 * Proposal data structure from Treasury contract
 */
export interface ProposalData {
  id: bigint;
  proposer: Address;
  proposalType: ProposalType;
  amount: bigint;
  target: Address;
  description: string;
}

/**
 * Voting data structure from Treasury contract
 */
export interface VotingData {
  votesFor: bigint;
  votesAgainst: bigint;
  deadline: bigint;
  executed: boolean;
  cancelled: boolean;
}

/**
 * Full proposal structure from Treasury contract
 */
export interface FullProposal {
  data: ProposalData;
  voting: VotingData;
  executionData: string; // bytes as hex string
}

/**
 * Treasury balance information
 */
export interface TreasuryBalance {
  usdcBalance: bigint;
  aUsdcBalance: bigint;
}

/**
 * Extended treasury balance with calculations
 */
export interface TreasuryBalanceExtended extends TreasuryBalance {
  totalValue: bigint;
  formattedTotal: string;
  usdcFormatted: string;
  aUsdcFormatted: string;
}

/**
 * Parameters for creating a proposal
 */
export interface CreateProposalParams {
  proposalType: ProposalType;
  amount: bigint;
  target: Address;
  data: string; // bytes as hex string
  description: string;
}

/**
 * Parameters for voting
 */
export interface VoteParams {
  proposalId: bigint;
  support: boolean;
}

/**
 * Vote choice information
 */
export interface VoteChoice {
  voter: Address;
  support: boolean;
  votingPower: bigint;
  timestamp: bigint;
}

// =============================================================================
// AGENT EXECUTOR TYPES
// =============================================================================

/**
 * Parameters for executing a strategy via Agent Executor
 */
export interface ExecuteStrategyParams {
  treasury: Address;
  strategy: string;
  amount: bigint;
  token: Address;
  targetProtocol: Address;
  data: string; // bytes as hex string
}

/**
 * Strategy execution result
 */
export interface StrategyExecutionResult {
  success: boolean;
  transactionHash?: string;
  gasUsed?: bigint;
  error?: string;
  timestamp: bigint;
}

// =============================================================================
// EVENT TYPES
// =============================================================================

/**
 * Contract event log structure
 */
export interface ContractLog {
  address: Address;
  topics: string[];
  data: string;
  transactionHash: string;
  blockNumber: bigint;
  blockHash: string;
  logIndex: number;
  transactionIndex: number;
}

/**
 * Treasury Created Event
 */
export interface TreasuryCreatedEvent {
  treasury: Address;
  creator: Address;
  name: string;
  memberCount: bigint;
  treasuryId: bigint;
}

/**
 * Proposal Created Event
 */
export interface ProposalCreatedEvent {
  proposalId: bigint;
  proposer: Address;
  proposalType: ProposalType;
  amount: bigint;
  description: string;
}

/**
 * Vote Cast Event
 */
export interface VoteCastEvent {
  proposalId: bigint;
  voter: Address;
  support: boolean;
  votingPower: bigint;
}

/**
 * Proposal Executed Event
 */
export interface ProposalExecutedEvent {
  proposalId: bigint;
  success: boolean;
}

/**
 * Strategy Executed Event
 */
export interface StrategyExecutedEvent {
  treasury: Address;
  strategy: string;
  amount: bigint;
  token: Address;
  success: boolean;
}

// =============================================================================
// UI/FRONTEND TYPES
// =============================================================================

/**
 * Proposal with computed properties for UI
 */
export interface UIProposal extends ProposalDetails {
  id: string; // String version for React keys
  statusLabel: string;
  canVote: boolean;
  canExecute: boolean;
  quorumProgress: number;
  timeRemaining: string;
  formattedAmount: string;
}

/**
 * Treasury with computed properties for UI
 */
export interface UITreasury extends TreasuryDetails {
  id: string; // String version for React keys
  statusLabel: string;
  formattedBalance: string;
  memberCountFormatted: string;
  activeProposalsFormatted: string;
}

/**
 * Member with computed properties for UI
 */
export interface UIMember extends MemberInfo {
  id: string; // String version for React keys
  votingPowerPercentage: string;
  roleLabels: string[];
  canPropose: boolean;
  canVote: boolean;
  canExecute: boolean;
}

/**
 * Form data for creating treasury
 */
export interface CreateTreasuryFormData {
  name: string;
  description: string;
  members: {
    address: string;
    votingPower: number;
  }[];
  xmtpGroupId?: string;
}

/**
 * Form data for creating proposal
 */
export interface CreateProposalFormData {
  type: ProposalType;
  amount: string;
  target?: string;
  description: string;
  // Additional fields based on proposal type
  additionalData?: Record<string, unknown>;
}

// =============================================================================
// HOOK RETURN TYPES
// =============================================================================

/**
 * Return type for useCreateTreasury hook
 */
export interface UseCreateTreasuryReturn {
  createTreasury: (params: CreateTreasuryParams) => void;
  isLoading: boolean;
  isSuccess: boolean;
  txHash?: string;
  error?: Error | null;
}

/**
 * Return type for useUserTreasuries hook
 */
export interface UseUserTreasuriesReturn {
  treasuries: Address[];
  isError: boolean;
  isLoading: boolean;
  error?: Error | null;
}

/**
 * Return type for useTreasuryDetails hook
 */
export interface UseTreasuryDetailsReturn {
  treasury?: TreasuryDetails;
  isError: boolean;
  isLoading: boolean;
  error?: Error | null;
}

/**
 * Return type for useTreasuryBalance hook
 */
export interface UseTreasuryBalanceReturn {
  balance: TreasuryBalance;
  totalValue: bigint;
  formattedTotal: string;
  isLoading: boolean;
  error?: Error | null;
}

/**
 * Return type for useCreateProposal hook
 */
export interface UseCreateProposalReturn {
  createProposal: (params: CreateProposalParams) => void;
  isLoading: boolean;
  isSuccess: boolean;
  txHash?: string;
  error?: Error | null;
}

/**
 * Return type for useVote hook
 */
export interface UseVoteReturn {
  vote: (params: VoteParams) => void;
  isLoading: boolean;
  isSuccess: boolean;
  txHash?: string;
  error?: Error | null;
}

/**
 * Return type for useExecuteProposal hook
 */
export interface UseExecuteProposalReturn {
  executeProposal: (proposalId: bigint) => void;
  isLoading: boolean;
  isSuccess: boolean;
  txHash?: string;
  error?: Error | null;
}

/**
 * Return type for useProposalDetails hook
 */
export interface UseProposalDetailsReturn {
  proposal?: ProposalDetails;
  isError: boolean;
  isLoading: boolean;
  error?: Error | null;
}

/**
 * Return type for useCanUserVote hook
 */
export interface UseCanUserVoteReturn {
  canVote: boolean;
  reason: string;
  isError: boolean;
  isLoading: boolean;
  error?: Error | null;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Contract call result wrapper
 */
export interface ContractCallResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Transaction result wrapper
 */
export interface TransactionResult {
  hash: string | undefined;
  isLoading: boolean;
  isSuccess: boolean;
  error: Error | null;
}

/**
 * Network configuration
 */
export interface NetworkConfig {
  chainId: number;
  name: string;
  contracts: {
    factory: Address;
    helper: Address;
    agentExecutor: Address;
    usdc: Address;
    aUSDC: Address;
  };
  blockExplorer: string;
  rpcUrl: string;
}

/**
 * Treasury role configuration
 */
export interface TreasuryRoles {
  DEFAULT_ADMIN_ROLE: string;
  PROPOSER_ROLE: string;
  VOTER_ROLE: string;
  EXECUTOR_ROLE: string;
  AGENT_ROLE: string;
}

/**
 * Gas estimation result
 */
export interface GasEstimate {
  gasLimit: bigint;
  gasPrice: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  estimatedCost: bigint;
  estimatedCostUSD?: number;
}

/**
 * Proposal validation result
 */
export interface ProposalValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Treasury validation result
 */
export interface TreasuryValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  memberValidation: {
    validAddresses: boolean;
    votingPowerSum: number;
    duplicateAddresses: boolean;
  };
}

// =============================================================================
// COMPUTED PROPERTY HELPERS
// =============================================================================

/**
 * Proposal status computed from contract data
 */
export type ComputedProposalStatus = {
  status: ProposalStatus;
  isActive: boolean;
  isVoteable: boolean;
  isExecutable: boolean;
  hasQuorum: boolean;
  isPassing: boolean;
};

/**
 * Treasury health metrics
 */
export type TreasuryHealthMetrics = {
  totalValue: bigint;
  utilizationRate: number; // Percentage of funds in yield
  activeProposalRatio: number;
  memberEngagement: number;
  avgProposalValue: bigint;
};

/**
 * Vote distribution
 */
export type VoteDistribution = {
  votesFor: bigint;
  votesAgainst: bigint;
  abstain: bigint;
  totalVotes: bigint;
  turnoutPercentage: number;
  passingPercentage: number;
};

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Contract-specific error types
 */
export enum ContractErrorType {
  INSUFFICIENT_FEE = 'InsufficientFee',
  INVALID_MEMBER_COUNT = 'InvalidMemberCount',
  INVALID_VOTING_POWERS = 'InvalidVotingPowers',
  TREASURY_NOT_FOUND = 'TreasuryNotFound',
  UNAUTHORIZED_ACCESS = 'UnauthorizedAccess',
  ALREADY_VOTED = 'AlreadyVoted',
  INVALID_PROPOSAL_ID = 'InvalidProposalId',
  PROPOSAL_ALREADY_EXECUTED = 'ProposalAlreadyExecuted',
  VOTING_ENDED = 'VotingEnded',
  QUORUM_NOT_REACHED = 'QuorumNotReached',
  INSUFFICIENT_BALANCE = 'InsufficientBalance'
}

/**
 * Contract error with metadata
 */
export interface ContractError extends Error {
  type: ContractErrorType;
  contractAddress?: Address;
  transactionHash?: string;
  blockNumber?: bigint;
  metadata?: Record<string, unknown>;
}

/**
 * Transaction error with context
 */
export interface TransactionError extends Error {
  code?: string | number;
  reason?: string;
  transactionHash?: string;
  receipt?: unknown;
  gasUsed?: bigint;
}

// =============================================================================
// EXPORT UTILITY TYPE GUARDS
// =============================================================================

/**
 * Type guard for checking if value is valid Address
 */
export function isValidAddress(value: unknown): value is Address {
  return typeof value === 'string' && 
         value.length === 42 && 
         value.startsWith('0x') &&
         /^0x[a-fA-F0-9]{40}$/.test(value);
}

/**
 * Type guard for checking if value is valid ProposalType
 */
export function isValidProposalType(value: unknown): value is ProposalType {
  return typeof value === 'number' && 
         Object.values(ProposalType).includes(value);
}

/**
 * Type guard for checking if proposal is executable
 */
export function isExecutableProposal(proposal: ProposalDetails): boolean {
  return proposal.voting.canExecute && 
         !proposal.voting.executed && 
         !proposal.voting.cancelled;
}

/**
 * Type guard for checking if treasury is active
 */
export function isActiveTreasury(treasury: TreasuryDetails): boolean {
  return treasury.isActive && treasury.memberCount > 0n;
}