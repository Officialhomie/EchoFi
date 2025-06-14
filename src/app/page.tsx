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
import { useXMTP } from '@/hooks/useXMTP';
import { useApp } from '@/components/providers/AppProviders';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { NotificationToast } from '@/components/ui/NotificationToast';
import { Progress } from '@/components/ui/progress';

type ViewMode = 'dashboard' | 'groups' | 'group-detail' | 'welcome';

export default function HomePage() {
  const { isConnected, address } = useWallet();
  const { 
    client,
    createGroup,
    isInitialized: xmtpInitialized,
    isInitializing,
    initializationState,
    error: xmtpError,
    resetDatabase,
    performHealthCheck,
    initializeXMTP,
    clearError: clearXMTPError
  } = useXMTP();
  const { isReady: appInitialized, error: appError, clearError: clearAppError, initializationProgress } = useApp();
  
  const [viewMode, setViewMode] = useState<ViewMode>('welcome');
  const [currentGroup, setCurrentGroup] = useState<{ id: string; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Debug: Log initialization status changes
  useEffect(() => {
    console.log('📱 [ENHANCED] Page: Initialization status changed:', {
      isConnected,
      xmtpInitialized,
      appInitialized,
      initializationProgress: `${initializationProgress}%`,
      error: appError || xmtpError,
      viewMode,
      initializationState: initializationState.phase
    });
  }, [isConnected, xmtpInitialized, appInitialized, initializationProgress, appError, xmtpError, viewMode, initializationState]);

  // Update view mode based on connection status
  useEffect(() => {
    if (!isConnected) {
      setViewMode('welcome');
      setCurrentGroup(null);
      console.log('📱 [ENHANCED] Page: Switching to welcome (wallet not connected)');
    } else if (isConnected && xmtpInitialized && appInitialized && viewMode === 'welcome') {
      console.log('📱 [ENHANCED] Page: Switching to dashboard (all systems ready)');
      setViewMode('dashboard');
    }
  }, [isConnected, xmtpInitialized, appInitialized, viewMode]);

  // Show notification for errors
  useEffect(() => {
    if (appError || xmtpError) {
      setNotification({ type: 'error', message: appError || xmtpError || 'Unknown error' });
    }
  }, [appError, xmtpError]);

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
  const shouldShowLoading = isConnected && !appInitialized && !debugBypass;

  // Update initialization progress display to match new phases
  const getInitializationPhase = () => {
    switch (initializationState.phase) {
      case 'starting':
        return 'Starting XMTP client...';
      case 'connecting':
        return 'Connecting to XMTP network...';
      case 'syncing':
        return 'Synchronizing messages...';
      case 'ready':
        return 'XMTP client ready';
      case 'failed':
        return 'Initialization failed';
      default:
        return 'Unknown state';
    }
  };

  // Update health check display to match new report structure
  const handleHealthCheck = async () => {
    try {
      const report = await performHealthCheck();
      console.log('Database Health Report:', {
        isHealthy: report.isHealthy,
        issues: report.issues,
        recommendations: report.recommendations,
        sequenceIdStatus: report.sequenceIdStatus,
        lastSyncTimestamp: report.lastSyncTimestamp
      });
    } catch (error) {
      console.error('Health check failed:', error);
    }
  };

  // Show enhanced loading screen during initialization
  if (shouldShowLoading) {
    return (
      <LoadingScreen
        progress={initializationProgress}
        currentPhase={getInitializationPhase()}
        onRetry={initializeXMTP}
        onResetDatabase={resetDatabase}
        onPerformHealthCheck={handleHealthCheck}
      />
    );
  }

  // Show welcome screen if not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h1 className="text-2xl font-bold mb-4">Welcome to EchoFi</h1>
            <p className="text-gray-600 mb-6">Connect your wallet to get started</p>
            <ConnectWallet />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show dashboard when everything is initialized
  if (xmtpInitialized && appInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <Dashboard onViewGroups={() => setViewMode('groups')} onJoinGroup={handleJoinGroup} />
      </div>
    );
  }

  // Show loading state while initializing
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center">
          <h2 className="text-xl font-semibold mb-4">Initializing...</h2>
          <p className="text-sm text-gray-600 mb-4">{getInitializationPhase()}</p>
          <Progress value={initializationProgress} className="mb-6" />
        </CardContent>
      </Card>
    </div>
  );
}