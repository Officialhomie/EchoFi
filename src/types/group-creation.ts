import type { Conversation, DecodedMessage } from '@xmtp/browser-sdk';

// =============================================================================
// CORE GROUP CREATION TYPES
// =============================================================================

/**
 * Configuration for creating a new XMTP investment group
 * Matches the enhanced XMTP manager interface
 */
export interface GroupCreationConfig {
  /** Display name for the group */
  name: string;
  /** Optional description of the group's purpose */
  description?: string;
  /** Optional square image URL for group avatar */
  imageUrlSquare?: string;
  /** Whether to deploy a smart contract treasury */
  deployTreasury?: boolean;
  /** Initial voting powers for treasury (if deployed) */
  votingPowers?: number[];
}

/**
 * Parameters for the group creation process
 * Used by the useXMTP hook and GroupManager component
 */
export interface CreateGroupParams {
  /** Group display name */
  name: string;
  /** Group description */
  description: string;
  /** Array of member wallet addresses (excluding creator) */
  members: string[];
  /** Optional configuration overrides */
  config?: Partial<GroupCreationConfig>;
}

/**
 * Result of a successful group creation
 * Contains both XMTP conversation and database record info
 */
export interface GroupCreationResult {
  /** XMTP conversation object */
  conversation: Conversation;
  /** Database group ID */
  databaseGroupId: string;
  /** Smart contract address (if treasury was deployed) */
  treasuryAddress?: string;
  /** Transaction hash for treasury deployment */
  deploymentTxHash?: string;
}

// =============================================================================
// GROUP MANAGEMENT TYPES
// =============================================================================

/**
 * Member validation status for group creation form
 * Used to validate wallet addresses before group creation
 */
