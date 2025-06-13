'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWallet } from '@/hooks/useWallet';
import { useEnhancedXMTP } from '@/hooks/useXMTP-enhanced';
import { useInvestmentAgent } from '@/hooks/useAgent';
import { AlertTriangleIcon, RefreshCwIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Create query client with better defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
    mutations: {
      retry: 1,
    },
  },
});

// App Context with better typing
interface AppContextType {
  isInitialized: boolean;
  initializationProgress: number;
  error: string | null;
  errorDetails?: any;
  clearError: () => void;
  retryInitialization: () => Promise<void>;
  initializationStatus: {
    wallet: boolean;
    xmtp: boolean;
    agent: boolean;
  };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

// App Provider with enhanced error handling
interface AppProviderProps {
  children: React.ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationProgress, setInitializationProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<any>(null);
  const [initializationAttempt, setInitializationAttempt] = useState(0);
  const [initializationStatus, setInitializationStatus] = useState({
    wallet: false,
    xmtp: false,
    agent: false,
  });
  
  const wallet = useWallet();
  const xmtp = useEnhancedXMTP();
  const agent = useInvestmentAgent({ autoInitialize: true });

  const clearError = useCallback(() => {
    setError(null);
    setErrorDetails(null);
    if (xmtp.clearError) xmtp.clearError();
    agent.clearError();
  }, [xmtp, agent]);

  const checkInitializationStatus = useCallback(() => {
    console.log('🔍 Checking initialization status...', {
      wallet: {
        isConnected: wallet.isConnected,
        address: wallet.address?.slice(0, 8) + '...'
      },
      xmtp: {
        isInitialized: xmtp.isInitialized,
        isInitializing: xmtp.isInitializing,
        error: xmtp.error
      },
      agent: {
        isInitialized: agent.isInitialized,
        isInitializing: agent.isInitializing,
        error: agent.error
      }
    });

    let progress = 0;
    let allReady = true;
    const errors = [];
    const status = {
      wallet: false,
      xmtp: false,
      agent: false,
    };

    // Check wallet connection (25% of progress)
    if (wallet.isConnected) {
      progress += 25;
      status.wallet = true;
      console.log('✅ Wallet: Connected');
    } else {
      allReady = false;
      console.log('❌ Wallet: Not connected');
    }

    // Check XMTP initialization (35% of progress)
    if (xmtp.isInitialized) {
      progress += 35;
      status.xmtp = true;
      console.log('✅ XMTP: Initialized');
    } else if (xmtp.isInitializing) {
      progress += 15; // Partial progress while initializing
      allReady = false;
      console.log('🔄 XMTP: Initializing...');
    } else if (wallet.isConnected) {
      allReady = false;
      console.log('❌ XMTP: Not initialized');
    }

    // Check agent initialization (40% of progress)
    if (agent.isInitialized) {
      progress += 40;
      status.agent = true;
      console.log('✅ Agent: Initialized');
    } else if (agent.isInitializing) {
      progress += 20; // Partial progress while initializing
      allReady = false;
      console.log('🔄 Agent: Initializing...');
    } else {
      allReady = false;
      console.log('❌ Agent: Not initialized');
    }

    // Collect errors
    if (xmtp.error) {
      errors.push(`XMTP: ${xmtp.error}`);
      console.error('❌ XMTP Error:', xmtp.error);
    }
    if (agent.error) {
      errors.push(`Agent: ${agent.error}`);
      console.error('❌ Agent Error:', agent.error);
    }

    // Update state
    setInitializationProgress(progress);
    setInitializationStatus(status);
    
    // Only set as initialized if all components are ready
    const shouldBeInitialized = wallet.isConnected && xmtp.isInitialized && agent.isInitialized;
    setIsInitialized(shouldBeInitialized);

    console.log('📊 Initialization Summary:', {
      progress: `${progress}%`,
      allReady: shouldBeInitialized,
      status,
      errors: errors.length > 0 ? errors : 'None'
    });

    if (errors.length > 0 && !error) {
      setError(errors.join('; '));
      setErrorDetails({ xmtpError: xmtp.error, agentError: agent.error });
    } else if (errors.length === 0 && error) {
      // Clear error if all errors are resolved
      setError(null);
      setErrorDetails(null);
    }
  }, [
    wallet.isConnected, 
    wallet.address,
    xmtp.isInitialized, 
    xmtp.isInitializing, 
    xmtp.error, 
    agent.isInitialized, 
    agent.isInitializing, 
    agent.error,
    error
  ]);

  useEffect(() => {
    checkInitializationStatus();
  }, [checkInitializationStatus]);

  const retryInitialization = useCallback(async () => {
    console.log('🔄 Retrying initialization...');
    setInitializationAttempt(prev => prev + 1);
    clearError();
    setInitializationProgress(0);
    
    try {
      // Reset and retry XMTP if needed
      if (!xmtp.isInitialized && wallet.isConnected) {
        console.log('🔄 Retrying XMTP initialization...');
        await xmtp.initializeXMTP();
      }
      
      // Agent initialization happens automatically, just clear errors
      if (agent.error) {
        console.log('🔄 Clearing agent errors...');
        agent.clearError();
      }

      // Force a status check
      setTimeout(() => {
        checkInitializationStatus();
      }, 1000);

    } catch (err) {
      console.error('❌ Retry initialization failed:', err);
      setError(err instanceof Error ? err.message : 'Retry failed');
    }
  }, [clearError, xmtp, agent, wallet.isConnected, checkInitializationStatus]);

