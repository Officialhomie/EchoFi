'use client';

import { useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  MessageCircleIcon, 
  CheckIcon, 
  AlertCircleIcon, 
  RefreshCwIcon,
  InfoIcon,
  ShieldIcon,
  UsersIcon,
  ClockIcon
} from 'lucide-react';
import { useXMTPIntegration } from '@/hooks/useXMTPIntegration';
import { CreateGroupParams } from '@/types/group-creation';
import { Conversation } from '@xmtp/browser-sdk';

interface XMTPCreationProps {
  groupData: {
    name: string;
    description: string;
    members: string[];
  };
  onSuccess: (conversation: Conversation) => void;
  onBack: () => void;
  onCancel: () => void;
}

export function XMTPCreation({
  groupData,
  onSuccess,
  onBack,
  onCancel
}: XMTPCreationProps) {
  const { state, createXMTPGroup, reset, canRetry } = useXMTPIntegration();

  // Automatically start XMTP creation when component mounts
  useEffect(() => {
    if (!state.isCreating && !state.isSuccess && !state.error) {
      handleCreateXMTPGroup();
    }
  }, []);

  const handleCreateXMTPGroup = useCallback(async () => {
    try {
      const params: CreateGroupParams = {
        name: groupData.name,
        description: groupData.description,
        members: groupData.members,
        config: {
          name: groupData.name,
          description: groupData.description
        }
      };
      
      const conversation = await createXMTPGroup(params);
      
      // Auto-advance on success after showing confirmation
      setTimeout(() => {
        onSuccess(conversation);
      }, 2000);
      
    } catch (error) {
      // Error is already handled in the hook state
      console.log('XMTP group creation failed, error stored in state');
    }
  }, [createXMTPGroup, groupData, onSuccess]);

  const handleRetry = useCallback(() => {
    reset();
    handleCreateXMTPGroup();
  }, [reset, handleCreateXMTPGroup]);

  // Render loading state
  if (state.isCreating) {
    const getProgressWidth = () => {
      switch (state.progress.phase) {
        case 'validation': return '25%';
        case 'creating': return '50%';
        case 'syncing': return '75%';
        case 'complete': return '100%';
        default: return '0%';
      }
    };

    const getPhaseIcon = (phase: string, isCurrent: boolean) => {
      const iconClass = `w-6 h-6 ${isCurrent ? 'text-blue-600' : 'text-gray-400'}`;
      
      switch (phase) {
        case 'validation':
          return isCurrent ? 
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div> :
            <CheckIcon className="w-6 h-6 text-green-500" />;
        case 'creating':
          return isCurrent ? 
            <MessageCircleIcon className={`${iconClass} animate-pulse`} /> :
            state.progress.phase === 'syncing' || state.progress.phase === 'complete' ?
            <CheckIcon className="w-6 h-6 text-green-500" /> :
            <MessageCircleIcon className={iconClass} />;
        case 'syncing':
          return isCurrent ? 
            <ShieldIcon className={`${iconClass} animate-pulse`} /> :
            state.progress.phase === 'complete' ?
            <CheckIcon className="w-6 h-6 text-green-500" /> :
            <ShieldIcon className={iconClass} />;
        default:
          return <ClockIcon className={iconClass} />;
      }
    };

    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center mb-4">
            <MessageCircleIcon className="w-6 h-6 text-white animate-pulse" />
          </div>
          <CardTitle className="text-xl font-semibold text-gray-900">
            Creating XMTP Group
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Setting up encrypted messaging for your group
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm text-gray-500">{state.progress.phase}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-purple-500 to-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: getProgressWidth() }}
              ></div>
            </div>
            <p className="text-xs text-gray-600">{state.progress.message}</p>
          </div>

          {/* Creation Phases */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              {getPhaseIcon('validation', state.progress.phase === 'validation')}
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">Address Validation</div>
                <div className="text-xs text-gray-600">Checking XMTP capability for {groupData.members.length} members</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              {getPhaseIcon('creating', state.progress.phase === 'creating')}
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">Group Creation</div>
                <div className="text-xs text-gray-600">Creating encrypted XMTP group conversation</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              {getPhaseIcon('syncing', state.progress.phase === 'syncing')}
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">Network Sync</div>
                <div className="text-xs text-gray-600">Synchronizing with XMTP network</div>
              </div>
            </div>
          </div>

          {/* Group Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Creating Group</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-blue-700">Name:</span>
                <span className="ml-2 font-medium text-blue-900">{groupData.name}</span>
              </div>
              <div>
                <span className="text-blue-700">Members:</span>
                <span className="ml-2 text-blue-900">{groupData.members.length + 1} total</span>
              </div>
              <div>
                <span className="text-blue-700">Encryption:</span>
                <span className="ml-2 text-blue-900">End-to-end encrypted</span>
              </div>
            </div>
          </div>

          {/* XMTP Info */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <ShieldIcon className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">XMTP Security</span>
            </div>
            <p className="text-xs text-purple-700">
              Your group uses XMTP v3 with MLS encryption, providing secure, 
              decentralized messaging that works across all XMTP-compatible apps.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render success state
  if (state.isSuccess && state.conversation) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mb-4">
            <CheckIcon className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-xl font-semibold text-gray-900">
            XMTP Group Created!
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Your encrypted messaging group is ready
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Success Summary */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <CheckIcon className="w-6 h-6 text-green-600" />
              <div className="flex-1">
                <div className="text-sm font-medium text-green-900">XMTP conversation created</div>
                <div className="text-xs text-green-700 font-mono">{state.conversation.id.slice(0, 20)}...</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <UsersIcon className="w-6 h-6 text-green-600" />
              <div className="flex-1">
                <div className="text-sm font-medium text-green-900">Members added</div>
                <div className="text-xs text-green-700">{groupData.members.length + 1} participants ready</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <ShieldIcon className="w-6 h-6 text-green-600" />
              <div className="flex-1">
                <div className="text-sm font-medium text-green-900">End-to-end encryption</div>
                <div className="text-xs text-green-700">Messages secured with XMTP v3 MLS</div>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <InfoIcon className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-800">
                Next: Saving group to database...
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render error state
  if (state.error) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center mb-4">
            <AlertCircleIcon className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-xl font-semibold text-gray-900">
            XMTP Creation Failed
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            {state.error.userMessage}
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Error Details */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm">
              <div className="font-medium text-red-900 mb-2">Error Details</div>
              <div className="text-red-800 mb-3">{state.error.userMessage}</div>
              
              {state.error.technicalDetails && (
                <div className="text-xs text-red-700 font-mono bg-red-100 p-2 rounded">
                  {state.error.technicalDetails}
                </div>
              )}
            </div>
          </div>

          {/* Recovery Suggestions */}
          {state.error.recoverySuggestions && state.error.recoverySuggestions.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="text-sm">
                <div className="font-medium text-yellow-900 mb-2">How to fix this:</div>
                <ul className="space-y-1 text-yellow-800">
                  {state.error.recoverySuggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-yellow-600">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* XMTP Info for Errors */}
          {state.error.type === 'PERMISSION_DENIED' && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <ShieldIcon className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-900">About XMTP Signatures</span>
              </div>
              <p className="text-xs text-purple-700">
                XMTP requires a one-time signature to create your secure messaging identity. 
                This enables end-to-end encryption and works across all XMTP apps.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="flex-1"
            >
              Back
            </Button>
            
            {canRetry ? (
              <Button
                type="button"
                onClick={handleRetry}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
              >
                <RefreshCwIcon className="w-4 h-4 mr-2" />
                Retry XMTP
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="flex-1"
              >
                Cancel
              </Button>
            )}
          </div>

          {/* Debug info in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-2 bg-gray-100 rounded text-xs">
              <div>Error Type: {state.error.type}</div>
              <div>Retryable: {state.error.retryable ? '✅' : '❌'}</div>
              <div>Can Retry: {canRetry ? '✅' : '❌'}</div>
              <div>Phase: {state.progress.phase}</div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Fallback (shouldn't reach here)
  return null;
}