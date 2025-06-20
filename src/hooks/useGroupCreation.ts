
import { useState, useCallback } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { 
  CreateGroupApiRequest, 
  CreateGroupApiResponse,
  GroupCreationResult,
  GroupCreationError,
  GroupCreationErrorType 
} from '@/types/group-creation';

interface GroupCreationState {
  isCreating: boolean;
  isSuccess: boolean;
  error: GroupCreationError | null;
  result: GroupCreationResult | null;
}

interface UseGroupCreationReturn {
  // State
  state: GroupCreationState;
  
  // Actions
  createGroup: (params: {
    name: string;
    description: string;
    members: string[];
    xmtpGroupId: string;
  }) => Promise<GroupCreationResult>;
  
  reset: () => void;
  
  // Computed properties
  canRetry: boolean;
}

/**
 * Database integration hook for group creation
 * Handles API calls to your existing /api/groups endpoint
 */
export function useGroupCreation(): UseGroupCreationReturn {
  const { address } = useWallet();
  
  const [state, setState] = useState<GroupCreationState>({
    isCreating: false,
    isSuccess: false,
    error: null,
    result: null
  });

  /**
   * Create structured error with proper typing
   */
  const createError = useCallback((
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
    
    // Add contextual recovery suggestions
    error.recoverySuggestions = generateRecoverySuggestions(type);
    
    return error;
  }, []);

  /**
   * Generate contextual recovery suggestions based on error type
   */
  const generateRecoverySuggestions = useCallback((type: GroupCreationErrorType): string[] => {
    switch (type) {
      case 'DATABASE_SAVE_FAILED':
        return [
          'Check your internet connection',
          'Try again in a few moments',
          'Contact support if the issue persists'
        ];
      case 'VALIDATION_ERROR':
        return [
          'Verify all group details are correct',
          'Check that member addresses are valid',
          'Ensure group name meets requirements'
        ];
      case 'NETWORK_ERROR':
        return [
          'Check your internet connection',
          'Try again when connection is stable'
        ];
      case 'RATE_LIMITED':
        return [
          'Wait a few minutes before trying again',
          'Avoid creating multiple groups rapidly'
        ];
      default:
        return [
          'Try again in a few moments',
          'Contact support if the issue continues'
        ];
    }
  }, []);

  /**
   * Main group creation function
   * Integrates with your existing /api/groups endpoint
   */
  const createGroup = useCallback(async (params: {
    name: string;
    description: string;
    members: string[];
    xmtpGroupId: string;
  }): Promise<GroupCreationResult> => {
    
    if (!address) {
      throw createError(
        'VALIDATION_ERROR',
        'Wallet not connected',
        'No wallet address available',
        false
      );
    }

    setState(prev => ({
      ...prev,
      isCreating: true,
      isSuccess: false,
      error: null
    }));

    try {
      // Prepare API request using your existing types
      const apiRequest: CreateGroupApiRequest = {
        name: params.name.trim(),
        description: params.description.trim() || undefined,
        xmtpGroupId: params.xmtpGroupId,
        createdBy: address,
        members: params.members.length > 0 ? params.members : undefined
      };

      console.log('🏗️ Creating group via API:', {
        name: apiRequest.name,
        memberCount: apiRequest.members?.length || 0,
        xmtpGroupId: apiRequest.xmtpGroupId
      });

      // Call your existing API endpoint
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiRequest)
      });

      // Handle HTTP errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 400) {
          throw createError(
            'VALIDATION_ERROR',
            errorData.error || 'Invalid group data provided',
            `HTTP ${response.status}: ${response.statusText}`
          );
        }
        
        if (response.status === 429) {
          throw createError(
            'RATE_LIMITED',
            'Too many requests. Please wait before creating another group.',
            `HTTP ${response.status}: ${response.statusText}`
          );
        }
        
        if (response.status >= 500) {
          throw createError(
            'DATABASE_SAVE_FAILED',
            'Server error occurred while creating group',
            `HTTP ${response.status}: ${response.statusText}`
          );
        }
        
        throw createError(
          'NETWORK_ERROR',
          'Failed to create group',
          `HTTP ${response.status}: ${response.statusText}`
        );
      }

      // Parse response using your existing types
      const apiResponse: CreateGroupApiResponse = await response.json();
      
      if (!apiResponse.group) {
        throw createError(
          'DATABASE_SAVE_FAILED',
          'Group creation succeeded but no group data returned',
          'Missing group in API response'
        );
      }

      // Create successful result
      const result: GroupCreationResult = {
        conversation: {
          id: params.xmtpGroupId,
          name: apiResponse.group.name,
          description: apiResponse.group.description
        } as any, // Mock conversation object for now
        databaseGroupId: apiResponse.group.id,
        // Treasury fields will be added in Phase 5
        treasuryAddress: undefined,
        deploymentTxHash: undefined
      };

      setState(prev => ({
        ...prev,
        isCreating: false,
        isSuccess: true,
        result
      }));

      console.log('✅ Group created successfully:', {
        databaseId: result.databaseGroupId,
        xmtpId: params.xmtpGroupId,
        name: apiResponse.group.name
      });

      return result;

    } catch (error) {
      let groupCreationError: GroupCreationError;
      
      if (error instanceof Error && 'type' in error) {
        // Already a structured error
        groupCreationError = error as GroupCreationError;
      } else {
        // Network or unexpected error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        if (errorMessage.includes('fetch')) {
          groupCreationError = createError(
            'NETWORK_ERROR',
            'Network connection failed',
            errorMessage
          );
        } else {
          groupCreationError = createError(
            'UNKNOWN_ERROR',
            'Unexpected error occurred during group creation',
            errorMessage
          );
        }
      }

      setState(prev => ({
        ...prev,
        isCreating: false,
        isSuccess: false,
        error: groupCreationError
      }));

      console.error('❌ Group creation failed:', {
        type: groupCreationError.type,
        message: groupCreationError.userMessage,
        technical: groupCreationError.technicalDetails
      });

      throw groupCreationError;
    }
  }, [address, createError]);

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setState({
      isCreating: false,
      isSuccess: false,
      error: null,
      result: null
    });
  }, []);

  // Determine if operation can be retried
  const canRetry = state.error?.retryable === true && !state.isCreating;

  return {
    state,
    createGroup,
    reset,
    canRetry
  };
}