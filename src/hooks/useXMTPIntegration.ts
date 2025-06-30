// src/hooks/useXMTPIntegration.ts
import { useState, useCallback } from 'react';
import { useXMTP } from '@/hooks/useXMTP';
import { useWallet } from '@/hooks/useWallet';
import { CreateGroupParams } from '@/types/group-creation';
import type { Conversation } from '@xmtp/browser-sdk';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface XMTPIntegrationError {
  type: 'PERMISSION_DENIED' | 'NETWORK_ERROR' | 'VALIDATION_ERROR' | 'UNKNOWN_ERROR';
  message: string;
  userMessage: string;
  technicalDetails?: string;
  retryable: boolean;
  recoverySuggestions?: string[];
}

export interface XMTPCreationProgress {
  phase: 'validation' | 'creating' | 'syncing' | 'complete';
  message: string;
  progress: number;
}

export interface XMTPIntegrationState {
  isCreating: boolean;
  isSuccess: boolean;
  error: XMTPIntegrationError | null;
  conversation: Conversation | null;
  progress: XMTPCreationProgress;
}

export interface UseXMTPIntegrationReturn {
  state: XMTPIntegrationState;
  createXMTPGroup: (params: CreateGroupParams) => Promise<Conversation>;
  reset: () => void;
  canRetry: boolean;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useXMTPIntegration(): UseXMTPIntegrationReturn {
  const { createGroup, canMessage, isInitialized, error: xmtpError } = useXMTP();
  const { address, isConnected } = useWallet();

  const [state, setState] = useState<XMTPIntegrationState>({
    isCreating: false,
    isSuccess: false,
    error: null,
    conversation: null,
    progress: {
      phase: 'validation',
      message: 'Ready to create group',
      progress: 0
    }
  });

  /**
   * Create structured error with recovery suggestions
   */
  const createError = useCallback((
    type: XMTPIntegrationError['type'],
    message: string,
    userMessage: string,
    technicalDetails?: string,
    retryable = true
  ): XMTPIntegrationError => {
    const recoverySuggestions = getRecoverySuggestions(type);
    
    return {
      type,
      message,
      userMessage,
      technicalDetails,
      retryable,
      recoverySuggestions
    };
  }, []);

  /**
   * Get recovery suggestions based on error type
   */
  const getRecoverySuggestions = useCallback((type: XMTPIntegrationError['type']): string[] => {
    switch (type) {
      case 'PERMISSION_DENIED':
        return [
          'Accept the signature request in your wallet',
          'XMTP needs this signature to create your secure messaging identity',
          'This is a one-time setup for encrypted messaging'
        ];
      case 'NETWORK_ERROR':
        return [
          'Check your internet connection',
          'Try again in a few moments',
          'Ensure your wallet is connected'
        ];
      case 'VALIDATION_ERROR':
        return [
          'Verify all member addresses are valid',
          'Ensure members have used XMTP before',
          'Check that group name is not empty'
        ];
      default:
        return [
          'Try again in a few moments',
          'Check your internet connection',
          'Contact support if issue persists'
        ];
    }
  }, []);

  /**
   * Update creation progress
   */
  const updateProgress = useCallback((
    phase: XMTPCreationProgress['phase'],
    message: string,
    progress: number
  ) => {
    setState(prev => ({
      ...prev,
      progress: { phase, message, progress }
    }));
  }, []);

  /**
   * Main XMTP group creation function
   */
  const createXMTPGroup = useCallback(async (params: CreateGroupParams): Promise<Conversation> => {
    // Pre-flight validation
    if (!isConnected || !address) {
      throw createError(
        'VALIDATION_ERROR',
        'Wallet not connected',
        'Please connect your wallet to create a group',
        'No wallet address available',
        false
      );
    }

    if (!isInitialized) {
      throw createError(
        'NETWORK_ERROR',
        'XMTP not initialized',
        'Messaging system is not ready. Please wait and try again.',
        'XMTP client not initialized',
        true
      );
    }

    if (!params.name?.trim()) {
      throw createError(
        'VALIDATION_ERROR',
        'Group name required',
        'Please provide a valid group name',
        'Empty group name provided',
        false
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
      // Step 1: Validate member addresses
      updateProgress('validation', 'Validating member addresses...', 10);
      
      if (params.members && params.members.length > 0) {
        console.log('🔍 Checking XMTP capability for members:', params.members);
        
        try {
          const capabilities = await canMessage(params.members);
          const invalidMembers = params.members.filter(member => !capabilities.get(member));
          
          if (invalidMembers.length > 0) {
            throw createError(
              'VALIDATION_ERROR',
              'Invalid member addresses',
              `Some members cannot receive XMTP messages: ${invalidMembers.join(', ')}`,
              `Invalid addresses: ${invalidMembers.join(', ')}`,
              false
            );
          }
        } catch (capabilityError) {
          console.warn('⚠️ Could not verify member capabilities, proceeding anyway:', capabilityError);
          // Continue without strict validation in case of API issues
        }
      }

      // Step 2: Create XMTP group
      updateProgress('creating', 'Creating encrypted group conversation...', 40);
      
      console.log('🏗️ Creating XMTP group:', {
        name: params.name,
        description: params.description,
        memberCount: params.members?.length || 0
      });

      const conversation = await createGroup(
        params.name,
        params.description || '',
        params.members || []
      );

      // Step 3: Sync with network
      updateProgress('syncing', 'Synchronizing with XMTP network...', 80);
      
      // Give time for network sync
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 4: Complete
      updateProgress('complete', 'Group created successfully!', 100);

      setState(prev => ({
        ...prev,
        isCreating: false,
        isSuccess: true,
        conversation
      }));

      console.log('✅ XMTP group created successfully:', {
        id: conversation.id,
        name: params.name,
        memberCount: params.members?.length || 0
      });

      return conversation;

    } catch (error) {
      console.error('❌ XMTP group creation failed:', error);
      
      let structuredError: XMTPIntegrationError;
      
      if (error && typeof error === 'object' && 'type' in error) {
        structuredError = error as XMTPIntegrationError;
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (errorMessage.includes('user rejected') || errorMessage.includes('User rejected')) {
          structuredError = createError(
            'PERMISSION_DENIED',
            'Signature rejected',
            'Signature request was cancelled. XMTP requires a signature to create your secure messaging identity.',
            errorMessage,
            true
          );
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
          structuredError = createError(
            'NETWORK_ERROR',
            'Network connection failed',
            'Unable to connect to XMTP network. Please check your connection and try again.',
            errorMessage,
            true
          );
        } else if (errorMessage.includes('address') || errorMessage.includes('member')) {
          structuredError = createError(
            'VALIDATION_ERROR',
            'Invalid addresses',
            'Some member addresses are invalid or cannot receive messages.',
            errorMessage,
            false
          );
        } else {
          structuredError = createError(
            'UNKNOWN_ERROR',
            'Unexpected error',
            'An unexpected error occurred while creating the group. Please try again.',
            errorMessage,
            true
          );
        }
      }

      setState(prev => ({
        ...prev,
        isCreating: false,
        error: structuredError
      }));

      throw structuredError;
    }
  }, [
    isConnected,
    address,
    isInitialized,
    createGroup,
    canMessage,
    createError,
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
        message: 'Ready to create group',
        progress: 0
      }
    });
  }, []);

  // Compute derived state
  const canRetry = state.error?.retryable === true && !state.isCreating;

  // Sync external XMTP errors
  const currentXmtpError = xmtpError;
  if (currentXmtpError && !state.error && !state.isCreating) {
    const structuredError = createError(
      'NETWORK_ERROR',
      'XMTP system error',
      currentXmtpError,
      'External XMTP error detected',
      true
    );
    
    setState(prev => ({
      ...prev,
      error: structuredError
    }));
  }

  return {
    state,
    createXMTPGroup,
    reset,
    canRetry
  };
}