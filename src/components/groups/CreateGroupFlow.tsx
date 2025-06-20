'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  X as XIcon, 
  ArrowLeftIcon, 
  AlertCircleIcon
} from 'lucide-react';
import { GroupDetailsForm } from '@/components/groups/GroupDetailsForm';
import { MemberManagement } from '@/components/groups/MemberManagement';
import { CreationProgress, DEFAULT_CREATION_STEPS, setCurrentStep, updateStepStatus } from '@/components/groups/CreationProgress';
import { SuccessConfirmation } from '@/components/groups/SuccessConfirmation';
import { useGroupValidation } from '@/hooks/useGroupValidation';
import { useGroupCreation } from '@/hooks/useGroupCreation';
import { useXMTP } from '@/hooks/useXMTP';
import { useWallet } from '@/hooks/useWallet';
import { GroupCreationResult, GroupCreationError, CreateGroupParams } from '@/types/group-creation';
import { Conversation } from '@xmtp/browser-sdk';
import { cn } from '@/lib/utils';

// =============================================================================
// INTERFACES & TYPES
// =============================================================================

interface CreateGroupFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: (result: GroupCreationResult) => void;
  className?: string;
}

interface FlowState {
  currentStep: 'details' | 'members' | 'creating' | 'success';
  groupDetails: { name: string; description: string } | null;
  selectedMembers: string[] | null;
  isProcessing: boolean;
  error: GroupCreationError | null;
  result: GroupCreationResult | null;
}

interface CreationProgress {
  phase: 'validation' | 'xmtp' | 'database' | 'complete';
  message: string;
  isError: boolean;
}

// =============================================================================
// ERROR MESSAGES & RECOVERY
// =============================================================================

const ERROR_MESSAGES: Record<string, string> = {
  XMTP_CONNECTION_FAILED: "Connection to messaging network failed. Please check your internet connection and try again.",
  INVALID_MEMBER_ADDRESSES: "Some member addresses are invalid or cannot receive messages. Please review and correct them.",
  DATABASE_SAVE_FAILED: "Failed to save group information. This is usually temporary - please try again.",
  VALIDATION_ERROR: "Please review the form and correct any highlighted issues.",
  PERMISSION_DENIED: "Permission denied. Please ensure your wallet is connected.",
  NETWORK_ERROR: "Network connection issue. Please check your connection and retry.",
  UNKNOWN_ERROR: "An unexpected error occurred. Please try again or contact support."
};

