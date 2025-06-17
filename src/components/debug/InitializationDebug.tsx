// FIXED: src/components/debug/InitializationDebug.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useXMTP } from '@/hooks/useXMTP';
import { useInvestmentAgent } from '@/hooks/useAgent';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AgentHealthCheck {
  status: 'healthy' | 'configuration_needed' | 'error';
  message?: string;
  error?: string;
  initializationStatus?: {
    isInitialized: boolean;
    lastInitAttempt?: string;
  };
  details?: {
    agentInitialized: boolean;
    environment: string;
    networkId: string;
    features: string[];
  };
}

interface ConnectionStateInfo {
  wallet: {
    connected: boolean;
    address: string | null;
    chainId: number | null;
    chainName: string;
    isConnecting: boolean;
    error: string | null;
  };
  xmtp: {
    initialized: boolean;
    initializing: boolean;
    conversations: number;
    phase: string;
    progress: number;
    currentOperation: string;
    error: string | null;
    databaseHealth: string | null;
  };
  agent: {
    initialized: boolean;
    initializing: boolean;
    error: string | null;
    serverStatus: string | null;
  };
}

export function InitializationDebug() {
  const [isVisible, setIsVisible] = useState(false);
  const [agentHealthCheck, setAgentHealthCheck] = useState<AgentHealthCheck | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const [connectionHistory, setConnectionHistory] = useState<string[]>([]);
  
  const wallet = useWallet();
  const xmtp = useXMTP();
  const agent = useInvestmentAgent();

  // FIXED: Connection history tracking - STABLE function
  const addToHistory = useCallback((event: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const entry = `${timestamp}: ${event}`;
    setConnectionHistory(prev => [entry, ...prev.slice(0, 9)]); // Keep last 10 entries
  }, []); // No dependencies needed - this function is self-contained

  // FIXED: Agent health check with proper dependencies
  const checkAgentHealth = useCallback(async () => {
    try {
      console.log('🏥 [DEBUG] Performing agent health check...');
      const response = await fetch('/api/agent', { 
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      setAgentHealthCheck(result);
      console.log('✅ [DEBUG] Agent health check completed:', result);
      
      // Add to connection history
      addToHistory(`Agent health: ${result.status}`);
      
    } catch (error) {
      console.error('❌ [DEBUG] Health check failed:', error);
      const errorResult: AgentHealthCheck = { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          agentInitialized: false,
          environment: process.env.NODE_ENV || 'unknown',
          networkId: wallet.chainId?.toString() || 'unknown',
          features: [],
        }
      };
      setAgentHealthCheck(errorResult);
      addToHistory(`Agent health check failed: ${errorResult.error}`);
    }
  }, [wallet.chainId, addToHistory]); // FIXED: Added addToHistory dependency

  // FIXED: Memoize connectionState to prevent dependency array changes
  const connectionState: ConnectionStateInfo = useMemo(() => ({
    wallet: {
      connected: wallet.isConnected,
      address: wallet.address,
      chainId: wallet.chainId,
      chainName: wallet.chainId === 8453 ? 'Base Mainnet' : 
                 wallet.chainId === 84532 ? 'Base Sepolia' : 
                 wallet.chainId === 1 ? 'Ethereum Mainnet' :
                 wallet.chainId === 11155111 ? 'Ethereum Sepolia' :
                 `Chain ${wallet.chainId}`,
      isConnecting: wallet.isConnecting,
      error: wallet.error,
    },
    xmtp: {
      initialized: xmtp.isInitialized,
      initializing: xmtp.isInitializing,
      conversations: xmtp.conversations.length,
      phase: xmtp.initializationState.phase,
      progress: xmtp.initializationState.progress,
      currentOperation: xmtp.initializationState.currentOperation,
      error: xmtp.error,
      databaseHealth: xmtp.databaseHealth?.isHealthy ? 'Healthy' : 
                     xmtp.databaseHealth?.sequenceIdStatus === 'corrupted' ? 'Corrupted' :
                     xmtp.databaseHealth?.sequenceIdStatus === 'missing' ? 'Missing' : 'Unknown',
    },
    agent: {
      initialized: agent.isInitialized,
      initializing: agent.isInitializing,
      error: agent.error,
      serverStatus: agentHealthCheck?.status || null,
    },
  }), [
    wallet.isConnected,
    wallet.address,
    wallet.chainId,
    wallet.isConnecting,
    wallet.error,
    xmtp.isInitialized,
    xmtp.isInitializing,
    xmtp.conversations.length,
    xmtp.initializationState.phase,
    xmtp.initializationState.progress,
    xmtp.initializationState.currentOperation,
    xmtp.error,
    xmtp.databaseHealth?.isHealthy,
    xmtp.databaseHealth?.sequenceIdStatus,
    agent.isInitialized,
    agent.isInitializing,
    agent.error,
    agentHealthCheck?.status,
  ]);

  // FIXED: Enhanced retry functions with proper error handling and dependencies
  const retryWallet = useCallback(async () => {
    try {
      addToHistory('Retrying wallet connection...');
      await wallet.connect();
      addToHistory('Wallet retry completed');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addToHistory(`Wallet retry failed: ${errorMsg}`);
    }
  }, [wallet.connect, addToHistory]); // FIXED: Added wallet dependency

  const retryXMTP = useCallback(async () => {
    try {
      addToHistory('Retrying XMTP initialization...');
      await xmtp.initializeXMTP();
      addToHistory('XMTP retry completed');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addToHistory(`XMTP retry failed: ${errorMsg}`);
    }
  }, [xmtp.initializeXMTP, addToHistory]); // FIXED: Added xmtp dependency

  const resetXMTPDatabase = useCallback(async () => {
    try {
      addToHistory('Resetting XMTP database...');
      await xmtp.resetDatabase();
      addToHistory('XMTP database reset completed');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addToHistory(`XMTP reset failed: ${errorMsg}`);
    }
  }, [xmtp.resetDatabase, addToHistory]); // FIXED: Added xmtp dependency

  const retryAgent = useCallback(async () => {
    try {
      addToHistory('Retrying agent initialization...');
      await agent.initializeAgent();
      await checkAgentHealth();
      addToHistory('Agent retry completed');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addToHistory(`Agent retry failed: ${errorMsg}`);
    }
  }, [agent.initializeAgent, checkAgentHealth, addToHistory]); // FIXED: Added agent dependency

  // FIXED: Enhanced monitoring with stable dependencies
  useEffect(() => {
    // Track significant state changes
    const currentTime = Date.now();
    const timeSinceLastUpdate = currentTime - lastUpdateTime;
    
    // Only log if significant time has passed or state has changed meaningfully
    if (timeSinceLastUpdate > 5000) { // 5 second minimum between logs
      console.log('🔍 [DEBUG] Current connection state:', connectionState);
      setLastUpdateTime(currentTime);
    }
    
    // Auto-check agent health on mount and when wallet connects
    if (wallet.isConnected && !agentHealthCheck) {
      checkAgentHealth();
    }
  }, [
    wallet.isConnected, 
    wallet.chainId, 
    xmtp.isInitialized, 
    xmtp.initializationState.phase,
    agent.isInitialized,
    lastUpdateTime,
    connectionState, // Now stable due to useMemo
    agentHealthCheck,
    checkAgentHealth, // Now stable due to useCallback
  ]);

  // Track connection state changes in history
  useEffect(() => {
    if (wallet.isConnected && wallet.address) {
      addToHistory(`Wallet connected: ${wallet.address} on ${connectionState.wallet.chainName}`);
    }
  }, [wallet.isConnected, wallet.address, wallet.chainId, connectionState.wallet.chainName, addToHistory]);

  useEffect(() => {
    if (xmtp.isInitialized) {
      addToHistory(`XMTP initialized: ${xmtp.conversations.length} conversations`);
    }
  }, [xmtp.isInitialized, xmtp.conversations.length, addToHistory]);

  // Compact button when not visible
  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button 
          onClick={() => setIsVisible(true)}
          variant="outline"
          size="sm"
          className="bg-blue-100 border-blue-300 text-blue-800 hover:bg-blue-200 shadow-lg"
        >
          🔧 Debug
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-lg">
      <Card className="bg-gray-900 text-white border-gray-700 shadow-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-gray-100">🔧 EchoFi Debug Panel</CardTitle>
            <div className="flex items-center space-x-2">
              <Button 
                onClick={checkAgentHealth}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white p-1"
                title="Refresh agent health"
              >
                🔄
              </Button>
              <Button 
                onClick={() => setIsVisible(false)}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white p-1"
              >
                ✕
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-xs max-h-96 overflow-y-auto">
          
          {/* Enhanced Wallet Status */}
          <div>
            <h4 className="font-medium text-blue-400 mb-2 flex items-center">
              💰 Wallet Status
              <span className={`ml-2 w-2 h-2 rounded-full ${
                connectionState.wallet.connected ? 'bg-green-400' : 
                connectionState.wallet.isConnecting ? 'bg-yellow-400' : 'bg-red-400'
              }`}></span>
            </h4>
            <div className="space-y-1 bg-gray-800 p-2 rounded">
              <div className="flex justify-between">
                <span>Connected:</span>
                <span className={connectionState.wallet.connected ? 'text-green-400' : 'text-red-400'}>
                  {connectionState.wallet.connected ? 'Yes' : 'No'}
                </span>
              </div>
              {connectionState.wallet.address && (
                <div className="flex justify-between">
                  <span>Address:</span>
                  <span className="text-blue-400 font-mono text-xs">
                    {connectionState.wallet.address.slice(0, 6)}...{connectionState.wallet.address.slice(-4)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Network:</span>
                <span className="text-gray-300">{connectionState.wallet.chainName}</span>
              </div>
              {connectionState.wallet.error && (
                <div className="text-red-400 text-xs mt-1">
                  Error: {connectionState.wallet.error}
                </div>
              )}
              {!connectionState.wallet.connected && (
                <div className="mt-2">
                  <Button 
                    onClick={retryWallet}
                    size="sm"
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Retry Connection
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* XMTP Status */}
          <div>
            <h4 className="font-medium text-purple-400 mb-2 flex items-center">
              💬 XMTP Status
              <span className={`ml-2 w-2 h-2 rounded-full ${
                connectionState.xmtp.initialized ? 'bg-green-400' : 
                connectionState.xmtp.initializing ? 'bg-yellow-400' : 'bg-red-400'
              }`}></span>
            </h4>
            <div className="space-y-1 bg-gray-800 p-2 rounded">
              <div className="flex justify-between">
                <span>Initialized:</span>
                <span className={connectionState.xmtp.initialized ? 'text-green-400' : 'text-red-400'}>
                  {connectionState.xmtp.initialized ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Phase:</span>
                <span className="text-gray-300">{connectionState.xmtp.phase}</span>
              </div>
              <div className="flex justify-between">
                <span>Progress:</span>
                <span className="text-gray-300">{connectionState.xmtp.progress}%</span>
              </div>
              <div className="flex justify-between">
                <span>Conversations:</span>
                <span className="text-gray-300">{connectionState.xmtp.conversations}</span>
              </div>
              <div className="flex justify-between">
                <span>DB Health:</span>
                <span className={
                  connectionState.xmtp.databaseHealth === 'Healthy' ? 'text-green-400' : 
                  connectionState.xmtp.databaseHealth === 'Corrupted' ? 'text-red-400' : 'text-yellow-400'
                }>
                  {connectionState.xmtp.databaseHealth}
                </span>
              </div>
              {connectionState.xmtp.error && (
                <div className="text-red-400 text-xs mt-1">
                  Error: {connectionState.xmtp.error}
                </div>
              )}
              <div className="mt-2 space-y-1">
                <Button 
                  onClick={retryXMTP}
                  size="sm"
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  disabled={connectionState.xmtp.initializing}
                >
                  Retry XMTP
                </Button>
                <Button 
                  onClick={resetXMTPDatabase}
                  size="sm"
                  variant="outline"
                  className="w-full border-red-400 text-red-400 hover:bg-red-400 hover:text-white"
                >
                  Reset Database
                </Button>
              </div>
            </div>
          </div>

          {/* Agent Status */}
          <div>
            <h4 className="font-medium text-green-400 mb-2 flex items-center">
              🤖 Agent Status
              <span className={`ml-2 w-2 h-2 rounded-full ${
                connectionState.agent.initialized ? 'bg-green-400' : 
                connectionState.agent.initializing ? 'bg-yellow-400' : 'bg-red-400'
              }`}></span>
            </h4>
            <div className="space-y-1 bg-gray-800 p-2 rounded">
              <div className="flex justify-between">
                <span>Initialized:</span>
                <span className={connectionState.agent.initialized ? 'text-green-400' : 'text-red-400'}>
                  {connectionState.agent.initialized ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Server Status:</span>
                <span className={
                  connectionState.agent.serverStatus === 'healthy' ? 'text-green-400' : 
                  connectionState.agent.serverStatus === 'error' ? 'text-red-400' : 'text-yellow-400'
                }>
                  {connectionState.agent.serverStatus || 'Unknown'}
                </span>
              </div>
              {connectionState.agent.error && (
                <div className="text-red-400 text-xs mt-1">
                  Error: {connectionState.agent.error}
                </div>
              )}
              <div className="mt-2">
                <Button 
                  onClick={retryAgent}
                  size="sm"
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={connectionState.agent.initializing}
                >
                  Retry Agent
                </Button>
              </div>
            </div>
          </div>

          {/* Connection History */}
          <div>
            <h4 className="font-medium text-gray-400 mb-2">📋 Connection History</h4>
            <div className="bg-gray-800 p-2 rounded max-h-32 overflow-y-auto">
              {connectionHistory.length > 0 ? (
                <div className="space-y-1">
                  {connectionHistory.map((entry, index) => (
                    <div key={index} className="text-xs text-gray-300 font-mono">
                      {entry}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">No connection events yet...</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}