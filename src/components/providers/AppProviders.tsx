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

// Enhanced state tracking for user interactions
interface UserInteractionState {
  hasRejectedXMTPSignature: boolean;
  lastRejectionTime: number | null;
  autoRetryAttempts: number;
  maxAutoRetryAttempts: number;
  lastAutoRetryTime: number | null;
  manualRetryRequested: boolean;
}

// Context creation
const AppContext = createContext<AppContextType | null>(null);

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProviders');
  }
  return context;
}

// FIXED: App Providers with enhanced error state clearing
export function AppProviders({ children }: AppProvidersProps) {
  const wallet = useWallet();
  const xmtp = useXMTP();
  const agent = useInvestmentAgent();

  // Enhanced state management with user interaction tracking
  const [appState, setAppState] = useState<AppState>({
    isReady: false,
    initializationProgress: 0,
    currentStep: 'Waiting for wallet connection',
    error: null,
    retryCount: 0,
  });

  // Track user interactions to prevent signature loops
  const [userInteraction, setUserInteraction] = useState<UserInteractionState>({
    hasRejectedXMTPSignature: false,
    lastRejectionTime: null,
    autoRetryAttempts: 0,
    maxAutoRetryAttempts: 2,
    lastAutoRetryTime: null,
    manualRetryRequested: false,
  });

  // Connection state tracking to prevent duplicate initializations
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
  
  // ADDED: Track success states to trigger error clearing
  const lastSuccessStatesRef = useRef({
    xmtpInitialized: false,
    walletConnected: false,
  });

  // Clear error function
  const clearError = useCallback(() => {
    setAppState(prev => ({
      ...prev,
      error: null,
    }));
    lastErrorRef.current = null;
  }, []);

  // FIXED: Enhanced status calculation with automatic error clearing on success
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
      } else if (userInteraction.hasRejectedXMTPSignature) {
        progress = 45;
        currentStep = 'Waiting for user to approve secure messaging';
      } else {
        currentStep = 'Preparing secure messaging';
      }
    } else if (wallet.isConnecting) {
      progress = 16;
      currentStep = 'Connecting wallet';
    }

    // CRITICAL FIX: Detect success state changes and trigger error clearing
    const currentSuccessStates = {
      xmtpInitialized: xmtpReady,
      walletConnected: walletReady,
    };

    const xmtpJustSucceeded = !lastSuccessStatesRef.current.xmtpInitialized && currentSuccessStates.xmtpInitialized;
    const walletJustConnected = !lastSuccessStatesRef.current.walletConnected && currentSuccessStates.walletConnected;

    if (xmtpJustSucceeded || walletJustConnected) {
      console.log('✅ [PROVIDERS] Success state detected, clearing errors:', {
        xmtpJustSucceeded,
        walletJustConnected,
        xmtpReady,
        walletReady
      });
      
      // Schedule error clearing on next tick to ensure state updates properly
      setTimeout(() => {
        setAppState(prev => {
          if (prev.error) {
            console.log('🧹 [PROVIDERS] Automatically clearing error after success:', prev.error);
            return {
              ...prev,
              error: null,
            };
          }
          return prev;
        });
        
        // Reset user interaction state on success
        if (xmtpJustSucceeded) {
          setUserInteraction(prev => ({
            ...prev,
            hasRejectedXMTPSignature: false,
            lastRejectionTime: null,
            autoRetryAttempts: 0,
            lastAutoRetryTime: null,
          }));
        }
      }, 100);
    }

    // Update success state tracking
    lastSuccessStatesRef.current = currentSuccessStates;

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
    userInteraction.hasRejectedXMTPSignature,
  ]);

  // FIXED: Enhanced initialization check with better error state management
  const checkInitializationStatus = useCallback(() => {
    if (initializationCheckInProgress.current) {
      return;
    }

    if (stateUpdateTimeoutRef.current) {
      clearTimeout(stateUpdateTimeoutRef.current);
    }

    stateUpdateTimeoutRef.current = setTimeout(() => {
      initializationCheckInProgress.current = true;

      try {
        const { isReady, progress, currentStep } = initializationStatus;

        // Collect errors with better categorization and success state awareness
        const errors: string[] = [];
        const isXMTPSuccessful = xmtp.isInitialized && !xmtp.error;
        const isWalletSuccessful = wallet.isConnected && !wallet.error;

        // Only add wallet errors if wallet isn't successful
        if (wallet.error && !isWalletSuccessful) {
          errors.push(`Wallet: ${wallet.error}`);
        }

        // Only add XMTP errors if XMTP isn't successful
        if (xmtp.error && !isXMTPSuccessful) {
          // Detect user rejection vs technical errors
          if (xmtp.error.includes('user rejected') || xmtp.error.includes('User rejected')) {
            setUserInteraction(prev => ({
              ...prev,
              hasRejectedXMTPSignature: true,
              lastRejectionTime: Date.now(),
            }));
            errors.push(`Messaging: User declined to sign for secure messaging`);
          } else if (xmtp.error.includes('already in progress')) {
            // Don't show "already in progress" as an error if XMTP is actually successful
            if (!isXMTPSuccessful) {
              errors.push(`Messaging: Initialization in progress`);
            }
          } else {
            errors.push(`Messaging: ${xmtp.error}`);
          }
        }

        // Only add agent errors if they're not transient
        if (agent.error && !agent.error.includes('not initialized')) {
          errors.push(`Agent: ${agent.error}`);
        }

        // CRITICAL: If everything is working, clear any lingering errors
        const currentError = errors.length > 0 ? errors.join('; ') : null;
        
        // Enhanced error change detection
        const errorChanged = currentError !== lastErrorRef.current;
        const shouldClearError = isReady && currentError !== null;

        if (shouldClearError) {
          console.log('🧹 [PROVIDERS] All systems ready, clearing any lingering errors');
          setAppState(prev => ({
            ...prev,
            isReady,
            initializationProgress: progress,
            currentStep,
            error: null, // Clear error when everything is ready
          }));
          lastErrorRef.current = null;
        } else {
          // Only update state if something meaningful changed
          setAppState(prev => {
            const shouldUpdate = 
              prev.isReady !== isReady ||
              Math.abs(prev.initializationProgress - progress) >= 5 ||
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

          if (errorChanged) {
            lastErrorRef.current = currentError;
          }
        }

        // Enhanced logging with reduced noise
        const globalState = global as GlobalState;
        if (errorChanged || shouldClearError || Math.abs(progress - (globalState.lastLoggedProgress || 0)) >= 25) {
          console.log('📊 [PROVIDERS] Initialization status update:', {
            isReady,
            progress: `${progress}%`,
            currentStep,
            walletReady: initializationStatus.walletReady,
            xmtpReady: initializationStatus.xmtpReady,
            agentReady: initializationStatus.agentReady,
            userRejectedXMTP: userInteraction.hasRejectedXMTPSignature,
            errors: errors.length > 0 ? errors : 'none',
            errorCleared: shouldClearError,
          });
          globalState.lastLoggedProgress = progress;
        }
      } finally {
        initializationCheckInProgress.current = false;
      }
    }, 150);
  }, [initializationStatus, wallet.error, xmtp.error, xmtp.isInitialized, wallet.isConnected, agent.error, userInteraction.hasRejectedXMTPSignature]);

  // ENHANCED: Smart XMTP auto-initialization that respects user choice and clears errors on success
  useEffect(() => {
    const initializeXMTPWhenReady = async () => {
      // Check if conditions are right for auto-initialization
      const walletAddressChanged = wallet.address !== connectionStates.lastWalletAddress;
      const chainIdChanged = wallet.chainId !== connectionStates.lastChainId;
      const connectionStateChanged = walletAddressChanged || chainIdChanged;

      // Don't auto-retry if user has rejected signature
      const shouldAttemptAutoInit = 
        wallet.isConnected && 
        wallet.signer && 
        wallet.chainId &&
        !xmtp.isInitialized && 
        !xmtp.isInitializing &&
        !xmtpInitializationInProgress.current &&
        (!connectionStates.xmtpInitialized || connectionStateChanged);

      // PREVENT AUTO-RETRY CONDITIONS:
      const preventAutoRetry = 
        userInteraction.hasRejectedXMTPSignature && !userInteraction.manualRetryRequested ||
        userInteraction.autoRetryAttempts >= userInteraction.maxAutoRetryAttempts ||
        (userInteraction.lastAutoRetryTime && (Date.now() - userInteraction.lastAutoRetryTime) < 30000);

      if (!shouldAttemptAutoInit || preventAutoRetry) {
        return;
      }

      // Update connection state tracking
      setConnectionStates(prev => ({
        ...prev,
        walletInitialized: true,
        lastWalletAddress: wallet.address,
        lastChainId: wallet.chainId,
      }));

      // Update auto-retry tracking
      setUserInteraction(prev => ({
        ...prev,
        autoRetryAttempts: prev.autoRetryAttempts + 1,
        lastAutoRetryTime: Date.now(),
        manualRetryRequested: false,
      }));

      xmtpInitializationInProgress.current = true;
      
      console.log('🚀 [PROVIDERS] Auto-initializing XMTP for address:', wallet.address, 'on chain:', wallet.chainId, 
        `(attempt ${userInteraction.autoRetryAttempts + 1}/${userInteraction.maxAutoRetryAttempts})`);
      
      try {
        await xmtp.initializeXMTP();
        
        // Mark XMTP as successfully initialized and reset rejection state
        setConnectionStates(prev => ({
          ...prev,
          xmtpInitialized: true,
        }));

        setUserInteraction(prev => ({
          ...prev,
          hasRejectedXMTPSignature: false,
          lastRejectionTime: null,
          autoRetryAttempts: 0,
          lastAutoRetryTime: null,
        }));

        // CRITICAL: Clear any lingering errors after successful initialization
        setTimeout(() => {
          setAppState(prev => {
            if (prev.error) {
              console.log('🧹 [PROVIDERS] Clearing error after successful XMTP initialization');
              return {
                ...prev,
                error: null,
              };
            }
            return prev;
          });
        }, 500);
        
        console.log('✅ [PROVIDERS] XMTP auto-initialization completed successfully');
      } catch (error) {
        console.error('❌ [PROVIDERS] Auto XMTP initialization failed:', error);
        
        setConnectionStates(prev => ({
          ...prev,
          xmtpInitialized: false,
        }));
      } finally {
        xmtpInitializationInProgress.current = false;
      }
    };

    initializeXMTPWhenReady();
  }, [
    wallet.isConnected, 
    wallet.signer, 
    wallet.address,
    wallet.chainId,
    xmtp,
    xmtp.isInitialized, 
    xmtp.isInitializing, 
    xmtp.initializeXMTP,
    connectionStates.xmtpInitialized,
    connectionStates.lastWalletAddress,
    connectionStates.lastChainId,
    userInteraction.hasRejectedXMTPSignature,
    userInteraction.manualRetryRequested,
    userInteraction.autoRetryAttempts,
    userInteraction.maxAutoRetryAttempts,
    userInteraction.lastAutoRetryTime,
  ]);

  // Reset connection states when wallet disconnects
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

      // Reset user interaction state on wallet disconnect
      setUserInteraction(prev => ({
        ...prev,
        hasRejectedXMTPSignature: false,
        lastRejectionTime: null,
        autoRetryAttempts: 0,
        lastAutoRetryTime: null,
        manualRetryRequested: false,
      }));
      
      console.log('🔌 [PROVIDERS] Wallet disconnected, resetting all states');
    }
  }, [wallet.isConnected]);

  // Throttled status checking with proper cleanup
  useEffect(() => {
    checkInitializationStatus();
    
    return () => {
      if (stateUpdateTimeoutRef.current) {
        clearTimeout(stateUpdateTimeoutRef.current);
        stateUpdateTimeoutRef.current = null;
      }
    };
  }, [checkInitializationStatus]);

  // ENHANCED: Retry initialization with user interaction awareness
  const retryInitialization = useCallback(async () => {
    console.log('🔄 [PROVIDERS] Manual retry initialization requested...');
    setAppState(prev => ({
      ...prev,
      retryCount: prev.retryCount + 1,
      error: null, // Clear error immediately on manual retry
    }));
    
    clearError();
    
    // Reset user interaction state to allow retry
    setUserInteraction(prev => ({
      ...prev,
      hasRejectedXMTPSignature: false,
      lastRejectionTime: null,
      autoRetryAttempts: 0,
      lastAutoRetryTime: null,
      manualRetryRequested: true,
    }));

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
        console.log('🔄 [PROVIDERS] Retrying wallet connection...');
        await wallet.connect();
      }
      
      // Wait for wallet state to settle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error('❌ [PROVIDERS] Manual retry failed:', error);
      setAppState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Retry failed',
      }));
    }
  }, [clearError, wallet]);

  // Enhanced XMTP database reset with state cleanup
  const resetXMTPDatabase = useCallback(async () => {
    try {
      console.log('🔧 [PROVIDERS] Resetting XMTP database...');
      
      // Clear error state immediately
      setAppState(prev => ({
        ...prev,
        error: null,
      }));
      
      // Reset all XMTP-related states
      setConnectionStates(prev => ({
        ...prev,
        xmtpInitialized: false,
      }));

      setUserInteraction(prev => ({
        ...prev,
        hasRejectedXMTPSignature: false,
        lastRejectionTime: null,
        autoRetryAttempts: 0,
        lastAutoRetryTime: null,
        manualRetryRequested: true,
      }));
      
      if (xmtp.resetDatabase) {
        await xmtp.resetDatabase();
        console.log('✅ [PROVIDERS] XMTP database reset completed');
        
        // Allow re-initialization after reset if wallet is connected
        if (wallet.isConnected && wallet.signer && wallet.chainId) {
          console.log('🔄 [PROVIDERS] Re-initializing XMTP after database reset...');
          setTimeout(() => {
            setConnectionStates(prev => ({
              ...prev,
              xmtpInitialized: false,
            }));
          }, 1000);
        }
      }
    } catch (error) {
      console.error('❌ [PROVIDERS] XMTP database reset failed:', error);
      setAppState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Database reset failed',
      }));
    }
  }, [xmtp, wallet]);

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

// Error Boundary Component - Enhanced error handling
export class AppErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 [ERROR BOUNDARY] App error caught:', error);
    console.error('🔍 [ERROR BOUNDARY] Error details:', errorInfo);
    
    // Enhanced error logging for debugging
    if (error.message.includes('XMTP') || error.message.includes('wallet')) {
      console.error('💡 [ERROR BOUNDARY] This appears to be a wallet or XMTP related error. Try:');
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