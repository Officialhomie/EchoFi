'use client';

import { createContext, useContext, useCallback, useEffect, useMemo, useRef } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useXMTP } from '@/hooks/useXMTP';
import { useInvestmentAgent } from '@/hooks/useAgent';
import { useState } from 'react';
import React from 'react';
import { 
  AppState, 
  AppContextType, 
  AppProvidersProps, 
  ErrorBoundaryProps, 
  ErrorBoundaryState,
  InitializationStatus,
  GlobalState
} from '@/types/providers';

// =============================================================================
// CONTEXT CREATION
// =============================================================================

const AppContext = createContext<AppContextType | null>(null);

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProviders');
  }
  return context;
}

// =============================================================================
// ENHANCED APP PROVIDERS COMPONENT WITH STABLE STATE MANAGEMENT
// =============================================================================

export function AppProviders({ children }: AppProvidersProps) {
  const wallet = useWallet();
  const xmtp = useXMTP();
  const agent = useInvestmentAgent();

  // FIXED: Enhanced state management with connection tracking
  const [appState, setAppState] = useState<AppState>({
    isReady: false,
    initializationProgress: 0,
    currentStep: 'Waiting for wallet connection',
    error: null,
    retryCount: 0,
  });

  // FIXED: Connection state tracking to prevent duplicate initializations
  const [connectionStates, setConnectionStates] = useState({
    walletInitialized: false,
    xmtpInitialized: false,
    agentInitialized: false,
    lastWalletAddress: null as string | null,
    lastChainId: null as number | null,
  });

  // Refs to prevent multiple simultaneous operations and track state
  const initializationCheckInProgress = useRef(false);
  const xmtpInitializationInProgress = useRef(false);
  const lastErrorRef = useRef<string | null>(null);
  const stateUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear error function
  const clearError = useCallback(() => {
    setAppState(prev => ({
      ...prev,
      error: null,
    }));
    lastErrorRef.current = null;
  }, []);

  // FIXED: Memoized status calculation with connection state tracking
  const initializationStatus = useMemo<InitializationStatus>(() => {
    const walletReady = wallet.isConnected && !wallet.isConnecting && !wallet.error;
    const xmtpReady = xmtp.isInitialized && !xmtp.error;
    const agentReady = !agent.error;

    let progress = 0;
    let currentStep = 'Waiting for wallet connection';
    let isReady = false;

    if (walletReady) {
      progress = 33;
      currentStep = `Wallet connected (${wallet.chainId === 8453 ? 'Base Mainnet' : wallet.chainId === 84532 ? 'Base Sepolia' : `Chain ${wallet.chainId}`})`;

      if (xmtpReady) {
        progress = 66;
        currentStep = 'XMTP initialized and ready';

        if (agentReady) {
          progress = 100;
          currentStep = 'All systems ready';
          isReady = true;
        } else {
          currentStep = 'Initializing investment agent';
        }
      } else if (xmtp.isInitializing) {
        progress = 50;
        currentStep = 'Initializing secure messaging';
      } else {
        currentStep = 'Preparing secure messaging';
      }
    } else if (wallet.isConnecting) {
      progress = 16;
      currentStep = 'Connecting wallet';
    }

    return {
      isReady,
      progress,
      currentStep,
      walletReady,
      xmtpReady,
      agentReady,
    };
  }, [
    wallet.isConnected,
    wallet.isConnecting,
    wallet.error,
    wallet.chainId,
    xmtp.isInitialized,
    xmtp.isInitializing,
    xmtp.error,
    agent.error,
  ]);

  // FIXED: Debounced initialization check to prevent excessive state updates
  const checkInitializationStatus = useCallback(() => {
    if (initializationCheckInProgress.current) {
      return;
    }

    // Clear any existing timeout
    if (stateUpdateTimeoutRef.current) {
      clearTimeout(stateUpdateTimeoutRef.current);
    }

    // Debounce state updates to prevent rapid-fire changes
    stateUpdateTimeoutRef.current = setTimeout(() => {
      initializationCheckInProgress.current = true;

      try {
        const { isReady, progress, currentStep } = initializationStatus;

        // Collect errors with better categorization
        const errors: string[] = [];
        if (wallet.error) errors.push(`Wallet: ${wallet.error}`);
        if (xmtp.error) errors.push(`Messaging: ${xmtp.error}`);
        if (agent.error) errors.push(`Agent: ${agent.error}`);

        const currentError = errors.length > 0 ? errors.join('; ') : null;
        const errorChanged = currentError !== lastErrorRef.current;

        // Only update state if something meaningful changed
        setAppState(prev => {
          const shouldUpdate = 
            prev.isReady !== isReady ||
            Math.abs(prev.initializationProgress - progress) >= 5 || // Only update on significant progress changes
            prev.currentStep !== currentStep ||
            errorChanged;

          if (!shouldUpdate) {
            return prev;
          }

          return {
            ...prev,
            isReady,
            initializationProgress: progress,
            currentStep,
            error: currentError,
          };
        });

        // Update error reference
        if (errorChanged) {
          lastErrorRef.current = currentError;
        }

        // FIXED: Improved logging with reduced noise
        const globalState = global as GlobalState;
        if (errorChanged || Math.abs(progress - (globalState.lastLoggedProgress || 0)) >= 25) {
          console.log('📊 Initialization status update:', {
            isReady,
            progress: `${progress}%`,
            currentStep,
            walletReady: initializationStatus.walletReady,
            xmtpReady: initializationStatus.xmtpReady,
            agentReady: initializationStatus.agentReady,
            errors: errors.length > 0 ? errors : 'none',
          });
          globalState.lastLoggedProgress = progress;
        }
      } finally {
        initializationCheckInProgress.current = false;
      }
    }, 150); // 150ms debounce
  }, [initializationStatus, wallet.error, xmtp.error, agent.error]);

  //  Stable XMTP auto-initialization with connection state tracking
  useEffect(() => {
    const initializeXMTPWhenReady = async () => {
      // Check if wallet connection state has changed
      const walletAddressChanged = wallet.address !== connectionStates.lastWalletAddress;
      const chainIdChanged = wallet.chainId !== connectionStates.lastChainId;
      const connectionStateChanged = walletAddressChanged || chainIdChanged;

      if (
        wallet.isConnected && 
        wallet.signer && 
        wallet.chainId &&
        !xmtp.isInitialized && 
        !xmtp.isInitializing &&
        !xmtpInitializationInProgress.current &&
        (!connectionStates.xmtpInitialized || connectionStateChanged)
      ) {
        // Update connection state tracking
        setConnectionStates(prev => ({
          ...prev,
          walletInitialized: true,
          lastWalletAddress: wallet.address,
          lastChainId: wallet.chainId,
        }));

        xmtpInitializationInProgress.current = true;
        
        console.log('🚀 Auto-initializing XMTP for address:', wallet.address, 'on chain:', wallet.chainId);
        
        try {
          await xmtp.initializeXMTP();
          
          // Mark XMTP as successfully initialized
          setConnectionStates(prev => ({
            ...prev,
            xmtpInitialized: true,
          }));
          
          console.log('✅ XMTP auto-initialization completed successfully');
        } catch (error) {
          console.error('❌ Auto XMTP initialization failed:', error);
          
          // Reset initialization state to allow retry
          setConnectionStates(prev => ({
            ...prev,
            xmtpInitialized: false,
          }));
        } finally {
          xmtpInitializationInProgress.current = false;
        }
      }
    };

    initializeXMTPWhenReady();
  }, [
    wallet.isConnected, 
    wallet.signer, 
    wallet.address,
    wallet.chainId,
    xmtp.isInitialized, 
    xmtp.isInitializing, 
    xmtp.initializeXMTP,
    connectionStates.xmtpInitialized,
    connectionStates.lastWalletAddress,
    connectionStates.lastChainId,
  ]);

  // FIXED: Reset connection states when wallet disconnects
  useEffect(() => {
    if (!wallet.isConnected) {
      setConnectionStates(prev => ({
        ...prev,
        walletInitialized: false,
        xmtpInitialized: false,
        agentInitialized: false,
        lastWalletAddress: null,
        lastChainId: null,
      }));
      
      console.log('🔌 Wallet disconnected, resetting connection states');
    }
  }, [wallet.isConnected]);

  // FIXED: Throttled status checking with proper cleanup
  useEffect(() => {
    checkInitializationStatus();
    
    return () => {
      if (stateUpdateTimeoutRef.current) {
        clearTimeout(stateUpdateTimeoutRef.current);
        stateUpdateTimeoutRef.current = null;
      }
    };
  }, [checkInitializationStatus]);

  // FIXED: Enhanced retry initialization with connection state management
  const retryInitialization = useCallback(async () => {
    console.log('🔄 Retrying initialization...');
    setAppState(prev => ({
      ...prev,
      retryCount: prev.retryCount + 1,
    }));
    
    clearError();
    
    // Reset connection states to force re-initialization
    setConnectionStates({
      walletInitialized: false,
      xmtpInitialized: false,
      agentInitialized: false,
      lastWalletAddress: null,
      lastChainId: null,
    });
    
    try {
      // Retry wallet connection if needed
      if (!wallet.isConnected && !wallet.isConnecting) {
        console.log('🔄 Retrying wallet connection...');
        await wallet.connect();
      }
      
      // Wait a moment for wallet state to settle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // XMTP will auto-initialize via the effect above once wallet is ready
      
    } catch (error) {
      console.error('❌ Retry failed:', error);
      setAppState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Retry failed',
      }));
    }
  }, [clearError, wallet]);

  // FIXED: Enhanced XMTP database reset with state cleanup
  const resetXMTPDatabase = useCallback(async () => {
    try {
      console.log('🔧 Resetting XMTP database...');
      
      // Reset connection states
      setConnectionStates(prev => ({
        ...prev,
        xmtpInitialized: false,
      }));
      
      if (xmtp.resetDatabase) {
        await xmtp.resetDatabase();
        console.log('✅ XMTP database reset completed');
        
        // Force re-initialization after reset if wallet is connected
        if (wallet.isConnected && wallet.signer && wallet.chainId) {
          console.log('🔄 Re-initializing XMTP after database reset...');
          setTimeout(() => {
            setConnectionStates(prev => ({
              ...prev,
              xmtpInitialized: false, // Ensure re-initialization
            }));
          }, 1000);
        }
      }
    } catch (error) {
      console.error('❌ XMTP database reset failed:', error);
      setAppState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Database reset failed',
      }));
    }
  }, [xmtp, wallet]);

  // FIXED: Connection state monitoring for debugging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Connection states updated:', {
        walletInitialized: connectionStates.walletInitialized,
        xmtpInitialized: connectionStates.xmtpInitialized,
        lastWalletAddress: connectionStates.lastWalletAddress,
        lastChainId: connectionStates.lastChainId,
        walletConnected: wallet.isConnected,
        xmtpReady: xmtp.isInitialized,
      });
    }
  }, [connectionStates, wallet.isConnected, xmtp.isInitialized]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stateUpdateTimeoutRef.current) {
        clearTimeout(stateUpdateTimeoutRef.current);
      }
    };
  }, []);

  return (
    <AppContext.Provider value={{
      ...appState,
      retryInitialization,
      resetXMTPDatabase,
      clearError,
    }}>
      {children}
    </AppContext.Provider>
  );
}

