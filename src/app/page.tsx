'use client';

import { useState, useEffect, useMemo } from 'react';
import { ConnectWallet } from '@/components/wallet/ConnectWallet';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { Logo } from '@/components/ui/Logo'; 
import { useWallet } from '@/hooks/useWallet';
import { useXMTP } from '@/hooks/useXMTP';
import { useApp } from '@/components/providers/AppProviders';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { Progress } from '@/components/ui/progress';

type ViewMode = 'dashboard' | 'groups' | 'group-detail' | 'welcome';

export default function HomePage() {
  const { isConnected } = useWallet();
  const { 
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

  // Show welcome screen if not connected - NOW WITH INTEGRATED LOGO
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg shadow-xl border-0"> {/* Made slightly wider to accommodate logo */}
          <CardContent className="p-8 text-center"> {/* Increased padding for better spacing */}
            
            {/* Logo Integration - Primary Brand Presence */}
            <div className="mb-8"> {/* Generous spacing below logo */}
              <Logo 
                size="lg" 
                showTagline={true} 
                animated={true}
                className="mx-auto" 
              />
            </div>
            
            {/* Welcome messaging - positioned after logo for proper hierarchy */}
            <div className="space-y-4 mb-8">
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome to the Future of Group Investment
              </h1>
              <p className="text-gray-600 text-lg leading-relaxed">
                Transform your group conversations into coordinated investment strategies with 
                secure messaging and AI-powered execution.
              </p>
            </div>
            
            {/* Call to action - clear next step for users */}
            <div className="space-y-4">
              <p className="text-sm text-gray-500 font-medium">
                Connect your wallet to get started
              </p>
              <ConnectWallet />
            </div>
            
            {/* Trust indicators - important for financial applications */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-center space-x-6 text-xs text-gray-400">
                <span className="flex items-center">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                  XMTP Encrypted
                </span>
                <span className="flex items-center">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                  Base Network
                </span>
                <span className="flex items-center">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mr-2"></div>
                  AI Powered
                </span>
              </div>
            </div>
            
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show dashboard when everything is initialized - logo will appear in Dashboard component
  if (xmtpInitialized && appInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <Dashboard onViewGroups={() => setViewMode('groups')} onJoinGroup={handleJoinGroup} />
      </div>
    );
  }

  // Show loading state while initializing - simplified logo for loading context
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center">
          
          {/* Compact logo for loading state - no tagline to keep focus on progress */}
          <div className="mb-6">
            <Logo 
              size="md" 
              showTagline={false} 
              animated={false}
              className="mx-auto opacity-75" 
            />
          </div>
          
          <h2 className="text-xl font-semibold mb-4">Setting Up Your Investment Hub</h2>
          <p className="text-sm text-gray-600 mb-4">{getInitializationPhase}</p>
          <Progress value={effectiveProgress} className="mb-6" />
          
          {/* Loading state trust indicators */}
          <p className="text-xs text-gray-400">
            Establishing secure connections...
          </p>
          
        </CardContent>
      </Card>
    </div>
  );
}