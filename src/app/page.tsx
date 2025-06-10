// src/app/page.tsx - Updated with debug component
'use client';

import { useState, useEffect } from 'react';
import { ConnectWallet, WalletStatus } from '@/components/wallet/ConnectWallet';
import { InvestmentGroup } from '@/components/investment/InvestmentGroup';
import { GroupManager } from '@/components/groups/GroupManager';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { InitializationDebug } from '@/components/debug/InitializationDebug';
import { useWallet } from '@/hooks/useWallet';
import { useXMTP } from '@/hooks/useXMTP';
import { useApp } from '@/components/providers/AppProviders';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { GlobalLoading, LoadingSpinner } from '@/components/providers/AppProviders';
import { NotificationToast } from '@/components/ui/NotificationToast';

type ViewMode = 'dashboard' | 'groups' | 'group-detail' | 'welcome';

export default function HomePage() {
  const { isConnected, address } = useWallet();
  const { client, createGroup, isInitialized: xmtpInitialized } = useXMTP();
  const { isInitialized, error, clearError, initializationProgress } = useApp();
  
  const [viewMode, setViewMode] = useState<ViewMode>('welcome');
  const [currentGroup, setCurrentGroup] = useState<{ id: string; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Debug: Log initialization status changes
  useEffect(() => {
    console.log('📱 Page: Initialization status changed:', {
      isConnected,
      xmtpInitialized,
      isInitialized,
      initializationProgress: `${initializationProgress}%`,
      error,
      viewMode
    });
  }, [isConnected, xmtpInitialized, isInitialized, initializationProgress, error, viewMode]);

  // Update view mode based on connection status
  useEffect(() => {
    if (!isConnected) {
      setViewMode('welcome');
      setCurrentGroup(null);
      console.log('📱 Page: Switching to welcome (wallet not connected)');
    } else if (isConnected && xmtpInitialized && isInitialized && viewMode === 'welcome') {
      console.log('📱 Page: Switching to dashboard (all systems ready)');
      setViewMode('dashboard');
    }
  }, [isConnected, xmtpInitialized, isInitialized, viewMode]);

  // Show notification for errors
  useEffect(() => {
    if (error) {
      setNotification({ type: 'error', message: error });
    }
  }, [error]);

  const handleCreateGroup = async (groupData: { name: string; description: string; members: string[] }) => {
    if (!client || !address) return;

    setIsLoading(true);
    try {
      console.log('Creating group with data:', {
        name: groupData.name,
        description: groupData.description,
        members: groupData.members,
        memberCount: groupData.members.length
      });

      // In XMTP v3, don't include your own address - the creator is automatically included
      // Only pass the additional members
      const group = await createGroup(groupData.name, groupData.description, groupData.members);
      
      setCurrentGroup({ id: group.id, name: groupData.name });
      setViewMode('group-detail');
      setNotification({ type: 'success', message: `Group "${groupData.name}" created successfully!` });
    } catch (err) {
      console.error('Group creation error:', err);
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

  // Show loading screen during initialization
  if (shouldShowLoading) {
    return (
      <>
        <GlobalLoading />
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
        <InitializationDebug />
      </>
    );
  }

  // Welcome screen for non-connected users
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="container mx-auto px-4 py-16">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="mb-8">
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
                Welcome to <span className="text-blue-600">EchoFi</span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                Transform group chats into investment DAOs with AI-powered execution
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto mb-12">
              <div className="text-center p-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">💬</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">Chat & Coordinate</h3>
                <p className="text-gray-600">Create investment groups and coordinate with friends through XMTP messaging</p>
              </div>
              
              <div className="text-center p-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🗳️</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">Propose & Vote</h3>
                <p className="text-gray-600">Submit investment proposals and vote democratically on group decisions</p>
              </div>
              
              <div className="text-center p-6">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🤖</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">AI Execution</h3>
                <p className="text-gray-600">Let AI agents execute approved strategies automatically on DeFi protocols</p>
              </div>
            </div>
          </div>

          {/* Connection Card */}
          <div className="max-w-md mx-auto">
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl text-gray-900">Get Started</CardTitle>
                <p className="text-gray-600">Connect your wallet to begin</p>
              </CardHeader>
              <CardContent>
                <ConnectWallet />
                
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-3">Features</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>
                      Decentralized group messaging
                    </li>
                    <li className="flex items-center">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>
                      Democratic investment voting
                    </li>
                    <li className="flex items-center">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>
                      AI-powered DeFi execution
                    </li>
                    <li className="flex items-center">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>
                      Portfolio tracking & analytics
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        {/* Debug component for welcome screen too */}
        {process.env.NODE_ENV === 'development' && <InitializationDebug />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 
                className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                onClick={handleBackToDashboard}
              >
                EchoFi
              </h1>
              
              {/* Navigation */}
              <nav className="hidden md:flex items-center space-x-4">
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
            }
          }}
        />
      )}
    </div>
  );
}