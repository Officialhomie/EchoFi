// src/components/ui/error.tsx
'use client';

import React from 'react';
import { AlertTriangleIcon, RefreshCwIcon, XCircleIcon, InfoIcon } from 'lucide-react';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';

// Generic Error Display Component
interface ErrorDisplayProps {
  title?: string;
  message: string;
  details?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  variant?: 'error' | 'warning' | 'info';
  className?: string;
}

export function ErrorDisplay({
  title = 'Something went wrong',
  message,
  details,
  onRetry,
  onDismiss,
  variant = 'error',
  className = '',
}: ErrorDisplayProps) {
  const getIcon = () => {
    switch (variant) {
      case 'warning':
        return <AlertTriangleIcon className="w-6 h-6 text-yellow-500" />;
      case 'info':
        return <InfoIcon className="w-6 h-6 text-blue-500" />;
      default:
        return <XCircleIcon className="w-6 h-6 text-red-500" />;
    }
  };

  const getColors = () => {
    switch (variant) {
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'info':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-red-200 bg-red-50';
    }
  };

  return (
    <div className={`rounded-lg border p-4 ${getColors()} ${className}`}>
      <div className="flex items-start space-x-3">
        {getIcon()}
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">{title}</h3>
          <p className="mt-1 text-sm text-gray-600">{message}</p>
          {details && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                Technical details
              </summary>
              <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                {details}
              </pre>
            </details>
          )}
          {(onRetry || onDismiss) && (
            <div className="mt-3 flex space-x-2">
              {onRetry && (
                <Button size="sm" onClick={onRetry} className="flex items-center">
                  <RefreshCwIcon className="w-3 h-3 mr-1" />
                  Try Again
                </Button>
              )}
              {onDismiss && (
                <Button size="sm" variant="outline" onClick={onDismiss}>
                  Dismiss
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Network Error Component
interface NetworkErrorProps {
  currentChainId?: number;
  requiredChainId: number;
  requiredNetworkName: string;
  onSwitchNetwork?: () => void;
}

export function NetworkError({
  currentChainId,
  requiredChainId,
  requiredNetworkName,
  onSwitchNetwork,
}: NetworkErrorProps) {
  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="flex items-center text-red-800">
          <AlertTriangleIcon className="w-5 h-5 mr-2" />
          Wrong Network
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-red-700 mb-4">
          This application requires you to be connected to {requiredNetworkName}.
          {currentChainId && (
            <> You are currently connected to chain ID {currentChainId}.</>
          )}
        </p>
        {onSwitchNetwork && (
          <Button onClick={onSwitchNetwork} className="bg-red-600 hover:bg-red-700">
            Switch to {requiredNetworkName}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Wallet Connection Error Component
interface WalletErrorProps {
  error: string;
  onRetryConnection?: () => void;
  onShowHelp?: () => void;
}

export function WalletError({ error, onRetryConnection, onShowHelp }: WalletErrorProps) {
  const getErrorMessage = (error: string) => {
    if (error.includes('User rejected')) {
      return 'Connection was cancelled. Please try again and approve the connection.';
    }
    if (error.includes('No wallet found')) {
      return 'No Web3 wallet detected. Please install MetaMask or another compatible wallet.';
    }
    if (error.includes('Chain not added')) {
      return 'The required network is not added to your wallet. Please add it manually or allow the application to add it.';
    }
    return error;
  };

  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="flex items-center text-red-800">
          <XCircleIcon className="w-5 h-5 mr-2" />
          Wallet Connection Error
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-red-700 mb-4">{getErrorMessage(error)}</p>
        <div className="flex space-x-2">
          {onRetryConnection && (
            <Button onClick={onRetryConnection} size="sm">
              Try Again
            </Button>
          )}
          {onShowHelp && (
            <Button onClick={onShowHelp} size="sm" variant="outline">
              Get Help
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Transaction Error Component
interface TransactionErrorProps {
  error: string;
  transactionHash?: string;
  onRetry?: () => void;
  explorerUrl?: string;
}

export function TransactionError({
  error,
  transactionHash,
  onRetry,
  explorerUrl,
}: TransactionErrorProps) {
  const getErrorMessage = (error: string) => {
    if (error.includes('insufficient funds')) {
      return 'Insufficient funds to complete this transaction. Please check your balance and try again.';
    }
    if (error.includes('gas too low')) {
      return 'Gas limit too low. The transaction requires more gas to complete.';
    }
    if (error.includes('nonce too low')) {
      return 'Nonce too low. Please reset your MetaMask account or wait for pending transactions to complete.';
    }
    if (error.includes('reverted')) {
      return 'Transaction reverted. This usually means the operation failed due to smart contract conditions.';
    }
    return error;
  };

  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="flex items-center text-red-800">
          <XCircleIcon className="w-5 h-5 mr-2" />
          Transaction Failed
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-red-700 mb-4">{getErrorMessage(error)}</p>
        
        {transactionHash && (
          <div className="mb-4 p-2 bg-gray-100 rounded">
            <p className="text-xs text-gray-600">Transaction Hash:</p>
            <code className="text-xs font-mono break-all">{transactionHash}</code>
          </div>
        )}

        <div className="flex space-x-2">
          {onRetry && (
            <Button onClick={onRetry} size="sm">
              <RefreshCwIcon className="w-3 h-3 mr-1" />
              Retry Transaction
            </Button>
          )}
          {transactionHash && explorerUrl && (
            <a
              href={`${explorerUrl}/tx/${transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 h-9 px-3 mt-1"
              style={{ minHeight: '2.25rem', padding: '0.5rem 0.75rem' }}
            >
              View on Explorer
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// API Error Component
interface ApiErrorProps {
  error: {
    status?: number;
    message: string;
    details?: any;
  };
  onRetry?: () => void;
  endpoint?: string;
}

export function ApiError({ error, onRetry, endpoint }: ApiErrorProps) {
  const getStatusMessage = (status?: number) => {
    switch (status) {
      case 400:
        return 'Bad Request - Please check your input and try again.';
      case 401:
        return 'Unauthorized - Please connect your wallet and try again.';
      case 403:
        return 'Forbidden - You do not have permission to perform this action.';
      case 404:
        return 'Not Found - The requested resource could not be found.';
      case 429:
        return 'Too Many Requests - Please wait a moment and try again.';
      case 500:
        return 'Server Error - Please try again later.';
      case 503:
        return 'Service Unavailable - The service is temporarily unavailable.';
      default:
        return error.message;
    }
  };

  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="flex items-center text-red-800">
          <XCircleIcon className="w-5 h-5 mr-2" />
          {error.status ? `Error ${error.status}` : 'API Error'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-red-700 mb-2">{getStatusMessage(error.status)}</p>
        
        {endpoint && (
          <p className="text-xs text-gray-600 mb-4">Endpoint: {endpoint}</p>
        )}

        {error.details && (
          <details className="mb-4">
            <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
              Error details
            </summary>
            <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
              {JSON.stringify(error.details, null, 2)}
            </pre>
          </details>
        )}

        {onRetry && (
          <Button onClick={onRetry} size="sm">
            <RefreshCwIcon className="w-3 h-3 mr-1" />
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Empty State Component (not an error, but useful for empty states)
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      {icon && <div className="mx-auto mb-4">{icon}</div>}
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">{description}</p>
      {action && (
        <Button onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  );
}

// 404 Not Found Component
export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-gray-300">404</h1>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Page not found</h2>
        <p className="text-gray-600 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 h-10 py-2 px-4"
          style={{ minHeight: '2.5rem', padding: '0.5rem 1rem' }}
        >
          Go back home
        </a>
      </div>
    </div>
  );
}

// Maintenance Mode Component
export function MaintenanceMode() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-center">
            🚧 Under Maintenance
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-gray-600 mb-4">
            We're currently performing scheduled maintenance to improve your experience.
          </p>
          <p className="text-sm text-gray-500">
            Please check back in a few minutes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}