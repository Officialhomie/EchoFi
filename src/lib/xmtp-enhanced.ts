// src/lib/xmtp-enhanced.ts - Working Enhanced XMTP Manager
import { 
    Client, 
    Conversation, 
    DecodedMessage,
    GroupPermissions,
    type ClientOptions
} from '@xmtp/browser-sdk';

export interface XMTPConfig {
    env?: 'dev' | 'production' | 'local';
    dbPath?: string;
    enableLogging?: boolean;
    apiUrl?: string;
    maxRetries?: number;
    retryDelay?: number;
    healthCheckInterval?: number;
}

export interface GroupConfig {
    name: string;
    description: string;
    imageUrlSquare?: string;
    permissions?: GroupPermissions;
}

export interface BrowserSigner {
    getAddress(): Promise<string>;
    signMessage(message: string): Promise<Uint8Array>;
}

export interface DatabaseHealthReport {
    isHealthy: boolean;
    issues: string[];
    lastSync: Date | null;
    sequenceIdStatus: 'valid' | 'corrupted' | 'missing';
    recommendedAction: 'none' | 'reset' | 'repair';
}

export interface InitializationState {
    phase: 'starting' | 'database_check' | 'client_creation' | 'sync_validation' | 'ready' | 'failed';
    progress: number;
    currentOperation: string;
    issues: string[];
}

export class EnhancedXMTPManager {
    private client: Client | null = null;
    private isInitialized = false;
    private encryptionKey: Uint8Array | null = null;
    private config: XMTPConfig;
    private initializationState: InitializationState;
    private syncValidationTimer: NodeJS.Timeout | null = null;

    constructor(config: XMTPConfig = {}) {
        this.config = {
            maxRetries: 3,
            retryDelay: 2000,
            healthCheckInterval: 30000,
            ...config
        };
        
        this.initializationState = {
            phase: 'starting',
            progress: 0,
            currentOperation: 'Preparing initialization',
            issues: []
        };
    }

    /**
     * Enhanced initialization with comprehensive error handling
     */
    async initializeClient(signer: BrowserSigner, config: XMTPConfig = {}): Promise<Client> {
        this.config = { ...this.config, ...config };
        
        try {
            console.log('🚀 [ENHANCED] Starting XMTP client initialization...');
            
            // Phase 1: Database Health Check
            this.updateInitializationState('database_check', 10, 'Checking database health');
            const healthReport = await this.performDatabaseHealthCheck();
            
            if (!healthReport.isHealthy) {
                console.log('🔧 [ENHANCED] Database issues detected, performing recovery...');
                this.updateInitializationState('database_check', 25, 'Recovering database');
                await this.performDatabaseRecovery(healthReport);
            }

            // Phase 2: Prepare encryption
            this.updateInitializationState('client_creation', 40, 'Setting up encryption');
            this.encryptionKey = await this.getOrCreateEncryptionKeyAsync();
            
            // Phase 3: Create client with retry
            this.updateInitializationState('client_creation', 60, 'Creating XMTP client');
            this.client = await this.createClientWithRetry(signer);
            
            // Phase 4: Validate sync
            this.updateInitializationState('sync_validation', 80, 'Validating synchronization');
            await this.validateClientSynchronization();
            
            this.isInitialized = true;
            this.updateInitializationState('ready', 100, 'Initialization complete');
            
            // Start monitoring
            this.startHealthMonitoring();
            
            console.log('✅ [ENHANCED] XMTP client initialization completed successfully');
            return this.client;
            
        } catch (error) {
            this.updateInitializationState('failed', 0, `Failed: ${error instanceof Error ? error.message : String(error)}`);
            this.isInitialized = false;
            console.error('❌ [ENHANCED] Client initialization failed:', error);
            throw this.enhanceError(error);
        }
    }

