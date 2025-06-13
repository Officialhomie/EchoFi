'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWallet } from '@/hooks/useWallet';
import { useXMTP } from '@/hooks/useXMTP'; // Updated to use unified XMTP hook
import { useInvestmentAgent } from '@/hooks/useAgent';
import { AlertTriangleIcon, RefreshCwIcon, XIcon, ShieldCheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Create query client with optimized defaults for EchoFi
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

// Enhanced App Context with comprehensive system monitoring
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
  systemHealth: {
    overall: 'healthy' | 'degraded' | 'critical';
    components: {
      wallet: 'healthy' | 'warning' | 'error';
      xmtp: 'healthy' | 'warning' | 'error';
      agent: 'healthy' | 'warning' | 'error';
    };
  };
  // XMTP-specific actions
  resetXMTPDatabase: () => Promise<void>;
  repairXMTPSequenceId: () => Promise<void>;
  performXMTPHealthCheck: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

// Enhanced App Provider with unified system management
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
  const [systemHealth, setSystemHealth] = useState<{
    overall: 'healthy' | 'degraded' | 'critical';
    components: {
      wallet: 'healthy' | 'warning' | 'error';
      xmtp: 'healthy' | 'warning' | 'error';
      agent: 'healthy' | 'warning' | 'error';
    };
  }>({
    overall: 'healthy',
    components: {
      wallet: 'healthy',
      xmtp: 'healthy',
      agent: 'healthy',
    }
  });
  
  // Initialize hooks with unified XMTP configuration
  const wallet = useWallet();
  const xmtp = useXMTP({
    env: 'dev', // Use dev environment for development
    enableLogging: true,
    dbPath: 'echofi-xmtp-unified',
    maxRetries: 3,
    retryDelay: 2000,
    healthCheckInterval: 30000,
  });
  const agent = useInvestmentAgent({ autoInitialize: true });

  const clearError = useCallback(() => {
    setError(null);
    setErrorDetails(null);
    if (xmtp.clearError) xmtp.clearError();
    if (agent.clearError) agent.clearError();
  }, [xmtp, agent]);

  const checkInitializationStatus = useCallback(() => {
    console.log('🔍 [UNIFIED] Checking initialization status...', {
      wallet: {
        isConnected: wallet.isConnected,
        address: wallet.address?.slice(0, 8) + '...'
      },
      xmtp: {
        isInitialized: xmtp.isInitialized,
        isInitializing: xmtp.isInitializing,
        error: xmtp.error,
        databaseHealth: xmtp.databaseHealth?.isHealthy
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

    // Enhanced system health monitoring
    const healthComponents: {
      wallet: 'healthy' | 'warning' | 'error';
      xmtp: 'healthy' | 'warning' | 'error';
      agent: 'healthy' | 'warning' | 'error';
    } = {
      wallet: 'healthy',
      xmtp: 'healthy',
      agent: 'healthy',
    };

    // Check wallet connection (25% of progress)
    if (wallet.isConnected) {
      progress += 25;
      status.wallet = true;
      healthComponents.wallet = 'healthy';
      console.log('✅ [UNIFIED] Wallet: Connected');
    } else {
      allReady = false;
      healthComponents.wallet = 'error';
      console.log('❌ [UNIFIED] Wallet: Not connected');
    }

    // Check XMTP initialization (40% of progress) - increased weight due to importance
    if (xmtp.isInitialized) {
      progress += 40;
      status.xmtp = true;
      
      // Check database health
      if (xmtp.databaseHealth?.isHealthy) {
        healthComponents.xmtp = 'healthy';
      } else if (xmtp.databaseHealth?.isHealthy === false) {
        healthComponents.xmtp = 'warning';
      } else {
        healthComponents.xmtp = 'healthy'; // Unknown state defaults to healthy
      }
      
      console.log('✅ [UNIFIED] XMTP: Initialized and healthy');
    } else if (xmtp.isInitializing) {
      progress += 20; // Partial progress while initializing
      allReady = false;
      healthComponents.xmtp = 'warning';
      console.log('🔄 [UNIFIED] XMTP: Initializing...');
    } else if (wallet.isConnected) {
      allReady = false;
      healthComponents.xmtp = 'error';
      console.log('❌ [UNIFIED] XMTP: Not initialized');
    }

    // Check agent initialization (35% of progress)
    if (agent.isInitialized) {
      progress += 35;
      status.agent = true;
      healthComponents.agent = 'healthy';
      console.log('✅ [UNIFIED] Agent: Initialized');
    } else if (agent.isInitializing) {
      progress += 15; // Partial progress while initializing
      allReady = false;
      healthComponents.agent = 'warning';
      console.log('🔄 [UNIFIED] Agent: Initializing...');
    } else {
      allReady = false;
      healthComponents.agent = 'error';
      console.log('❌ [UNIFIED] Agent: Not initialized');
    }

    // Collect errors with enhanced context
    if (xmtp.error) {
      errors.push(`XMTP: ${xmtp.error}`);
      healthComponents.xmtp = 'error';
      console.error('❌ [UNIFIED] XMTP Error:', xmtp.error);
      
      // Log additional XMTP context
      if (xmtp.initializationState) {
        console.error('❌ [UNIFIED] XMTP State:', xmtp.initializationState);
      }
    }
    
    if (agent.error) {
      errors.push(`Agent: ${agent.error}`);
      healthComponents.agent = 'error';
      console.error('❌ [UNIFIED] Agent Error:', agent.error);
    }

    // Determine overall system health
    let overallHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
    const errorCount = Object.values(healthComponents).filter(status => status === 'error').length;
    const warningCount = Object.values(healthComponents).filter(status => status === 'warning').length;
    
    if (errorCount > 1) {
      overallHealth = 'critical';
    } else if (errorCount === 1 || warningCount > 1) {
      overallHealth = 'degraded';
    }

    // Update state
    setInitializationProgress(progress);
    setInitializationStatus(status);
    setSystemHealth({
      overall: overallHealth,
      components: healthComponents
    });
    
    // Only set as initialized if all components are ready
    const shouldBeInitialized = wallet.isConnected && xmtp.isInitialized && agent.isInitialized;
    setIsInitialized(shouldBeInitialized);

    console.log('📊 [UNIFIED] Initialization Summary:', {
      progress: `${progress}%`,
      allReady: shouldBeInitialized,
      status,
      health: overallHealth,
      errors: errors.length > 0 ? errors : 'None'
    });

    // Update error state
    if (errors.length > 0 && !error) {
      setError(errors.join('; '));
      setErrorDetails({ 
        xmtpError: xmtp.error, 
        agentError: agent.error,
        xmtpState: xmtp.initializationState,
        databaseHealth: xmtp.databaseHealth
      });
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
    xmtp.initializationState,
    xmtp.databaseHealth,
    agent.isInitialized, 
    agent.isInitializing, 
    agent.error,
    error
  ]);

  useEffect(() => {
    checkInitializationStatus();
  }, [checkInitializationStatus]);

  const retryInitialization = useCallback(async () => {
    console.log('🔄 [UNIFIED] Retrying initialization...');
    setInitializationAttempt(prev => prev + 1);
    clearError();
    setInitializationProgress(0);
    
    try {
      // Reset and retry XMTP if needed
      if (!xmtp.isInitialized && wallet.isConnected) {
        console.log('🔄 [UNIFIED] Retrying XMTP initialization...');
        await xmtp.initializeXMTP();
      }
      
      // Agent initialization happens automatically, just clear errors
      if (agent.error) {
        console.log('🔄 [UNIFIED] Clearing agent errors...');
        agent.clearError();
      }

      // Force a status check
      setTimeout(() => {
        checkInitializationStatus();
      }, 1000);

    } catch (err) {
      console.error('❌ [UNIFIED] Retry initialization failed:', err);
      setError(err instanceof Error ? err.message : 'Retry failed');
    }
  }, [clearError, xmtp, agent, wallet.isConnected, checkInitializationStatus]);

  // XMTP-specific recovery actions
  const resetXMTPDatabase = useCallback(async () => {
    try {
      console.log('🔧 [UNIFIED] Resetting XMTP database...');
      await xmtp.resetDatabase();
      console.log('✅ [UNIFIED] XMTP database reset completed');
      
      // Force status check after reset
      setTimeout(() => {
        checkInitializationStatus();
      }, 1000);
    } catch (error) {
      console.error('❌ [UNIFIED] XMTP database reset failed:', error);
      setError(error instanceof Error ? error.message : 'Database reset failed');
    }
  }, [xmtp, checkInitializationStatus]);

  const repairXMTPSequenceId = useCallback(async () => {
    try {
      console.log('🔧 [UNIFIED] Repairing XMTP SequenceId...');
      await xmtp.repairSequenceId();
      console.log('✅ [UNIFIED] XMTP SequenceId repair completed');
      
      // Force status check after repair
      setTimeout(() => {
        checkInitializationStatus();
      }, 1000);
    } catch (error) {
      console.error('❌ [UNIFIED] XMTP SequenceId repair failed:', error);
      setError(error instanceof Error ? error.message : 'SequenceId repair failed');
    }
  }, [xmtp, checkInitializationStatus]);

  const performXMTPHealthCheck = useCallback(async () => {
    try {
      console.log('🔍 [UNIFIED] Performing XMTP health check...');
      const healthReport = await xmtp.performHealthCheck();
      console.log('✅ [UNIFIED] XMTP health check completed:', healthReport);
      
      // Force status check to update health state
      setTimeout(() => {
        checkInitializationStatus();
      }, 500);
    } catch (error) {
      console.error('❌ [UNIFIED] XMTP health check failed:', error);
      setError(error instanceof Error ? error.message : 'Health check failed');
    }
  }, [xmtp, checkInitializationStatus]);

  // Auto-retry logic for transient errors with enhanced backoff
  useEffect(() => {
    if (error && initializationAttempt < 3) {
      const isTransientError = 
        error.includes('timeout') || 
        error.includes('network') || 
        error.includes('connection') ||
        error.includes('SequenceId');
      
      if (isTransientError) {
        const retryDelay = Math.pow(2, initializationAttempt) * 1000; // Exponential backoff
        console.log(`⏰ [UNIFIED] Auto-retrying in ${retryDelay}ms (attempt ${initializationAttempt + 1}/3)`);
        const timer = setTimeout(retryInitialization, retryDelay);
        return () => clearTimeout(timer);
      }
    }
  }, [error, initializationAttempt, retryInitialization]);

  // Enhanced periodic health monitoring
  useEffect(() => {
    if (isInitialized) {
      const healthCheckInterval = setInterval(() => {
        performXMTPHealthCheck();
      }, 60000); // Check every minute when initialized

      return () => clearInterval(healthCheckInterval);
    }
  }, [isInitialized, performXMTPHealthCheck]);

  const value: AppContextType = {
    isInitialized,
    initializationProgress,
    error,
    errorDetails,
    clearError,
    retryInitialization,
    initializationStatus,
    systemHealth,
    resetXMTPDatabase,
    repairXMTPSequenceId,
    performXMTPHealthCheck,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

// Main Providers Component with error boundary
interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <SystemHealthMonitor />
        {children}
      </AppProvider>
    </QueryClientProvider>
  );
}

// Enhanced System Health Monitor Component
function SystemHealthMonitor() {
  const app = useApp();
  const [showHealthDetails, setShowHealthDetails] = useState(false);

  // Show health warning for degraded systems
  if (app.systemHealth.overall === 'degraded' || app.systemHealth.overall === 'critical') {
    return (
      <div className={`fixed top-4 right-4 z-50 max-w-md p-4 rounded-lg border shadow-lg ${
        app.systemHealth.overall === 'critical' 
          ? 'bg-red-50 border-red-200 text-red-800' 
          : 'bg-yellow-50 border-yellow-200 text-yellow-800'
      }`}>
        <div className="flex items-start gap-3">
          <AlertTriangleIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">
              System Health: {app.systemHealth.overall === 'critical' ? 'Critical' : 'Degraded'}
            </h3>
            {app.error && (
              <p className="text-xs mt-1 opacity-90">
                {app.error}
              </p>
            )}
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowHealthDetails(!showHealthDetails)}
                className="text-xs"
              >
                {showHealthDetails ? 'Hide' : 'Show'} Details
              </Button>
              <Button
                size="sm"
                onClick={app.retryInitialization}
                className="text-xs"
              >
                <RefreshCwIcon className="w-3 h-3 mr-1" />
                Retry
              </Button>
            </div>
            
            {showHealthDetails && (
              <div className="mt-3 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    app.systemHealth.components.wallet === 'healthy' ? 'bg-green-500' :
                    app.systemHealth.components.wallet === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <span>Wallet: {app.systemHealth.components.wallet}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    app.systemHealth.components.xmtp === 'healthy' ? 'bg-green-500' :
                    app.systemHealth.components.xmtp === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <span>XMTP: {app.systemHealth.components.xmtp}</span>
                  {app.systemHealth.components.xmtp !== 'healthy' && (
                    <div className="flex gap-1 ml-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={app.repairXMTPSequenceId}
                        className="text-xs px-2 py-1 h-auto"
                      >
                        Repair
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={app.resetXMTPDatabase}
                        className="text-xs px-2 py-1 h-auto"
                      >
                        Reset
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    app.systemHealth.components.agent === 'healthy' ? 'bg-green-500' :
                    app.systemHealth.components.agent === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <span>Agent: {app.systemHealth.components.agent}</span>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={app.clearError}
            className="text-current opacity-60 hover:opacity-100"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Show healthy status briefly when all systems are operational
  if (app.isInitialized && app.systemHealth.overall === 'healthy') {
    return (
      <div className="fixed top-4 right-4 z-50 max-w-md p-3 rounded-lg border bg-green-50 border-green-200 text-green-800 shadow-lg">
        <div className="flex items-center gap-2 text-sm">
          <ShieldCheckIcon className="w-4 h-4" />
          <span className="font-medium">All systems operational</span>
        </div>
      </div>
    );
  }

  return null;
}

// Enhanced Error Boundary for additional protection
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('❌ [ERROR BOUNDARY] Application error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
            <AlertTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Application Error
            </h2>
            <p className="text-gray-600 mb-4">
              Something went wrong. Please refresh the page or contact support.
            </p>
            <Button
              onClick={() => window.location.reload()}
              className="w-full"
            >
              <RefreshCwIcon className="w-4 h-4 mr-2" />
              Refresh Page
            </Button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-500">
                  Error Details (Development)
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {this.state.error.stack}
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

// Loading Spinner Component (updated)
export function LoadingSpinner({ 
  size = 'default', 
  message = 'Loading...',
  progress,
  details 
}: { 
  size?: 'sm' | 'default' | 'lg';
  message?: string;
  progress?: number;
  details?: string;
}) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    default: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]}`} />
      <p className="text-sm text-gray-600">{message}</p>
      {typeof progress === 'number' && (
        <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
      {details && (
        <p className="text-xs text-gray-500 text-center max-w-xs">{details}</p>
      )}
    </div>
  );
}