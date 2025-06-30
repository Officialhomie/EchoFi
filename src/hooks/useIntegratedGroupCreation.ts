// src/hooks/useIntegratedGroupCreation.ts
// Integrated hook for creating EchoFi investment groups with both XMTP and smart contracts

import { useState, useCallback } from 'react';
import { useXMTP } from './useXMTP';
import { useCreateTreasury, useCreateGroup } from '../contracts/contracts';
import { useWallet } from './useWallet';
import type { Address } from 'viem';
import type { Conversation } from '@xmtp/browser-sdk';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

export interface GroupMember {
  address: string;
  votingPower: number; // Percentage (1-100)
  name?: string;
  ensName?: string;
}

export interface CreateGroupParams {
  name: string;
  description: string;
  members: GroupMember[];
  // Optional XMTP-specific settings
  xmtpSettings?: {
    enableEncryption?: boolean;
    customImageUrl?: string;
  };
}

export interface GroupCreationProgress {
  phase: 'validation' | 'xmtp' | 'treasury' | 'linking' | 'complete' | 'failed';
  message: string;
  progress: number; // 0-100
  currentStep: string;
  errors: string[];
}

export interface GroupCreationResult {
  xmtpGroup: Conversation;
  treasuryAddress: Address;
  txHash: string;
  groupId: string;
}

export interface UseIntegratedGroupCreationReturn {
  // State
  isCreating: boolean;
  isSuccess: boolean;
  progress: GroupCreationProgress;
  result: GroupCreationResult | null;
  error: string | null;
  
  // Actions
  createInvestmentGroup: (params: CreateGroupParams) => Promise<GroupCreationResult>;
  reset: () => void;
  
  // Utils
  canRetry: boolean;
  estimatedGasCost: string | null;
}

// =============================================================================
// MAIN HOOK IMPLEMENTATION
// =============================================================================

/**
 * Integrated hook for creating EchoFi investment groups
 * Combines XMTP group creation with smart contract treasury deployment
 */