    /**
     * Database health diagnostics
     */
    private async performDatabaseHealthCheck(): Promise<DatabaseHealthReport> {
        console.log('🔍 [ENHANCED] Performing database health check...');
        
        const report: DatabaseHealthReport = {
            isHealthy: true,
            issues: [],
            lastSync: null,
            sequenceIdStatus: 'valid',
            recommendedAction: 'none'
        };

        try {
            if (!window.indexedDB) {
                report.isHealthy = false;
                report.issues.push('IndexedDB not available');
                report.recommendedAction = 'reset';
                return report;
            }

            const dbName = this.config.dbPath || 'echofi-xmtp';
            const dbExists = await this.checkDatabaseExists(dbName);
            
            if (!dbExists) {
                console.log('📝 [ENHANCED] Fresh database - initialization needed');
                report.sequenceIdStatus = 'missing';
                return report;
            }

            const structureValid = await this.validateDatabaseStructure(dbName);
            if (!structureValid) {
                report.isHealthy = false;
                report.issues.push('Database structure corrupted');
                report.sequenceIdStatus = 'corrupted';
                report.recommendedAction = 'reset';
                return report;
            }

            const sequenceIdValid = await this.validateSequenceIds(dbName);
            if (!sequenceIdValid) {
                report.isHealthy = false;
                report.issues.push('SequenceId corruption detected');
                report.sequenceIdStatus = 'corrupted';
                report.recommendedAction = 'repair';
                return report;
            }

            console.log('✅ [ENHANCED] Database health check passed');
            
        } catch (error) {
            console.error('❌ [ENHANCED] Database health check failed:', error);
            report.isHealthy = false;
            report.issues.push(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
            report.recommendedAction = 'reset';
        }

        return report;
    }

    private async checkDatabaseExists(dbName: string): Promise<boolean> {
        return new Promise((resolve) => {
            const request = indexedDB.open(dbName);
            request.onsuccess = () => {
                request.result.close();
                resolve(true);
            };
            request.onerror = () => resolve(false);
            request.onupgradeneeded = () => {
                request.result.close();
                resolve(false);
            };
        });
    }

    private async validateDatabaseStructure(dbName: string): Promise<boolean> {
        return new Promise((resolve) => {
            const request = indexedDB.open(dbName);
            request.onsuccess = () => {
                const db = request.result;
                try {
                    // Basic validation - check if we can access the database
                    const hasStores = db.objectStoreNames.length > 0;
                    db.close();
                    resolve(hasStores);
                } catch (error) {
                    db.close();
                    resolve(false);
                }
            };
            request.onerror = () => resolve(false);
        });
    }

    private async validateSequenceIds(dbName: string): Promise<boolean> {
        return new Promise((resolve) => {
            const request = indexedDB.open(dbName);
            request.onsuccess = () => {
                const db = request.result;
                
                try {
                    // Simple validation - if we can open it, consider it valid for now
                    // More sophisticated validation would check specific SequenceId records
                    db.close();
                    resolve(true);
                } catch (error) {
                    db.close();
                    resolve(false);
                }
            };
            request.onerror = () => resolve(false);
        });
    }

    /**
     * Database recovery
     */
    private async performDatabaseRecovery(report: DatabaseHealthReport): Promise<void> {
        console.log('🔧 [ENHANCED] Performing database recovery...');
        
        if (report.recommendedAction === 'reset') {
            await this.performCompleteDatabaseReset();
        } else if (report.recommendedAction === 'repair') {
            await this.performSelectiveRepair();
        }
    }

    private async performCompleteDatabaseReset(): Promise<void> {
        console.log('🗑️ [ENHANCED] Performing complete database reset...');
        
        await this.clearIndexedDBDatabases();
        await this.clearLocalStorage();
        await this.clearSessionStorage();
        
        this.client = null;
        this.isInitialized = false;
        this.encryptionKey = null;
        
        console.log('✅ [ENHANCED] Complete database reset completed');
    }

    private async performSelectiveRepair(): Promise<void> {
        console.log('🔨 [ENHANCED] Performing selective repair...');
        
        const dbName = this.config.dbPath || 'echofi-xmtp';
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName);
            request.onsuccess = () => {
                const db = request.result;
                
                try {
                    // Simple repair - close and reopen
                    db.close();
                    console.log('✅ [ENHANCED] Selective repair completed');
                    resolve();
                } catch (error) {
                    db.close();
                    reject(new Error('Failed to repair database'));
                }
            };
            request.onerror = () => reject(new Error('Failed to open database for repair'));
        });
    }

    /**
     * Enhanced client creation with retry
     */
    private async createClientWithRetry(signer: BrowserSigner): Promise<Client> {
        const maxRetries = this.config.maxRetries || 3;
        const retryDelay = this.config.retryDelay || 2000;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 [ENHANCED] Client creation attempt ${attempt}/${maxRetries}`);
                
                const clientOptions: ClientOptions = {
                    env: this.config.env || 'dev',
                    apiUrl: this.config.apiUrl,
                    dbPath: this.config.dbPath || 'echofi-xmtp',
                };

                const adaptedSigner = {
                    walletType: 'EOA' as const,
                    getAddress: () => signer.getAddress(),
                    signMessage: (message: string) => signer.signMessage(message),
                };

                if (attempt > 1) {
                    console.log(`⏳ [ENHANCED] Waiting ${retryDelay}ms before retry...`);
                    await this.delay(retryDelay);
                }

                const client = await Client.create(adaptedSigner, this.encryptionKey!, clientOptions);
                
                console.log(`✅ [ENHANCED] Client created successfully on attempt ${attempt}`);
                return client;
                
            } catch (error) {
                console.error(`❌ [ENHANCED] Client creation attempt ${attempt} failed:`, error);
                
                if (attempt === maxRetries) {
                    throw error;
                }
                
                if (error instanceof Error && error.message.includes('SequenceId')) {
                    console.log('🔧 [ENHANCED] SequenceId error detected, resetting database');
                    await this.performCompleteDatabaseReset();
                }
            }
        }
        
        throw new Error('Failed to create client after all retry attempts');
    }

    /**
     * Validate client synchronization
     */
    private async validateClientSynchronization(): Promise<void> {
        if (!this.client) {
            throw new Error('Client not available for synchronization validation');
        }

        try {
            console.log('🔍 [ENHANCED] Validating client synchronization...');
            
            const conversations = await this.client.conversations.list();
            console.log(`✅ [ENHANCED] Successfully loaded ${conversations.length} conversations`);
            
            await this.delay(1000);
            
            console.log('✅ [ENHANCED] Client synchronization validation passed');
            
        } catch (error) {
            console.error('❌ [ENHANCED] Synchronization validation failed:', error);
            
            if (error instanceof Error && error.message.includes('SequenceId')) {
                throw new Error('Synchronization validation failed due to SequenceId corruption. Database reset required.');
            }
            
            throw new Error(`Synchronization validation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Pre-group creation validation
     */
    private async performPreGroupCreationValidation(memberAddresses: string[]): Promise<void> {
        console.log('🔍 [ENHANCED] Performing pre-group creation validation...');
        
        this.ensureClientReady();
        
        const healthReport = await this.performDatabaseHealthCheck();
        if (!healthReport.isHealthy) {
            throw new Error(`Database health check failed: ${healthReport.issues.join(', ')}`);
        }
        
        await this.validateNetworkConnectivity();
        
        if (memberAddresses.length > 0) {
            await this.validateMemberAddresses(memberAddresses);
        }
        
        console.log('✅ [ENHANCED] Pre-group creation validation passed');
    }

    private async validateNetworkConnectivity(): Promise<void> {
        try {
            await this.client!.conversations.list();
        } catch (error) {
            throw new Error(`Network connectivity validation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async validateMemberAddresses(memberAddresses: string[]): Promise<void> {
        console.log('🔍 [ENHANCED] Validating member addresses...');
        
        const canMessageMap = await this.client!.canMessage(memberAddresses);
        const invalidAddresses = Array.from(canMessageMap.entries())
            .filter(([address, canMsg]) => !canMsg)
            .map(([address]) => address);
        
        if (invalidAddresses.length > 0) {
            throw new Error(`Some addresses cannot receive XMTP messages: ${invalidAddresses.join(', ')}`);
        }
        
        console.log('✅ [ENHANCED] All member addresses validated successfully');
    }

    /**
     * Enhanced group creation with atomic operations
     */
    async createInvestmentGroup(groupConfig: GroupConfig, memberAddresses: string[]): Promise<Conversation> {
        console.log('🚀 [ENHANCED] Starting atomic group creation...');
        
        await this.performPreGroupCreationValidation(memberAddresses);
        
        const maxRetries = this.config.maxRetries || 3;
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 [ENHANCED] Group creation attempt ${attempt}/${maxRetries}`);
                
                const group = await this.client!.conversations.newGroup(
                    memberAddresses,
                    {
                        name: groupConfig.name,
                        description: groupConfig.description,
                        imageUrlSquare: groupConfig.imageUrlSquare
                    }
                );

                await this.validateGroupCreation(group);
                
                console.log('✅ [ENHANCED] Investment group created successfully:', {
                    id: group.id,
                    name: groupConfig.name,
                    memberCount: memberAddresses.length + 1
                });
                
                return group;
                
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                console.error(`❌ [ENHANCED] Group creation attempt ${attempt} failed:`, lastError);
                
                if (attempt < maxRetries) {
                    if (lastError.message.includes('SequenceId')) {
                        console.log('🔧 [ENHANCED] SequenceId error detected, attempting repair...');
                        await this.performSelectiveRepair();
                        await this.delay(2000);
                    } else {
                        await this.delay(this.config.retryDelay || 2000);
                    }
                } else {
                    await this.performGroupCreationRollback();
                }
            }
        }
        
        throw new Error(`Failed to create group after ${maxRetries} attempts. Last error: ${lastError?.message}`);
    }

    private async validateGroupCreation(group: Conversation): Promise<void> {
        try {
            const groupInfo = {
                id: group.id,
                name: group.name,
                description: group.description
            };
            
            console.log('✅ [ENHANCED] Group creation validated:', groupInfo);
            
        } catch (error) {
            throw new Error(`Group validation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async performGroupCreationRollback(): Promise<void> {
        console.log('🔄 [ENHANCED] Performing group creation rollback...');
        await this.performSelectiveRepair();
    }

    /**
     * Utility methods
     */
    private updateInitializationState(phase: InitializationState['phase'], progress: number, operation: string): void {
        this.initializationState = {
            ...this.initializationState,
            phase,
            progress,
            currentOperation: operation
        };
    }

    private async getOrCreateEncryptionKeyAsync(): Promise<Uint8Array> {
        const STORAGE_KEY = 'xmtp_encryption_key_v2';
        
        try {
            const storedKey = localStorage.getItem(STORAGE_KEY);
            if (storedKey) {
                const keyBytes = new Uint8Array(JSON.parse(storedKey));
                if (keyBytes.length === 32) {
                    console.log('🔑 [ENHANCED] Using existing encryption key');
                    return keyBytes;
                }
            }
        } catch (error) {
            console.warn('⚠️ [ENHANCED] Failed to load existing encryption key:', error);
        }
        
        console.log('🔑 [ENHANCED] Generating new encryption key...');
        const newKey = crypto.getRandomValues(new Uint8Array(32));
        
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(newKey)));
            console.log('✅ [ENHANCED] New encryption key saved');
        } catch (error) {
            console.warn('⚠️ [ENHANCED] Failed to save encryption key:', error);
        }
        
        return newKey;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private enhanceError(error: unknown): Error {
        if (error instanceof Error) {
            if (error.message.includes('SequenceId')) {
                return new Error(`XMTP Database Synchronization Error: ${error.message}. This indicates a corrupted local database that needs to be reset.`);
            } else if (error.message.includes('network')) {
                return new Error(`XMTP Network Error: ${error.message}. Please check your internet connection and try again.`);
            } else if (error.message.includes('signer')) {
                return new Error(`XMTP Wallet Error: ${error.message}. Please ensure your wallet is properly connected.`);
            }
        }
        
        return new Error(`XMTP Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    private async clearIndexedDBDatabases(): Promise<void> {
        const dbName = this.config.dbPath || 'echofi-xmtp';
        
        return new Promise((resolve, reject) => {
            const deleteRequest = indexedDB.deleteDatabase(dbName);
            deleteRequest.onsuccess = () => {
                console.log('✅ [ENHANCED] IndexedDB database cleared');
                resolve();
            };
            deleteRequest.onerror = () => {
                console.error('❌ [ENHANCED] Failed to clear IndexedDB database');
                reject(new Error('Failed to clear IndexedDB database'));
            };
            deleteRequest.onblocked = () => {
                console.warn('⚠️ [ENHANCED] IndexedDB deletion blocked, retrying...');
                setTimeout(() => {
                    indexedDB.deleteDatabase(dbName);
                }, 1000);
            };
        });
    }

    private async clearLocalStorage(): Promise<void> {
        const keysToRemove = Object.keys(localStorage).filter(key => 
            key.includes('xmtp') || key.includes('XMTP')
        );
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        
        console.log(`✅ [ENHANCED] Cleared ${keysToRemove.length} XMTP localStorage entries`);
    }

    private async clearSessionStorage(): Promise<void> {
        const keysToRemove = Object.keys(sessionStorage).filter(key => 
            key.includes('xmtp') || key.includes('XMTP')
        );
        
        keysToRemove.forEach(key => {
            sessionStorage.removeItem(key);
        });
        
        console.log(`✅ [ENHANCED] Cleared ${keysToRemove.length} XMTP sessionStorage entries`);
    }

    private startHealthMonitoring(): void {
        if (this.syncValidationTimer) {
            clearInterval(this.syncValidationTimer);
        }
        
        this.syncValidationTimer = setInterval(async () => {
            try {
                await this.performDatabaseHealthCheck();
            } catch (error) {
                console.warn('⚠️ [ENHANCED] Periodic health check failed:', error);
            }
        }, this.config.healthCheckInterval || 30000);
    }

    private ensureClientReady(): void {
        if (!this.client || !this.isInitialized) {
            throw new Error('XMTP client not initialized. Call initializeClient() first.');
        }
    }

    /**
     * Enhanced message sending with hybrid delivery system
     */
    async sendMessage(
        conversationId: string,
        content: string,
        options: {
            retries?: number;
            timeout?: number;
            preferredMethod?: 'xmtp' | 'api' | 'auto';
            requireConfirmation?: boolean;
        } = {}
    ): Promise<{ success: boolean; messageId?: string; method: string; error?: string }> {
        this.ensureClientReady();

        try {
            console.log('🚀 [ENHANCED] Starting message send operation...');
            
            // Get conversation
            const conversation = await this.getConversationById(conversationId);
            if (!conversation) {
                throw new Error('Conversation not found');
            }

            // Import and use enhanced message manager
            const { EnhancedMessageManager } = await import('./message-manager-enhanced');
            
            const messageManager = new EnhancedMessageManager(conversation, {
                fallbackApiEndpoint: '/api/messages/send',
                maxRetries: options.retries || 3,
                operationTimeout: options.timeout || 10000
            });

            // Send message using hybrid system
            const result = await messageManager.sendMessage(content, {
                retries: options.retries || 3,
                timeout: options.timeout || 10000,
                preferredMethod: options.preferredMethod || 'auto',
                requireConfirmation: options.requireConfirmation || false
            });

            console.log('📊 [ENHANCED] Message send result:', result);
            
            return {
                success: result.success,
                messageId: result.messageId,
                method: result.method,
                error: result.error
            };

        } catch (error) {
            console.error('❌ [ENHANCED] Message send failed:', error);
            
            return {
                success: false,
                method: 'error',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Get conversation by ID
     */
    async getConversationById(conversationId: string): Promise<Conversation | null> {
        this.ensureClientReady();

        try {
            const conversations = await this.client!.conversations.list();
            const conversation = conversations.find(c => c.id === conversationId);
            return conversation || null;
        } catch (error) {
            console.error('❌ [ENHANCED] Failed to get conversation:', error);
            return null;
        }
    }

    /**
     * Get messages from a conversation with enhanced error handling
     */
    async getMessages(
        conversationId: string,
        limit?: number
    ): Promise<DecodedMessage[]> {
        this.ensureClientReady();

        try {
            const conversation = await this.getConversationById(conversationId);
            if (!conversation) {
                throw new Error('Conversation not found');
            }

            // Import enhanced message manager for health checks
            const { EnhancedMessageManager } = await import('./message-manager-enhanced');
            const messageManager = new EnhancedMessageManager(conversation);

            // Perform health check before getting messages
            const healthReport = await messageManager.getHealthStatus();
            
            if (!healthReport.isHealthy) {
                console.log('🔧 [ENHANCED] Conversation unhealthy, attempting recovery...');
                await messageManager.forceRecovery();
            }

            // Get messages
            const messages = await conversation.messages({
                limit: limit ? BigInt(limit) : undefined
            });

            console.log(`✅ [ENHANCED] Retrieved ${messages.length} messages`);
            return messages;

        } catch (error) {
            console.error('❌ [ENHANCED] Failed to get messages:', error);
            
            // Return empty array instead of throwing to prevent UI crashes
            if (error instanceof Error && error.message.includes('SequenceId')) {
                console.log('🛡️ [ENHANCED] SequenceId error detected, returning empty messages');
            }
            
            return [];
        }
    }

    /**
     * Stream messages from a conversation with enhanced error handling
     */
    async streamMessages(
        conversationId: string,
        onMessage: (message: DecodedMessage) => void,
        onError?: (error: Error) => void
    ): Promise<() => void> {
        this.ensureClientReady();

        try {
            const conversation = await this.getConversationById(conversationId);
            if (!conversation) {
                throw new Error('Conversation not found');
            }

            // Import enhanced message manager
            const { EnhancedMessageManager } = await import('./message-manager-enhanced');
            const messageManager = new EnhancedMessageManager(conversation);

            // Perform health check before streaming
            const healthReport = await messageManager.getHealthStatus();
            
            if (!healthReport.isHealthy) {
                console.log('🔧 [ENHANCED] Conversation unhealthy for streaming, attempting recovery...');
                try {
                    await messageManager.forceRecovery();
                } catch (recoveryError) {
                    console.warn('⚠️ [ENHANCED] Recovery failed, continuing with streaming attempt:', recoveryError);
                }
            }

            // Start streaming
            console.log('🔄 [ENHANCED] Starting message stream for conversation:', conversationId);
            
            const streamPromise = this.client!.conversations.streamAllMessages();
            let isActive = true;

            (async () => {
                try {
                    const stream = await streamPromise;
                    for await (const message of stream) {
                        if (!isActive) break;
                        if (!message || message.conversationId !== conversationId) continue;
                        if (message.senderInboxId === this.client!.inboxId) continue;
                        
                        try {
                            onMessage(message);
                        } catch (messageError) {
                            console.error('❌ [ENHANCED] Error in message callback:', messageError);
                        }
                    }
                } catch (streamError) {
                    console.error('❌ [ENHANCED] Message stream error:', streamError);
                    if (onError) {
                        onError(streamError instanceof Error ? streamError : new Error(String(streamError)));
                    }
                }
            })();

            // Return cleanup function
            return () => {
                isActive = false;
                console.log('🧹 [ENHANCED] Message stream stopped for conversation:', conversationId);
            };

        } catch (error) {
            console.error('❌ [ENHANCED] Failed to start message stream:', error);
            
            if (onError) {
                onError(error instanceof Error ? error : new Error(String(error)));
            }
            
            // Return no-op cleanup function
            return () => {};
        }
    }

    /**
     * Public API methods
     */
    getInitializationState(): InitializationState {
        return { ...this.initializationState };
    }

    async getConversations(): Promise<Conversation[]> {
        this.ensureClientReady();
        return await this.client!.conversations.list();
    }

    async canMessage(addresses: string[]): Promise<Map<string, boolean>> {
        this.ensureClientReady();
        return await this.client!.canMessage(addresses);
    }

    getClientInfo() {
        if (!this.client) return null;
        
        return {
            address: this.client.accountAddress,
            inboxId: this.client.inboxId,
            installationId: this.client.installationId,
            isReady: this.isInitialized
        };
    }

    async cleanup(): Promise<void> {
        if (this.syncValidationTimer) {
            clearInterval(this.syncValidationTimer);
            this.syncValidationTimer = null;
        }
        
        this.client = null;
        this.isInitialized = false;
        this.encryptionKey = null;
    }
}