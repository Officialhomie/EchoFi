import { useState, useEffect, useCallback, useRef } from 'react';
import { useXMTP } from '@/hooks/useXMTP';
import { useWallet } from '@/hooks/useWallet';
import { isValidAddress } from '@/lib/utils';
import { 
  MemberValidationResult, 
  GroupCreationFormState,
  EthereumAddress 
} from '@/types/group-creation';
import {
  validateGroupName,
  validateDescription,
  parseAddressInput,
  createValidationResult,
  validateCompleteForm,
  VALIDATION_CONFIG
} from '@/lib/validation/group-validation';

interface UseGroupValidationReturn {
  // Form state
  formState: GroupCreationFormState;
  updateFormField: (field: keyof GroupCreationFormState, value: string) => void;
  
  // Validation state
  isValidating: boolean;
  canSubmit: boolean;
  validMemberCount: number;
  
  // Validation results
  nameError: string | null;
  descriptionError: string | null;
  membersError: string | null;
  warnings: string[];
  
  // Member validation details
  memberValidation: Record<string, MemberValidationResult>;
  
  // Actions
  validateMembers: () => Promise<void>;
  resetValidation: () => void;
  clearField: (field: keyof GroupCreationFormState) => void;
}

/**
 * Enhanced group validation hook
 * Provides deterministic, robust validation state management
 */
