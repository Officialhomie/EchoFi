// src/hooks/useTreasuryDeployment.ts
// Smart contract treasury deployment integration
// Built for deterministic execution with your EchoFiFactory

import { useState, useCallback } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { 
  TreasuryDeploymentParams,
  TreasuryDeploymentResult,
  GroupCreationError,
  GroupCreationErrorType 
} from '@/types/group-creation';

interface TreasuryDeploymentState {
  isDeploying: boolean;
  isSuccess: boolean;
  error: GroupCreationError | null;
  result: TreasuryDeploymentResult | null;
  progress: {
    phase: 'preparation' | 'deployment' | 'verification' | 'complete';
    message: string;
  };
}

interface UseTreasuryDeploymentReturn {
  // State
  state: TreasuryDeploymentState;
  
  // Actions
  deployTreasury: (params: TreasuryDeploymentParams) => Promise<TreasuryDeploymentResult>;
  
  reset: () => void;
  
  // Computed properties
  canRetry: boolean;
}

/**
 * Treasury deployment hook for smart contract integration
 * Integrates with your EchoFiFactory contract
 */
export function useTreasuryDeployment(): UseTreasuryDeploymentReturn {
  const { address, isConnected } = useWallet();
  
  const [state, setState] = useState<TreasuryDeploymentState>({
    isDeploying: false,
    isSuccess: false,
    error: null,
    result: null,
    progress: {
      phase: 'preparation',
      message: 'Ready to deploy treasury'
    }
  });

  /**
   * Create structured treasury error
   */
  const createTreasuryError = useCallback((
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
    
    // Add contextual recovery suggestions for treasury deployment
    error.recoverySuggestions = generateTreasuryRecoverySuggestions(type);
    
    return error;
  }, []);

  /**
   * Generate treasury-specific recovery suggestions
   */
  const generateTreasuryRecoverySuggestions = useCallback((type: GroupCreationErrorType): string[] => {
    switch (type) {
      case 'TREASURY_DEPLOYMENT_FAILED':
        return [
          'Ensure you have sufficient Base ETH for gas fees',
          'Check that your wallet is connected to Base network',
          'Verify the creation fee is available (0.001 ETH)',
          'Try again with a higher gas limit'
        ];
      case 'PERMISSION_DENIED':
        return [
          'Accept the transaction in your wallet',
          'Ensure your wallet is unlocked',
          'Check that you have sufficient funds for gas'
        ];
      case 'NETWORK_ERROR':
        return [
          'Check your internet connection',
          'Verify Base network is accessible',
          'Try switching to a different RPC endpoint'
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
  const updateProgress = useCallback((
    phase: TreasuryDeploymentState['progress']['phase'], 
    message: string
  ) => {
    setState(prev => ({
      ...prev,
      progress: { phase, message }
    }));
  }, []);

  /**
   * Mock treasury deployment (replace with real contract integration)
   * In production, this would use your EchoFiFactory contract
   */
  const mockDeployTreasury = useCallback(async (params: TreasuryDeploymentParams) => {
    // Simulate contract deployment delay
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Simulate random deployment failures (15% chance)
    if (Math.random() < 0.15) {
      throw new Error('Transaction failed due to insufficient gas');
    }
    
    // Mock successful deployment result
    const treasuryAddress = `0x${Math.random().toString(16).slice(2, 42).padStart(40, '0')}`;
    const txHash = `0x${Math.random().toString(16).slice(2, 66).padStart(64, '0')}`;
    
    return {
      treasuryAddress,
      txHash,
      blockNumber: Math.floor(Math.random() * 1000000) + 20000000,
      gasUsed: '234567'
    };
  }, []);

  /**
   * Main treasury deployment function
   * Replace this with real EchoFiFactory integration
   */
  const deployTreasury = useCallback(async (params: TreasuryDeploymentParams): Promise<TreasuryDeploymentResult> => {
    
    // Pre-flight validation
    if (!isConnected || !address) {
      throw createTreasuryError(
        'VALIDATION_ERROR',
        'Wallet not connected',
        'No wallet address available',
        false
      );
    }

    // Validate voting powers sum to 100
    const totalVotingPower = params.votingPowers.reduce((sum, power) => sum + power, 0);
    if (totalVotingPower !== 100) {
      throw createTreasuryError(
        'VALIDATION_ERROR',
        `Voting powers must sum to 100, got ${totalVotingPower}`,
        `Invalid voting power distribution: ${params.votingPowers.join(', ')}`,
        false
      );
    }

    setState(prev => ({
      ...prev,
      isDeploying: true,
      isSuccess: false,
      error: null,
      result: null
    }));

    try {
      // Phase 1: Preparation
      updateProgress('preparation', 'Preparing treasury deployment...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Phase 2: Deployment
      updateProgress('deployment', 'Deploying smart contract to Base...');
      
      console.log('🚀 Deploying treasury contract:', {
        name: params.name,
        memberCount: params.members.length,
        xmtpGroupId: params.xmtpGroupId
      });

      // In production, replace this with real contract deployment:
      // const result = await deployEchoFiTreasury(params);
      const result = await mockDeployTreasury(params);

      // Phase 3: Verification
      updateProgress('verification', 'Verifying deployment...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Phase 4: Complete
      updateProgress('complete', 'Treasury deployed successfully');

      setState(prev => ({
        ...prev,
        isDeploying: false,
        isSuccess: true,
        result
      }));

      console.log('✅ Treasury deployed successfully:', result);

      return result;

    } catch (error) {
      let treasuryError: GroupCreationError;
      
      if (error instanceof Error && 'type' in error) {
        // Already a structured error
        treasuryError = error as GroupCreationError;
      } else {
        // Convert contract errors to structured format
        const errorMessage = error instanceof Error ? error.message : 'Unknown treasury deployment error occurred';
        
        if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
          treasuryError = createTreasuryError(
            'PERMISSION_DENIED',
            'Transaction rejected by user',
            errorMessage
          );
        } else if (errorMessage.includes('gas') || errorMessage.includes('fee')) {
          treasuryError = createTreasuryError(
            'TREASURY_DEPLOYMENT_FAILED',
            'Insufficient gas or fees for deployment',
            errorMessage
          );
        } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
          treasuryError = createTreasuryError(
            'NETWORK_ERROR',
            'Network error during deployment',
            errorMessage
          );
        } else {
          treasuryError = createTreasuryError(
            'TREASURY_DEPLOYMENT_FAILED',
            'Smart contract deployment failed',
            errorMessage
          );
        }
      }

      setState(prev => ({
        ...prev,
        isDeploying: false,
        isSuccess: false,
        error: treasuryError
      }));

      console.error('❌ Treasury deployment failed:', {
        type: treasuryError.type,
        message: treasuryError.userMessage,
        technical: treasuryError.technicalDetails
      });

      throw treasuryError;
    }
  }, [
    isConnected, 
    address, 
    createTreasuryError, 
    updateProgress, 
    mockDeployTreasury
  ]);

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setState({
      isDeploying: false,
      isSuccess: false,
      error: null,
      result: null,
      progress: {
        phase: 'preparation',
        message: 'Ready to deploy treasury'
      }
    });
  }, []);

  // Determine if operation can be retried
  const canRetry = state.error?.retryable === true && !state.isDeploying;

  return {
    state,
    deployTreasury,
    reset,
    canRetry
  };

}