export interface MemberValidationResult {
  /** Whether the address can receive XMTP messages */
  canMessage: boolean;
  /** Whether the address format is valid */
  isValidFormat: boolean;
  /** Whether validation is currently in progress */
  isValidating: boolean;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Collection of member validation results
 * Maps wallet address to validation status
 */
export type MemberValidationMap = Record<string, MemberValidationResult>;

/**
 * Form state for group creation UI
 * Manages user input and validation errors
 */
export interface GroupCreationFormState {
  /** Group name input */
  name: string;
  /** Group description input */
  description: string;
  /** Comma-separated member addresses */
  members: string;
  /** Whether the form is currently submitting */
  isSubmitting: boolean;
  /** Form validation errors */
  errors: Record<string, string>;
  /** Member validation results */
  memberValidation: MemberValidationMap;
}

// =============================================================================
// API INTEGRATION TYPES
// =============================================================================

/**
 * Request payload for the groups API endpoint
 * Used for creating groups in the database
 */
export interface CreateGroupApiRequest {
  /** Group display name */
  name: string;
  /** Group description */
  description?: string;
  /** XMTP group ID from conversation */
  xmtpGroupId: string;
  /** Creator's wallet address */
  createdBy: string;
  /** Initial member addresses */
  members?: string[];
}

/**
 * Response from the groups API endpoint
 * Contains the created group information
 */
export interface CreateGroupApiResponse {
  /** Success status */
  success: boolean;
  /** Created group data */
  group?: {
    id: string;
    name: string;
    description?: string;
    xmtpGroupId: string;
    createdBy: string;
    createdAt: string;
  };
  /** Error message if creation failed */
  error?: string;
}

// =============================================================================
// SMART CONTRACT INTEGRATION TYPES
// =============================================================================

/**
 * Parameters for smart contract treasury deployment
 * Used with the EchoFiFactory contract
 */
export interface TreasuryDeploymentParams {
  /** Group name for the treasury */
  name: string;
  /** XMTP group ID to link with treasury */
  xmtpGroupId: string;
  /** Member addresses for treasury access */
  members: string[];
  /** Voting power distribution (must sum to 100) */
  votingPowers: number[];
}

/**
 * Result of treasury deployment
 * Contains contract addresses and transaction info
 */
export interface TreasuryDeploymentResult {
  /** Address of the deployed treasury contract */
  treasuryAddress: string;
  /** Transaction hash of deployment */
  txHash: string;
  /** Block number where contract was deployed */
  blockNumber: number;
  /** Gas used for deployment */
  gasUsed: string;
}

// =============================================================================
// ERROR HANDLING TYPES
// =============================================================================

/**
 * Specific error types for group creation failures
 * Provides structured error handling across the flow
 */
export type GroupCreationErrorType = 
  | 'XMTP_CONNECTION_FAILED'
  | 'INVALID_MEMBER_ADDRESSES' 
  | 'DATABASE_SAVE_FAILED'
  | 'TREASURY_DEPLOYMENT_FAILED'
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'UNKNOWN_ERROR';

/**
 * Structured error for group creation failures
 * Provides detailed context for error handling and user feedback
 */
export interface GroupCreationError extends Error {
  /** Specific error type for programmatic handling */
  type: GroupCreationErrorType;
  /** User-friendly error message */
  userMessage: string;
  /** Technical details for debugging */
  technicalDetails?: string;
  /** Recovery suggestions for the user */
  recoverySuggestions?: string[];
  /** Whether the operation can be retried */
  retryable: boolean;
}

// =============================================================================
// UI COMPONENT TYPES
// =============================================================================

/**
 * Props for the GroupManager component
 * Defines the interface for the main group management UI
 */
export interface GroupManagerProps {
  /** Current XMTP conversations */
  conversations: Conversation[];
  /** Whether XMTP is currently initializing */
  isLoading: boolean;
  /** Current initialization error */
  error: string | null;
  /** Callback when user wants to create a group */
  onCreateGroup: (params: CreateGroupParams) => Promise<void>;
  /** Callback when user wants to join/view a group */
  onJoinGroup: (conversationId: string, groupName: string) => void;
  /** Whether the current user can create groups */
  canCreateGroups?: boolean;
  /** Maximum number of members allowed per group */
  maxMembers?: number;
}

/**
 * Props for individual group cards in the UI
 * Used for displaying group information in lists
 */
export interface GroupCardProps {
  /** XMTP conversation data */
  conversation: Conversation;
  /** Last message in the group */
  lastMessage?: DecodedMessage;
  /** Number of unread messages */
  unreadCount?: number;
  /** Whether the group has an active AI agent */
  hasActiveAgent?: boolean;
  /** Click handler for joining the group */
  onClick: (conversationId: string, groupName: string) => void;
  /** Whether the card should show loading state */
  isLoading?: boolean;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Utility type for address validation
 * Ensures type safety when working with Ethereum addresses
 */
export type EthereumAddress = `0x${string}`;

/**
 * Type guard for Ethereum addresses
 * Validates address format at runtime
 * Note: This is now implemented in the useXMTP hook directly to avoid import issues
 */
export function isValidEthereumAddress(address: string): address is EthereumAddress {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Helper type for parsing member address input
 * Handles comma-separated address strings safely
 */
export interface ParsedMemberAddresses {
  /** Valid Ethereum addresses */
  validAddresses: EthereumAddress[];
  /** Invalid address strings */
  invalidAddresses: string[];
  /** Empty strings that were filtered out */
  emptyStrings: number;
}

/**
 * Utility function to parse member address input
 * Safely converts comma-separated string to validated addresses
 */
export function parseMemberAddresses(input: string): ParsedMemberAddresses {
  const addresses = input
    .split(',')
    .map(addr => addr.trim())
    .filter(addr => addr.length > 0);
  
  const validAddresses: EthereumAddress[] = [];
  const invalidAddresses: string[] = [];
  let emptyStrings = 0;
  
  for (const addr of addresses) {
    if (addr.length === 0) {
      emptyStrings++;
    } else if (isValidEthereumAddress(addr)) {
      validAddresses.push(addr);
    } else {
      invalidAddresses.push(addr);
    }
  }
  
  return { validAddresses, invalidAddresses, emptyStrings };
}