// =============================================================================
// ERROR BOUNDARY COMPONENT - ENHANCED ERROR HANDLING
// =============================================================================

export class AppErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 App Error Boundary caught an error:', error);
    console.error('🔍 Error details:', errorInfo);
    
    // Enhanced error logging for debugging
    if (error.message.includes('XMTP') || error.message.includes('wallet')) {
      console.error('💡 This appears to be a wallet or XMTP related error. Try:');
      console.error('   1. Disconnecting and reconnecting your wallet');
      console.error('   2. Refreshing the page');
      console.error('   3. Clearing browser storage if the issue persists');
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    
    // Clear any stored error states
    if (typeof window !== 'undefined') {
      try {
        // Clear any error-related storage
        const errorKeys = Object.keys(localStorage).filter(key => 
          key.includes('error') || key.includes('failed')
        );
        errorKeys.forEach(key => localStorage.removeItem(key));
      } catch (error) {
        console.warn('Failed to clear error storage:', error);
      }
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
          <div className="max-w-md w-full bg-white border border-red-200 rounded-lg shadow-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.084 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-red-800">Application Error</h2>
            </div>
            
            <div className="mb-4">
              <p className="text-red-700 mb-2">
                Something went wrong with the application. This might be related to wallet connection or messaging initialization.
              </p>
              
              {this.state.error && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-red-600 hover:text-red-800">
                    Technical Details
                  </summary>
                  <pre className="mt-2 text-xs bg-red-50 p-3 rounded border overflow-auto max-h-32 text-red-800">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={this.handleRetry}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 border border-red-300 text-red-700 px-4 py-2 rounded-md hover:bg-red-50 transition-colors"
              >
                Reload Page
              </button>
            </div>
            
            <p className="text-xs text-red-600 mt-4 text-center">
              If this error persists, try clearing your browser data or switching wallets.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}