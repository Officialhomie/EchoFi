// src/hooks/useErrorHandler.ts - Centralized error handling hook
import { useState, useCallback, useEffect, useRef } from 'react';
import { ErrorHandler, ErrorType, ErrorContext, ProcessedError } from '@/lib/error-handling';
import { useSafeAsync } from './usePerformance';

export interface UseErrorHandlerOptions {
  context?: Partial<ErrorContext>;
  enableRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  onError?: (error: ProcessedError) => void;
  onRetry?: (attempt: number) => void;
  onMaxRetriesReached?: (error: ProcessedError) => void;
}

export interface ErrorState {
  error: ProcessedError | null;
  isError: boolean;
  retryCount: number;
  isRetrying: boolean;
  canRetry: boolean;
}

export interface ErrorActions {
  handleError: (error: unknown, type: ErrorType, context?: Partial<ErrorContext>) => ProcessedError;
  clearError: () => void;
  retry: () => Promise<void>;
  retryWithCallback: (callback: () => Promise<void>) => Promise<void>;
}

/**
 * Centralized error handling hook with retry capabilities
 */
export function useErrorHandler(options: UseErrorHandlerOptions = {}): ErrorState & ErrorActions {
  const {
    context: defaultContext = {},
    enableRetry = true,
    maxRetries = 3,
    retryDelay = 1000,
    onError,
    onRetry,
    onMaxRetriesReached
  } = options;

  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isError: false,
    retryCount: 0,
    isRetrying: false,
    canRetry: false
  });

  const { safeAsyncCall } = useSafeAsync();
  const lastFailedAction = useRef<(() => Promise<void>) | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Handle error with centralized processing
   */
  const handleError = useCallback((
    error: unknown,
    type: ErrorType,
    context: Partial<ErrorContext> = {}
  ): ProcessedError => {
    const mergedContext = { ...defaultContext, ...context };
    
    let processedError: ProcessedError;
    
    // Use appropriate error handler based on type
    switch (type) {
      case ErrorType.XMTP_ERROR:
        processedError = ErrorHandler.handleXMTPError(error, mergedContext);
        break;
      case ErrorType.AGENT_ERROR:
        processedError = ErrorHandler.handleAgentError(error, mergedContext);
        break;
      case ErrorType.WALLET_ERROR:
        processedError = ErrorHandler.handleWalletError(error, mergedContext);
        break;
      case ErrorType.API_ERROR:
        processedError = ErrorHandler.handleApiError(error, mergedContext);
        break;
      default:
        processedError = ErrorHandler.getInstance()['processError'](error, type, mergedContext);
    }

    // Update error state
    setErrorState(prev => ({
      ...prev,
      error: processedError,
      isError: true,
      canRetry: enableRetry && processedError.retryable && prev.retryCount < maxRetries
    }));

    // Call error callback
    if (onError) {
      onError(processedError);
    }

    return processedError;
  }, [defaultContext, enableRetry, maxRetries, onError]);

  /**
   * Clear current error state
   */
  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isError: false,
      retryCount: 0,
      isRetrying: false,
      canRetry: false
    });
    lastFailedAction.current = null;
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  /**
   * Retry the last failed action
   */
  const retry = useCallback(async (): Promise<void> => {
    if (!errorState.canRetry || !lastFailedAction.current || errorState.isRetrying) {
      return;
    }

    const newRetryCount = errorState.retryCount + 1;
    
    setErrorState(prev => ({
      ...prev,
      isRetrying: true,
      retryCount: newRetryCount
    }));

    // Call retry callback
    if (onRetry) {
      onRetry(newRetryCount);
    }

    try {
      // Add delay before retry
      if (retryDelay > 0) {
        await new Promise(resolve => {
          retryTimeoutRef.current = setTimeout(resolve, retryDelay * newRetryCount);
        });
      }

      // Execute the retry
      await safeAsyncCall(lastFailedAction.current);
      
      // Success - clear error
      clearError();
      
    } catch (retryError) {
      // Retry failed
      const canRetryAgain = newRetryCount < maxRetries;
      
      setErrorState(prev => ({
        ...prev,
        isRetrying: false,
        canRetry: canRetryAgain
      }));

      // If max retries reached
      if (!canRetryAgain) {
        if (onMaxRetriesReached && errorState.error) {
          onMaxRetriesReached(errorState.error);
        }
      }

      // Re-process the error if it's different
      if (retryError !== errorState.error) {
        // Extract error type from current error or default to unknown
        const errorType = errorState.error?.type || ErrorType.UNKNOWN_ERROR;
        handleError(retryError, errorType, { 
          metadata: { retryAttempt: newRetryCount }
        });
      }
    }
  }, [errorState, maxRetries, retryDelay, onRetry, onMaxRetriesReached, safeAsyncCall, clearError, handleError]);

  /**
   * Retry with a specific callback
   */
  const retryWithCallback = useCallback(async (callback: () => Promise<void>): Promise<void> => {
    lastFailedAction.current = callback;
    await retry();
  }, [retry]);

  /**
   * Auto-retry for certain error types
   */
  useEffect(() => {
    if (errorState.error && 
        errorState.canRetry && 
        !errorState.isRetrying &&
        errorState.error.retryable &&
        errorState.retryCount === 0) {
      
      // Auto-retry for certain error codes
      const autoRetryErrors = [
        'XMTP_NETWORK_ERROR',
        'API_REQUEST_FAILED',
        'AGENT_NETWORK_ERROR'
      ];

      if (autoRetryErrors.includes(errorState.error.code)) {
        // Auto-retry after a short delay
        retryTimeoutRef.current = setTimeout(() => {
          retry();
        }, 1000);
      }
    }
  }, [errorState.error, errorState.canRetry, errorState.isRetrying, errorState.retryCount, retry]);

  /**
   * Cleanup timeout on unmount
   */
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...errorState,
    handleError,
    clearError,
    retry,
    retryWithCallback
  };
}

