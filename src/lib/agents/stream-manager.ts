

import { Client, DecodedMessage } from '@xmtp/browser-sdk';
import { db } from '../db-enhanced';
import { conversationHealth, messageMetrics } from '../db-enhanced';
import { sql } from 'drizzle-orm';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface GroupConversation {
  id: string;
  name?: string;
  description?: string;
  send: (content: string) => Promise<void>;
  streamMessages?: () => AsyncGenerator<DecodedMessage>;
}

export interface StreamHealthStatus {
  isHealthy: boolean;
  activeStreams: number;
  failedStreams: string[];
  lastHealthCheck: Date;
  reconnectionAttempts: Record<string, number>;
  circuitBreakerStatus: Record<string, 'closed' | 'open' | 'half-open'>;
  messageQueueSizes: Record<string, number>;
}

export interface StreamMetrics {
  totalStreams: number;
  activeStreams: number;
  failedStreams: number;
  totalReconnections: number;
  averageReconnectionTime: number;
  successRate: number;
  uptimePercentage: number;
  lastSuccessfulConnection: Date | null;
}

export interface ConnectionStatus {
  status: 'connected' | 'connecting' | 'disconnected' | 'error' | 'degraded';
  details: string;
  lastStatusChange: Date;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'critical';
}

export interface QueuedMessage {
  id: string;
  groupId: string;
  message: DecodedMessage;
  timestamp: Date;
  retryCount: number;
}

export interface StreamConfig {
  maxReconnectionAttempts: number;
  baseReconnectionDelay: number;
  maxReconnectionDelay: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  healthCheckInterval: number;
  messageQueueMaxSize: number;
  heartbeatInterval: number;
}

// =============================================================================
// ERROR CLASSIFICATION
// =============================================================================

export enum StreamErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  PROTOCOL_ERROR = 'PROTOCOL_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface ClassifiedError {
  type: StreamErrorType;
  isRecoverable: boolean;
  recommendedAction: 'retry' | 'backoff' | 'circuit_break' | 'escalate';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// =============================================================================
// CIRCUIT BREAKER IMPLEMENTATION
// =============================================================================

class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(
    private threshold: number,
    private timeout: number
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= 2) {
        this.state = 'closed';
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'open';
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }
}

// =============================================================================
// STREAM MANAGER CLASS
// =============================================================================

export class StreamManager {
  private xmtpClient: Client | null = null;
  private activeStreams = new Map<string, AsyncGenerator<DecodedMessage>>();
  private streamControllers = new Map<string, AbortController>();
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private reconnectionAttempts = new Map<string, number>();
  private messageQueues = new Map<string, QueuedMessage[]>();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private onMessageCallback: ((message: DecodedMessage, groupId: string) => Promise<void>) | null = null;
  private onStreamHealthChange: ((status: StreamHealthStatus) => void) | null = null;
  private onError: ((error: Error, groupId: string) => void) | null = null;

  private config: StreamConfig = {
    maxReconnectionAttempts: 10,
    baseReconnectionDelay: 1000,
    maxReconnectionDelay: 30000,
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 60000,
    healthCheckInterval: 30000,
    messageQueueMaxSize: 1000,
    heartbeatInterval: 15000
  };

  private metrics: StreamMetrics = {
    totalStreams: 0,
    activeStreams: 0,
    failedStreams: 0,
    totalReconnections: 0,
    averageReconnectionTime: 0,
    successRate: 100,
    uptimePercentage: 100,
    lastSuccessfulConnection: null
  };

  constructor(
    xmtpClient: Client,
    config?: Partial<StreamConfig>
  ) {
    this.xmtpClient = xmtpClient;
    this.config = { ...this.config, ...config };
    this.startHealthMonitoring();
    this.startHeartbeat();
  }

  // =============================================================================
  // CORE STREAM MANAGEMENT
  // =============================================================================

  /**
   * Create and manage a message stream for a group with automatic recovery
   */
  async createStream(groupId: string): Promise<AsyncGenerator<DecodedMessage> | null> {
    console.log(`🔄 [STREAM-MANAGER] Creating stream for group: ${groupId}`);

    try {
      // Initialize circuit breaker for this group
      if (!this.circuitBreakers.has(groupId)) {
        this.circuitBreakers.set(groupId, new CircuitBreaker(
          this.config.circuitBreakerThreshold,
          this.config.circuitBreakerTimeout
        ));
      }

      const stream = await this.initializeStream(groupId);
      if (stream) {
        this.activeStreams.set(groupId, stream);
        this.resetReconnectionAttempts(groupId);
        this.updateMetrics();
        await this.updateDatabaseHealth(groupId, true);
        
        // Start processing messages from this stream
        this.processStreamMessages(groupId, stream);
        
        console.log(`✅ [STREAM-MANAGER] Stream created successfully for group: ${groupId}`);
        return stream;
      }

      return null;
    } catch (error) {
      console.error(`❌ [STREAM-MANAGER] Failed to create stream for group ${groupId}:`, error);
      await this.handleStreamFailure(groupId, error as Error);
      return null;
    }
  }

