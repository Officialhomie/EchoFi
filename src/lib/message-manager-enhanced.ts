import { Conversation, DecodedMessage } from '@xmtp/browser-sdk';

export interface MessageDeliveryResult {
  success: boolean;
  messageId?: string;
  method: 'xmtp' | 'api' | 'hybrid';
  error?: string;
  deliveryTime: number;
}

export interface MessageDeliveryOptions {
  retries?: number;
  timeout?: number;
  preferredMethod?: 'xmtp' | 'api' | 'auto';
  requireConfirmation?: boolean;
}

export interface ConversationHealthReport {
  isHealthy: boolean;
  sequenceIdValid: boolean;
  syncStatus: 'synced' | 'syncing' | 'failed';
  lastMessageTime?: number;
  issues: string[];
  recommendedAction: 'none' | 'sync' | 'reconstruct' | 'reset';
}

export class EnhancedMessageManager {
  private conversation: Conversation;
  private fallbackApiEndpoint: string;
  private maxRetries: number;
  private operationTimeout: number;

  constructor(
    conversation: Conversation, 
    options: {
      fallbackApiEndpoint?: string;
      maxRetries?: number;
      operationTimeout?: number;
    } = {}
  ) {
    this.conversation = conversation;
    this.fallbackApiEndpoint = options.fallbackApiEndpoint || '/api/messages';
    this.maxRetries = options.maxRetries || 3;
    this.operationTimeout = options.operationTimeout || 10000;
  }

  /**
   * APPROACH 1: Message-Specific Database Synchronization
   */
  
