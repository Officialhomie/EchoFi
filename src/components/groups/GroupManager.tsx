'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useXMTP } from '@/hooks/useXMTP';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreateGroupFlow } from '@/components/groups/CreateGroupFlow';
import { formatAddress, getRelativeTime } from '@/lib/utils';
import { 
  PlusIcon, 
  UsersIcon, 
  MessageCircleIcon,
  AlertCircleIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowRightIcon
} from 'lucide-react';
import { GroupCreationResult } from '@/types/group-creation';

// =============================================================================
// INTERFACES & TYPES
// =============================================================================

// Enhanced GroupManager props with backward compatibility
interface GroupManagerProps {
  /** Callback when user wants to join/view a group */
  onJoinGroup: (groupId: string, groupName: string) => void;
  /** Legacy callback for backward compatibility - will be handled internally */
  onCreateGroup?: (groupData: { name: string; description: string; members: string[] }) => Promise<void>;
  /** Whether external operations are loading */
  isLoading?: boolean;
  /** Whether the current user can create groups */
  canCreateGroups?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the create button prominently */
  showCreateButton?: boolean;
}

interface GroupCardData {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  lastActivity: number;
  unreadCount?: number;
  hasActiveAgent?: boolean;
  isXMTPOnly: boolean;
}

interface GroupManagerState {
  showCreateFlow: boolean;
  isRefreshing: boolean;
  lastRefresh: number;
  error: string | null;
  retryCount: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const REFRESH_COOLDOWN = 5000; // 5 seconds
const MAX_RETRY_COUNT = 3;
const CARD_ANIMATION_DELAY = 100; // ms between card animations

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function GroupManager({
  onJoinGroup,
  onCreateGroup, // Legacy prop for backward compatibility
  isLoading = false,
  canCreateGroups = true,
  className = '',
  showCreateButton = true
}: GroupManagerProps) {
  
  // Hook integrations
  const { 
    conversations, 
    isInitialized: xmtpReady, 
    isInitializing: xmtpInitializing,
    error: xmtpError,
    refreshConversations 
  } = useXMTP();
  const { address, isConnected } = useWallet();

  // Component state
  const [state, setState] = useState<GroupManagerState>({
    showCreateFlow: false,
    isRefreshing: false,
    lastRefresh: 0,
    error: null,
    retryCount: 0
  });

  // =============================================================================
  // COMPUTED VALUES
  // =============================================================================

  const groupCards = useMemo((): GroupCardData[] => {
    if (!conversations) return [];

    return conversations.map((conversation, index) => {
      // Calculate member count (approximate from XMTP group)
      const memberCount = 1; // Default to 1 (creator) since XMTP doesn't expose member list directly
      
      // Calculate last activity
      const lastActivity = conversation.createdAtNs 
        ? Number(conversation.createdAtNs) / 1000000
        : Date.now();

      return {
        id: conversation.id,
        name: conversation.name || `Group ${index + 1}`,
        description: conversation.description || 'Investment coordination group',
        memberCount,
        lastActivity,
        unreadCount: 0, // Could be enhanced with message tracking
        hasActiveAgent: false, // Could be enhanced with agent detection
        isXMTPOnly: true // All groups from XMTP hook are XMTP-native
      };
    });
  }, [conversations]);

  const isOperational = xmtpReady && isConnected && !xmtpError;
  const canRefresh = !state.isRefreshing && (Date.now() - state.lastRefresh) > REFRESH_COOLDOWN;
  const hasGroups = groupCards.length > 0;

  // =============================================================================
  // HANDLERS
  // =============================================================================

  const handleShowCreateFlow = useCallback(() => {
    if (!canCreateGroups || !isOperational) {
      console.warn('Cannot create groups: prerequisites not met');
      return;
    }

    setState(prev => ({ 
      ...prev, 
      showCreateFlow: true,
      error: null 
    }));
  }, [canCreateGroups, isOperational]);

  const handleCloseCreateFlow = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      showCreateFlow: false 
    }));
  }, []);

  const handleGroupCreated = useCallback(async (result: GroupCreationResult) => {
    try {
      console.log('✅ Group created successfully:', {
        databaseId: result.databaseGroupId,
        conversationId: result.conversation.id,
        treasuryAddress: result.treasuryAddress
      });

      // Close the creation flow
      setState(prev => ({ 
        ...prev, 
        showCreateFlow: false,
        error: null,
        retryCount: 0
      }));

      // Refresh conversations to show the new group
      if (refreshConversations) {
        await refreshConversations();
      }

      // Navigate to the new group
      onJoinGroup(
        result.conversation.id, 
        result.conversation.name || 'New Group'
      );

      // Call legacy callback if provided (backward compatibility)
      if (onCreateGroup) {
        const groupData = {
          name: result.conversation.name || 'New Group',
          description: result.conversation.description || '',
          members: [] // XMTP doesn't expose member list directly
        };
        
        try {
          await onCreateGroup(groupData);
        } catch (legacyError) {
          console.warn('Legacy onCreateGroup callback failed:', legacyError);
          // Don't fail the entire flow for legacy callback issues
        }
      }

    } catch (error) {
      console.error('❌ Error handling group creation result:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to process group creation'
      }));
    }
  }, [onJoinGroup, onCreateGroup, refreshConversations]);

  const handleRefreshGroups = useCallback(async () => {
    if (!canRefresh || !refreshConversations) return;

    setState(prev => ({ 
      ...prev, 
      isRefreshing: true,
      error: null 
    }));

    try {
      await refreshConversations();
      setState(prev => ({ 
        ...prev, 
        lastRefresh: Date.now(),
        retryCount: 0
      }));
    } catch (error) {
      console.error('❌ Failed to refresh conversations:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to refresh groups',
        retryCount: prev.retryCount + 1
      }));
    } finally {
      setState(prev => ({ 
        ...prev, 
        isRefreshing: false 
      }));
    }
  }, [canRefresh, refreshConversations]);

  const handleRetryOperation = useCallback(() => {
    if (state.retryCount < MAX_RETRY_COUNT) {
      handleRefreshGroups();
    } else {
      setState(prev => ({ 
        ...prev, 
        error: 'Maximum retry attempts reached. Please check your connection and try again later.',
        retryCount: 0
      }));
    }
  }, [state.retryCount, handleRefreshGroups]);

  const handleJoinGroup = useCallback((conversationId: string, groupName: string) => {
    setState(prev => ({ ...prev, error: null }));
    onJoinGroup(conversationId, groupName);
  }, [onJoinGroup]);

  // =============================================================================
  // EFFECTS
  // =============================================================================

  // Auto-refresh conversations when XMTP becomes ready
  useEffect(() => {
    if (xmtpReady && refreshConversations && conversations.length === 0) {
      refreshConversations().catch(error => {
        console.warn('❌ Auto-refresh failed:', error);
      });
    }
  }, [xmtpReady, refreshConversations, conversations.length]);

  // Clear errors when XMTP state changes
  useEffect(() => {
    if (xmtpReady && state.error) {
      setState(prev => ({ ...prev, error: null }));
    }
  }, [xmtpReady, state.error]);

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  const renderStatusIndicator = () => {
    if (xmtpInitializing) {
      return (
        <Alert className="mb-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <AlertDescription>
              Initializing messaging system...
            </AlertDescription>
          </div>
        </Alert>
      );
    }

    if (xmtpError) {
      return (
        <Alert variant="destructive" className="mb-4">
          <AlertCircleIcon className="w-4 h-4" />
          <AlertDescription>
            <div className="space-y-2">
              <div>Messaging system error: {xmtpError}</div>
              {state.retryCount < MAX_RETRY_COUNT && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetryOperation}
                  className="mt-2"
                >
                  <RefreshCwIcon className="w-3 h-3 mr-1" />
                  Retry ({state.retryCount + 1}/{MAX_RETRY_COUNT})
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    if (!isConnected) {
      return (
        <Alert className="mb-4">
          <AlertCircleIcon className="w-4 h-4" />
          <AlertDescription>
            Please connect your wallet to view and create groups.
          </AlertDescription>
        </Alert>
      );
    }

    if (state.error) {
      return (
        <Alert variant="destructive" className="mb-4">
          <AlertCircleIcon className="w-4 h-4" />
          <AlertDescription>
            <div className="space-y-2">
              <div>{state.error}</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setState(prev => ({ ...prev, error: null }))}
                className="mt-2"
              >
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  };

  const renderGroupCard = (group: GroupCardData, index: number) => (
    <div
      key={group.id}
      className="group p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-md transition-all duration-200 cursor-pointer bg-white"
      onClick={() => handleJoinGroup(group.id, group.name)}
      style={{ 
        animationDelay: `${index * CARD_ANIMATION_DELAY}ms`,
        animation: 'fadeInUp 0.5s ease-out forwards'
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-gray-900 truncate">
              {group.name}
            </h3>
            {group.hasActiveAgent && (
              <div className="w-2 h-2 bg-green-500 rounded-full" title="AI Agent Active" />
            )}
          </div>
          
          <p className="text-sm text-gray-600 line-clamp-2 mb-2">
            {group.description}
          </p>
          
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <UsersIcon className="w-3 h-3" />
              <span>{group.memberCount} member{group.memberCount !== 1 ? 's' : ''}</span>
            </div>
            
            <div className="flex items-center gap-1">
              <ClockIcon className="w-3 h-3" />
              <span>{getRelativeTime(group.lastActivity)}</span>
            </div>
            
            {group.isXMTPOnly && (
              <div className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                XMTP
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          {group.unreadCount && group.unreadCount > 0 && (
            <div className="w-5 h-5 bg-purple-500 text-white text-xs rounded-full flex items-center justify-center">
              {group.unreadCount > 9 ? '9+' : group.unreadCount}
            </div>
          )}
          
          <ArrowRightIcon className="w-4 h-4 text-gray-400 group-hover:text-purple-500 transition-colors" />
        </div>
      </div>
    </div>
  );

  const renderEmptyState = () => (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <MessageCircleIcon className="w-8 h-8 text-purple-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">No groups yet</h3>
      <p className="text-gray-600 mb-6 max-w-sm mx-auto">
        Create your first investment group to start coordinating with others and pooling resources for better opportunities.
      </p>
      {canCreateGroups && isOperational && (
        <Button 
          onClick={handleShowCreateFlow}
          className="bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          Create Your First Group
        </Button>
      )}
    </div>
  );

  const renderCreateButton = () => {
    if (!showCreateButton || !canCreateGroups || !isOperational) return null;

    return (
      <Button
        onClick={handleShowCreateFlow}
        disabled={isLoading || state.isRefreshing}
        className="bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white"
      >
        {isLoading || state.isRefreshing ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            Creating...
          </>
        ) : (
          <>
            <PlusIcon className="w-4 h-4 mr-2" />
            Create Group
          </>
        )}
      </Button>
    );
  };

  const renderGroupsList = () => (
    <div className="space-y-3">
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      
      {groupCards.map((group, index) => renderGroupCard(group, index))}
    </div>
  );

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Status indicators */}
      {renderStatusIndicator()}

      {/* Groups section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <UsersIcon className="w-5 h-5 mr-2 text-purple-600" />
              Your Investment Groups
              {hasGroups && (
                <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 text-sm rounded-full">
                  {groupCards.length}
                </span>
              )}
            </CardTitle>
            
            <div className="flex items-center gap-2">
              {hasGroups && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshGroups}
                  disabled={!canRefresh || state.isRefreshing}
                  className="text-gray-600"
                >
                  <RefreshCwIcon className={`w-4 h-4 ${state.isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              )}
              {renderCreateButton()}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {hasGroups ? renderGroupsList() : renderEmptyState()}
        </CardContent>
      </Card>

      {/* Operational status footer */}
      {isOperational && hasGroups && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <CheckCircleIcon className="w-4 h-4 text-green-500" />
          <span>Connected to secure messaging network</span>
          {address && (
            <span className="font-mono text-xs">
              ({formatAddress(address)})
            </span>
          )}
        </div>
      )}

      {/* Create Group Flow Modal */}
      <CreateGroupFlow
        isOpen={state.showCreateFlow}
        onClose={handleCloseCreateFlow}
        onGroupCreated={handleGroupCreated}
      />
    </div>
  );
}