  /**
   * Restart a failed stream with exponential backoff
   */
  async restartStream(groupId: string): Promise<void> {
    console.log(`🔄 [STREAM-MANAGER] Restarting stream for group: ${groupId}`);

    const attempts = this.reconnectionAttempts.get(groupId) || 0;
    
    if (attempts >= this.config.maxReconnectionAttempts) {
      console.error(`❌ [STREAM-MANAGER] Max reconnection attempts reached for group: ${groupId}`);
      await this.handleMaxRetriesReached(groupId);
      return;
    }

    // Calculate exponential backoff delay
    const delay = Math.min(
      this.config.baseReconnectionDelay * Math.pow(2, attempts),
      this.config.maxReconnectionDelay
    );

    console.log(`⏳ [STREAM-MANAGER] Waiting ${delay}ms before reconnection attempt ${attempts + 1} for group: ${groupId}`);
    
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await this.createStream(groupId);
    } catch (error) {
      console.error(`❌ [STREAM-MANAGER] Restart failed for group ${groupId}:`, error);
      this.incrementReconnectionAttempts(groupId);
      
      // Schedule next retry
      setTimeout(() => {
        this.restartStream(groupId);
      }, delay);
    }
  }

  /**
   * Perform comprehensive health check on all streams
   */
  async healthCheck(): Promise<StreamHealthStatus> {
    const status: StreamHealthStatus = {
      isHealthy: true,
      activeStreams: this.activeStreams.size,
      failedStreams: [],
      lastHealthCheck: new Date(),
      reconnectionAttempts: Object.fromEntries(this.reconnectionAttempts),
      circuitBreakerStatus: {},
      messageQueueSizes: {}
    };

    // Check circuit breaker status
    for (const [groupId, breaker] of this.circuitBreakers) {
      status.circuitBreakerStatus[groupId] = breaker.getState();
      if (breaker.getState() === 'open') {
        status.failedStreams.push(groupId);
        status.isHealthy = false;
      }
    }

    // Check message queue sizes
    for (const [groupId, queue] of this.messageQueues) {
      status.messageQueueSizes[groupId] = queue.length;
      if (queue.length > this.config.messageQueueMaxSize * 0.8) {
        status.isHealthy = false;
      }
    }

    // Validate active streams
    for (const [groupId] of this.activeStreams) {
      if (!await this.validateStreamHealth(groupId)) {
        status.failedStreams.push(groupId);
        status.isHealthy = false;
      }
    }

    // Update database with health status
    await this.persistHealthStatus(status);

    // Notify listeners
    if (this.onStreamHealthChange) {
      this.onStreamHealthChange(status);
    }

    console.log(`🏥 [STREAM-MANAGER] Health check completed. Status: ${status.isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
    return status;
  }

  // =============================================================================
  // RECOVERY MECHANISMS
  // =============================================================================

  /**
   * Reconnect with exponential backoff strategy
   */
  async reconnectWithBackoff(groupId: string): Promise<void> {
    const circuitBreaker = this.circuitBreakers.get(groupId);
    if (!circuitBreaker) return;

    try {
      await circuitBreaker.execute(async () => {
        await this.restartStream(groupId);
      });
    } catch (error) {
      console.error(`❌ [STREAM-MANAGER] Circuit breaker prevented reconnection for group: ${groupId}`, error);
      await this.queueReconnectionRetry(groupId);
    }
  }

  /**
   * Handle stream failure with appropriate recovery strategy
   */
  async handleStreamFailure(groupId: string, error: Error): Promise<void> {
    console.error(`❌ [STREAM-MANAGER] Stream failure for group ${groupId}:`, error);

    const classifiedError = this.classifyError(error);
    
    // Log error to database
    await this.logStreamError(groupId, error, classifiedError);

    // Clean up failed stream
    this.cleanupStream(groupId);

    // Execute recovery strategy based on error type
    switch (classifiedError.recommendedAction) {
      case 'retry':
        await this.reconnectWithBackoff(groupId);
        break;
      
      case 'backoff':
        setTimeout(() => {
          this.reconnectWithBackoff(groupId);
        }, this.config.baseReconnectionDelay * 2);
        break;
      
      case 'circuit_break':
        console.warn(`⚠️ [STREAM-MANAGER] Triggering circuit breaker for group: ${groupId}`);
        // Circuit breaker will handle this automatically
        break;
      
      case 'escalate':
        console.error(`🚨 [STREAM-MANAGER] Critical error for group ${groupId}, escalating...`);
        if (this.onError) {
          this.onError(error, groupId);
        }
        break;
    }

    // Update metrics and database
    this.metrics.failedStreams++;
    this.updateMetrics();
    await this.updateDatabaseHealth(groupId, false, error.message);
  }

  // =============================================================================
  // MONITORING AND METRICS
  // =============================================================================

  /**
   * Get comprehensive stream metrics
   */
  getStreamMetrics(): StreamMetrics {
    // Calculate success rate
    const totalOperations = this.metrics.totalReconnections + this.activeStreams.size;
    this.metrics.successRate = totalOperations > 0 
      ? ((this.activeStreams.size / totalOperations) * 100) 
      : 100;

    return { ...this.metrics };
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    const activeStreams = this.activeStreams.size;
    const totalExpectedStreams = this.metrics.totalStreams;
    const failedStreams = this.metrics.failedStreams;

    let status: ConnectionStatus['status'] = 'connected';
    let connectionQuality: ConnectionStatus['connectionQuality'] = 'excellent';
    let details = `${activeStreams} streams active`;

    if (activeStreams === 0 && totalExpectedStreams > 0) {
      status = 'disconnected';
      connectionQuality = 'critical';
      details = 'All streams disconnected';
    } else if (failedStreams > 0) {
      if (failedStreams / totalExpectedStreams > 0.5) {
        status = 'error';
        connectionQuality = 'critical';
        details = `${failedStreams} streams failed`;
      } else {
        status = 'degraded';
        connectionQuality = 'poor';
        details = `${failedStreams} streams experiencing issues`;
      }
    } else if (activeStreams / totalExpectedStreams < 0.8) {
      connectionQuality = 'good';
      details = `${activeStreams}/${totalExpectedStreams} streams active`;
    }

    return {
      status,
      details,
      lastStatusChange: new Date(),
      connectionQuality
    };
  }

  /**
   * Set callback for message handling
   */
  setMessageCallback(callback: (message: DecodedMessage, groupId: string) => Promise<void>): void {
    this.onMessageCallback = callback;
  }

  /**
   * Set callback for stream health changes
   */
  setHealthChangeCallback(callback: (status: StreamHealthStatus) => void): void {
    this.onStreamHealthChange = callback;
  }

  /**
   * Set callback for critical errors
   */
  setErrorCallback(callback: (error: Error, groupId: string) => void): void {
    this.onError = callback;
  }

  // =============================================================================
  // PRIVATE IMPLEMENTATION METHODS
  // =============================================================================

  private async initializeStream(groupId: string): Promise<AsyncGenerator<DecodedMessage> | null> {
    if (!this.xmtpClient) {
      throw new Error('XMTP client not initialized');
    }

    const groups = await this.xmtpClient.conversations.listGroups();
    const group = groups.find(g => g.id === groupId) as GroupConversation | undefined;

    if (!group || !group.streamMessages) {
      throw new Error(`Group ${groupId} not found or does not support streaming`);
    }

    const controller = new AbortController();
    this.streamControllers.set(groupId, controller);

    return await group.streamMessages();
  }

  private async processStreamMessages(groupId: string, stream: AsyncGenerator<DecodedMessage>): Promise<void> {
    try {
      for await (const message of stream) {
        // Check if stream should continue
        const controller = this.streamControllers.get(groupId);
        if (controller?.signal.aborted) {
          break;
        }

        // Process queued messages first
        await this.processQueuedMessages(groupId);

        // Process current message
        if (this.onMessageCallback) {
          try {
            await this.onMessageCallback(message, groupId);
          } catch (error) {
            console.error(`❌ [STREAM-MANAGER] Error processing message for group ${groupId}:`, error);
            // Queue message for retry
            await this.queueMessage(groupId, message);
          }
        }

        // Update metrics
        await this.updateMessageMetrics(groupId, 'receive', true);
      }
    } catch (error) {
      console.error(`❌ [STREAM-MANAGER] Stream processing error for group ${groupId}:`, error);
      await this.handleStreamFailure(groupId, error as Error);
    }
  }

  private async processQueuedMessages(groupId: string): Promise<void> {
    const queue = this.messageQueues.get(groupId) || [];
    if (queue.length === 0) return;

    console.log(`📤 [STREAM-MANAGER] Processing ${queue.length} queued messages for group: ${groupId}`);

    const processedMessages: string[] = [];

    for (const queuedMessage of queue) {
      try {
        if (this.onMessageCallback) {
          await this.onMessageCallback(queuedMessage.message, groupId);
          processedMessages.push(queuedMessage.id);
        }
      } catch (error) {
        console.error(`❌ [STREAM-MANAGER] Failed to process queued message ${queuedMessage.id}:`, error);
        queuedMessage.retryCount++;
        
        if (queuedMessage.retryCount >= 3) {
          console.error(`❌ [STREAM-MANAGER] Dropping message ${queuedMessage.id} after 3 retry attempts`);
          processedMessages.push(queuedMessage.id);
        }
      }
    }

    // Remove processed messages from queue
    if (processedMessages.length > 0) {
      const updatedQueue = queue.filter(msg => !processedMessages.includes(msg.id));
      this.messageQueues.set(groupId, updatedQueue);
    }
  }

  private async queueMessage(groupId: string, message: DecodedMessage): Promise<void> {
    const queue = this.messageQueues.get(groupId) || [];
    
    if (queue.length >= this.config.messageQueueMaxSize) {
      console.warn(`⚠️ [STREAM-MANAGER] Message queue full for group ${groupId}, dropping oldest message`);
      queue.shift();
    }

    const queuedMessage: QueuedMessage = {
      id: `${groupId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      groupId,
      message,
      timestamp: new Date(),
      retryCount: 0
    };

    queue.push(queuedMessage);
    this.messageQueues.set(groupId, queue);
  }

  private classifyError(error: Error): ClassifiedError {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return {
        type: StreamErrorType.NETWORK_ERROR,
        isRecoverable: true,
        recommendedAction: 'retry',
        severity: 'medium'
      };
    }

    if (message.includes('auth') || message.includes('unauthorized') || message.includes('signature')) {
      return {
        type: StreamErrorType.AUTHENTICATION_ERROR,
        isRecoverable: true,
        recommendedAction: 'escalate',
        severity: 'high'
      };
    }

    if (message.includes('rate limit') || message.includes('too many requests')) {
      return {
        type: StreamErrorType.RATE_LIMIT_ERROR,
        isRecoverable: true,
        recommendedAction: 'backoff',
        severity: 'medium'
      };
    }

    if (message.includes('protocol') || message.includes('version') || message.includes('mls')) {
      return {
        type: StreamErrorType.PROTOCOL_ERROR,
        isRecoverable: false,
        recommendedAction: 'circuit_break',
        severity: 'high'
      };
    }

    return {
      type: StreamErrorType.UNKNOWN_ERROR,
      isRecoverable: true,
      recommendedAction: 'retry',
      severity: 'medium'
    };
  }

  private cleanupStream(groupId: string): void {
    // Abort active stream
    const controller = this.streamControllers.get(groupId);
    if (controller) {
      controller.abort();
      this.streamControllers.delete(groupId);
    }

    // Remove from active streams
    this.activeStreams.delete(groupId);
  }

  private incrementReconnectionAttempts(groupId: string): void {
    const current = this.reconnectionAttempts.get(groupId) || 0;
    this.reconnectionAttempts.set(groupId, current + 1);
    this.metrics.totalReconnections++;
  }

  private resetReconnectionAttempts(groupId: string): void {
    this.reconnectionAttempts.set(groupId, 0);
    this.metrics.lastSuccessfulConnection = new Date();
  }

  private async handleMaxRetriesReached(groupId: string): Promise<void> {
    console.error(`🚨 [STREAM-MANAGER] Max retries reached for group: ${groupId}, marking as permanently failed`);
    
    // Mark stream as permanently failed in database
    await this.updateDatabaseHealth(groupId, false, 'Max reconnection attempts exceeded');
    
    // Notify error callback
    if (this.onError) {
      this.onError(new Error(`Max reconnection attempts exceeded for group: ${groupId}`), groupId);
    }
  }

  private async queueReconnectionRetry(groupId: string): Promise<void> {
    setTimeout(async () => {
      const circuitBreaker = this.circuitBreakers.get(groupId);
      if (circuitBreaker && circuitBreaker.getState() !== 'open') {
        await this.reconnectWithBackoff(groupId);
      }
    }, this.config.circuitBreakerTimeout);
  }

  private async validateStreamHealth(groupId: string): Promise<boolean> {
    // For now, just check if stream exists and is active
    // In the future, this could include heartbeat validation
    return this.activeStreams.has(groupId) && 
           !this.streamControllers.get(groupId)?.signal.aborted;
  }

  private updateMetrics(): void {
    this.metrics.activeStreams = this.activeStreams.size;
    this.metrics.totalStreams = this.activeStreams.size + this.metrics.failedStreams;
    
    const totalConnections = this.metrics.totalStreams;
    if (totalConnections > 0) {
      this.metrics.uptimePercentage = (this.activeStreams.size / totalConnections) * 100;
    }
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.healthCheck();
      } catch (error) {
        console.error('❌ [STREAM-MANAGER] Health check failed:', error);
      }
    }, this.config.healthCheckInterval);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      // Send heartbeat to all active streams to ensure they're still alive
      for (const groupId of this.activeStreams.keys()) {
        if (!await this.validateStreamHealth(groupId)) {
          console.warn(`💔 [STREAM-MANAGER] Heartbeat failed for group: ${groupId}`);
          await this.handleStreamFailure(groupId, new Error('Heartbeat validation failed'));
        }
      }
    }, this.config.heartbeatInterval);
  }

  // =============================================================================
  // DATABASE INTEGRATION
  // =============================================================================

  private async updateDatabaseHealth(groupId: string, isHealthy: boolean, issue?: string): Promise<void> {
    try {
      // Update conversation health in database
      await db.insert(conversationHealth)
        .values({
          id: `${groupId}-${Date.now()}`,
          conversationId: groupId,
          lastHealthCheck: new Date(),
          isHealthy,
          syncStatus: isHealthy ? 'synced' : 'failed',
          lastIssue: issue || null,
          recoveryAttempts: this.reconnectionAttempts.get(groupId) || 0,
          lastRecoveryAttempt: new Date()
        })
        .onConflictDoUpdate({
          target: conversationHealth.conversationId,
          set: {
            lastHealthCheck: new Date(),
            isHealthy,
            syncStatus: isHealthy ? 'synced' : 'failed',
            lastIssue: issue || null,
            recoveryAttempts: this.reconnectionAttempts.get(groupId) || 0,
            lastRecoveryAttempt: new Date(),
            updatedAt: new Date()
          }
        });
    } catch (error) {
      console.error('❌ [STREAM-MANAGER] Failed to update database health:', error);
    }
  }

  private async logStreamError(groupId: string, error: Error, classifiedError: ClassifiedError): Promise<void> {
    try {
      await db.insert(messageMetrics)
        .values({
          id: `error-${groupId}-${Date.now()}`,
          date: new Date(),
          conversationId: groupId,
          operationType: 'stream',
          method: 'xmtp',
          failureCount: 1,
          errorRate: '100.00',
          networkErrors: classifiedError.type === StreamErrorType.NETWORK_ERROR ? 1 : 0
        });
    } catch (dbError) {
      console.error('❌ [STREAM-MANAGER] Failed to log error to database:', dbError);
    }
  }

  private async updateMessageMetrics(groupId: string, operation: string, success: boolean): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await db.insert(messageMetrics)
        .values({
          id: `${operation}-${groupId}-${Date.now()}`,
          date: today,
          conversationId: groupId,
          operationType: operation,
          method: 'xmtp',
          successCount: success ? 1 : 0,
          failureCount: success ? 0 : 1,
          errorRate: success ? '0.00' : '100.00'
        })
        .onConflictDoUpdate({
          target: [messageMetrics.date, messageMetrics.conversationId, messageMetrics.operationType],
          set: {
            successCount: success ? 
              sql`${messageMetrics.successCount} + 1` : 
              messageMetrics.successCount,
            failureCount: !success ? 
              sql`${messageMetrics.failureCount} + 1` : 
              messageMetrics.failureCount
          }
        });
    } catch (error) {
      console.error('❌ [STREAM-MANAGER] Failed to update message metrics:', error);
    }
  }

  private async persistHealthStatus(status: StreamHealthStatus): Promise<void> {
    // Store the health status summary in database for monitoring
    for (const groupId of Object.keys(status.reconnectionAttempts)) {
      await this.updateDatabaseHealth(
        groupId, 
        !status.failedStreams.includes(groupId),
        status.failedStreams.includes(groupId) ? 'Stream unhealthy' : undefined
      );
    }
  }

  /**
   * Cleanup resources when shutting down
   */
  async shutdown(): Promise<void> {
    console.log('🛑 [STREAM-MANAGER] Shutting down...');

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Abort all active streams
    for (const controller of this.streamControllers.values()) {
      controller.abort();
    }

    // Clear all maps
    this.activeStreams.clear();
    this.streamControllers.clear();
    this.circuitBreakers.clear();
    this.reconnectionAttempts.clear();
    this.messageQueues.clear();

    console.log('✅ [STREAM-MANAGER] Shutdown complete');
  }
}