export function useGroupValidation(): UseGroupValidationReturn {
  const { canMessage } = useXMTP();
  const { address: currentUserAddress } = useWallet();
  
  // Form state - matches existing GroupCreationFormState interface
  const [formState, setFormState] = useState<GroupCreationFormState>({
    name: '',
    description: '',
    members: '',
    isSubmitting: false,
    errors: {},
    memberValidation: {}
  });
  
  // Validation state
  const [isValidating, setIsValidating] = useState(false);
  const [memberValidation, setMemberValidation] = useState<Record<string, MemberValidationResult>>({});
  
  // Debounce references
  const memberValidationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastValidatedMembersRef = useRef<string>('');
  
  // Derived validation results
  const nameError = validateGroupName(formState.name);
  const descriptionError = validateDescription(formState.description);
  
  // Parse current member input
  const parsedAddresses = parseAddressInput(formState.members ?? '', currentUserAddress ?? undefined);
  
  // Members validation error
  const membersError = (() => {
    if (parsedAddresses.invalid.length > 0) {
      return `Invalid address format: ${parsedAddresses.invalid[0]}`;
    }
    if (parsedAddresses.duplicates.length > 0) {
      return `Duplicate address: ${parsedAddresses.duplicates[0]}`;
    }
    if (parsedAddresses.selfIncluded) {
      return 'You are automatically included as the group creator';
    }
    
    // Check XMTP validation results
    const validAddresses = parsedAddresses.valid;
    const xmtpInvalidCount = validAddresses.filter(addr => 
      memberValidation[addr] && !memberValidation[addr].canMessage
    ).length;
    
    if (xmtpInvalidCount > 0) {
      return `${xmtpInvalidCount} member${xmtpInvalidCount > 1 ? 's' : ''} cannot receive XMTP messages`;
    }
    
    return null;
  })();
  
  // Complete form validation
  const formValidationResult = validateCompleteForm(
    formState.name,
    formState.description || '',
    memberValidation,
    currentUserAddress ?? undefined
  );
  
  const canSubmit = formValidationResult.isValid && !isValidating && !formState.isSubmitting;
  const validMemberCount = parsedAddresses.valid.filter(addr => 
    memberValidation[addr]?.canMessage === true
  ).length;
  
  /**
   * Update form field with automatic validation
   */
  const updateFormField = useCallback((
    field: keyof GroupCreationFormState, 
    value: string
  ) => {
    setFormState(prev => {
      const { [field]: _, ...restErrors } = prev.errors;
      return {
        ...prev,
        [field]: value,
        errors: restErrors
      };
    });
    
    // Trigger member validation for members field
    if (field === 'members') {
      // Clear existing timeout
      if (memberValidationTimeoutRef.current) {
        clearTimeout(memberValidationTimeoutRef.current);
      }
      
      // Debounced validation - only if input actually changed
      const normalizedValue = value.trim();
      if (normalizedValue !== lastValidatedMembersRef.current) {
        memberValidationTimeoutRef.current = setTimeout(() => {
          validateMembersInternal(normalizedValue);
        }, VALIDATION_CONFIG.MEMBERS.DEBOUNCE_DELAY);
      }
    }
  }, []);
  
  /**
   * Internal member validation logic
   * Deterministic and robust - assumes things work correctly
   */
  const validateMembersInternal = useCallback(async (memberInput: string) => {
    const trimmedInput = memberInput?.trim() ?? '';
    
    // Clear validation if no input
    if (!trimmedInput) {
      setMemberValidation({});
      setIsValidating(false);
      lastValidatedMembersRef.current = '';
      return;
    }
    
    // Skip if already validated this exact input
    if (trimmedInput === lastValidatedMembersRef.current) {
      return;
    }
    
    setIsValidating(true);
    lastValidatedMembersRef.current = trimmedInput;
    
    try {
      const parsed = parseAddressInput(trimmedInput, currentUserAddress ?? undefined);
      const validAddresses = parsed.valid;
      
      // Create initial validation results for format validation
      const newValidation: Record<string, MemberValidationResult> = {};
      
      // Handle invalid format addresses
      for (const invalidAddr of parsed.invalid) {
        newValidation[invalidAddr] = createValidationResult(
          invalidAddr,
          false,
          false,
          'Invalid address format'
        );
      }
      
      // Handle valid format addresses - check XMTP capability
      if (validAddresses.length > 0) {
        const canMessageMap = await canMessage(validAddresses);
        
        for (const addr of validAddresses) {
          const canMsg = canMessageMap.get(addr) ?? false;
          newValidation[addr] = createValidationResult(
            addr,
            canMsg,
            true,
            canMsg ? undefined : 'Cannot receive XMTP messages'
          );
        }
      }
      
      setMemberValidation(newValidation);
      
    } catch (error) {
      // If XMTP validation fails, mark all valid format addresses as unknown
      const parsed = parseAddressInput(trimmedInput, currentUserAddress ?? undefined);
      const newValidation: Record<string, MemberValidationResult> = {};
      
      for (const addr of parsed.valid) {
        newValidation[addr] = createValidationResult(
          addr,
          false,
          true,
          'Unable to verify XMTP capability'
        );
      }
      
      setMemberValidation(newValidation);
      console.warn('Member validation error:', error);
    } finally {
      setIsValidating(false);
    }
  }, [canMessage, currentUserAddress]);
  
  /**
   * Public validate members function
   */
  const validateMembers = useCallback(async () => {
    await validateMembersInternal(formState.members);
  }, [formState.members, validateMembersInternal]);
  
  /**
   * Reset all validation state
   */
  const resetValidation = useCallback(() => {
    setFormState({
      name: '',
      description: '',
      members: '',
      isSubmitting: false,
      errors: {},
      memberValidation: {}
    });
    setMemberValidation({});
    setIsValidating(false);
    lastValidatedMembersRef.current = '';
    
    if (memberValidationTimeoutRef.current) {
      clearTimeout(memberValidationTimeoutRef.current);
    }
  }, []);
  
  /**
   * Clear specific field
   */
  const clearField = useCallback((field: keyof GroupCreationFormState) => {
    setFormState(prev => {
      const { [field]: _, ...restErrors } = prev.errors;
      return {
        ...prev,
        [field]: '',
        errors: restErrors
      };
    });
    
    if (field === 'members') {
      setMemberValidation({});
      lastValidatedMembersRef.current = '';
    }
  }, []);
  
  // Cleanup effect
  useEffect(() => {
    return () => {
      if (memberValidationTimeoutRef.current) {
        clearTimeout(memberValidationTimeoutRef.current);
      }
    };
  }, []);
  
  // Sync internal member validation with form state
  useEffect(() => {
    setFormState(prev => ({
      ...prev,
      memberValidation
    }));
  }, [memberValidation]);
  
  return {
    // Form state
    formState,
    updateFormField,
    
    // Validation state
    isValidating,
    canSubmit,
    validMemberCount,
    
    // Validation results
    nameError,
    descriptionError,
    membersError,
    warnings: formValidationResult.warnings,
    
    // Member validation details
    memberValidation,
    
    // Actions
    validateMembers,
    resetValidation,
    clearField
  };
}