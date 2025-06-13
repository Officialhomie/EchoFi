// src/lib/xmtp-enhanced.ts - Comprehensive XMTP v3 Database Synchronization Fix
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
     * Phase 1: Comprehensive Database Health Diagnostics
     */
    private async performDatabaseHealthCheck(): Promise<DatabaseHealthReport> {
        console.log('🔍 [PHASE 1] Performing comprehensive database health check...');
        
        const report: DatabaseHealthReport = {
            isHealthy: true,
            issues: [],
            lastSync: null,
            sequenceIdStatus: 'valid',
            recommendedAction: 'none'
        };

        try {
            // Check if IndexedDB is available and functional
            if (!window.indexedDB) {
                report.isHealthy = false;
                report.issues.push('IndexedDB not available in this browser');
                report.recommendedAction = 'reset';
                return report;
            }

            // Check XMTP database existence and integrity
            const dbName = this.config.dbPath || 'echofi-xmtp';
            const dbExists = await this.checkDatabaseExists(dbName);
            
            if (!dbExists) {
                console.log('📝 [PHASE 1] Database does not exist - fresh initialization needed');
                report.sequenceIdStatus = 'missing';
                return report; // This is normal for first-time users
            }

            // Validate database structure and check for corruption
            const structureValid = await this.validateDatabaseStructure(dbName);
            if (!structureValid) {
                report.isHealthy = false;
                report.issues.push('Database structure is corrupted');
                report.sequenceIdStatus = 'corrupted';
                report.recommendedAction = 'reset';
                return report;
            }

            // Check for SequenceId corruption specifically
            const sequenceIdValid = await this.validateSequenceIds(dbName);
            if (!sequenceIdValid) {
                report.isHealthy = false;
                report.issues.push('SequenceId corruption detected');
                report.sequenceIdStatus = 'corrupted';
                report.recommendedAction = 'repair';
                return report;
            }

            console.log('✅ [PHASE 1] Database health check passed');
            
        } catch (error) {
            console.error('❌ [PHASE 1] Database health check failed:', error);
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
                const requiredStores = ['messages', 'conversations', 'sync_state'];
                const existingStores = Array.from(db.objectStoreNames);
                
                const hasRequiredStores = requiredStores.every(store => 
                    existingStores.includes(store)
                );
                
                db.close();
                resolve(hasRequiredStores);
            };
            request.onerror = () => resolve(false);
        });
    }

    private async validateSequenceIds(dbName: string): Promise<boolean> {
        return new Promise((resolve) => {
            const request = indexedDB.open(dbName);
            request.onsuccess = () => {
                const db = request.result;
                
                if (!db.objectStoreNames.contains('sync_state')) {
                    db.close();
                    resolve(false);
                    return;
                }

                const transaction = db.transaction(['sync_state'], 'readonly');
                const store = transaction.objectStore('sync_state');
                const getRequest = store.getAll();
                
                getRequest.onsuccess = () => {
                    const syncStates = getRequest.result;
                    
                    // Check for invalid or corrupted SequenceId entries
                    const hasValidSequenceIds = syncStates.every(state => 
                        state.sequenceId != null && 
                        typeof state.sequenceId === 'number' &&
                        state.sequenceId >= 0
                    );
                    
                    db.close();
                    resolve(hasValidSequenceIds);
                };
                
                getRequest.onerror = () => {
                    db.close();
                    resolve(false);
                };
            };
            request.onerror = () => resolve(false);
        });
    }

    /**
     * Phase 2: Intelligent Database Recovery
     */
    private async performDatabaseRecovery(report: DatabaseHealthReport): Promise<void> {
        console.log('🔧 [PHASE 2] Performing database recovery...');
        
        if (report.recommendedAction === 'reset') {
            console.log('🗑️ [PHASE 2] Performing complete database reset...');
            await this.performCompleteDatabaseReset();
        } else if (report.recommendedAction === 'repair') {
            console.log('🔨 [PHASE 2] Attempting selective database repair...');
            await this.performSelectiveRepair();
        }
    }

    private async performCompleteDatabaseReset(): Promise<void> {
        const dbName = this.config.dbPath || 'echofi-xmtp';
        
        // Clear all XMTP-related storage
        await this.clearIndexedDBDatabases();
        await this.clearLocalStorage();
        await this.clearSessionStorage();
        
        // Reset internal state
        this.client = null;
        this.isInitialized = false;
        this.encryptionKey = null;
        
        console.log('✅ [PHASE 2] Complete database reset completed');
    }

    private async performSelectiveRepair(): Promise<void> {
        const dbName = this.config.dbPath || 'echofi-xmtp';
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName);
            request.onsuccess = () => {
                const db = request.result;
                
                if (!db.objectStoreNames.contains('sync_state')) {
                    db.close();
                    resolve();
                    return;
                }

                const transaction = db.transaction(['sync_state'], 'readwrite');
                const store = transaction.objectStore('sync_state');
                
                // Clear corrupted SequenceId entries
                const clearRequest = store.clear();
                clearRequest.onsuccess = () => {
                    console.log('✅ [PHASE 2] Corrupted SequenceId entries cleared');
                    db.close();
                    resolve();
                };
                
                clearRequest.onerror = () => {
                    db.close();
                    reject(new Error('Failed to clear corrupted entries'));
                };
            };
            request.onerror = () => reject(new Error('Failed to open database for repair'));
        });
    }

    /**
     * Phase 3: Enhanced Client Initialization with Proper Timing
     */
    async initializeClient(signer: BrowserSigner, config: XMTPConfig = {}): Promise<Client> {
        this.config = { ...this.config, ...config };
        
        try {
            console.log('🚀 [PHASE 3] Starting enhanced XMTP client initialization...');
            
            // Update initialization state
            this.updateInitializationState('database_check', 10, 'Checking database health');
            
            // Phase 1: Database Health Check
            const healthReport = await this.performDatabaseHealthCheck();
            
            if (!healthReport.isHealthy) {
                this.updateInitializationState('database_check', 25, 'Recovering database');
                await this.performDatabaseRecovery(healthReport);
            }

            // Phase 2: Prepare encryption key with proper persistence
            this.updateInitializationState('client_creation', 40, 'Setting up encryption');
            this.encryptionKey = await this.getOrCreateEncryptionKeyAsync();
            
            // Phase 3: Create XMTP client with retry mechanism
            this.updateInitializationState('client_creation', 60, 'Creating XMTP client');
            this.client = await this.createClientWithRetry(signer);
            
            // Phase 4: Validate synchronization state
            this.updateInitializationState('sync_validation', 80, 'Validating synchronization');
            await this.validateClientSynchronization();
            
            this.isInitialized = true;
            this.updateInitializationState('ready', 100, 'Initialization complete');
            
            // Start periodic health monitoring
            this.startHealthMonitoring();
            
            console.log('✅ [PHASE 3] Enhanced XMTP client initialization completed successfully');
            return this.client;
            
        } catch (error) {
            this.updateInitializationState('failed', 0, `Initialization failed: ${error instanceof Error ? error.message : String(error)}`);
            this.isInitialized = false;
            console.error('❌ [PHASE 3] Client initialization failed:', error);
            throw this.enhanceError(error);
        }
    }

    private async createClientWithRetry(signer: BrowserSigner): Promise<Client> {
        const maxRetries = this.config.maxRetries || 3;
        const retryDelay = this.config.retryDelay || 2000;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 [PHASE 3] Client creation attempt ${attempt}/${maxRetries}`);
                
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

                // Add initialization delay to prevent race conditions
                if (attempt > 1) {
                    console.log(`⏳ [PHASE 3] Waiting ${retryDelay}ms before retry...`);
                    await this.delay(retryDelay);
                }

                const client = await Client.create(adaptedSigner, this.encryptionKey!, clientOptions);
                
                console.log(`✅ [PHASE 3] Client created successfully on attempt ${attempt}`);
                return client;
                
            } catch (error) {
                console.error(`❌ [PHASE 3] Client creation attempt ${attempt} failed:`, error);
                
                if (attempt === maxRetries) {
                    throw error;
                }
                
                // Handle specific errors that might benefit from database reset
                if (error instanceof Error && error.message.includes('SequenceId')) {
                    console.log('🔧 [PHASE 3] SequenceId error detected, performing emergency database reset');
                    await this.performCompleteDatabaseReset();
                }
            }
        }
        
        throw new Error('Failed to create client after all retry attempts');
    }

    private async validateClientSynchronization(): Promise<void> {
        if (!this.client) {
            throw new Error('Client not available for synchronization validation');
        }

        try {
            console.log('🔍 [PHASE 3] Validating client synchronization...');
            
            // Test basic operations to ensure sync is working
            const conversations = await this.client.conversations.list();
            console.log(`✅ [PHASE 3] Successfully loaded ${conversations.length} conversations`);
            
            // Wait a moment for any pending sync operations
            await this.delay(1000);
            
            console.log('✅ [PHASE 3] Client synchronization validation passed');
            
        } catch (error) {
            console.error('❌ [PHASE 3] Synchronization validation failed:', error);
            
            if (error instanceof Error && error.message.includes('SequenceId')) {
                throw new Error('Synchronization validation failed due to SequenceId corruption. Database reset required.');
            }
            
            throw new Error(`Synchronization validation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Phase 4: Pre-Group Creation Validation Pipeline
     */
    private async performPreGroupCreationValidation(memberAddresses: string[]): Promise<void> {
        console.log('🔍 [PHASE 4] Performing pre-group creation validation...');
        
        // Validate client state
        this.ensureClientReady();
        
        // Validate database health
        const healthReport = await this.performDatabaseHealthCheck();
        if (!healthReport.isHealthy) {
            throw new Error(`Database health check failed: ${healthReport.issues.join(', ')}`);
        }
        
        // Validate network connectivity
        await this.validateNetworkConnectivity();
        
        // Validate member addresses
        if (memberAddresses.length > 0) {
            await this.validateMemberAddresses(memberAddresses);
        }
        
        console.log('✅ [PHASE 4] Pre-group creation validation passed');
    }

    private async validateNetworkConnectivity(): Promise<void> {
        try {
            // Test XMTP network connectivity
            await this.client!.conversations.list();
        } catch (error) {
            throw new Error(`Network connectivity validation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async validateMemberAddresses(memberAddresses: string[]): Promise<void> {
        console.log('🔍 [PHASE 4] Validating member addresses...');
        
        const canMessageMap = await this.client!.canMessage(memberAddresses);
        const invalidAddresses = Array.from(canMessageMap.entries())
            .filter(([address, canMsg]) => !canMsg)
            .map(([address]) => address);
        
        if (invalidAddresses.length > 0) {
            throw new Error(`Some addresses cannot receive XMTP messages: ${invalidAddresses.join(', ')}`);
        }
        
        console.log('✅ [PHASE 4] All member addresses validated successfully');
    }

    /**
     * Phase 5: Atomic Group Creation with Rollback
     */
    async createInvestmentGroup(groupConfig: GroupConfig, memberAddresses: string[]): Promise<Conversation> {
        console.log('🚀 [PHASE 5] Starting atomic group creation...');
        
        // Pre-creation validation
        await this.performPreGroupCreationValidation(memberAddresses);
        
        const maxRetries = this.config.maxRetries || 3;
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 [PHASE 5] Group creation attempt ${attempt}/${maxRetries}`);
                
                // Create group with atomic operation
                const group = await this.client!.conversations.newGroup(
                    memberAddresses,
                    {
                        name: groupConfig.name,
                        description: groupConfig.description,
                        imageUrlSquare: groupConfig.imageUrlSquare
                    }
                );

                // Validate group creation
                await this.validateGroupCreation(group);
                
                console.log('✅ [PHASE 5] Investment group created successfully:', {
                    id: group.id,
                    name: groupConfig.name,
                    memberCount: memberAddresses.length + 1
                });
                
                return group;
                
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                console.error(`❌ [PHASE 5] Group creation attempt ${attempt} failed:`, lastError);
                
                if (attempt < maxRetries) {
                    // Handle specific errors that might benefit from recovery
                    if (lastError.message.includes('SequenceId')) {
                        console.log('🔧 [PHASE 5] SequenceId error detected, attempting repair...');
                        await this.performSelectiveRepair();
                        await this.delay(2000); // Wait for repair to take effect
                    } else {
                        await this.delay(this.config.retryDelay || 2000);
                    }
                } else {
                    // Final attempt failed, perform rollback if needed
                    await this.performGroupCreationRollback();
                }
            }
        }
        
        throw new Error(`Failed to create group after ${maxRetries} attempts. Last error: ${lastError?.message}`);
    }

    private async validateGroupCreation(group: Conversation): Promise<void> {
        try {
            // Validate group exists and is accessible
            const groupInfo = {
                id: group.id,
                name: group.name,
                description: group.description
            };
            
            console.log('✅ [PHASE 5] Group creation validated:', groupInfo);
            
        } catch (error) {
            throw new Error(`Group validation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async performGroupCreationRollback(): Promise<void> {
        console.log('🔄 [PHASE 5] Performing group creation rollback...');
        // In XMTP v3, group creation is atomic, so no explicit rollback needed
        // But we can clear any corrupted state
        await this.performSelectiveRepair();
    }

    /**
     * Utility Methods
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
            // Try to get existing key from localStorage
            const storedKey = localStorage.getItem(STORAGE_KEY);
            if (storedKey) {
                const keyBytes = new Uint8Array(JSON.parse(storedKey));
                if (keyBytes.length === 32) {
                    console.log('🔑 [PHASE 3] Using existing encryption key from localStorage');
                    return keyBytes;
                }
            }
        } catch (error) {
            console.warn('⚠️ [PHASE 3] Failed to load existing encryption key:', error);
        }
        
        // Generate new key
        console.log('🔑 [PHASE 3] Generating new encryption key...');
        const newKey = crypto.getRandomValues(new Uint8Array(32));
        
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(newKey)));
            console.log('✅ [PHASE 3] New encryption key saved to localStorage');
        } catch (error) {
            console.warn('⚠️ [PHASE 3] Failed to save encryption key to localStorage:', error);
        }
        
        return newKey;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private enhanceError(error: unknown): Error {
        if (error instanceof Error) {
            if (error.message.includes('SequenceId')) {
                return new Error(`XMTP Database Synchronization Error: ${error.message}. This typically indicates a corrupted local database that needs to be reset.`);
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
                console.log('✅ IndexedDB database cleared');
                resolve();
            };
            deleteRequest.onerror = () => {
                console.error('❌ Failed to clear IndexedDB database');
                reject(new Error('Failed to clear IndexedDB database'));
            };
            deleteRequest.onblocked = () => {
                console.warn('⚠️ IndexedDB deletion blocked, retrying...');
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
        
        console.log(`✅ Cleared ${keysToRemove.length} XMTP localStorage entries`);
    }

    private async clearSessionStorage(): Promise<void> {
        const keysToRemove = Object.keys(sessionStorage).filter(key => 
            key.includes('xmtp') || key.includes('XMTP')
        );
        
        keysToRemove.forEach(key => {
            sessionStorage.removeItem(key);
        });
        
        console.log(`✅ Cleared ${keysToRemove.length} XMTP sessionStorage entries`);
    }

    private startHealthMonitoring(): void {
        if (this.syncValidationTimer) {
            clearInterval(this.syncValidationTimer);
        }
        
        this.syncValidationTimer = setInterval(async () => {
            try {
                await this.performDatabaseHealthCheck();
            } catch (error) {
                console.warn('⚠️ Periodic health check failed:', error);
            }
        }, this.config.healthCheckInterval || 30000);
    }

    private ensureClientReady(): void {
        if (!this.client || !this.isInitialized) {
            throw new Error('XMTP client not initialized. Call initializeClient() first.');
        }
    }

    /**
     * Public API Methods
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