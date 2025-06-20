import { useState, useCallback } from 'react';
import { useXMTP } from '@/hooks/useXMTP';
import { useWallet } from '@/hooks/useWallet';
import { Conversation } from '@xmtp/browser-sdk';
import { 
  GroupCreationError,
  GroupCreationErrorType,
  CreateGroupParams 
} from '@/types/group-creation';

interface XMTPCreationState {
  isCreating: boolean;
  isSuccess: boolean;
  error: GroupCreationError | null;
  conversation: Conversation | null;
  progress: {
    phase: 'validation' | 'creating' | 'syncing' | 'complete';
    message: string;
  };
}

interface UseXMTPIntegrationReturn {
  // State
  state: XMTPCreationState;
  
  // Actions
  createXMTPGroup: (params: CreateGroupParams) => Promise<Conversation>;
  
  reset: () => void;
  
  // Computed properties
  canRetry: boolean;
}

/**
 * XMTP integration hook for real group creation
 * Uses your existing EnhancedXMTPManager through useXMTP hook
 */
export function useXMTPIntegration(): UseXMTPIntegrationReturn {
  const { client, isInitialized, createGroup, canMessage } = useXMTP();
  const { address, isConnected } = useWallet();
  
  const [state, setState] = useState<XMTPCreationState>({
    isCreating: false,
    isSuccess: false,
    error: null,
    conversation: null,
    progress: {
      phase: 'validation',
      message: 'Ready to create XMTP group'
    }
  });

  /**
   * Create structured XMTP error
   */
  const createXMTPError = useCallback((
    type: GroupCreationErrorType,
    userMessage: string,
    technicalDetails?: string,
    retryable = true
  ): GroupCreationError => {
    const error = new Error(userMessage) as GroupCreationError;
    error.type = type;
    error.userMessage = userMessage;
    error.technicalDetails = technicalDetails;
    error.retryable = retryable;
    
    // Add contextual recovery suggestions for XMTP
    error.recoverySuggestions = generateXMTPRecoverySuggestions(type);
    
    return error;
  }, []);

  /**
   * Generate XMTP-specific recovery suggestions
   */
  const generateXMTPRecoverySuggestions = useCallback((type: GroupCreationErrorType): string[] => {
    switch (type) {
      case 'XMTP_CONNECTION_FAILED':
        return [
          'Check your internet connection',
          'Ensure your wallet is connected',
          'Try refreshing the page and reconnecting wallet'
        ];
      case 'INVALID_MEMBER_ADDRESSES':
        return [
          'Verify all member addresses are valid wallet addresses',
          'Ensure members have used XMTP before or can receive messages',
          'Remove any invalid addresses and try again'
        ];
      case 'PERMISSION_DENIED':
        return [
          'Accept the wallet signature request to create XMTP identity',
          'XMTP requires a signature to create secure messaging keys',
          'This is a one-time setup for your wallet'
        ];
      default:
        return [
          'Try again in a few moments',
          'Check that your wallet is properly connected',
          'Contact support if the issue persists'
        ];
    }
  }, []);

  /**
   * Update progress state
   */
  const updateProgress = useCallback((phase: XMTPCreationState['progress']['phase'], message: string) => {
    setState(prev => ({
      ...prev,
      progress: { phase, message }
    }));
  }, []);

  /**
   * Main XMTP group creation function
   * Uses your existing createGroup method from useXMTP
   */
  const createXMTPGroup = useCallback(async (params: CreateGroupParams): Promise<Conversation> => {
    
    // Pre-flight validation
    if (!isConnected || !address) {
      throw createXMTPError(
        'VALIDATION_ERROR',
        'Wallet not connected',
        'No wallet address available',
        false
      );
    }

    if (!isInitialized || !client) {
      throw createXMTPError(
        'XMTP_CONNECTION_FAILED',
        'XMTP client not initialized',
        'Client initialization required before group creation',
        true
      );
    }

    setState(prev => ({
      ...prev,
      isCreating: true,
      isSuccess: false,
      error: null,
      conversation: null
    }));

    try {
      // Phase 1: Validate member addresses
      updateProgress('validation', 'Validating member addresses...');
      
      if (params.members.length > 0) {
        console.log('🔍 Validating XMTP capability for members:', params.members);
        
        const canMessageMap = await canMessage(params.members);
        const invalidMembers = params.members.filter(addr => !canMessageMap.get(addr));
        
        if (invalidMembers.length > 0) {
          throw createXMTPError(
            'INVALID_MEMBER_ADDRESSES',
            `${invalidMembers.length} member${invalidMembers.length > 1 ? 's' : ''} cannot receive XMTP messages`,
            `Invalid addresses: ${invalidMembers.join(', ')}`
          );
        }
      }

      // Phase 2: Create XMTP group
      updateProgress('creating', 'Creating encrypted XMTP group...');
      
      console.log('🚀 Creating XMTP group:', {
        name: params.name,
        memberCount: params.members.length,
        description: params.description
      });

      // Use your existing createGroup method from useXMTP hook
      const conversation = await createGroup(
        params.name,
        params.description,
        params.members
      );

      // Phase 3: Sync and validate
      updateProgress('syncing', 'Syncing group data...');
      
      // Small delay to ensure group is properly synced
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Phase 4: Complete
      updateProgress('complete', 'XMTP group created successfully');

      setState(prev => ({
        ...prev,
        isCreating: false,
        isSuccess: true,
        conversation
      }));

      console.log('✅ XMTP group created successfully:', {
        id: conversation.id,
        name: params.name,
        memberCount: params.members.length + 1
      });

      return conversation;

    } catch (error) {
      let xmtpError: GroupCreationError;
      
      if (error instanceof Error && 'type' in error) {
        // Already a structured error
        xmtpError = error as GroupCreationError;
      } else {
        // Convert XMTP errors to structured format
        const errorMessage = error instanceof Error ? error.message : 'Unknown XMTP error occurred';
        
        if (errorMessage.includes('signature') || errorMessage.includes('rejected')) {
          xmtpError = createXMTPError(
            'PERMISSION_DENIED',
            'Wallet signature required for XMTP messaging',
            errorMessage
          );
        } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
          xmtpError = createXMTPError(
            'XMTP_CONNECTION_FAILED',
            'Failed to connect to XMTP network',
            errorMessage
          );
        } else if (errorMessage.includes('address') || errorMessage.includes('member')) {
          xmtpError = createXMTPError(
            'INVALID_MEMBER_ADDRESSES',
            'One or more member addresses are invalid',
            errorMessage
          );
        } else {
          xmtpError = createXMTPError(
            'UNKNOWN_ERROR',
            'Unexpected error during XMTP group creation',
            errorMessage
          );
        }
      }

      setState(prev => ({
        ...prev,
        isCreating: false,
        isSuccess: false,
        error: xmtpError
      }));

      console.error('❌ XMTP group creation failed:', {
        type: xmtpError.type,
        message: xmtpError.userMessage,
        technical: xmtpError.technicalDetails
      });

      throw xmtpError;
    }
  }, [
    isConnected, 
    address, 
    isInitialized, 
    client, 
    createGroup, 
    canMessage, 
    createXMTPError, 
    updateProgress
  ]);

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setState({
      isCreating: false,
      isSuccess: false,
      error: null,
      conversation: null,
      progress: {
        phase: 'validation',
        message: 'Ready to create XMTP group'
      }
    });
  }, []);

  // Determine if operation can be retried
  const canRetry = state.error?.retryable === true && !state.isCreating;

  return {
    state,
    createXMTPGroup,
    reset,
    canRetry
  };
}