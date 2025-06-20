import { MemberValidationResult, EthereumAddress } from '@/types/group-creation';

/**
 * Validation configuration - deterministic and clear
 */
export const VALIDATION_CONFIG = {
  GROUP_NAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z0-9\s\-_.]+$/, // Alphanumeric, spaces, hyphens, underscores, periods
    RESERVED_NAMES: new Set(['admin', 'system', 'bot', 'official', 'support', 'help', 'api', 'www'])
  },
  DESCRIPTION: {
    MAX_LENGTH: 200,
    MIN_LENGTH: 0 // Optional field
  },
  MEMBERS: {
    MAX_COUNT: 20,
    MIN_COUNT: 0, // Can create empty group
    DEBOUNCE_DELAY: 300
  }
} as const;

/**
 * Deterministic group name validation
 * Returns specific error or null for valid names
 */
export function validateGroupName(name: string): string | null {
  const trimmed = name.trim();
  
  if (trimmed.length === 0) {
    return 'Group name is required';
  }
  
  if (trimmed.length < VALIDATION_CONFIG.GROUP_NAME.MIN_LENGTH) {
    return `Group name must be at least ${VALIDATION_CONFIG.GROUP_NAME.MIN_LENGTH} characters`;
  }
  
  if (trimmed.length > VALIDATION_CONFIG.GROUP_NAME.MAX_LENGTH) {
    return `Group name must be less than ${VALIDATION_CONFIG.GROUP_NAME.MAX_LENGTH} characters`;
  }
  
  if (!VALIDATION_CONFIG.GROUP_NAME.PATTERN.test(trimmed)) {
    return 'Group name can only contain letters, numbers, spaces, hyphens, underscores, and periods';
  }
  
  // Check against reserved names using Set.has() - O(1) lookup, no TypeScript issues
  const lowercase = trimmed.toLowerCase();
  if (VALIDATION_CONFIG.GROUP_NAME.RESERVED_NAMES.has(lowercase)) {
    return 'This name is reserved. Please choose a different name';
  }
  
  return null; // Valid
}

/**
 * Deterministic description validation
 */
export function validateDescription(description: string): string | null {
  if (description.length > VALIDATION_CONFIG.DESCRIPTION.MAX_LENGTH) {
    return `Description must be less than ${VALIDATION_CONFIG.DESCRIPTION.MAX_LENGTH} characters`;
  }
  
  return null; // Valid (including empty)
}

/**
 * Parse and normalize member addresses from input string
 * Deterministic parsing with clear results
 */
export interface ParsedAddresses {
  valid: EthereumAddress[];
  invalid: string[];
  duplicates: string[];
  selfIncluded: boolean;
  total: number;
}

export function parseAddressInput(
  input: string, 
  currentUserAddress?: string
): ParsedAddresses {
  const addresses = input
    .split(/[,\n;]+/) // Split on comma, newline, or semicolon
    .map(addr => addr.trim())
    .filter(addr => addr.length > 0);

  const seen = new Set<string>();
  const valid: EthereumAddress[] = [];
  const invalid: string[] = [];
  const duplicates: string[] = [];
  let selfIncluded = false;

  for (const addr of addresses) {
    const normalized = addr.toLowerCase();
    
    // Check for duplicates
    if (seen.has(normalized)) {
      if (!duplicates.includes(addr)) {
        duplicates.push(addr);
      }
      continue;
    }
    seen.add(normalized);
    
    // Check if user included themselves
    if (currentUserAddress && normalized === currentUserAddress.toLowerCase()) {
      selfIncluded = true;
      continue;
    }
    
    // Validate address format
    if (isValidEthereumAddress(addr)) {
      valid.push(addr as EthereumAddress);
    } else {
      invalid.push(addr);
    }
  }

  return {
    valid,
    invalid,
    duplicates,
    selfIncluded,
    total: addresses.length
  };
}

/**
 * Enhanced address format validation
 * Uses existing utility but with typed return
 */
function isValidEthereumAddress(address: string): address is EthereumAddress {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Create validation result object
 * Standardized format for all validation results
 */
export function createValidationResult(
  address: string,
  canMessage: boolean,
  isValidFormat: boolean,
  error?: string
): MemberValidationResult {
  return {
    canMessage,
    isValidFormat,
    isValidating: false,
    error,
  };
}

/**
 * Generate contextual recovery suggestions
 */
function generateRecoverySuggestions(error: string, address: string): string[] {
  const suggestions: string[] = [];
  
  if (error.includes('format') || error.includes('invalid')) {
    suggestions.push('Check that the address starts with 0x and is 42 characters long');
    suggestions.push('Copy the address directly from the wallet or block explorer');
  }
  
  if (error.includes('XMTP') || error.includes('message')) {
    suggestions.push('Ask the member to install an XMTP-compatible app first');
    suggestions.push('Verify the address is active and has sent transactions');
  }
  
  if (error.includes('duplicate')) {
    suggestions.push('Remove the duplicate entry');
  }
  
  return suggestions;
}

/**
 * Validate entire form state
 * Single source of truth for form validation
 */
export interface FormValidationResult {
  isValid: boolean;
  errors: {
    name?: string;
    description?: string;
    members?: string;
  };
  warnings: string[];
}

export function validateCompleteForm(
  name: string,
  description: string,
  memberResults: Record<string, MemberValidationResult>,
  currentUserAddress?: string
): FormValidationResult {
  const errors: FormValidationResult['errors'] = {};
  const warnings: string[] = [];
  
  // Validate name
  const nameError = validateGroupName(name);
  if (nameError) {
    errors.name = nameError;
  }
  
  // Validate description
  const descError = validateDescription(description);
  if (descError) {
    errors.description = descError;
  }
  
  // Validate members
  const memberAddresses = Object.keys(memberResults);
  const invalidMembers = memberAddresses.filter(addr => 
    !memberResults[addr].isValidFormat || !memberResults[addr].canMessage
  );
  
  if (invalidMembers.length > 0) {
    errors.members = `${invalidMembers.length} member${invalidMembers.length > 1 ? 's' : ''} cannot receive messages`;
  }
  
  // Add warnings for edge cases
  if (memberAddresses.length === 0) {
    warnings.push('Creating group with no members - you can add them later');
  }
  
  if (memberAddresses.length > 10) {
    warnings.push('Large groups may take longer to create');
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings
  };
}