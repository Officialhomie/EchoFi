'use client';

import { useEffect } from 'react';
import { ProcessedError } from '@/lib/error-handling';
import { Card, CardHeader, CardTitle, CardContent } from './card';
import { Button } from './button';
import { Spinner } from './loading';
import { 
  XCircleIcon, 
  RefreshCwIcon, 
  XIcon, 
  AlertTriangleIcon,
  InfoIcon,
  CheckCircleIcon
} from 'lucide-react';

interface ErrorDisplayProps {
  error: ProcessedError;
  onRetry?: () => void;
  onDismiss?: () => void;
  isRetrying?: boolean;
  className?: string;
  compact?: boolean;
  showSuggestions?: boolean;
}

export function ErrorDisplay({
  error,
  onRetry,
  onDismiss,
  isRetrying = false,
  className = '',
  compact = false,
  showSuggestions = true
}: ErrorDisplayProps) {
  const getErrorIcon = () => {
    if (isRetrying) {
      return <Spinner size="sm" />;
    }

    switch (error.type) {
      case 'WALLET_ERROR':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      case 'XMTP_ERROR':
        return <AlertTriangleIcon className="w-5 h-5 text-orange-500" />;
      case 'AGENT_ERROR':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      case 'API_ERROR':
        return <AlertTriangleIcon className="w-5 h-5 text-yellow-500" />;
      default:
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
    }
  };

  const getErrorColor = () => {
    switch (error.type) {
      case 'WALLET_ERROR':
        return 'border-red-200 bg-red-50';
      case 'XMTP_ERROR':
        return 'border-orange-200 bg-orange-50';
      case 'AGENT_ERROR':
        return 'border-red-200 bg-red-50';
      case 'API_ERROR':
        return 'border-yellow-200 bg-yellow-50';
      default:
        return 'border-red-200 bg-red-50';
    }
  };

  const getTextColor = () => {
    switch (error.type) {
      case 'WALLET_ERROR':
        return 'text-red-800';
      case 'XMTP_ERROR':
        return 'text-orange-800';
      case 'AGENT_ERROR':
        return 'text-red-800';
      case 'API_ERROR':
        return 'text-yellow-800';
      default:
        return 'text-red-800';
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center p-3 rounded-md ${getErrorColor()} ${className}`}>
        <div className="flex-shrink-0 mr-3">
          {getErrorIcon()}
        </div>
        
        <div className="flex-1">
          <p className={`text-sm font-medium ${getTextColor()}`}>
            {error.userMessage}
          </p>
        </div>

        <div className="flex items-center space-x-2 ml-3">
          {onRetry && error.retryable && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
              disabled={isRetrying}
              className="text-xs"
            >
              {isRetrying ? (
                <>
                  <Spinner size="xs" className="mr-1" />
                  Retrying
                </>
              ) : (
                <>
                  <RefreshCwIcon className="w-3 h-3 mr-1" />
                  Retry
                </>
              )}
            </Button>
          )}
          
          {onDismiss && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              className="text-xs p-1"
            >
              <XIcon className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className={`${getErrorColor()} ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className={`flex items-center ${getTextColor()}`}>
          <div className="flex-shrink-0 mr-3">
            {getErrorIcon()}
          </div>
          <div className="flex-1">
            <div className="font-medium">
              {error.recoverable ? 'Recoverable Error' : 'Error'}
            </div>
            <div className="text-sm font-normal mt-1">
              Code: {error.code}
            </div>
          </div>
          {onDismiss && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              className="ml-2"
            >
              <XIcon className="w-4 h-4" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className={`text-sm ${getTextColor()} mb-4`}>
          {error.userMessage}
        </div>

        {/* Technical details (collapsible) */}
        {error.message !== error.userMessage && (
          <details className="mb-4">
            <summary className={`cursor-pointer text-xs ${getTextColor()} opacity-75 hover:opacity-100`}>
              Technical details
            </summary>
            <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
              {error.message}
            </pre>
          </details>
        )}

        {/* Error context */}
        {error.context && Object.keys(error.context).length > 0 && (
          <details className="mb-4">
            <summary className={`cursor-pointer text-xs ${getTextColor()} opacity-75 hover:opacity-100`}>
              Context information
            </summary>
            <div className="mt-2 text-xs bg-gray-100 p-2 rounded">
              {Object.entries(error.context).map(([key, value]) => (
                <div key={key} className="flex">
                  <span className="font-medium mr-2">{key}:</span>
                  <span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Suggestions */}
        {showSuggestions && error.suggestions.length > 0 && (
          <div className="mb-4">
            <div className={`flex items-center text-sm font-medium ${getTextColor()} mb-2`}>
              <InfoIcon className="w-4 h-4 mr-1" />
              Suggestions
            </div>
            <ul className={`text-sm ${getTextColor()} space-y-1`}>
              {error.suggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start">
                  <CheckCircleIcon className="w-3 h-3 mr-2 mt-0.5 flex-shrink-0" />
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center space-x-3">
          {onRetry && error.retryable && (
            <Button
              onClick={onRetry}
              disabled={isRetrying}
              variant="default"
              size="sm"
            >
              {isRetrying ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCwIcon className="w-4 h-4 mr-2" />
                  Try Again
                </>
              )}
            </Button>
          )}

          {error.recoverable && !error.retryable && (
            <div className={`text-xs ${getTextColor()} opacity-75`}>
              This error may resolve itself. If it persists, try refreshing the page.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Toast-style error notification
 */
interface ErrorToastProps {
  error: ProcessedError;
  onDismiss: () => void;
  duration?: number;
}

export function ErrorToast({ error, onDismiss, duration = 5000 }: ErrorToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <ErrorDisplay
        error={error}
        onDismiss={onDismiss}
        compact
        showSuggestions={false}
        className="shadow-lg"
      />
    </div>
  );
}

/**
 * Error list for displaying multiple errors
 */
interface ErrorListProps {
  errors: ProcessedError[];
  onDismiss: (error: ProcessedError) => void;
  onRetry?: (error: ProcessedError) => void;
  maxVisible?: number;
}

export function ErrorList({ errors, onDismiss, onRetry, maxVisible = 3 }: ErrorListProps) {
  const visibleErrors = errors.slice(0, maxVisible);
  const hiddenCount = errors.length - maxVisible;

  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {visibleErrors.map((error, index) => (
        <ErrorDisplay
          key={`${error.code}-${error.context.timestamp}-${index}`}
          error={error}
          onDismiss={() => onDismiss(error)}
          onRetry={onRetry ? () => onRetry(error) : undefined}
          compact
        />
      ))}
      
      {hiddenCount > 0 && (
        <div className="text-sm text-gray-500 text-center py-2">
          ... and {hiddenCount} more error{hiddenCount === 1 ? '' : 's'}
        </div>
      )}
    </div>
  );
}