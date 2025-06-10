// src/components/agent/AgentStatus.tsx
'use client';

import { useState } from 'react';
import { useInvestmentAgent } from '@/hooks/useAgent';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/providers/AppProviders';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon, 
  RefreshCwIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BotIcon,
  AlertTriangleIcon
} from 'lucide-react';

interface AgentStatusProps {
  showDetails?: boolean;
  showMessages?: boolean;
  className?: string;
}

export function AgentStatus({ 
  showDetails = true, 
  showMessages = true, 
  className = '' 
}: AgentStatusProps) {
  const { 
    isInitialized, 
    isInitializing, 
    error, 
    initializationStatus,
    initializationMessages,
    forceReinitialize,
    checkHealth 
  } = useInvestmentAgent();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const getStatusIcon = () => {
    if (isInitializing) {
      return <LoadingSpinner size="sm" className="text-blue-500" />;
    } else if (isInitialized) {
      return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
    } else if (error) {
      return <XCircleIcon className="w-5 h-5 text-red-500" />;
    } else {
      return <ClockIcon className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusText = () => {
    if (isInitializing) {
      return 'Initializing AgentKit...';
    } else if (isInitialized) {
      return 'AgentKit Ready';
    } else if (error) {
      return 'AgentKit Error';
    } else {
      return 'AgentKit Pending';
    }
  };

  const getStatusColor = () => {
    if (isInitializing) {
      return 'border-blue-200 bg-blue-50';
    } else if (isInitialized) {
      return 'border-green-200 bg-green-50';
    } else if (error) {
      return 'border-red-200 bg-red-50';
    } else {
      return 'border-yellow-200 bg-yellow-50';
    }
  };

  const handleHealthCheck = async () => {
    setIsCheckingHealth(true);
    try {
      await checkHealth();
    } catch (error) {
      console.error('Health check failed:', error);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const handleForceReinit = async () => {
    try {
      await forceReinitialize();
    } catch (error) {
      console.error('Reinitialization failed:', error);
    }
  };

  return (
    <Card className={`${getStatusColor()} ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-lg">
            <BotIcon className="w-5 h-5 mr-2" />
            AgentKit Status
          </CardTitle>
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className="text-sm font-medium">{getStatusText()}</span>
            {showDetails && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1"
              >
                {isExpanded ? (
                  <ChevronUpIcon className="w-4 h-4" />
                ) : (
                  <ChevronDownIcon className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Basic Status Info */}
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Status:</span>
            <span className={`ml-2 font-medium ${
              isInitialized ? 'text-green-700' : 
              isInitializing ? 'text-blue-700' : 
              error ? 'text-red-700' : 'text-yellow-700'
            }`}>
              {isInitialized ? 'Operational' : 
               isInitializing ? 'Initializing' : 
               error ? 'Error' : 'Pending'}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Last Check:</span>
            <span className="ml-2 font-medium">
              {initializationStatus.lastInitAttempt ? 
                new Date(initializationStatus.lastInitAttempt).toLocaleTimeString() : 
                'Never'}
            </span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <AlertTriangleIcon className="w-4 h-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Error:</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-4 flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleHealthCheck}
            disabled={isCheckingHealth}
            className="flex-1"
          >
            {isCheckingHealth ? (
              <>
                <LoadingSpinner size="xs" className="mr-1" />
                Checking...
              </>
            ) : (
              <>
                <CheckCircleIcon className="w-3 h-3 mr-1" />
                Health Check
              </>
            )}
          </Button>
          
          {(error || !isInitialized) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleForceReinit}
              disabled={isInitializing}
              className="flex-1"
            >
              <RefreshCwIcon className="w-3 h-3 mr-1" />
              Reinitialize
            </Button>
          )}
        </div>

        {/* Expanded Details */}
        {isExpanded && showDetails && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Technical Details</h4>
            <div className="space-y-1 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Initialized:</span>
                <span>{initializationStatus.isInitialized ? '✅' : '❌'}</span>
              </div>
              <div className="flex justify-between">
                <span>Initializing:</span>
                <span>{initializationStatus.isInitializing ? '🔄' : '⏸️'}</span>
              </div>
              {initializationStatus.error && (
                <div className="flex justify-between">
                  <span>Error:</span>
                  <span className="text-red-600 text-right max-w-32 truncate">
                    {initializationStatus.error}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Messages */}
        {showMessages && initializationMessages.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Activity</h4>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {initializationMessages.map((message, index) => (
                <div key={index} className="text-xs font-mono text-gray-600 p-2 bg-gray-50 rounded">
                  {message}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact version for dashboard
export function AgentStatusCompact({ className = '' }: { className?: string }) {
  const { isInitialized, isInitializing, error } = useInvestmentAgent();

  const getStatusColor = () => {
    if (isInitializing) return 'text-blue-600';
    if (isInitialized) return 'text-green-600';
    if (error) return 'text-red-600';
    return 'text-yellow-600';
  };

  const getStatusIcon = () => {
    if (isInitializing) return <LoadingSpinner size="xs" />;
    if (isInitialized) return <CheckCircleIcon className="w-3 h-3" />;
    if (error) return <XCircleIcon className="w-3 h-3" />;
    return <ClockIcon className="w-3 h-3" />;
  };

  return (
    <div className={`flex items-center space-x-2 ${getStatusColor()} ${className}`}>
      {getStatusIcon()}
      <span className="text-xs font-medium">
        {isInitializing ? 'Initializing...' : 
         isInitialized ? 'Agent Ready' : 
         error ? 'Agent Error' : 'Agent Pending'}
      </span>
    </div>
  );
}

// Hook for getting agent status in other components
export function useAgentStatus() {
  const { 
    isInitialized, 
    isInitializing, 
    error, 
    initializationStatus,
    initializationMessages 
  } = useInvestmentAgent();

  return {
    isInitialized,
    isInitializing,
    error,
    status: initializationStatus,
    messages: initializationMessages,
    isReady: isInitialized && !error,
    hasError: !!error,
  };
}