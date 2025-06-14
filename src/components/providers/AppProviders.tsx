'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useXMTP } from '@/hooks/useXMTP';
import { useInvestmentAgent } from '@/hooks/useAgent';

interface AppState {
  isReady: boolean;
  initializationProgress: number;
  currentStep: string;
  error: string | null;
  retryCount: number;
  walletReady: boolean;
  xmtpReady: boolean;
  agentReady: boolean;
}

interface AppContextType extends AppState {
  retryInitialization: () => Promise<void>;
  clearError: () => void;
  resetXMTPDatabase: () => Promise<void>;
  wallet: ReturnType<typeof useWallet>;
  xmtp: ReturnType<typeof useXMTP>;
  agent: ReturnType<typeof useInvestmentAgent>;
}

const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProviders');
  }
  return context;
}

// Enhanced Error Boundary Component
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('🚨 App Error Boundary caught error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 text-sm font-bold">!</span>
                </div>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-red-800">
                  Application Error
                </h3>
              </div>
            </div>
            
            <div className="text-sm text-red-700 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </div>
            
            <div className="space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
              >
                Reload Application
              </button>
              
              <button
                onClick={() => {
                  // Clear localStorage and reload
                  localStorage.clear();
                  window.location.reload();
                }}
                className="w-full bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
              >
                Reset & Reload
              </button>
            </div>
            
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-600">
                  Error Details (Development)
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                  {this.state.error?.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Main AppProviders Component
export function AppProviders({ children }: { children: React.ReactNode }) {
  const wallet = useWallet();
  const xmtp = useXMTP();
  const agent = useInvestmentAgent();

  const [appState, setAppState] = useState<AppState>({
    isReady: false,
    initializationProgress: 0,
    currentStep: 'Initializing...',
    error: null,
    retryCount: 0,
    walletReady: false,
    xmtpReady: false,
    agentReady: false,
  });

  const clearError = useCallback(() => {
    setAppState(prev => ({ ...prev, error: null }));
    wallet.clearError();
    if (xmtp.clearError) xmtp.clearError();
    if (agent.clearError) agent.clearError();
  }, [wallet, xmtp, agent]);

  // Enhanced initialization status checking
  const checkInitializationStatus = useCallback(() => {
    console.log('🔍 Checking initialization status...');
    
    // Calculate component readiness
    const walletReady = wallet.isConnected && !wallet.error;
    const xmtpReady = wallet.isConnected ? xmtp.isInitialized && !xmtp.error : true; // Only require XMTP if wallet connected
    const agentReady = true; // Agent is optional for basic functionality
    
    // Calculate overall progress
    let progress = 0;
    let currentStep = 'Starting...';
    
    if (walletReady) {
      progress += 40;
      currentStep = 'Wallet connected';
    } else if (wallet.isConnecting) {
      progress = 20;
      currentStep = 'Connecting wallet...';
    } else {
      currentStep = 'Ready to connect wallet';
    }
    
    if (walletReady && xmtpReady) {
      progress += 40;
      currentStep = 'XMTP initialized';
    } else if (walletReady && xmtp.isInitializing) {
      progress += 20;
      currentStep = 'Initializing messaging...';
    }
    
    if (walletReady && xmtpReady && agentReady) {
      progress = 100;
      currentStep = 'Ready';
    }
    
    const isReady = walletReady && xmtpReady && agentReady;
    
    // Collect errors
    const errors: string[] = [];
    if (wallet.error) errors.push(`Wallet: ${wallet.error}`);
    if (xmtp.error) errors.push(`XMTP: ${xmtp.error}`);
    if (agent.error) errors.push(`Agent: ${agent.error}`);
    
    const hasNewError = errors.length > 0 && !appState.error;
    const errorCleared = errors.length === 0 && appState.error;
    
    setAppState(prev => ({
      ...prev,
      isReady,
      initializationProgress: progress,
      currentStep,
      walletReady,
      xmtpReady,
      agentReady,
      error: hasNewError ? errors.join('; ') : (errorCleared ? null : prev.error),
    }));
    
    console.log('📊 Initialization status:', {
      isReady,
      progress,
      currentStep,
      walletReady,
      xmtpReady,
      agentReady,
      errors: errors.length > 0 ? errors : 'none',
    });
  }, [
    wallet.isConnected,
    wallet.isConnecting,
    wallet.error,
    xmtp.isInitialized,
    xmtp.isInitializing,
    xmtp.error,
    agent.error,
    appState.error,
  ]);

  // Auto-initialize XMTP when wallet connects
  useEffect(() => {
    const initializeXMTP = async () => {
      if (wallet.isConnected && wallet.signer && !xmtp.isInitialized && !xmtp.isInitializing) {
        console.log('🚀 Auto-initializing XMTP...');
        try {
          await xmtp.initializeXMTP();
        } catch (error) {
          console.error('❌ Auto XMTP initialization failed:', error);
        }
      }
    };

    initializeXMTP();
  }, [wallet.isConnected, wallet.signer, xmtp.isInitialized, xmtp.isInitializing]);

  // Update status when dependencies change
  useEffect(() => {
    checkInitializationStatus();
  }, [checkInitializationStatus]);

  const retryInitialization = useCallback(async () => {
    console.log('🔄 Retrying initialization...');
    setAppState(prev => ({
      ...prev,
      retryCount: prev.retryCount + 1,
    }));
    
    clearError();
    
    try {
      // Retry wallet connection if needed
      if (!wallet.isConnected && !wallet.isConnecting) {
        console.log('🔄 Retrying wallet connection...');
        await wallet.connect();
      }
      
      // Retry XMTP if wallet is connected but XMTP failed
      if (wallet.isConnected && !xmtp.isInitialized && !xmtp.isInitializing) {
        console.log('🔄 Retrying XMTP initialization...');
        await xmtp.initializeXMTP();
      }
      
    } catch (error) {
      console.error('❌ Retry failed:', error);
      setAppState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Retry failed',
      }));
    }
  }, [wallet, xmtp, clearError]);

  const resetXMTPDatabase = useCallback(async () => {
    try {
      console.log('🔧 Resetting XMTP database...');
      if (xmtp.resetDatabase) {
        await xmtp.resetDatabase();
        console.log('✅ XMTP database reset completed');
      }
    } catch (error) {
      console.error('❌ XMTP database reset failed:', error);
      setAppState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Database reset failed',
      }));
    }
  }, [xmtp]);

  const contextValue: AppContextType = {
    ...appState,
    retryInitialization,
    clearError,
    resetXMTPDatabase,
    wallet,
    xmtp,
    agent,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

// Initialization Status Component
export function InitializationStatus() {
  const { 
    isReady, 
    initializationProgress, 
    currentStep, 
    error, 
    retryInitialization, 
    clearError,
    resetXMTPDatabase,
    walletReady,
    xmtpReady,
    agentReady,
    retryCount 
  } = useApp();

  if (isReady) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Initializing EchoFi</h2>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${initializationProgress}%` }}
            />
          </div>
          
          {/* Current Step */}
          <p className="text-gray-600 mb-4">{currentStep}</p>
          
          {/* Component Status */}
          <div className="space-y-2 mb-4">
            <div className={`flex items-center justify-between p-2 rounded ${walletReady ? 'bg-green-50' : 'bg-gray-50'}`}>
              <span>Wallet</span>
              <span className={walletReady ? 'text-green-600' : 'text-gray-500'}>
                {walletReady ? '✓' : '○'}
              </span>
            </div>
            <div className={`flex items-center justify-between p-2 rounded ${xmtpReady ? 'bg-green-50' : 'bg-gray-50'}`}>
              <span>Messaging (XMTP)</span>
              <span className={xmtpReady ? 'text-green-600' : 'text-gray-500'}>
                {xmtpReady ? '✓' : '○'}
              </span>
            </div>
            <div className={`flex items-center justify-between p-2 rounded ${agentReady ? 'bg-green-50' : 'bg-gray-50'}`}>
              <span>AI Agent</span>
              <span className={agentReady ? 'text-green-600' : 'text-gray-500'}>
                {agentReady ? '✓' : '○'}
              </span>
            </div>
          </div>
          
          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="space-y-2">
            {error && (
              <>
                <button
                  onClick={retryInitialization}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                >
                  Retry {retryCount > 0 && `(${retryCount})`}
                </button>
                
                {error.includes('XMTP') && (
                  <button
                    onClick={resetXMTPDatabase}
                    className="w-full bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 transition-colors"
                  >
                    Reset XMTP Database
                  </button>
                )}
                
                <button
                  onClick={clearError}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
                >
                  Continue with Errors
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}