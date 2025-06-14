// src/lib/error-handling.ts - Centralized error handling for EchoFi
import { Logger } from './logger';

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  groupId?: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export interface ProcessedError {
  type: ErrorType;
  message: string;
  userMessage: string;
  code: string;
  context: ErrorContext;
  recoverable: boolean;
  retryable: boolean;
  suggestions: string[];
}

export enum ErrorType {
  WALLET_ERROR = 'WALLET_ERROR',
  XMTP_ERROR = 'XMTP_ERROR',
  AGENT_ERROR = 'AGENT_ERROR',
  API_ERROR = 'API_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private logger: Logger;
  private errorCounts = new Map<string, number>();
  private listeners: ((error: ProcessedError) => void)[] = [];

  private constructor() {
    this.logger = Logger.getInstance();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Process and handle XMTP-related errors
   */
  static handleXMTPError(error: unknown, context: ErrorContext): ProcessedError {
    const instance = ErrorHandler.getInstance();
    return instance.processError(error, ErrorType.XMTP_ERROR, context);
  }

  /**
   * Process and handle Agent-related errors
   */
  static handleAgentError(error: unknown, context: ErrorContext): ProcessedError {
    const instance = ErrorHandler.getInstance();
    return instance.processError(error, ErrorType.AGENT_ERROR, context);
  }

  /**
   * Process and handle Wallet-related errors
   */
  static handleWalletError(error: unknown, context: ErrorContext): ProcessedError {
    const instance = ErrorHandler.getInstance();
    return instance.processError(error, ErrorType.WALLET_ERROR, context);
  }

  /**
   * Process and handle API-related errors
   */
  static handleApiError(error: unknown, context: ErrorContext): ProcessedError {
    const instance = ErrorHandler.getInstance();
    return instance.processError(error, ErrorType.API_ERROR, context);
  }

  /**
   * Core error processing logic
   */
  private processError(error: unknown, type: ErrorType, context: ErrorContext): ProcessedError {
    const errorString = this.extractErrorMessage(error);
    const processed = this.analyzeError(errorString, type, context);
    
    // Log the error
    this.logger.error(`${type}: ${processed.message}`, error as Error, processed.context);
    
    // Track error frequency
    this.trackErrorFrequency(processed.code);
    
    // Notify listeners
    this.notifyListeners(processed);
    
    return processed;
  }

  /**
   * Extract meaningful error message from various error types
   */
  private extractErrorMessage(error: unknown): string {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (error && typeof error === 'object' && 'message' in error) {
      return String(error.message);
    }
    return 'An unknown error occurred';
  }

  /**
   * Analyze error and provide user-friendly context
   */
  private analyzeError(errorMessage: string, type: ErrorType, context: ErrorContext): ProcessedError {
    const baseError: ProcessedError = {
      type,
      message: errorMessage,
      userMessage: '',
      code: `${type}_GENERIC`,
      context: { ...context, timestamp: Date.now() },
      recoverable: false,
      retryable: false,
      suggestions: []
    };

    switch (type) {
      case ErrorType.XMTP_ERROR:
        return this.analyzeXMTPError(errorMessage, baseError);
      case ErrorType.AGENT_ERROR:
        return this.analyzeAgentError(errorMessage, baseError);
      case ErrorType.WALLET_ERROR:
        return this.analyzeWalletError(errorMessage, baseError);
      case ErrorType.API_ERROR:
        return this.analyzeApiError(errorMessage, baseError);
      default:
        return this.analyzeGenericError(errorMessage, baseError);
    }
  }

  /**
   * Analyze XMTP-specific errors
   */
  private analyzeXMTPError(message: string, baseError: ProcessedError): ProcessedError {
    if (message.includes('SequenceId')) {
      return {
        ...baseError,
        code: 'XMTP_SEQUENCE_ID_ERROR',
        userMessage: 'Message sync issue detected. We\'re fixing this automatically.',
        recoverable: true,
        retryable: true,
        suggestions: [
          'The app will attempt to repair the message database',
          'If the issue persists, try refreshing the page',
          'Clear browser data if problems continue'
        ]
      };
    }

    if (message.includes('database') || message.includes('sync')) {
      return {
        ...baseError,
        code: 'XMTP_DATABASE_ERROR',
        userMessage: 'Message database needs to be reset. This will not affect your messages.',
        recoverable: true,
        retryable: true,
        suggestions: [
          'Message database will be automatically reset',
          'Your messages are safely stored on the network',
          'Refresh the page to complete the reset'
        ]
      };
    }

    if (message.includes('network') || message.includes('connection')) {
      return {
        ...baseError,
        code: 'XMTP_NETWORK_ERROR',
        userMessage: 'Connection to messaging network failed. Please check your internet connection.',
        recoverable: true,
        retryable: true,
        suggestions: [
          'Check your internet connection',
          'Try refreshing the page',
          'If using VPN, try disconnecting it'
        ]
      };
    }

    return {
      ...baseError,
      code: 'XMTP_UNKNOWN_ERROR',
      userMessage: 'An unexpected messaging error occurred. Please try again.',
      recoverable: true,
      retryable: true,
      suggestions: ['Try refreshing the page', 'Contact support if the issue persists']
    };
  }

  /**
   * Analyze Agent-specific errors
   */
  private analyzeAgentError(message: string, baseError: ProcessedError): ProcessedError {
    if (message.includes('CDP_API_KEY') || message.includes('credentials')) {
      return {
        ...baseError,
        code: 'AGENT_CREDENTIALS_ERROR',
        userMessage: 'Agent configuration issue. Please contact support.',
        recoverable: false,
        retryable: false,
        suggestions: ['This appears to be a configuration issue', 'Please contact support']
      };
    }

    if (message.includes('insufficient') || message.includes('balance')) {
      return {
        ...baseError,
        code: 'AGENT_INSUFFICIENT_BALANCE',
        userMessage: 'Insufficient balance to complete this operation.',
        recoverable: true,
        retryable: false,
        suggestions: [
          'Add more funds to your wallet',
          'Try a smaller amount',
          'Check gas fees requirements'
        ]
      };
    }

    if (message.includes('network') || message.includes('RPC')) {
      return {
        ...baseError,
        code: 'AGENT_NETWORK_ERROR',
        userMessage: 'Blockchain network error. Please try again.',
        recoverable: true,
        retryable: true,
        suggestions: [
          'Try again in a few moments',
          'Check your network connection',
          'Switch to a different RPC if available'
        ]
      };
    }

    return {
      ...baseError,
      code: 'AGENT_EXECUTION_ERROR',
      userMessage: 'Agent operation failed. Please try again.',
      recoverable: true,
      retryable: true,
      suggestions: ['Try the operation again', 'Contact support if the issue persists']
    };
  }

  /**
   * Analyze Wallet-specific errors
   */
  private analyzeWalletError(message: string, baseError: ProcessedError): ProcessedError {
    if (message.includes('rejected') || message.includes('denied')) {
      return {
        ...baseError,
        code: 'WALLET_USER_REJECTED',
        userMessage: 'Transaction was cancelled by user.',
        recoverable: true,
        retryable: true,
        suggestions: ['Try the operation again', 'Approve the transaction in your wallet']
      };
    }

    if (message.includes('network') || message.includes('chain')) {
      return {
        ...baseError,
        code: 'WALLET_WRONG_NETWORK',
        userMessage: 'Please switch to the correct network in your wallet.',
        recoverable: true,
        retryable: true,
        suggestions: [
          'Switch to Base network in your wallet',
          'Check network settings',
          'Refresh the page after switching networks'
        ]
      };
    }

    return {
      ...baseError,
      code: 'WALLET_CONNECTION_ERROR',
      userMessage: 'Wallet connection failed. Please try connecting again.',
      recoverable: true,
      retryable: true,
      suggestions: ['Try connecting your wallet again', 'Refresh the page', 'Try a different wallet']
    };
  }

  /**
   * Analyze API-specific errors
   */
  private analyzeApiError(message: string, baseError: ProcessedError): ProcessedError {
    // This would be expanded based on your API error patterns
    return {
      ...baseError,
      code: 'API_REQUEST_FAILED',
      userMessage: 'Server request failed. Please try again.',
      recoverable: true,
      retryable: true,
      suggestions: ['Try again in a few moments', 'Check your internet connection']
    };
  }

  /**
   * Analyze generic errors
   */
  private analyzeGenericError(message: string, baseError: ProcessedError): ProcessedError {
    return {
      ...baseError,
      userMessage: 'An unexpected error occurred. Please try again.',
      suggestions: ['Try refreshing the page', 'Contact support if the issue persists']
    };
  }

  /**
   * Track error frequency for monitoring
   */
  private trackErrorFrequency(errorCode: string): void {
    const current = this.errorCounts.get(errorCode) || 0;
    this.errorCounts.set(errorCode, current + 1);

    // Log frequent errors
    if (current > 5) {
      this.logger.warn(`Frequent error detected: ${errorCode} (${current} occurrences)`);
    }
  }

  /**
   * Add error listener for global error handling
   */
  onError(listener: (error: ProcessedError) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all error listeners
   */
  private notifyListeners(error: ProcessedError): void {
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        this.logger.error('Error in error listener', err as Error);
      }
    });
  }

  /**
   * Get error statistics
   */
  getErrorStats(): Record<string, number> {
    return Object.fromEntries(this.errorCounts);
  }

  /**
   * Clear error statistics
   */
  clearErrorStats(): void {
    this.errorCounts.clear();
  }
}