'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useEnhancedXMTP } from '@/hooks/useXMTP-enhanced';
import { useInvestmentAgent } from '@/hooks/useAgent';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function InitializationDebug() {
  const [isVisible, setIsVisible] = useState(false);
  const [agentHealthCheck, setAgentHealthCheck] = useState<any>(null);
  
  const wallet = useWallet();
  const xmtp = useEnhancedXMTP();
  const agent = useInvestmentAgent();

  const checkAgentHealth = async () => {
    try {
      const response = await fetch('/api/agent', { method: 'GET' });
      const result = await response.json();
      setAgentHealthCheck(result);
      console.log('🏥 Agent Health Check:', result);
    } catch (error) {
      console.error('❌ Health check failed:', error);
      setAgentHealthCheck({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  useEffect(() => {
    // Auto-check agent health on mount
    checkAgentHealth();
  }, []);

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button 
          onClick={() => setIsVisible(true)}
          variant="outline"
          size="sm"
          className="bg-yellow-100 border-yellow-300 text-yellow-800 hover:bg-yellow-200"
        >
          🐛 Debug Info
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <Card className="bg-gray-900 text-white border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-gray-100">🐛 Debug Initialization</CardTitle>
            <Button 
              onClick={() => setIsVisible(false)}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white p-1"
            >
              ✕
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          {/* Wallet Status */}
          <div>
            <h4 className="font-medium text-blue-400 mb-1">Wallet</h4>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Connected:</span>
                <span className={wallet.isConnected ? 'text-green-400' : 'text-red-400'}>
                  {wallet.isConnected ? '✅' : '❌'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Address:</span>
                <span className="font-mono text-gray-300">
                  {wallet.address ? `${wallet.address.slice(0, 6)}...` : 'None'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Chain ID:</span>
                <span>{wallet.chainId || 'Unknown'}</span>
              </div>
            </div>
          </div>

          {/* XMTP Status */}
          <div>
            <h4 className="font-medium text-purple-400 mb-1">XMTP</h4>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Initialized:</span>
                <span className={xmtp.isInitialized ? 'text-green-400' : 'text-red-400'}>
                  {xmtp.isInitialized ? '✅' : '❌'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Initializing:</span>
                <span className={xmtp.isInitializing ? 'text-yellow-400' : 'text-gray-400'}>
                  {xmtp.isInitializing ? '🔄' : '⏸️'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Conversations:</span>
                <span>{xmtp.conversations.length}</span>
              </div>
              {xmtp.error && (
                <div className="text-red-400 text-xs break-words">
                  Error: {xmtp.error}
                </div>
              )}
            </div>
          </div>

          {/* Agent Status */}
          <div>
            <h4 className="font-medium text-orange-400 mb-1">Agent</h4>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Initialized:</span>
                <span className={agent.isInitialized ? 'text-green-400' : 'text-red-400'}>
                  {agent.isInitialized ? '✅' : '❌'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Initializing:</span>
                <span className={agent.isInitializing ? 'text-yellow-400' : 'text-gray-400'}>
                  {agent.isInitializing ? '🔄' : '⏸️'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Messages:</span>
                <span>N/A</span>
              </div>
              {agent.error && (
                <div className="text-red-400 text-xs break-words">
                  Error: {agent.error}
                </div>
              )}
            </div>
          </div>

          {/* Agent Health Check */}
          {agentHealthCheck && (
            <div>
              <h4 className="font-medium text-cyan-400 mb-1">Agent Health</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={
                    agentHealthCheck.status === 'healthy' ? 'text-green-400' : 
                    agentHealthCheck.status === 'configuration_needed' ? 'text-yellow-400' : 
                    'text-red-400'
                  }>
                    {agentHealthCheck.status}
                  </span>
                </div>
                {agentHealthCheck.initializationStatus && (
                  <>
                    <div className="flex justify-between">
                      <span>Server Init:</span>
                      <span className={agentHealthCheck.initializationStatus.isInitialized ? 'text-green-400' : 'text-red-400'}>
                        {agentHealthCheck.initializationStatus.isInitialized ? '✅' : '❌'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Attempt:</span>
                      <span className="text-gray-300">
                        {agentHealthCheck.initializationStatus.lastInitAttempt ? 
                          new Date(agentHealthCheck.initializationStatus.lastInitAttempt).toLocaleTimeString() : 
                          'Never'
                        }
                      </span>
                    </div>
                  </>
                )}
                {agentHealthCheck.error && (
                  <div className="text-red-400 text-xs break-words">
                    Error: {agentHealthCheck.error}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent Agent Messages */}
          {/* Removed agent.initializationMessages section as it is no longer available */}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button 
              onClick={checkAgentHealth}
              size="sm"
              variant="outline"
              className="flex-1 text-xs border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              🏥 Health
            </Button>
            <Button 
              onClick={() => agent.initializeAgent()}
              size="sm"
              variant="outline"
              className="flex-1 text-xs border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              🔄 Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}