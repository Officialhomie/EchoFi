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
// APP PROVIDERS COMPONENT
// =============================================================================

export function AppProviders({ children }: AppProvidersProps) {
  const wallet = useWallet();
  const xmtp = useXMTP();
  const agent = useInvestmentAgent();

  // State management with stable references
  const [appState, setAppState] = useState<AppState>({
    isReady: false,
    initializationProgress: 0,
    currentStep: 'Waiting for wallet connection',
    error: null,
    retryCount: 0,
  });

  // Ref to prevent multiple simultaneous initialization checks
  const initializationCheckInProgress = useRef(false);

  // Stable error reference to prevent infinite updates
  const lastErrorRef = useRef<string | null>(null);

  // Clear error function
  const clearError = useCallback(() => {
    setAppState(prev => ({
      ...prev,
      error: null,
    }));
    lastErrorRef.current = null;
  }, []);

  // Memoized status calculation to prevent recalculation on every render
  const initializationStatus = useMemo<InitializationStatus>(() => {
    const walletReady = wallet.isConnected && !wallet.isConnecting && !wallet.error;
    const xmtpReady = xmtp.isInitialized && !xmtp.error;
    const agentReady = !agent.error;

    let progress = 0;
    let currentStep = 'Waiting for wallet connection';
    let isReady = false;

    if (walletReady) {
      progress = 33;
      currentStep = 'Wallet connected';

      if (xmtpReady) {
        progress = 66;
        currentStep = 'XMTP initialized';

        if (agentReady) {
          progress = 100;
          currentStep = 'All systems ready';
          isReady = true;
        } else {
          currentStep = 'Initializing agent';
        }
      } else if (xmtp.isInitializing) {
        progress = 50;
        currentStep = 'Initializing XMTP';
      } else {
        currentStep = 'Waiting for XMTP';
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
    xmtp.isInitialized,
    xmtp.isInitializing,
    xmtp.error,
    agent.error,
  ]);

  // Stable initialization check function
  const checkInitializationStatus = useCallback(() => {
    if (initializationCheckInProgress.current) {
      return;
    }

    initializationCheckInProgress.current = true;

    try {
      const { isReady, progress, currentStep } = initializationStatus;

      // Collect errors
      const errors: string[] = [];
      if (wallet.error) errors.push(`Wallet: ${wallet.error}`);
      if (xmtp.error) errors.push(`XMTP: ${xmtp.error}`);
      if (agent.error) errors.push(`Agent: ${agent.error}`);

      const currentError = errors.length > 0 ? errors.join('; ') : null;
      const errorChanged = currentError !== lastErrorRef.current;

      // Only update state if something actually changed
      setAppState(prev => {
        const shouldUpdate = 
          prev.isReady !== isReady ||
          prev.initializationProgress !== progress ||
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

      // Log status changes (but not repeatedly)
      const globalState = global as GlobalState;
      if (errorChanged || Math.abs(progress - (globalState.lastLoggedProgress || 0)) >= 10) {
        console.log('📊 Initialization status:', {
          isReady,
          progress,
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
  }, [initializationStatus, wallet.error, xmtp.error, agent.error]);

  // FIXED: Auto-initialize XMTP when wallet connects - WITH PROPER DEPENDENCIES
  // The dependency array now includes the xmtp object reference to ensure proper updates
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
  }, [
    wallet.isConnected, 
    wallet.signer, 
    xmtp.isInitialized, 
    xmtp.isInitializing, 
    xmtp.initializeXMTP,  // This ensures the effect reruns if XMTP changes
    xmtp  // FIXED: Added missing xmtp dependency
  ]);

  // FIXED: Update status when dependencies change - THROTTLED TO PREVENT LOOPS
  // Use a ref to track if we need to check status to avoid unnecessary calls
  const statusCheckNeeded = useRef(true);

  useEffect(() => {
    if (!statusCheckNeeded.current) return;
    
    const timeoutId = setTimeout(() => {
      checkInitializationStatus();
      statusCheckNeeded.current = false;
    }, 100); // Small delay to batch updates

    return () => clearTimeout(timeoutId);
  }, [wallet.error, xmtp.error, agent.error, initializationStatus, checkInitializationStatus]);

  // Mark that status check is needed when key values change
  useEffect(() => {
    statusCheckNeeded.current = true;
  }, [wallet.isConnected, wallet.isConnecting, xmtp.isInitialized, xmtp.isInitializing]);

  // FIXED: Retry initialization function - Added missing dependencies
  // This ensures the callback has access to the latest wallet and xmtp state
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
  }, [
    wallet.isConnected, 
    wallet.isConnecting, 
    wallet.connect, 
    xmtp.isInitialized, 
    xmtp.isInitializing, 
    xmtp.initializeXMTP, 
    clearError,
    wallet,  // FIXED: Added missing wallet dependency
    xmtp     // FIXED: Added missing xmtp dependency
  ]);

  // FIXED: Reset XMTP database function - Added missing dependencies
  // This ensures the function has access to the latest xmtp state
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
  }, [
    xmtp.resetDatabase, 
    xmtp  // FIXED: Added missing xmtp dependency
  ]);

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
// ERROR BOUNDARY COMPONENT
// =============================================================================

export class AppErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-lg font-semibold text-red-800">Something went wrong</h2>
          <p className="mt-2 text-red-600">{this.state.error?.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}