const RECOVERY_SUGGESTIONS: Record<string, string[]> = {
  XMTP_CONNECTION_FAILED: [
    "Check your internet connection",
    "Ensure your wallet is connected", 
    "Try refreshing the page"
  ],
  INVALID_MEMBER_ADDRESSES: [
    "Remove invalid addresses",
    "Ensure all members have used XMTP before",
    "Check address format"
  ],
  DATABASE_SAVE_FAILED: [
    "Wait a moment and try again",
    "Check your internet connection",
    "Contact support if issue persists"
  ]
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function CreateGroupFlow({
  isOpen,
  onClose,
  onGroupCreated,
  className
}: CreateGroupFlowProps) {
  
  // Hook integrations
  const { address, isConnected } = useWallet();
  const { createGroup: createXMTPGroup, isInitialized: xmtpReady } = useXMTP();
  const { createGroup: createDatabaseGroup } = useGroupCreation();
  const { resetValidation } = useGroupValidation();

  // Flow state management
  const [flowState, setFlowState] = useState<FlowState>({
    currentStep: 'details',
    groupDetails: null,
    selectedMembers: null,
    isProcessing: false,
    error: null,
    result: null
  });

  const [creationProgress, setCreationProgress] = useState<CreationProgress>({
    phase: 'validation',
    message: 'Preparing to create group...',
    isError: false
  });

  const [progressSteps, setProgressSteps] = useState(DEFAULT_CREATION_STEPS);

  // =============================================================================
  // STEP NAVIGATION
  // =============================================================================

  const handleDetailsSubmit = useCallback((data: { name: string; description: string }) => {
    setFlowState(prev => ({
      ...prev,
      groupDetails: data,
      currentStep: 'members'
    }));
    setProgressSteps(steps => setCurrentStep(steps, 'members'));
  }, []);

  const handleMembersSubmit = useCallback((members: string[]) => {
    setFlowState(prev => ({
      ...prev,
      selectedMembers: members,
      currentStep: 'creating'
    }));
    setProgressSteps(steps => setCurrentStep(steps, 'create'));
  }, []);

  const handleBackToDetails = useCallback(() => {
    setFlowState(prev => ({
      ...prev,
      currentStep: 'details',
      error: null
    }));
    setProgressSteps(steps => setCurrentStep(steps, 'details'));
  }, []);

  const handleBackToMembers = useCallback(() => {
    setFlowState(prev => ({
      ...prev,
      currentStep: 'members',
      error: null
    }));
    setProgressSteps(steps => setCurrentStep(steps, 'members'));
  }, []);

  // =============================================================================
  // MAIN CREATION WORKFLOW
  // =============================================================================

  const handleCreateGroup = useCallback(async () => {
    if (!flowState.groupDetails || !flowState.selectedMembers) {
      console.error('Missing required data for group creation');
      return;
    }

    if (!isConnected || !address) {
      setFlowState(prev => ({
        ...prev,
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Wallet not connected',
          userMessage: 'Please connect your wallet to continue',
          retryable: false
        } as GroupCreationError
      }));
      return;
    }

    if (!xmtpReady) {
      setFlowState(prev => ({
        ...prev,
        error: {
          type: 'XMTP_CONNECTION_FAILED',
          message: 'XMTP not ready',
          userMessage: 'Messaging system is not ready. Please wait and try again.',
          retryable: true
        } as GroupCreationError
      }));
      return;
    }

    setFlowState(prev => ({ ...prev, isProcessing: true, error: null }));
    
    try {
      // Step 1: XMTP Group Creation
      setCreationProgress({
        phase: 'validation',
        message: 'Validating member addresses...',
        isError: false
      });

      const createParams: CreateGroupParams = {
        name: flowState.groupDetails.name,
        description: flowState.groupDetails.description,
        members: flowState.selectedMembers
      };

      setCreationProgress({
        phase: 'xmtp',
        message: 'Creating secure messaging group...',
        isError: false
      });

      const xmtpConversation: Conversation = await createXMTPGroup(
        createParams.name,
        createParams.description,
        createParams.members
      );

      console.log('✅ XMTP group created:', {
        id: xmtpConversation.id,
        name: createParams.name,
        memberCount: createParams.members.length
      });

      // Step 2: Database Persistence
      setCreationProgress({
        phase: 'database',
        message: 'Saving group information...',
        isError: false
      });

      const dbResult = await createDatabaseGroup({
        name: createParams.name,
        description: createParams.description,
        members: createParams.members,
        xmtpGroupId: xmtpConversation.id
      });

      console.log('✅ Database group created:', {
        databaseId: dbResult.databaseGroupId,
        xmtpId: xmtpConversation.id
      });

      // Step 3: Success Handling
      setCreationProgress({
        phase: 'complete',
        message: 'Group created successfully!',
        isError: false
      });

      const finalResult: GroupCreationResult = {
        conversation: xmtpConversation,
        databaseGroupId: dbResult.databaseGroupId,
        // Treasury will be deployed later when group members are ready
        treasuryAddress: undefined,
        deploymentTxHash: undefined
      };

      setFlowState(prev => ({
        ...prev,
        isProcessing: false,
        currentStep: 'success',
        result: finalResult
      }));

      setProgressSteps(steps => setCurrentStep(steps, 'complete'));

      // Notify parent component
      onGroupCreated(finalResult);

    } catch (error) {
      console.error('❌ Group creation failed:', error);
      
      let errorDetails: GroupCreationError;
      
      if (error && typeof error === 'object' && 'type' in error) {
        errorDetails = error as GroupCreationError;
      } else {
        errorDetails = {
          type: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          userMessage: ERROR_MESSAGES.UNKNOWN_ERROR,
          retryable: true
        } as GroupCreationError;
      }

      setCreationProgress({
        phase: 'validation',
        message: errorDetails.userMessage || ERROR_MESSAGES.UNKNOWN_ERROR,
        isError: true
      });

      setFlowState(prev => ({
        ...prev,
        isProcessing: false,
        error: errorDetails
      }));

      setProgressSteps(steps => updateStepStatus(steps, 'create', 'error'));
    }
  }, [
    flowState.groupDetails,
    flowState.selectedMembers,
    isConnected,
    address,
    xmtpReady,
    createXMTPGroup,
    createDatabaseGroup,
    onGroupCreated
  ]);

  // Auto-start creation when entering creating step
  useEffect(() => {
    if (flowState.currentStep === 'creating' && !flowState.isProcessing && !flowState.error) {
      handleCreateGroup();
    }
  }, [flowState.currentStep, flowState.isProcessing, flowState.error, handleCreateGroup]);

  // =============================================================================
  // ERROR HANDLING & RETRY
  // =============================================================================

  const handleRetry = useCallback(() => {
    if (flowState.error?.retryable) {
      setFlowState(prev => ({ ...prev, error: null }));
      setCreationProgress({
        phase: 'validation',
        message: 'Preparing to create group...',
        isError: false
      });
      setProgressSteps(steps => updateStepStatus(steps, 'create', 'current'));
      handleCreateGroup();
    }
  }, [flowState.error, handleCreateGroup]);

  const handleStartOver = useCallback(() => {
    setFlowState({
      currentStep: 'details',
      groupDetails: null,
      selectedMembers: null,
      isProcessing: false,
      error: null,
      result: null
    });
    setProgressSteps(setCurrentStep(DEFAULT_CREATION_STEPS, 'details'));
    resetValidation();
  }, [resetValidation]);

  // =============================================================================
  // SUCCESS ACTIONS
  // =============================================================================

  const handleJoinGroup = useCallback(() => {
    if (flowState.result) {
      onClose();
      // Navigate to group chat would be handled by parent
      console.log('Joining group:', flowState.result.conversation.id);
    }
  }, [flowState.result, onClose]);

  const handleCreateAnother = useCallback(() => {
    handleStartOver();
  }, [handleStartOver]);

  const handleViewDashboard = useCallback(() => {
    onClose();
    // Navigate to dashboard would be handled by parent
    console.log('Navigating to dashboard');
  }, [onClose]);

  // =============================================================================
  // CONDITIONAL RENDERING HELPERS
  // =============================================================================

  const renderCurrentStep = () => {
    switch (flowState.currentStep) {
      case 'details':
        return (
          <GroupDetailsForm
            onSubmit={handleDetailsSubmit}
            onCancel={onClose}
            isLoading={flowState.isProcessing}
            initialData={flowState.groupDetails || undefined}
          />
        );

      case 'members':
        return (
          <MemberManagement
            onSubmit={handleMembersSubmit}
            onBack={handleBackToDetails}
            isLoading={flowState.isProcessing}
            maxMembers={20}
          />
        );

      case 'creating':
        return (
          <Card className="w-full max-w-lg mx-auto">
            <CardContent className="p-6">
              <CreationProgress 
                steps={progressSteps}
                className="mb-6"
              />
              
              <div className="text-center space-y-4">
                <div className="text-lg font-semibold text-gray-900">
                  {creationProgress.isError ? 'Creation Failed' : 'Creating Your Group'}
                </div>
                
                <div className={cn(
                  "text-sm",
                  creationProgress.isError ? "text-red-600" : "text-gray-600"
                )}>
                  {creationProgress.message}
                </div>

                {flowState.isProcessing && !creationProgress.isError && (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <div className="w-6 h-6 border-3 border-gray-300 border-t-purple-500 rounded-full animate-spin"></div>
                    <span className="text-sm text-gray-500">Please wait...</span>
                  </div>
                )}

                {flowState.error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left">
                    <div className="flex items-start gap-3">
                      <AlertCircleIcon className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-red-900">
                          {flowState.error.userMessage}
                        </div>
                        {RECOVERY_SUGGESTIONS[flowState.error.type] && (
                          <div className="text-xs text-red-700">
                            <div className="font-medium mb-1">Try these steps:</div>
                            <ul className="list-disc list-inside space-y-1">
                              {RECOVERY_SUGGESTIONS[flowState.error.type].map((suggestion, index) => (
                                <li key={index}>{suggestion}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-4 flex gap-3">
                      {flowState.error.retryable && (
                        <Button
                          onClick={handleRetry}
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          Try Again
                        </Button>
                      )}
                      <Button
                        onClick={handleBackToMembers}
                        variant="outline"
                        size="sm"
                      >
                        Go Back
                      </Button>
                      <Button
                        onClick={handleStartOver}
                        variant="outline"
                        size="sm"
                      >
                        Start Over
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );

      case 'success':
        return flowState.result && flowState.groupDetails ? (
          <SuccessConfirmation
            result={flowState.result}
            groupData={{
              name: flowState.groupDetails.name,
              description: flowState.groupDetails.description,
              members: flowState.selectedMembers || []
            }}
            onJoinGroup={handleJoinGroup}
            onCreateAnother={handleCreateAnother}
            onViewDashboard={handleViewDashboard}
          />
        ) : null;

      default:
        return null;
    }
  };

  const renderHeader = () => {
    const stepTitles = {
      details: 'Group Details',
      members: 'Add Members', 
      creating: 'Creating Group',
      success: 'Success!'
    };

    return (
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          {flowState.currentStep !== 'details' && flowState.currentStep !== 'success' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={flowState.currentStep === 'members' ? handleBackToDetails : handleBackToMembers}
              disabled={flowState.isProcessing}
              className="p-1"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </Button>
          )}
          <h2 className="text-xl font-semibold text-gray-900">
            {stepTitles[flowState.currentStep]}
          </h2>
        </div>
        
        {flowState.currentStep !== 'creating' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={flowState.isProcessing}
            className="p-2"
          >
            <XIcon className="w-5 h-5" />
          </Button>
        )}
      </div>
    );
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-purple-500 via-purple-600 to-blue-600 z-50 overflow-y-auto">
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className={cn(
          "bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-auto",
          "backdrop-blur-sm bg-opacity-95",
          className
        )}>
          {renderHeader()}
          
          <div className="p-6">
            {flowState.currentStep !== 'details' && flowState.currentStep !== 'success' && (
              <div className="mb-6">
                <CreationProgress 
                  steps={progressSteps}
                  className="max-w-md mx-auto"
                />
              </div>
            )}
            
            {renderCurrentStep()}
          </div>
        </div>
      </div>
    </div>
  );
}