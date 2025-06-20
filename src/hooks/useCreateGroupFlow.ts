import { useState, useCallback, useRef } from 'react';
import { GroupCreationResult, GroupCreationError } from '@/types/group-creation';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export type FlowStep = 'details' | 'members' | 'creating' | 'success';

export interface FlowState {
  currentStep: FlowStep;
  groupDetails: { name: string; description: string } | null;
  selectedMembers: string[] | null;
  isProcessing: boolean;
  error: GroupCreationError | null;
  result: GroupCreationResult | null;
}

export interface FlowActions {
  // Navigation
  goToDetails: () => void;
  goToMembers: () => void;
  goToCreating: () => void;
  goToSuccess: (result: GroupCreationResult) => void;
  
  // Data management
  setGroupDetails: (details: { name: string; description: string }) => void;
  setSelectedMembers: (members: string[]) => void;
  setProcessing: (processing: boolean) => void;
  setError: (error: GroupCreationError | null) => void;
  
  // Flow control
  reset: () => void;
  canProceed: boolean;
  canRetry: boolean;
}

export interface UseCreateGroupFlowReturn {
  state: FlowState;
  actions: FlowActions;
  
  // Progress tracking
  progressPercentage: number;
  isComplete: boolean;
  hasError: boolean;
  
  // Validation helpers
  validateCurrentStep: () => boolean;
  getStepTitle: (step: FlowStep) => string;
  getNextStep: (currentStep: FlowStep) => FlowStep | null;
  getPreviousStep: (currentStep: FlowStep) => FlowStep | null;
}

