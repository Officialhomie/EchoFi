// src/app/page.tsx - Updated with Enhanced XMTP
'use client';

import { useState, useEffect } from 'react';
import { ConnectWallet, WalletStatus } from '@/components/wallet/ConnectWallet';
import { InvestmentGroup } from '@/components/investment/InvestmentGroup';
import { GroupManager } from '@/components/groups/GroupManager';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { InitializationProgress } from '@/components/xmtp/InitializationProgress';
import { InitializationDebug } from '@/components/debug/InitializationDebug';
import { useWallet } from '@/hooks/useWallet';
import { useEnhancedXMTP } from '@/hooks/useXMTP-enhanced';
import { useApp } from '@/components/providers/AppProviders';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { GlobalLoading, LoadingSpinner } from '@/components/providers/AppProviders';
import { NotificationToast } from '@/components/ui/NotificationToast';

type ViewMode = 'dashboard' | 'groups' | 'group-detail' | 'welcome';

export default function HomePage() {
  const { isConnected, address } = useWallet();
  const { 
    client, 
    createGroup, 
    isInitialized: xmtpInitialized,
    initializationState,
    isInitializing,
    error: xmtpError,
    resetDatabase,
    performHealthCheck,
    initializeXMTP,
    clearError
  } = useEnhancedXMTP();
  const { isInitialized, error, clearError: clearAppError, initializationProgress } = useApp();
  
  const [viewMode, setViewMode] = useState<ViewMode>('welcome');
  const [currentGroup, setCurrentGroup] = useState<{ id: string; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Debug: Log initialization status changes
  useEffect(() => {
    console.log('📱 [ENHANCED] Page: Initialization status changed:', {
      isConnected,
      xmtpInitialized,
      isInitialized,
      initializationProgress: `${initializationProgress}%`,
      error: error || xmtpError,
      viewMode,
      initializationState: initializationState.phase
    });
  }, [isConnected, xmtpInitialized, isInitialized, initializationProgress, error, xmtpError, viewMode, initializationState]);

  // Update view mode based on connection status
  useEffect(() => {
    if (!isConnected) {
      setViewMode('welcome');
      setCurrentGroup(null);
      console.log('📱 [ENHANCED] Page: Switching to welcome (wallet not connected)');
    } else if (isConnected && xmtpInitialized && isInitialized && viewMode === 'welcome') {
      console.log('📱 [ENHANCED] Page: Switching to dashboard (all systems ready)');
      setViewMode('dashboard');
    }
  }, [isConnected, xmtpInitialized, isInitialized, viewMode]);

  // Show notification for errors
  useEffect(() => {
    if (error || xmtpError) {
      setNotification({ type: 'error', message: error || xmtpError || 'Unknown error' });
    }
  }, [error, xmtpError]);

  const handleCreateGroup = async (groupData: { name: string; description: string; members: string[] }) => {
    if (!client || !address) return;

    setIsLoading(true);
    try {
      console.log('🔄 [ENHANCED] Creating group with data:', {
        name: groupData.name,
        description: groupData.description,
        members: groupData.members,
        memberCount: groupData.members.length
      });

      // Use enhanced group creation
      const group = await createGroup(groupData.name, groupData.description, groupData.members);
      
      setCurrentGroup({ id: group.id, name: groupData.name });
      setViewMode('group-detail');
      setNotification({ type: 'success', message: `Group "${groupData.name}" created successfully!` });
    } catch (err) {
      console.error('❌ [ENHANCED] Group creation error:', err);
      const message = err instanceof Error ? err.message : 'Failed to create group';
      setNotification({ type: 'error', message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinGroup = (groupId: string, groupName: string) => {
    setCurrentGroup({ id: groupId, name: groupName });
    setViewMode('group-detail');
  };

  const handleBackToDashboard = () => {
    setCurrentGroup(null);
    setViewMode('dashboard');
  };

  // Force bypass loading screen for debugging (only in development)
  const [debugBypass, setDebugBypass] = useState(false);
  const shouldShowLoading = isConnected && !isInitialized && !debugBypass;

  // Show enhanced loading screen during initialization
  if (shouldShowLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <InitializationProgress
          initializationState={initializationState}
          isInitializing={isInitializing}
          error={xmtpError}
          onRetry={initializeXMTP}
          onResetDatabase={resetDatabase}
          onPerformHealthCheck={performHealthCheck}
        />
        
        {/* Debug component overlay */}
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed top-4 left-4 z-50">
            <Card className="bg-yellow-100 border-yellow-300">
              <CardContent className="p-3">
                <p className="text-xs text-yellow-800 mb-2">Debug Mode</p>
                <Button 
                  size="sm" 
                  onClick={() => setDebugBypass(true)}
                  className="text-xs"
                >
                  Skip Loading Screen
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // Welcome screen for non-connected users
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome to EchoFi
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Decentralized Investment Coordination Platform
            </p>
            <p className="text-gray-500 mb-8">
              Connect your wallet to start creating investment groups and coordinating with others.
            </p>
            <ConnectWallet />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-gray-900">EchoFi</h1>
              
              <nav className="hidden md:flex space-x-4">
                <Button
                  variant={viewMode === 'dashboard' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('dashboard')}
                >
                  Dashboard
                </Button>
                <Button
                  variant={viewMode === 'groups' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('groups')}
                >
                  Groups
                </Button>
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <WalletStatus />
              {currentGroup && (
                <Button variant="outline" onClick={handleBackToDashboard}>
                  ← Back
                </Button>
              )}
              
              {/* Show initialization status in header if not fully ready */}
              {(debugBypass || !isInitialized) && (
                <div className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                  Init: {initializationProgress}%
                </div>
              )}

              {/* Show XMTP status */}
              {isInitialized && (
                <div className={`text-xs px-2 py-1 rounded ${
                  xmtpInitialized 
                    ? 'text-green-600 bg-green-100' 
                    : isInitializing
                      ? 'text-orange-600 bg-orange-100'
                      : 'text-red-600 bg-red-100'
                }`}>
                  XMTP: {xmtpInitialized ? 'Ready' : isInitializing ? 'Initializing' : 'Error'}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {viewMode === 'dashboard' && (
          <Dashboard 
            onViewGroups={() => setViewMode('groups')}
            onJoinGroup={handleJoinGroup}
          />
        )}

        {viewMode === 'groups' && (
          <GroupManager
            onCreateGroup={handleCreateGroup}
            onJoinGroup={handleJoinGroup}
            isLoading={isLoading}
          />
        )}

        {viewMode === 'group-detail' && currentGroup && (
          <InvestmentGroup 
            groupId={currentGroup.id} 
            groupName={currentGroup.name}
          />
        )}

        {isLoading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
              <LoadingSpinner />
              <span>Processing...</span>
            </div>
          </div>
        )}
      </main>

      {/* Debug Component (only in development) */}
      {process.env.NODE_ENV === 'development' && <InitializationDebug />}

      {/* Notifications */}
      {notification && (
        <NotificationToast
          type={notification.type}
          message={notification.message}
          onClose={() => {
            setNotification(null);
            if (notification.type === 'error') {
              clearError();
              clearAppError();
            }
          }}
        />
      )}
    </div>
  );
}