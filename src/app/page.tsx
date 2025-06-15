'use client';

import { useState, useEffect, useMemo } from 'react';
import { ConnectWallet } from '@/components/wallet/ConnectWallet';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { useWallet } from '@/hooks/useWallet';
import { useXMTP } from '@/hooks/useXMTP';
import { useApp } from '@/components/providers/AppProviders';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { Progress } from '@/components/ui/progress';

type ViewMode = 'dashboard' | 'groups' | 'group-detail' | 'welcome';

export default function HomePage() {
  const { isConnected, address } = useWallet();
  const { 
    client,
    createGroup,
    isInitialized: xmtpInitialized,
    initializationState,
    error: xmtpError,
    resetDatabase,
    performHealthCheck,
    initializeXMTP,
  } = useXMTP();
  const { isReady: appInitialized, error: appError, initializationProgress } = useApp();
  
  const [viewMode, setViewMode] = useState<ViewMode>('welcome');
  const [, setCurrentGroup] = useState<{ id: string; name: string } | null>(null);
  const [, setIsLoading] = useState(false);
  const [, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // FIXED: Memoize the initializationState.phase to prevent object recreation
  const initializationPhase = useMemo(() => initializationState.phase, [initializationState.phase]);
  const currentOperation = useMemo(() => initializationState.currentOperation, [initializationState.currentOperation]);
  const initializationProgress_stable = useMemo(() => initializationState.progress, [initializationState.progress]);

  // FIXED: Debug logging with stable dependencies
  useEffect(() => {
    console.log('📱 [FIXED] Page: Initialization status changed:', {
      isConnected,
      xmtpInitialized,
      appInitialized,
      initializationProgress: `${initializationProgress}%`,
      error: appError || xmtpError,
      viewMode,
      initializationPhase, // Using memoized value instead of full object
      currentOperation,
      xmtpProgress: initializationProgress_stable
    });
  }, [
    isConnected, 
    xmtpInitialized, 
    appInitialized, 
    initializationProgress, 
    appError, 
    xmtpError, 
    viewMode, 
    initializationPhase, // Stable reference
    currentOperation,
    initializationProgress_stable
  ]);

  // FIXED: Proper dependency management for view mode updates
  useEffect(() => {
    if (!isConnected) {
      setViewMode('welcome');
      setCurrentGroup(null);
      console.log('📱 [FIXED] Page: Switching to welcome (wallet not connected)');
    } else if (isConnected && xmtpInitialized && appInitialized && viewMode === 'welcome') {
      console.log('📱 [FIXED] Page: Switching to dashboard (all systems ready)');
      setViewMode('dashboard');
    }
  }, [isConnected, xmtpInitialized, appInitialized, viewMode]);

  // FIXED: Error notification handling with stable dependencies
  useEffect(() => {
    const errorMessage = appError || xmtpError;
    if (errorMessage) {
      setNotification({ type: 'error', message: errorMessage });
    }
  }, [appError, xmtpError]);

  // const handleCreateGroup = async (groupData: { name: string; description: string; members: string[] }) => {
  //   if (!client || !address) return;

  //   setIsLoading(true);
  //   try {
  //     console.log('🔄 [FIXED] Creating group with data:', {
  //       name: groupData.name,
  //       description: groupData.description,
  //       members: groupData.members,
  //       memberCount: groupData.members.length
  //     });

  //     // Use enhanced group creation
  //     const group = await createGroup(groupData.name, groupData.description, groupData.members);
      
  //     setCurrentGroup({ id: group.id, name: groupData.name });
  //     setViewMode('group-detail');
  //     setNotification({ type: 'success', message: `Group "${groupData.name}" created successfully!` });
  //   } catch (err) {
  //     console.error('❌ [FIXED] Group creation error:', err);
  //     const message = err instanceof Error ? err.message : 'Failed to create group';
  //     setNotification({ type: 'error', message });
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  const handleJoinGroup = (groupId: string, groupName: string) => {
    setCurrentGroup({ id: groupId, name: groupName });
    setViewMode('group-detail');
  };


  // Force bypass loading screen for debugging (only in development)
  const [debugBypass,] = useState(false);
  const shouldShowLoading = isConnected && !appInitialized && !debugBypass;

  // FIXED: Memoized initialization phase getter
  const getInitializationPhase = useMemo(() => {
    switch (initializationPhase) {
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
        return currentOperation || 'Initializing...';
    }
  }, [initializationPhase, currentOperation]);

  // Updated progress calculation for consistency
  const effectiveProgress = useMemo(() => {
    return Math.max(initializationProgress, initializationProgress_stable);
  }, [initializationProgress, initializationProgress_stable]);

  // Enhanced health check handler
  const handleHealthCheck = async () => {
    try {
      const report = await performHealthCheck();
      console.log('🔍 [FIXED] Database Health Report:', {
        isHealthy: report.isHealthy,
        issues: report.issues,
        recommendations: report.recommendations,
        sequenceIdStatus: report.sequenceIdStatus,
        lastSyncTimestamp: report.lastSyncTimestamp
      });
    } catch (error) {
      console.error('❌ [FIXED] Health check failed:', error);
    }
  };

  // Show enhanced loading screen during initialization
  if (shouldShowLoading) {
    return (
      <LoadingScreen
        progress={effectiveProgress}
        currentPhase={getInitializationPhase}
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
          <p className="text-sm text-gray-600 mb-4">{getInitializationPhase}</p>
          <Progress value={effectiveProgress} className="mb-6" />
        </CardContent>
      </Card>
    </div>
  );
}