export interface FlowValidationResult {
  isValid: boolean;
  issues: string[];
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const INITIAL_STATE: FlowState = {
  currentStep: 'details',
  groupDetails: null,
  selectedMembers: null,
  isProcessing: false,
  error: null,
  result: null
};

// =============================================================================
// STEP CONFIGURATION
// =============================================================================

const STEP_CONFIG = {
  details: {
    title: 'Group Details',
    progress: 25,
    required: ['groupDetails'],
    next: 'members' as FlowStep,
    previous: null
  },
  members: {
    title: 'Add Members',
    progress: 50,
    required: ['groupDetails', 'selectedMembers'],
    next: 'creating' as FlowStep,
    previous: 'details' as FlowStep
  },
  creating: {
    title: 'Creating Group',
    progress: 75,
    required: ['groupDetails', 'selectedMembers'],
    next: 'success' as FlowStep,
    previous: 'members' as FlowStep
  },
  success: {
    title: 'Success!',
    progress: 100,
    required: ['result'],
    next: null,
    previous: null
  }
} as const;

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * Enhanced state management hook for group creation flow
 * Provides deterministic state transitions and validation
 */
export function useCreateGroupFlow(): UseCreateGroupFlowReturn {
  const [state, setState] = useState<FlowState>(INITIAL_STATE);
  
  // Track user interactions for analytics/debugging
  const interactionHistory = useRef<Array<{
    action: string;
    timestamp: number;
    step: FlowStep;
    data?: Record<string, unknown>;
  }>>([]);

  // =============================================================================
  // LOGGING HELPER
  // =============================================================================

  const logInteraction = useCallback((action: string, data?: Record<string, unknown>) => {
    const interaction = {
      action,
      timestamp: Date.now(),
      step: state.currentStep,
      data
    };
    
    interactionHistory.current.push(interaction);
    
    // Keep only last 50 interactions to prevent memory leaks
    if (interactionHistory.current.length > 50) {
      interactionHistory.current = interactionHistory.current.slice(-50);
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Flow interaction:', interaction);
    }
  }, [state.currentStep]);

  // =============================================================================
  // VALIDATION HELPERS
  // =============================================================================

  const validateCurrentStep = useCallback((): boolean => {
    const stepConfig = STEP_CONFIG[state.currentStep];
    
    for (const requirement of stepConfig.required) {
      switch (requirement) {
        case 'groupDetails':
          if (!state.groupDetails?.name?.trim()) return false;
          break;
        case 'selectedMembers':
          // Members are optional, but if provided, array should be valid
          if (state.selectedMembers && !Array.isArray(state.selectedMembers)) return false;
          break;
        case 'result':
          if (!state.result) return false;
          break;
      }
    }
    
    return true;
  }, [state]);

  const validateStep = useCallback((step: FlowStep): FlowValidationResult => {
    const issues: string[] = [];
    const stepConfig = STEP_CONFIG[step];
    
    for (const requirement of stepConfig.required) {
      switch (requirement) {
        case 'groupDetails':
          if (!state.groupDetails) {
            issues.push('Group details are required');
          } else {
            if (!state.groupDetails.name?.trim()) {
              issues.push('Group name is required');
            }
            if (state.groupDetails.name && state.groupDetails.name.length > 50) {
              issues.push('Group name must be less than 50 characters');
            }
          }
          break;
          
        case 'selectedMembers':
          if (state.selectedMembers && state.selectedMembers.length > 20) {
            issues.push('Maximum 20 members allowed');
          }
          break;
          
        case 'result':
          if (!state.result) {
            issues.push('Group creation must be completed');
          }
          break;
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }, [state]);

  // =============================================================================
  // NAVIGATION ACTIONS
  // =============================================================================

  const goToDetails = useCallback(() => {
    logInteraction('navigate_to_details');
    setState(prev => ({
      ...prev,
      currentStep: 'details',
      error: null // Clear errors when going back
    }));
  }, [logInteraction]);

  const goToMembers = useCallback(() => {
    const validation = validateStep('details');
    
    if (!validation.isValid) {
      console.warn('Cannot proceed to members step:', validation.issues);
      return;
    }
    
    logInteraction('navigate_to_members');
    setState(prev => ({
      ...prev,
      currentStep: 'members',
      error: null
    }));
  }, [validateStep, logInteraction]);

  const goToCreating = useCallback(() => {
    const validation = validateStep('members');
    
    if (!validation.isValid) {
      console.warn('Cannot proceed to creating step:', validation.issues);
      return;
    }
    
    logInteraction('navigate_to_creating');
    setState(prev => ({
      ...prev,
      currentStep: 'creating',
      error: null
    }));
  }, [validateStep, logInteraction]);

  const goToSuccess = useCallback((result: GroupCreationResult) => {
    logInteraction('navigate_to_success', { resultId: result.databaseGroupId });
    setState(prev => ({
      ...prev,
      currentStep: 'success',
      result,
      error: null,
      isProcessing: false
    }));
  }, [logInteraction]);

  // =============================================================================
  // DATA MANAGEMENT ACTIONS
  // =============================================================================

  const setGroupDetails = useCallback((details: { name: string; description: string }) => {
    logInteraction('set_group_details', { name: details.name });
    setState(prev => ({
      ...prev,
      groupDetails: details,
      error: null // Clear errors when updating data
    }));
  }, [logInteraction]);

  const setSelectedMembers = useCallback((members: string[]) => {
    logInteraction('set_selected_members', { count: members.length });
    setState(prev => ({
      ...prev,
      selectedMembers: members,
      error: null
    }));
  }, [logInteraction]);

  const setProcessing = useCallback((processing: boolean) => {
    logInteraction(processing ? 'start_processing' : 'stop_processing');
    setState(prev => ({
      ...prev,
      isProcessing: processing
    }));
  }, [logInteraction]);

  const setError = useCallback((error: GroupCreationError | null) => {
    logInteraction(error ? 'set_error' : 'clear_error', { 
      type: error?.type,
      message: error?.userMessage 
    });
    setState(prev => ({
      ...prev,
      error,
      isProcessing: false // Stop processing on error
    }));
  }, [logInteraction]);

  // =============================================================================
  // FLOW CONTROL ACTIONS
  // =============================================================================

  const reset = useCallback(() => {
    logInteraction('reset_flow');
    setState(INITIAL_STATE);
    interactionHistory.current = [];
  }, [logInteraction]);

  // =============================================================================
  // COMPUTED PROPERTIES
  // =============================================================================

  const progressPercentage = STEP_CONFIG[state.currentStep].progress;
  const isComplete = state.currentStep === 'success' && !!state.result;
  const hasError = !!state.error;
  const canProceed = validateCurrentStep() && !state.isProcessing && !hasError;
  const canRetry = hasError && state.error?.retryable === true;

  // =============================================================================
  // UTILITY FUNCTIONS
  // =============================================================================

  const getStepTitle = useCallback((step: FlowStep): string => {
    return STEP_CONFIG[step].title;
  }, []);

  const getNextStep = useCallback((currentStep: FlowStep): FlowStep | null => {
    return STEP_CONFIG[currentStep].next;
  }, []);

  const getPreviousStep = useCallback((currentStep: FlowStep): FlowStep | null => {
    return STEP_CONFIG[currentStep].previous;
  }, []);

  // =============================================================================
  // RETURN OBJECT
  // =============================================================================

  return {
    state,
    actions: {
      // Navigation
      goToDetails,
      goToMembers,
      goToCreating,
      goToSuccess,
      
      // Data management
      setGroupDetails,
      setSelectedMembers,
      setProcessing,
      setError,
      
      // Flow control
      reset,
      canProceed,
      canRetry
    },
    
    // Progress tracking
    progressPercentage,
    isComplete,
    hasError,
    
    // Validation helpers
    validateCurrentStep,
    getStepTitle,
    getNextStep,
    getPreviousStep
  };
}