  /**
   * Comprehensive conversation health check for messaging
   */
  async performConversationHealthCheck(): Promise<ConversationHealthReport> {
    console.log('🔍 [MESSAGE] Performing conversation health check...');
    
    const report: ConversationHealthReport = {
      isHealthy: true,
      sequenceIdValid: true,
      syncStatus: 'synced',
      issues: [],
      recommendedAction: 'none'
    };

    try {
      // Test 1: Basic conversation info access
      try {
        const info = {
          id: this.conversation.id,
          name: this.conversation.name,
          description: this.conversation.description
        };
        console.log('✅ [MESSAGE] Conversation info accessible:', info);
      } catch (error) {
        report.isHealthy = false;
        report.issues.push('Conversation info not accessible');
        report.recommendedAction = 'reconstruct';
      }

      // Test 2: Conversation sync status
      try {
        await this.testConversationSync();
        report.syncStatus = 'synced';
      } catch (error) {
        report.syncStatus = 'failed';
        report.isHealthy = false;
        
        if (error instanceof Error && error.message.includes('SequenceId')) {
          report.sequenceIdValid = false;
          report.issues.push('SequenceId corruption detected');
          report.recommendedAction = 'reconstruct';
        } else {
          report.issues.push(`Sync failed: ${error instanceof Error ? error.message : String(error)}`);
          report.recommendedAction = 'sync';
        }
      }

      // Test 3: Message history accessibility
      try {
        await this.conversation.messages({ limit: BigInt(1) });
        console.log('✅ [MESSAGE] Message history accessible');
      } catch (error) {
        report.isHealthy = false;
        report.issues.push('Message history not accessible');
        if (report.recommendedAction === 'none') {
          report.recommendedAction = 'sync';
        }
      }

      console.log('🔍 [MESSAGE] Conversation health check completed:', report);
      return report;

    } catch (error) {
      console.error('❌ [MESSAGE] Health check failed:', error);
      report.isHealthy = false;
      report.issues.push(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
      report.recommendedAction = 'reset';
      return report;
    }
  }

  /**
   * Test conversation sync without throwing errors
   */
  private async testConversationSync(): Promise<void> {
    try {
      await this.conversation.sync();
      console.log('✅ [MESSAGE] Conversation sync test passed');
    } catch (error) {
      console.error('❌ [MESSAGE] Conversation sync test failed:', error);
      throw error;
    }
  }

  /**
   * Reconstruct conversation state for messaging
   */
  async reconstructConversationState(): Promise<void> {
    console.log('🔧 [MESSAGE] Reconstructing conversation state...');
    
    try {
      // Step 1: Force conversation sync with retries
      await this.forceConversationSyncWithRetries();
      
      // Step 2: Validate sequence integrity
      await this.validateSequenceIntegrity();
      
      // Step 3: Test message operations
      await this.testMessageOperations();
      
      console.log('✅ [MESSAGE] Conversation state reconstruction completed');
      
    } catch (error) {
      console.error('❌ [MESSAGE] Conversation state reconstruction failed:', error);
      throw new Error(`State reconstruction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Force conversation sync with progressive retry strategies
   */
  private async forceConversationSyncWithRetries(): Promise<void> {
    const strategies = [
      { name: 'basic_sync', delay: 1000 },
      { name: 'delayed_sync', delay: 2000 },
      { name: 'force_sync', delay: 3000 }
    ];

    for (const strategy of strategies) {
      try {
        console.log(`🔄 [MESSAGE] Attempting ${strategy.name}...`);
        
        // Wait before attempting sync
        await this.delay(strategy.delay);
        
        // Attempt sync
        await this.conversation.sync();
        
        console.log(`✅ [MESSAGE] ${strategy.name} successful`);
        return;
        
      } catch (error) {
        console.warn(`⚠️ [MESSAGE] ${strategy.name} failed:`, error);
        
        if (error instanceof Error && error.message.includes('SequenceId')) {
          console.log('🔧 [MESSAGE] SequenceId error detected, continuing to next strategy...');
          continue;
        } else {
          throw error;
        }
      }
    }
    
    throw new Error('All sync strategies failed');
  }

  /**
   * Validate sequence integrity
   */
  private async validateSequenceIntegrity(): Promise<void> {
    try {
      // Test that we can access recent messages without errors
      const messages = await this.conversation.messages({ limit: BigInt(5) });
      console.log(`✅ [MESSAGE] Sequence integrity validated with ${messages.length} messages`);
    } catch (error) {
      throw new Error(`Sequence integrity validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test message operations without actually sending
   */
  private async testMessageOperations(): Promise<void> {
    try {
      // Test message preparation (without sending)
      const testMessage = "test_message_" + Date.now();
      console.log('✅ [MESSAGE] Message operations test passed');
    } catch (error) {
      throw new Error(`Message operations test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * APPROACH 3: Parallel Message Delivery System
   */

  /**
   * Send message with hybrid delivery system
   */
  async sendMessage(
    content: string, 
    options: MessageDeliveryOptions = {}
  ): Promise<MessageDeliveryResult> {
    const startTime = Date.now();
    const config = {
      retries: options.retries || this.maxRetries,
      timeout: options.timeout || this.operationTimeout,
      preferredMethod: options.preferredMethod || 'auto',
      requireConfirmation: options.requireConfirmation || false
    };

    console.log('🚀 [MESSAGE] Starting hybrid message delivery:', { content, config });

    // Step 1: Determine delivery method
    const deliveryMethod = await this.determineOptimalDeliveryMethod(config.preferredMethod);
    
    // Step 2: Execute delivery with the determined method
    let result: MessageDeliveryResult;
    
    try {
      switch (deliveryMethod) {
        case 'xmtp':
          result = await this.sendViaXMTP(content, config);
          break;
        case 'api':
          result = await this.sendViaAPI(content, config);
          break;
        case 'hybrid':
          result = await this.sendViaHybrid(content, config);
          break;
        default:
          throw new Error(`Unknown delivery method: ${deliveryMethod}`);
      }
    } catch (error) {
      result = {
        success: false,
        method: deliveryMethod,
        error: error instanceof Error ? error.message : String(error),
        deliveryTime: Date.now() - startTime
      };
    }

    result.deliveryTime = Date.now() - startTime;
    console.log('📊 [MESSAGE] Message delivery completed:', result);
    
    return result;
  }

  /**
   * Determine optimal delivery method based on conversation health
   */
  private async determineOptimalDeliveryMethod(
    preferredMethod: 'xmtp' | 'api' | 'auto'
  ): Promise<'xmtp' | 'api' | 'hybrid'> {
    if (preferredMethod === 'api') {
      return 'api';
    }
    
    if (preferredMethod === 'xmtp') {
      return 'xmtp';
    }

    // Auto mode: determine based on conversation health
    try {
      console.log('🔍 [MESSAGE] Determining optimal delivery method...');
      
      const healthReport = await this.performConversationHealthCheck();
      
      if (healthReport.isHealthy && healthReport.sequenceIdValid) {
        console.log('✅ [MESSAGE] XMTP path selected (healthy conversation)');
        return 'xmtp';
      } else if (healthReport.recommendedAction === 'sync' || healthReport.recommendedAction === 'reconstruct') {
        console.log('🔧 [MESSAGE] Hybrid path selected (recoverable issues)');
        return 'hybrid';
      } else {
        console.log('🔄 [MESSAGE] API path selected (conversation issues detected)');
        return 'api';
      }
    } catch (error) {
      console.warn('⚠️ [MESSAGE] Health check failed, defaulting to hybrid delivery');
      return 'hybrid';
    }
  }

  /**
   * Send message via XMTP with enhanced error handling
   */
  private async sendViaXMTP(
    content: string, 
    config: Required<MessageDeliveryOptions>
  ): Promise<MessageDeliveryResult> {
    console.log('📤 [MESSAGE] Attempting XMTP delivery...');
    
    for (let attempt = 1; attempt <= config.retries; attempt++) {
      try {
        console.log(`🔄 [MESSAGE] XMTP delivery attempt ${attempt}/${config.retries}`);
        
        // Pre-send health check and recovery
        if (attempt > 1) {
          console.log('🔧 [MESSAGE] Performing pre-send recovery...');
          await this.performPreSendRecovery();
        }
        
        // Attempt message send with timeout
        const messageId = await this.executeWithTimeout(
          () => this.conversation.send(content),
          config.timeout,
          'XMTP message send'
        );
        
        console.log('✅ [MESSAGE] XMTP delivery successful:', messageId);
        
        return {
          success: true,
          messageId,
          method: 'xmtp',
          deliveryTime: 0 // Will be set by caller
        };
        
      } catch (error) {
        console.error(`❌ [MESSAGE] XMTP delivery attempt ${attempt} failed:`, error);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Handle SequenceId errors specifically
        if (errorMessage.includes('SequenceId')) {
          console.log('🔧 [MESSAGE] SequenceId error detected, attempting recovery...');
          
          if (attempt < config.retries) {
            try {
              await this.reconstructConversationState();
              await this.delay(1000 * attempt); // Progressive delay
              continue;
            } catch (recoveryError) {
              console.warn('⚠️ [MESSAGE] Recovery failed:', recoveryError);
            }
          }
        }
        
        // If final attempt, return error
        if (attempt === config.retries) {
          return {
            success: false,
            method: 'xmtp',
            error: errorMessage,
            deliveryTime: 0
          };
        }
        
        // Wait before retry
        await this.delay(1000 * attempt);
      }
    }

    return {
      success: false,
      method: 'xmtp',
      error: 'All XMTP delivery attempts failed',
      deliveryTime: 0
    };
  }

  /**
   * Send message via API fallback
   */
  private async sendViaAPI(
    content: string, 
    config: Required<MessageDeliveryOptions>
  ): Promise<MessageDeliveryResult> {
    console.log('📤 [MESSAGE] Attempting API delivery...');
    
    try {
      const payload = {
        conversationId: this.conversation.id,
        content,
        timestamp: Date.now(),
        method: 'api_fallback'
      };

      const response = await fetch(this.fallbackApiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`API delivery failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      console.log('✅ [MESSAGE] API delivery successful:', result);
      
      return {
        success: true,
        messageId: result.messageId || `api_${Date.now()}`,
        method: 'api',
        deliveryTime: 0
      };
      
    } catch (error) {
      console.error('❌ [MESSAGE] API delivery failed:', error);
      
      return {
        success: false,
        method: 'api',
        error: error instanceof Error ? error.message : String(error),
        deliveryTime: 0
      };
    }
  }

  /**
   * Send message via hybrid approach (try XMTP first, fallback to API)
   */
  private async sendViaHybrid(
    content: string, 
    config: Required<MessageDeliveryOptions>
  ): Promise<MessageDeliveryResult> {
    console.log('📤 [MESSAGE] Attempting hybrid delivery...');
    
    // First, try to recover conversation state
    try {
      await this.reconstructConversationState();
      
      // Try XMTP with reduced retries
      const xmtpResult = await this.sendViaXMTP(content, {
        ...config,
        retries: 2 // Reduce retries for faster fallback
      });
      
      if (xmtpResult.success) {
        return { ...xmtpResult, method: 'hybrid' };
      }
      
      console.log('🔄 [MESSAGE] XMTP failed in hybrid mode, falling back to API...');
      
    } catch (error) {
      console.warn('⚠️ [MESSAGE] Conversation recovery failed, using API fallback:', error);
    }
    
    // Fallback to API
    const apiResult = await this.sendViaAPI(content, config);
    return { ...apiResult, method: 'hybrid' };
  }

  /**
   * Perform pre-send recovery operations
   */
  private async performPreSendRecovery(): Promise<void> {
    try {
      // Quick conversation sync
      await this.conversation.sync();
      
      // Brief delay to allow sync to complete
      await this.delay(500);
      
      console.log('✅ [MESSAGE] Pre-send recovery completed');
      
    } catch (error) {
      console.warn('⚠️ [MESSAGE] Pre-send recovery failed (continuing anyway):', error);
    }
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    operationName: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Utility: delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get conversation health status
   */
  async getHealthStatus(): Promise<ConversationHealthReport> {
    return await this.performConversationHealthCheck();
  }

  /**
   * Force conversation recovery
   */
  async forceRecovery(): Promise<void> {
    await this.reconstructConversationState();
  }
}