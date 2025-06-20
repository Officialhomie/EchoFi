// src/components/groups/DatabaseCreation.tsx
'use client';

import { useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  DatabaseIcon, 
  CheckIcon, 
  AlertCircleIcon, 
  RefreshCwIcon,
  InfoIcon,
  MessageCircleIcon
} from 'lucide-react';
import { useGroupCreation } from '@/hooks/useGroupCreation';
import { GroupCreationResult } from '@/types/group-creation';
import { Conversation } from '@xmtp/browser-sdk';

interface DatabaseCreationProps {
  groupData: {
    name: string;
    description: string;
    members: string[];
  };
  conversation: Conversation; // Real XMTP conversation from Phase 4
  onSuccess: (result: GroupCreationResult) => void;
  onBack: () => void;
  onCancel: () => void;
}

export function DatabaseCreation({
  groupData,
  conversation,
  onSuccess,
  onBack,
  onCancel
}: DatabaseCreationProps) {
  const { state, createGroup, reset, canRetry } = useGroupCreation();

  // Automatically start database creation when component mounts
  useEffect(() => {
    if (!state.isCreating && !state.isSuccess && !state.error) {
      handleCreateGroup();
    }
  }, []);

  const handleCreateGroup = useCallback(async () => {
    try {
      const result = await createGroup({
        name: groupData.name,
        description: groupData.description,
        members: groupData.members,
        xmtpGroupId: conversation.id // Use real XMTP conversation ID
      });
      
      // Create enhanced result with real conversation
      const Result: GroupCreationResult = {
        conversation, // Real XMTP conversation object
        databaseGroupId: result.databaseGroupId,
        treasuryAddress: result.treasuryAddress,
        deploymentTxHash: result.deploymentTxHash
      };
      
      // Auto-advance on success
      setTimeout(() => {
        onSuccess(Result);
      }, 1500);
      
    } catch (error) {
      console.log('Database creation failed, error stored in state');
    }
  }, [createGroup, groupData, conversation, onSuccess]);

  const handleRetry = useCallback(() => {
    reset();
    handleCreateGroup();
  }, [reset, handleCreateGroup]);

  // Render loading state
  if (state.isCreating) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
            <DatabaseIcon className="w-6 h-6 text-white animate-pulse" />
          </div>
          <CardTitle className="text-xl font-semibold text-gray-900">
            Saving to Database
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Persisting group data and linking with XMTP...
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Creation Progress */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <CheckIcon className="w-6 h-6 text-green-600" />
              <div className="flex-1">
                <div className="text-sm font-medium text-green-900">XMTP group created</div>
                <div className="text-xs text-green-700 font-mono">{conversation.id.slice(0, 20)}...</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <div className="flex-1">
                <div className="text-sm font-medium text-blue-900">Calling database API</div>
                <div className="text-xs text-blue-700">POST /api/groups</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg opacity-60">
              <div className="w-6 h-6 border-2 border-gray-300 rounded-full"></div>
              <div className="flex-1">
                <div className="text-sm text-gray-600">Linking XMTP conversation</div>
                <div className="text-xs text-gray-500">Creating database linkage</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg opacity-60">
              <div className="w-6 h-6 border-2 border-gray-300 rounded-full"></div>
              <div className="flex-1">
                <div className="text-sm text-gray-600">Adding group members</div>
                <div className="text-xs text-gray-500">{groupData.members.length + 1} members</div>
              </div>
            </div>
          </div>

          {/* Integration Details */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-purple-900 mb-2">XMTP Integration</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-purple-700">Conversation ID:</span>
                <span className="ml-2 font-mono text-xs text-purple-900">{conversation.id.slice(0, 30)}...</span>
              </div>
              <div>
                <span className="text-purple-700">Name:</span>
                <span className="ml-2 font-medium text-purple-900">{groupData.name}</span>
              </div>
              <div>
                <span className="text-purple-700">Encryption:</span>
                <span className="ml-2 text-purple-900">XMTP v3 MLS</span>
              </div>
            </div>
          </div>

          {/* Group Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Database Record</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Name:</span>
                <span className="ml-2 font-medium">{groupData.name}</span>
              </div>
              <div>
                <span className="text-gray-600">Members:</span>
                <span className="ml-2">{groupData.members.length + 1} total</span>
              </div>
              <div>
                <span className="text-gray-600">Description:</span>
                <span className="ml-2">{groupData.description || 'None'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render success state
  if (state.isSuccess && state.result) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mb-4">
            <CheckIcon className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-xl font-semibold text-gray-900">
            Group Ready!
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            XMTP messaging and database integration complete
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Complete Integration Status */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <MessageCircleIcon className="w-6 h-6 text-green-600" />
              <div className="flex-1">
                <div className="text-sm font-medium text-green-900">XMTP conversation active</div>
                <div className="text-xs text-green-700">Real-time messaging enabled</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <DatabaseIcon className="w-6 h-6 text-green-600" />
              <div className="flex-1">
                <div className="text-sm font-medium text-green-900">Database record created</div>
                <div className="text-xs text-green-700">ID: {state.result.databaseGroupId.slice(0, 20)}...</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <CheckIcon className="w-6 h-6 text-green-600" />
              <div className="flex-1">
                <div className="text-sm font-medium text-green-900">Members synchronized</div>
                <div className="text-xs text-green-700">XMTP ↔ Database linkage complete</div>
              </div>
            </div>
          </div>

          {/* Integration Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Complete Integration</h4>
            <div className="text-xs text-blue-800 space-y-1">
              <div>✅ XMTP conversation: {conversation.id.slice(0, 24)}...</div>
              <div>✅ Database group: {state.result.databaseGroupId.slice(0, 24)}...</div>
              <div>✅ {groupData.members.length + 1} members added to both systems</div>
              <div>✅ End-to-end encryption enabled</div>
            </div>
          </div>

          {/* Auto-advance notice */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <InfoIcon className="w-4 h-4 text-purple-600" />
              <span className="text-sm text-purple-800">
                Finalizing setup...
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
            Database Save Failed
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            {state.error.userMessage}
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* XMTP Status */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircleIcon className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">XMTP Group Created Successfully</span>
            </div>
            <p className="text-xs text-green-700 font-mono">
              {conversation.id.slice(0, 40)}...
            </p>
            <p className="text-xs text-green-700 mt-1">
              Your XMTP group exists and is functional. Only database linking failed.
            </p>
          </div>

          {/* Error Details */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm">
              <div className="font-medium text-red-900 mb-2">Database Error</div>
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
                <div className="font-medium text-yellow-900 mb-2">Recovery Options:</div>
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
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <RefreshCwIcon className="w-4 h-4 mr-2" />
                Retry Database
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
              <div>XMTP ID: {conversation.id}</div>
              <div>Database Error: {state.error.type}</div>
              <div>Retryable: {state.error.retryable ? '✅' : '❌'}</div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Fallback (shouldn't reach here)
  return null;
}