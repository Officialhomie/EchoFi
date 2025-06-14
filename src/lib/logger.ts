// src/lib/logger.ts - Centralized logging service for EchoFi
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
}
  
export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: number;
    context?: Record<string, any>;
    error?: Error;
    component?: string;
    userId?: string;
  }
  
  export interface LoggerConfig {
    level: LogLevel;
    enableConsole: boolean;
    enableRemote: boolean;
    enableStorage: boolean;
    maxStorageEntries: number;
    remoteEndpoint?: string;
  }
  
  export class Logger {
    private static instance: Logger;
    private config: LoggerConfig;
    private logs: LogEntry[] = [];
    private remoteQueue: LogEntry[] = [];
    private isFlushingRemote = false;
  
    private constructor() {
      this.config = this.getDefaultConfig();
      this.setupUnhandledErrorCapture();
    }
  
    static getInstance(): Logger {
      if (!Logger.instance) {
        Logger.instance = new Logger();
      }
      return Logger.instance;
    }
  
    /**
     * Configure logger settings
     */
    configure(config: Partial<LoggerConfig>): void {
      this.config = { ...this.config, ...config };
    }
  
    /**
     * Debug level logging
     */
    debug(message: string, context?: Record<string, any>): void {
      this.log(LogLevel.DEBUG, message, context);
    }
  
    /**
     * Info level logging
     */
    info(message: string, context?: Record<string, any>): void {
      this.log(LogLevel.INFO, message, context);
    }
  
    /**
     * Warning level logging
     */
    warn(message: string, context?: Record<string, any>): void {
      this.log(LogLevel.WARN, message, context);
    }
  
    /**
     * Error level logging
     */
    error(message: string, error?: Error, context?: Record<string, any>): void {
      this.log(LogLevel.ERROR, message, context, error);
    }
  
    /**
     * Core logging method
     */
    private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
      // Check if this log level should be recorded
      if (level < this.config.level) {
        return;
      }
  
      const entry: LogEntry = {
        level,
        message,
        timestamp: Date.now(),
        context,
        error,
        component: context?.component,
        userId: context?.userId
      };
  
      // Store in memory (with size limit)
      if (this.config.enableStorage) {
        this.logs.push(entry);
        if (this.logs.length > this.config.maxStorageEntries) {
          this.logs.shift(); // Remove oldest entry
        }
      }
  
      // Output to console
      if (this.config.enableConsole) {
        this.logToConsole(entry);
      }
  
      // Queue for remote logging
      if (this.config.enableRemote && this.config.remoteEndpoint) {
        this.queueForRemote(entry);
      }
    }
  
    /**
     * Output log entry to console with appropriate styling
     */
    private logToConsole(entry: LogEntry): void {
      const timestamp = new Date(entry.timestamp).toISOString();
      const prefix = `[${timestamp}] ${this.getLevelName(entry.level)}:`;
      
      const style = this.getConsoleStyle(entry.level);
      
      if (entry.error) {
        console.group(`%c${prefix} ${entry.message}`, style);
        console.error('Error:', entry.error);
        if (entry.context) {
          console.log('Context:', entry.context);
        }
        console.groupEnd();
      } else {
        if (entry.context && Object.keys(entry.context).length > 0) {
          console.group(`%c${prefix} ${entry.message}`, style);
          console.log('Context:', entry.context);
          console.groupEnd();
        } else {
          console.log(`%c${prefix} ${entry.message}`, style);
        }
      }
    }
  
    /**
     * Get console styling for log level
     */
    private getConsoleStyle(level: LogLevel): string {
      switch (level) {
        case LogLevel.DEBUG:
          return 'color: #6B7280; font-weight: normal;';
        case LogLevel.INFO:
          return 'color: #3B82F6; font-weight: normal;';
        case LogLevel.WARN:
          return 'color: #F59E0B; font-weight: bold;';
        case LogLevel.ERROR:
          return 'color: #EF4444; font-weight: bold;';
        default:
          return 'color: inherit;';
      }
    }
  
    /**
     * Get human-readable log level name
     */
    private getLevelName(level: LogLevel): string {
      switch (level) {
        case LogLevel.DEBUG: return 'DEBUG';
        case LogLevel.INFO: return 'INFO';
        case LogLevel.WARN: return 'WARN';
        case LogLevel.ERROR: return 'ERROR';
        default: return 'UNKNOWN';
      }
    }
  
    /**
     * Queue log entry for remote transmission
     */
    private queueForRemote(entry: LogEntry): void {
      this.remoteQueue.push(entry);
      
      // Auto-flush on error or when queue gets large
      if (entry.level >= LogLevel.ERROR || this.remoteQueue.length >= 10) {
        this.flushRemoteLogs();
      }
    }
  
    /**
     * Send queued logs to remote endpoint
     */
    private async flushRemoteLogs(): Promise<void> {
      if (this.isFlushingRemote || this.remoteQueue.length === 0 || !this.config.remoteEndpoint) {
        return;
      }
  
      this.isFlushingRemote = true;
      const logsToSend = [...this.remoteQueue];
      this.remoteQueue = [];
  
      try {
        await fetch(this.config.remoteEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            logs: logsToSend.map(entry => ({
              ...entry,
              error: entry.error ? {
                message: entry.error.message,
                stack: entry.error.stack,
                name: entry.error.name
              } : undefined
            }))
          })
        });
      } catch (error) {
        // Failed to send logs - put them back in queue (but don't log this error to avoid infinite loop)
        this.remoteQueue.unshift(...logsToSend);
        console.warn('Failed to send logs to remote endpoint:', error);
      } finally {
        this.isFlushingRemote = false;
      }
    }
  
    /**
     * Get stored log entries
     */
    getLogs(filterLevel?: LogLevel): LogEntry[] {
      if (filterLevel !== undefined) {
        return this.logs.filter(log => log.level >= filterLevel);
      }
      return [...this.logs];
    }
  
    /**
     * Clear stored logs
     */
    clearLogs(): void {
      this.logs = [];
    }
  
    /**
     * Export logs as JSON
     */
    exportLogs(): string {
      return JSON.stringify(this.logs, null, 2);
    }
  
    /**
     * Setup capture of unhandled errors and rejections
     */
    private setupUnhandledErrorCapture(): void {
      if (typeof window !== 'undefined') {
        // Capture unhandled JavaScript errors
        window.addEventListener('error', (event) => {
          this.error('Unhandled JavaScript error', event.error, {
            component: 'window',
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          });
        });
  
        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
          this.error('Unhandled promise rejection', 
            event.reason instanceof Error ? event.reason : new Error(String(event.reason)), 
            {
              component: 'promise',
              reason: event.reason
            }
          );
        });
      }
    }
  
    /**
     * Get default configuration based on environment
     */
    private getDefaultConfig(): LoggerConfig {
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      return {
        level: isDevelopment ? LogLevel.DEBUG : LogLevel.INFO,
        enableConsole: true,
        enableRemote: !isDevelopment, // Only enable remote logging in production
        enableStorage: true,
        maxStorageEntries: 1000,
        remoteEndpoint: process.env.NEXT_PUBLIC_LOGGING_ENDPOINT
      };
    }
  
    /**
     * Create a child logger with context
     */
    child(context: Record<string, any>): ChildLogger {
      return new ChildLogger(this, context);
    }
  
    /**
     * Flush any pending remote logs (useful for app shutdown)
     */
    async flush(): Promise<void> {
      await this.flushRemoteLogs();
    }
  }
  
  /**
   * Child logger that automatically includes context
   */
  export class ChildLogger {
    constructor(
      private parent: Logger,
      private defaultContext: Record<string, any>
    ) {}
  
    debug(message: string, context?: Record<string, any>): void {
      this.parent.debug(message, { ...this.defaultContext, ...context });
    }
  
    info(message: string, context?: Record<string, any>): void {
      this.parent.info(message, { ...this.defaultContext, ...context });
    }
  
    warn(message: string, context?: Record<string, any>): void {
      this.parent.warn(message, { ...this.defaultContext, ...context });
    }
  
    error(message: string, error?: Error, context?: Record<string, any>): void {
      this.parent.error(message, error, { ...this.defaultContext, ...context });
    }
  }