  // Auto-retry logic for transient errors
  useEffect(() => {
    if (error && initializationAttempt < 3) {
      const isTransientError = 
        error.includes('timeout') || 
        error.includes('network') || 
        error.includes('connection');
      
      if (isTransientError) {
        const retryDelay = Math.pow(2, initializationAttempt) * 1000; // Exponential backoff
        console.log(`⏰ Auto-retrying in ${retryDelay}ms (attempt ${initializationAttempt + 1}/3)`);
        const timer = setTimeout(retryInitialization, retryDelay);
        return () => clearTimeout(timer);
      }
    }
  }, [error, initializationAttempt, retryInitialization]);

  const value: AppContextType = {
    isInitialized,
    initializationProgress,
    error,
    errorDetails,
    clearError,
    retryInitialization,
    initializationStatus,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

// Main Providers Component
interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        {children}
      </AppProvider>
    </QueryClientProvider>
  );
}

// Enhanced Error Boundary
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void; errorInfo?: React.ErrorInfo }>;
}

export class AppErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    
    // Report to error tracking service here
    // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent 
            error={this.state.error} 
            resetError={this.resetError}
            errorInfo={this.state.errorInfo}
          />
        );
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full">
            <div className="bg-white rounded-lg shadow-lg p-6 border border-red-200">
              <div className="flex items-center mb-4">
                <AlertTriangleIcon className="h-8 w-8 text-red-500 mr-3" />
                <h2 className="text-xl font-bold text-red-900">Something went wrong</h2>
              </div>
              
              <div className="mb-4">
                <p className="text-gray-700 mb-2">
                  {this.state.error.message || 'An unexpected error occurred'}
                </p>
                
                {process.env.NODE_ENV === 'development' && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                      Technical Details
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                      {this.state.error.stack}
                    </pre>
                    {this.state.errorInfo && (
                      <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </details>
                )}
              </div>

              <div className="flex gap-3">
                <Button onClick={this.resetError} className="flex-1">
                  <RefreshCwIcon className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  className="flex-1"
                >
                  Reload Page
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Enhanced Loading Components
export function LoadingSpinner({ 
  size = 'md',
  className = '',
  color = 'blue'
}: { 
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray';
}) {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  const colorClasses = {
    blue: 'border-blue-600',
    green: 'border-green-600',
    red: 'border-red-600',
    yellow: 'border-yellow-600',
    purple: 'border-purple-600',
    gray: 'border-gray-600',
  };

  return (
    <div 
      className={`animate-spin rounded-full border-2 border-gray-200 border-t-transparent ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

// Enhanced Global Loading with detailed progress
export function GlobalLoading() {
  const { initializationProgress, error, initializationStatus } = useApp();

  const getStepStatus = (isComplete: boolean, isError: boolean) => {
    if (isError) return '❌';
    if (isComplete) return '✅';
    return '🔄';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <LoadingSpinner size="xl" className="mx-auto mb-6" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Initializing EchoFi...
          </h2>
          <p className="text-gray-600 mb-6">
            Setting up your investment coordination platform
          </p>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${initializationProgress}%` }}
            />
          </div>
          
          <p className="text-sm text-gray-500 mb-4">
            {initializationProgress}% complete
          </p>

          {/* Detailed Steps */}
          <div className="text-left space-y-2 mb-4">
            <div className="flex items-center text-sm">
              <span className="mr-2">{getStepStatus(initializationStatus.wallet, false)}</span>
              <span>Wallet Connection</span>
            </div>
            <div className="flex items-center text-sm">
              <span className="mr-2">{getStepStatus(initializationStatus.xmtp, !!error?.includes('XMTP'))}</span>
              <span>Secure Messaging (XMTP)</span>
            </div>
            <div className="flex items-center text-sm">
              <span className="mr-2">{getStepStatus(initializationStatus.agent, !!error?.includes('Agent'))}</span>
              <span>AI Investment Agent</span>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-left">
              <p className="text-sm text-red-700 font-medium">Error:</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Notification Toast Component
interface NotificationProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  onClose: () => void;
  autoClose?: boolean;
  duration?: number;
}

export function Notification({ 
  type, 
  title, 
  message, 
  onClose, 
  autoClose = true, 
  duration = 5000 
}: NotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Allow fade out animation
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, onClose]);

  const typeStyles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  return (
    <div 
      className={`
        fixed top-4 right-4 max-w-sm w-full border rounded-lg p-4 shadow-lg z-50
        transition-all duration-300 ease-in-out
        ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'}
        ${typeStyles[type]}
      `}
    >
      <div className="flex items-start">
        <div className="flex-1">
          <h3 className="font-medium">{title}</h3>
          <p className="mt-1 text-sm">{message}</p>
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
          className="ml-3 text-gray-400 hover:text-gray-600"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}