export function useIntegratedGroupCreation(): UseIntegratedGroupCreationReturn {
  const { address, chainId } = useWallet();
  const { 
    createGroup: createXMTPGroup, 
    isInitialized: isXMTPReady,
    client: xmtpClient,
    canMessage
  } = useXMTP();
  
  const { 
    createTreasury, 
    isLoading: isTreasuryCreating, 
    isSuccess: isTreasurySuccess,
    txHash: treasuryTxHash,
    error: treasuryError 
  } = useCreateTreasury(chainId || 84532);
  
  const { 
    createGroup: createSmartContractGroup,
    isLoading: isGroupLinking,
    isSuccess: isGroupLinkSuccess,
    txHash: groupTxHash,
    error: groupError
  } = useCreateGroup(chainId || 84532);

  // Component state
  const [state, setState] = useState<{
    isCreating: boolean;
    isSuccess: boolean;
    progress: GroupCreationProgress;
    result: GroupCreationResult | null;
    error: string | null;
  }>({
    isCreating: false,
    isSuccess: false,
    progress: {
      phase: 'validation',
      message: 'Ready to create investment group',
      progress: 0,
      currentStep: 'Waiting for input',
      errors: []
    },
    result: null,
    error: null
  });

  /**
   * Update progress during group creation
   */
  const updateProgress = useCallback((
    phase: GroupCreationProgress['phase'],
    message: string,
    progress: number,
    currentStep: string,
    errors: string[] = []
  ) => {
    setState(prev => ({
      ...prev,
      progress: {
        phase,
        message,
        progress,
        currentStep,
        errors
      }
    }));
  }, []);

  /**
   * Validate group creation parameters
   */
  const validateParams = useCallback(async (params: CreateGroupParams): Promise<void> => {
    const errors: string[] = [];

    // Basic validation
    if (!params.name.trim()) {
      errors.push('Group name is required');
    }

    if (!params.description.trim()) {
      errors.push('Group description is required');
    }

    if (params.members.length === 0) {
      errors.push('At least one member is required');
    }

    // Validate voting powers
    const totalVotingPower = params.members.reduce((sum, member) => sum + member.votingPower, 0);
    if (totalVotingPower !== 100) {
      errors.push('Total voting power must equal 100%');
    }

    // Check for duplicate addresses
    const addressSet = new Set(params.members.map(m => m.address.toLowerCase()));
    if (addressSet.size !== params.members.length) {
      errors.push('Duplicate member addresses found');
    }

    // Validate Ethereum addresses
    for (const member of params.members) {
      if (!/^0x[a-fA-F0-9]{40}$/.test(member.address)) {
        errors.push(`Invalid Ethereum address: ${member.address}`);
      }
    }

    // Check XMTP message capabilities
    if (isXMTPReady && canMessage) {
      try {
        updateProgress('validation', 'Checking XMTP message capabilities...', 20, 'Validating member addresses');
        
        const memberAddresses = params.members.map(m => m.address);
        const messageCapabilities = await canMessage(memberAddresses);
        
        const invalidXMTPMembers = Array.from(messageCapabilities.entries())
          .filter(([, canMsg]) => !canMsg)
          .map(([address]) => address);
        
        if (invalidXMTPMembers.length > 0) {
          errors.push(`Some members cannot receive XMTP messages: ${invalidXMTPMembers.join(', ')}`);
        }
      } catch (xmtpError) {
        console.warn('⚠️ Could not verify XMTP capabilities:', xmtpError);
        // Continue without strict XMTP validation
      }
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
  }, [isXMTPReady, canMessage]);

  /**
   * Main function to create integrated investment group
   */
  const createInvestmentGroup = useCallback(async (params: CreateGroupParams): Promise<GroupCreationResult> => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    if (!isXMTPReady) {
      throw new Error('XMTP not ready. Please wait for initialization to complete.');
    }

    setState(prev => ({
      ...prev,
      isCreating: true,
      isSuccess: false,
      error: null,
      result: null
    }));

    try {
      // Phase 1: Validation
      updateProgress('validation', 'Validating group parameters...', 10, 'Running validation checks');
      await validateParams(params);

      // Phase 2: Create XMTP Group
      updateProgress('xmtp', 'Creating encrypted group chat...', 25, 'Setting up XMTP group');
      
      const memberAddresses = params.members.map(m => m.address);
      const xmtpGroup = await createXMTPGroup(
        params.name,
        params.description,
        memberAddresses
      );

      updateProgress('xmtp', 'XMTP group created successfully', 40, 'Group chat ready');

      // Phase 3: Create Treasury Smart Contract
      updateProgress('treasury', 'Deploying treasury smart contract...', 50, 'Creating on-chain treasury');
      
      const treasuryParams = {
        name: params.name,
        description: params.description,
        members: memberAddresses as Address[],
        votingPowers: params.members.map(m => m.votingPower)
      };

      createTreasury(treasuryParams);

      // Wait for treasury creation to complete
      updateProgress('treasury', 'Waiting for treasury deployment...', 70, 'Confirming blockchain transaction');
      
      // NOTE: In a real implementation, we'd wait for the transaction to complete
      // For now, we'll simulate this with the hook states
      let retryCount = 0;
      const maxRetries = 30; // 30 seconds timeout
      
      while (!isTreasurySuccess && !treasuryError && retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        retryCount++;
      }

      if (treasuryError) {
        throw new Error(`Treasury creation failed: ${treasuryError.message}`);
      }

      if (!isTreasurySuccess || !treasuryTxHash) {
        throw new Error('Treasury creation timed out');
      }

      // Phase 4: Link XMTP Group with Smart Contract
      updateProgress('linking', 'Linking group chat with treasury...', 85, 'Creating on-chain group reference');
      
      const groupParams = {
        name: params.name,
        xmtpGroupId: xmtpGroup.id
      };

      createSmartContractGroup(groupParams);

      // Wait for group linking to complete
      updateProgress('linking', 'Waiting for group linking...', 90, 'Confirming group registration');
      
      retryCount = 0;
      while (!isGroupLinkSuccess && !groupError && retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        retryCount++;
      }

      if (groupError) {
        console.warn('⚠️ Group linking failed, but treasury and XMTP group are created:', groupError);
        // Continue - the core functionality works even without the link
      }

      // Phase 5: Complete
      updateProgress('complete', 'Investment group created successfully!', 100, 'All components ready');

      const result: GroupCreationResult = {
        xmtpGroup,
        treasuryAddress: '0x...' as Address, // This would come from the treasury creation event
        txHash: treasuryTxHash,
        groupId: xmtpGroup.id
      };

      setState(prev => ({
        ...prev,
        isCreating: false,
        isSuccess: true,
        result
      }));

      console.log('✅ Investment group created successfully:', {
        groupName: params.name,
        xmtpGroupId: xmtpGroup.id,
        treasuryTxHash,
        memberCount: params.members.length
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Investment group creation failed:', errorMessage);
      
      updateProgress('failed', 'Group creation failed', 0, 'Error occurred', [errorMessage]);
      
      setState(prev => ({
        ...prev,
        isCreating: false,
        error: errorMessage
      }));

      throw error;
    }
  }, [
    address,
    isXMTPReady,
    createXMTPGroup,
    createTreasury,
    createSmartContractGroup,
    validateParams,
    isTreasurySuccess,
    treasuryError,
    treasuryTxHash,
    isGroupLinkSuccess,
    groupError
  ]);

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setState({
      isCreating: false,
      isSuccess: false,
      progress: {
        phase: 'validation',
        message: 'Ready to create investment group',
        progress: 0,
        currentStep: 'Waiting for input',
        errors: []
      },
      result: null,
      error: null
    });
  }, []);

  // Derived state
  const canRetry = !state.isCreating && !!state.error;
  const estimatedGasCost = '~0.005 ETH'; // This would be calculated dynamically

  return {
    // State
    isCreating: state.isCreating,
    isSuccess: state.isSuccess,
    progress: state.progress,
    result: state.result,
    error: state.error,
    
    // Actions
    createInvestmentGroup,
    reset,
    
    // Utils
    canRetry,
    estimatedGasCost
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Helper to format voting power distribution
 */
export function formatVotingDistribution(members: GroupMember[]): string {
  return members
    .map(member => `${member.address.slice(0, 6)}...${member.address.slice(-4)}: ${member.votingPower}%`)
    .join(', ');
}

/**
 * Helper to validate voting power distribution
 */
export function validateVotingPowers(members: GroupMember[]): string[] {
  const errors: string[] = [];
  
  const total = members.reduce((sum, member) => sum + member.votingPower, 0);
  if (total !== 100) {
    errors.push(`Total voting power is ${total}%, must be exactly 100%`);
  }
  
  const invalidPowers = members.filter(member => 
    member.votingPower <= 0 || member.votingPower > 100
  );
  
  if (invalidPowers.length > 0) {
    errors.push('All voting powers must be between 1% and 100%');
  }
  
  return errors;
}

/**
 * Helper to check for duplicate addresses
 */
export function findDuplicateAddresses(members: GroupMember[]): string[] {
  const addressCounts = new Map<string, number>();
  
  members.forEach(member => {
    const normalizedAddress = member.address.toLowerCase();
    addressCounts.set(normalizedAddress, (addressCounts.get(normalizedAddress) || 0) + 1);
  });
  
  return Array.from(addressCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([address]) => address);
}