/**
 * Specialized hooks for different error types
 */
export function useXMTPErrorHandler(context?: Partial<ErrorContext>) {
  return useErrorHandler({
    context: { ...context, component: context?.component || 'XMTP' },
    enableRetry: true,
    maxRetries: 3,
    retryDelay: 2000 // Longer delay for XMTP errors
  });
}

export function useAgentErrorHandler(context?: Partial<ErrorContext>) {
  return useErrorHandler({
    context: { ...context, component: context?.component || 'Agent' },
    enableRetry: true,
    maxRetries: 2, // Fewer retries for agent errors
    retryDelay: 3000
  });
}

export function useWalletErrorHandler(context?: Partial<ErrorContext>) {
  return useErrorHandler({
    context: { ...context, component: context?.component || 'Wallet' },
    enableRetry: false, // Most wallet errors shouldn't auto-retry
    maxRetries: 0
  });
}

export function useApiErrorHandler(context?: Partial<ErrorContext>) {
  return useErrorHandler({
    context: { ...context, component: context?.component || 'API' },
    enableRetry: true,
    maxRetries: 3,
    retryDelay: 1000
  });
}

/**
 * Hook for global error boundary integration
 */
export function useGlobalErrorHandler() {
  const [globalErrors, setGlobalErrors] = useState<ProcessedError[]>([]);

  useEffect(() => {
    const errorHandler = ErrorHandler.getInstance();
    
    const unsubscribe = errorHandler.onError((error) => {
      setGlobalErrors(prev => [...prev, error]);
    });

    return unsubscribe;
  }, []);

  const dismissError = useCallback((error: ProcessedError) => {
    setGlobalErrors(prev => prev.filter(e => e !== error));
  }, []);

  const clearAllErrors = useCallback(() => {
    setGlobalErrors([]);
  }, []);

  return {
    globalErrors,
    dismissError,
    clearAllErrors
  };
}