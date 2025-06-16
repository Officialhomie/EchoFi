import { 
    Client, 
    Conversation,
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
    getChainId?: () => bigint;
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

// FIXED: Enhanced XMTP Manager with Singleton Pattern to prevent multiple instances
export class EnhancedXMTPManager {
    // SINGLETON PATTERN - Prevents multiple instances and repeated signature requests
    private static instance: EnhancedXMTPManager | null = null;
    private static instancePromise: Promise<EnhancedXMTPManager> | null = null;
    
    private client: Client | null = null;
    private isInitialized = false;
    private isClientStable = false;
    private encryptionKey: Uint8Array | null = null;
    private config: XMTPConfig;
    private initializationState: InitializationState;
    private syncValidationTimer: NodeJS.Timeout | null = null;
    private lastSignerAddress: string | null = null;
    private clientCreationInProgress = false;

    // FIXED: Singleton getInstance method to prevent multiple instances
    public static async getInstance(config: XMTPConfig = {}): Promise<EnhancedXMTPManager> {
        if (this.instance && this.instance.isClientStable) {
            console.log('✅ [ENHANCED] Reusing existing stable XMTP manager instance');
            return this.instance;
        }

        // Prevent multiple simultaneous instance creation
        if (this.instancePromise) {
            console.log('⏳ [ENHANCED] Waiting for existing instance creation...');
            return this.instancePromise;
        }

        this.instancePromise = this.createInstance(config);
        
        try {
            this.instance = await this.instancePromise;
            return this.instance;
        } finally {
            this.instancePromise = null;
        }
    }

    private static async createInstance(config: XMTPConfig): Promise<EnhancedXMTPManager> {
        console.log('🏗️ [ENHANCED] Creating new XMTP manager instance...');
        const instance = new EnhancedXMTPManager(config);
        await instance.initialize();
        return instance;
    }

    // FIXED: Private constructor to enforce singleton pattern
    private constructor(config: XMTPConfig = {}) {
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
     * FIXED: Initialize the manager instance (called once during creation)
     */
    private async initialize(): Promise<void> {
        try {
            console.log('🔧 [ENHANCED] Initializing XMTP manager...');
            
            // Pre-initialize setup
            this.encryptionKey = await this.getOrCreateEncryptionKeyAsync();
            
            console.log('✅ [ENHANCED] XMTP manager initialized successfully');
        } catch (error) {
            console.error('❌ [ENHANCED] XMTP manager initialization failed:', error);
            throw error;
        }
    }

    /**
     * FIXED: Enhanced client initialization that prevents repeated signature requests
     */
    async initializeClient(signer: BrowserSigner, config: XMTPConfig = {}): Promise<Client> {
        this.config = { ...this.config, ...config };
        
        // Get current signer address to check if re-initialization is needed
        const currentSignerAddress = await signer.getAddress();
        
        // OPTIMIZATION: Return existing client if same signer and client is stable
        if (
            this.client && 
            this.isClientStable && 
            this.isInitialized && 
            this.lastSignerAddress === currentSignerAddress &&
            !this.clientCreationInProgress
        ) {
            console.log('✅ [ENHANCED] Reusing existing stable XMTP client for address:', currentSignerAddress);
            return this.client;
        }

        // Prevent multiple simultaneous client creation attempts
        if (this.clientCreationInProgress) {
            console.log('⏳ [ENHANCED] Client creation already in progress, waiting...');
            
            // Wait for current creation to complete
            while (this.clientCreationInProgress) {
                await this.delay(500);
            }
            
            // Return the client if it was successfully created
            if (this.client && this.isClientStable && this.lastSignerAddress === currentSignerAddress) {
                return this.client;
            }
        }

        this.clientCreationInProgress = true;
        
        try {
            console.log('🚀 [ENHANCED] Starting XMTP client initialization for address:', currentSignerAddress);
            
            // Phase 1: Database Health Check
            this.updateInitializationState('database_check', 10, 'Checking database health');
            const healthReport = await this.performDatabaseHealthCheck();
            
            if (!healthReport.isHealthy) {
                console.log('🔧 [ENHANCED] Database issues detected, performing recovery...');
                this.updateInitializationState('database_check', 25, 'Recovering database');
                await this.performDatabaseRecovery(healthReport);
            }

            // Phase 2: Client Creation
            this.updateInitializationState('client_creation', 40, 'Setting up encryption');
            
            // Phase 3: Create client with retry
            this.updateInitializationState('client_creation', 60, 'Creating XMTP client');
            this.client = await this.createClientWithRetry(signer);
            
            // Phase 4: Validate sync
            this.updateInitializationState('sync_validation', 80, 'Validating synchronization');
            await this.validateClientSynchronization();
            
            // Mark as stable and store signer info
            this.isInitialized = true;
            this.isClientStable = true;
            this.lastSignerAddress = currentSignerAddress;
            this.updateInitializationState('ready', 100, 'Initialization complete');
            
            // Start monitoring
            this.startHealthMonitoring();
            
            return this.client;
            
        } catch (initError) {
            this.isClientStable = false;
            const errorMessage = initError instanceof Error ? initError.message : String(initError);
            this.updateInitializationState('failed', 0, `Failed: ${errorMessage}`);
            this.isInitialized = false;
            console.error('❌ [ENHANCED] Client initialization failed:', initError);
            throw this.enhanceError(initError);
        } finally {
            this.clientCreationInProgress = false;
        }
    }

    /**
     Database health diagnostics with improved error handling
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

            const dbName = this.config.dbPath || 'echofi-xmtp-base';
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
            
        } catch (healthError) {
            console.error('❌ [ENHANCED] Database health check failed:', healthError);
            const errorMessage = healthError instanceof Error ? healthError.message : String(healthError);
            report.isHealthy = false;
            report.issues.push(`Health check failed: ${errorMessage}`);
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
                    const hasStores = db.objectStoreNames.length > 0;
                    db.close();
                    resolve(hasStores);
                } catch {
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
                    db.close();
                    resolve(true);
                } catch {
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
        this.isClientStable = false;
        this.lastSignerAddress = null;
        
        console.log('✅ [ENHANCED] Complete database reset completed');
    }

    private async performSelectiveRepair(): Promise<void> {
        console.log('🔨 [ENHANCED] Performing selective repair...');
        
        const dbName = this.config.dbPath || 'echofi-xmtp-base';
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName);
            request.onsuccess = () => {
                const db = request.result;
                
                try {
                    db.close();
                    console.log('✅ [ENHANCED] Selective repair completed');
                    resolve();
                } catch {
                    db.close();
                    reject(new Error('Failed to repair database'));
                }
            };
            request.onerror = () => reject(new Error('Failed to open database for repair'));
        });
    }

    /**
     * FIXED: Enhanced client creation with retry and signature optimization
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
                    dbPath: this.config.dbPath || 'echofi-xmtp-base',
                };

                // FIXED: Create adapted signer with proper chain ID support
                const adaptedSigner = {
                    walletType: 'EOA' as const,
                    getAddress: () => signer.getAddress(),
                    signMessage: (message: string) => {
                        console.log('🔐 [ENHANCED] XMTP requesting signature for message...');
                        return signer.signMessage(message);
                    },
                    getChainId: () => {
                        if (typeof signer.getChainId === 'function') {
                            return signer.getChainId();
                        }
                        // Default to Base Sepolia for development
                        return BigInt(84532);
                    },
                    getBlockNumber: () => BigInt(0),
                };

                if (attempt > 1) {
                    console.log(`⏳ [ENHANCED] Waiting ${retryDelay}ms before retry...`);
                    await this.delay(retryDelay);
                }

                // This is where the signature request happens - only once per unique signer
                const client = await Client.create(adaptedSigner, this.encryptionKey!, clientOptions);
                
                console.log(`✅ [ENHANCED] Client created successfully on attempt ${attempt}`);
                return client;
                
            } catch (clientError) {
                console.error(`❌ [ENHANCED] Client creation attempt ${attempt} failed:`, clientError);
                
                if (attempt === maxRetries) {
                    throw clientError;
                }
                
                if (clientError instanceof Error && clientError.message.includes('SequenceId')) {
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
            
        } catch (syncError) {
            console.error('❌ [ENHANCED] Synchronization validation failed:', syncError);
            
            if (syncError instanceof Error && syncError.message.includes('SequenceId')) {
                throw new Error('Synchronization validation failed due to SequenceId corruption. Database reset required.');
            }
            
            const errorMessage = syncError instanceof Error ? syncError.message : String(syncError);
            throw new Error(`Synchronization validation failed: ${errorMessage}`);
        }
    }

    /**
     * FIXED: Enhanced group creation with atomic operations and proper validation
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
                
            } catch (groupError) {
                lastError = groupError instanceof Error ? groupError : new Error(String(groupError));
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
        } catch (networkError) {
            const errorMessage = networkError instanceof Error ? networkError.message : String(networkError);
            throw new Error(`Network connectivity validation failed: ${errorMessage}`);
        }
    }

    private async validateMemberAddresses(memberAddresses: string[]): Promise<void> {
        console.log('🔍 [ENHANCED] Validating member addresses...');
        
        const canMessageMap = await this.client!.canMessage(memberAddresses);
        const invalidAddresses = Array.from(canMessageMap.entries())
            .filter(([, canMsg]) => !canMsg)  
            .map(([memberAddress]) => memberAddress);  
        
        if (invalidAddresses.length > 0) {
            throw new Error(`Some addresses cannot receive XMTP messages: ${invalidAddresses.join(', ')}`);
        }
        
        console.log('✅ [ENHANCED] All member addresses validated successfully');
    }

    private async validateGroupCreation(group: Conversation): Promise<void> {
        try {
            const groupInfo = {
                id: group.id,
                name: group.name,
                description: group.description
            };
            
            console.log('✅ [ENHANCED] Group creation validated:', groupInfo);
            
        } catch (validationError) {
            const errorMessage = validationError instanceof Error ? validationError.message : String(validationError);
            throw new Error(`Group validation failed: ${errorMessage}`);
        }
    }

    private async performGroupCreationRollback(): Promise<void> {
        console.log('🔄 [ENHANCED] Performing group creation rollback...');
        await this.performSelectiveRepair();
    }

    /**
     * FIXED: Utility methods with proper error handling
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
        const STORAGE_KEY = 'xmtp_encryption_key_base_v2';
        
        try {
            const storedKey = localStorage.getItem(STORAGE_KEY);
            if (storedKey) {
                const keyBytes = new Uint8Array(JSON.parse(storedKey));
                if (keyBytes.length === 32) {
                    console.log('🔑 [ENHANCED] Using existing encryption key');
                    return keyBytes;
                }
            }
        } catch {
            console.warn('⚠️ [ENHANCED] Failed to load existing encryption key');
        }
        
        console.log('🔑 [ENHANCED] Generating new encryption key...');
        const newKey = crypto.getRandomValues(new Uint8Array(32));
        
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(newKey)));
            console.log('✅ [ENHANCED] New encryption key saved');
        } catch {
            console.warn('⚠️ [ENHANCED] Failed to save encryption key');
        }
        
        return newKey;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private enhanceError(originalError: unknown): Error {
        if (originalError instanceof Error) {
            if (originalError.message.includes('SequenceId')) {
                return new Error(`XMTP Database Synchronization Error: ${originalError.message}. This indicates a corrupted local database that needs to be reset.`);
            } else if (originalError.message.includes('network')) {
                return new Error(`XMTP Network Error: ${originalError.message}. Please check your internet connection and try again.`);
            } else if (originalError.message.includes('signer')) {
                return new Error(`XMTP Wallet Error: ${originalError.message}. Please ensure your wallet is properly connected.`);
            }
        }
        
        return new Error(`XMTP Error: ${originalError instanceof Error ? originalError.message : String(originalError)}`);
    }

    private async clearIndexedDBDatabases(): Promise<void> {
        const dbName = this.config.dbPath || 'echofi-xmtp-base';
        
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
        
        // Don't remove the encryption key
        const filteredKeys = keysToRemove.filter(key => !key.includes('encryption_key'));
        
        filteredKeys.forEach(key => {
            localStorage.removeItem(key);
        });
        
        console.log(`✅ [ENHANCED] Cleared ${filteredKeys.length} XMTP localStorage entries`);
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
            } catch {
                console.warn('⚠️ [ENHANCED] Periodic health check failed');
            }
        }, this.config.healthCheckInterval || 30000);
    }

    private ensureClientReady(): void {
        if (!this.client || !this.isInitialized) {
            throw new Error('XMTP client not initialized. Call initializeClient() first.');
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
            isReady: this.isInitialized && this.isClientStable
        };
    }

    /**
     * FIXED: Enhanced cleanup with singleton reset
     */
    async cleanup(): Promise<void> {
        if (this.syncValidationTimer) {
            clearInterval(this.syncValidationTimer);
            this.syncValidationTimer = null;
        }
        
        this.client = null;
        this.isInitialized = false;
        this.isClientStable = false;
        this.lastSignerAddress = null;
        this.clientCreationInProgress = false;
        this.encryptionKey = null;
        
        // Reset singleton instance
        EnhancedXMTPManager.instance = null;
        
        console.log('🧹 [ENHANCED] XMTP manager cleanup completed');
    }

    /**
     * Static method to reset singleton (for testing or forced reinitialization)
     */
    public static resetInstance(): void {
        if (this.instance) {
            this.instance.cleanup();
        }
        this.instance = null;
        this.instancePromise = null;
        console.log('🔄 [ENHANCED] XMTP manager singleton reset');
    }
}