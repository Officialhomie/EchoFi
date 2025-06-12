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

export class XMTPManager {
    private client: Client | null = null;
    private isInitialized = false;
    private encryptionKey: Uint8Array | null = null;

    /**
     * Initialize XMTP Client with proper browser SDK configuration
     */
    async initializeClient(
        signer: BrowserSigner, 
        config: XMTPConfig = {}
      ): Promise<Client> {
        try {
          console.log('🚀 [FIXED] Initializing XMTP Browser Client with persistent encryption...');
          
          // Get key info for debugging
          const keyInfo = this.getKeyInfo();
          console.log('🔑 [FIXED] Encryption key info:', keyInfo);
          
          // Generate or retrieve encryption key with persistence
          this.encryptionKey = this.getOrCreateEncryptionKey();
          
          const clientOptions: ClientOptions = {
            env: config.env || 'dev',
            apiUrl: config.apiUrl,
            dbPath: config.dbPath || 'xmtp-db',
          };
      
          // Adapt BrowserSigner to XMTP Signer interface
          const adaptedSigner = {
            walletType: 'EOA' as const,
            getAddress: () => signer.getAddress(),
            signMessage: (message: string) => signer.signMessage(message),
          };
      
          console.log('🔧 [FIXED] Creating XMTP client with options:', {
            env: clientOptions.env,
            dbPath: clientOptions.dbPath,
            hasEncryptionKey: !!this.encryptionKey,
            keyLength: this.encryptionKey?.length
          });
      
          // Browser SDK client creation with enhanced error handling
          this.client = await Client.create(adaptedSigner, this.encryptionKey, clientOptions);
          this.isInitialized = true;
      
          console.log('✅ [FIXED] XMTP Client initialized successfully with persistent key:', {
            address: this.client.accountAddress,
            inboxId: this.client.inboxId,
            installationId: this.client.installationId,
            keyPersistence: keyInfo.keySource
          });
      
          return this.client;
        } catch (error) {
          console.error('❌ [FIXED] XMTP Client initialization failed:', error);
          this.isInitialized = false;
          
          // Provide specific error guidance
          if (error instanceof Error) {
            if (error.message.includes('encryption')) {
              throw new Error(`XMTP encryption error: ${error.message}. Try clearing stored keys.`);
            } else if (error.message.includes('network')) {
              throw new Error(`XMTP network error: ${error.message}. Check internet connection.`);
            } else if (error.message.includes('signer')) {
              throw new Error(`XMTP signer error: ${error.message}. Check wallet connection.`);
            }
          }
          
          throw new Error(`Failed to initialize XMTP client: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

    /**
     * Get or create encryption key with proper persistence
     * Now stores in localStorage for browser persistence instead of session-only generation
     */
    private getOrCreateEncryptionKey(): Uint8Array {
        const STORAGE_KEY = 'xmtp_encryption_key_v1';
        
        // Try to get key from environment variables first (production)
        const envKey = process.env.NEXT_PUBLIC_XMTP_ENCRYPTION_KEY;
        
        if (envKey) {
        try {
            console.log('🔑 [FIXED] Using XMTP encryption key from environment');
            
            // Convert hex string to Uint8Array
            if (envKey.startsWith('0x')) {
            const hexKey = envKey.slice(2);
            if (hexKey.length === 64) { // 32 bytes = 64 hex chars
                return new Uint8Array(Buffer.from(hexKey, 'hex'));
            }
            }
            
            // Try base64 format
            const keyBytes = Buffer.from(envKey, 'base64');
            if (keyBytes.length === 32) {
            return new Uint8Array(keyBytes);
            }
            
            console.warn('⚠️ [FIXED] Invalid XMTP_ENCRYPTION_KEY format in environment');
        } catch (error) {
            console.warn('⚠️ [FIXED] Failed to parse XMTP_ENCRYPTION_KEY from environment:', error);
        }
        }
    
        // Try to get existing key from localStorage (browser persistence)
        if (typeof window !== 'undefined') {
        try {
            const storedKey = localStorage.getItem(STORAGE_KEY);
            if (storedKey) {
            console.log('🔑 [FIXED] Found existing XMTP encryption key in localStorage');
            const keyBytes = Buffer.from(storedKey, 'base64');
            if (keyBytes.length === 32) {
                return new Uint8Array(keyBytes);
            } else {
                console.warn('⚠️ [FIXED] Stored key has invalid length, generating new one');
                localStorage.removeItem(STORAGE_KEY);
            }
            }
        } catch (error) {
            console.warn('⚠️ [FIXED] Failed to read stored XMTP key:', error);
            // Clear invalid stored key
            try {
            localStorage.removeItem(STORAGE_KEY);
            } catch {}
        }
        }
    
        // Generate new key and store it for persistence
        console.log('🔑 [FIXED] Generating new XMTP encryption key with localStorage persistence');
        const newKey = crypto.getRandomValues(new Uint8Array(32));
        
        // Store in localStorage for persistence between sessions
        if (typeof window !== 'undefined') {
        try {
            const keyBase64 = Buffer.from(newKey).toString('base64');
            localStorage.setItem(STORAGE_KEY, keyBase64);
            console.log('✅ [FIXED] XMTP encryption key saved to localStorage for persistence');
        } catch (error) {
            console.warn('⚠️ [FIXED] Failed to store XMTP key in localStorage:', error);
            console.warn('🔄 [FIXED] Messages will only persist for this session');
        }
        }
    
        return newKey;
    }

    /**
     * Clear stored encryption key (useful for testing or key rotation)
     */
    public clearStoredEncryptionKey(): void {
        const STORAGE_KEY = 'xmtp_encryption_key_v1';
        
        if (typeof window !== 'undefined') {
        try {
            localStorage.removeItem(STORAGE_KEY);
            console.log('🗑️ [FIXED] Cleared stored XMTP encryption key');
        } catch (error) {
            console.warn('⚠️ [FIXED] Failed to clear stored XMTP key:', error);
        }
        }
    }

    /**
     * Get key info for debugging
     */
    public getKeyInfo(): { hasEnvKey: boolean; hasStoredKey: boolean; keySource: string } {
        const hasEnvKey = !!process.env.NEXT_PUBLIC_XMTP_ENCRYPTION_KEY;
        let hasStoredKey = false;
        
        if (typeof window !== 'undefined') {
        try {
            const storedKey = localStorage.getItem('xmtp_encryption_key_v1');
            hasStoredKey = !!storedKey;
        } catch {}
        }
        
        let keySource = 'none';
        if (hasEnvKey) keySource = 'environment';
        else if (hasStoredKey) keySource = 'localStorage';
        else keySource = 'generated';
        
        return { hasEnvKey, hasStoredKey, keySource };
    }

    /**
     * Check if client is ready for operations
     */
    private ensureClientReady(): void {
        if (!this.client || !this.isInitialized) {
            throw new Error('XMTP client not initialized. Call initializeClient() first.');
        }
    }

    /**
     * Create a new investment group with specified members
     */
    async createInvestmentGroup(
        groupConfig: GroupConfig,
        memberAddresses: string[]
    ): Promise<Conversation> {
        this.ensureClientReady();

        try {
            console.log('Creating investment group:', {
                name: groupConfig.name,
                memberCount: memberAddresses.length,
                members: memberAddresses
            });

            // Validate addresses before creating group
            if (memberAddresses.length > 0) {
                console.log('Validating member addresses...');
                const canMessageMap = await this.canMessage(memberAddresses);
                const invalidAddresses = Array.from(canMessageMap.entries())
                    .filter(([address, canMsg]) => !canMsg)
                    .map(([address]) => address);
                
                if (invalidAddresses.length > 0) {
                    throw new Error(`Some addresses cannot receive XMTP messages: ${invalidAddresses.join(', ')}`);
                }
            }

            // Create group - in XMTP v3, creator is automatically included
            // Only pass additional member addresses
            const group = await this.client!.conversations.newGroup(
                memberAddresses, // Don't include creator's address
                {
                    name: groupConfig.name,
                    description: groupConfig.description,
                    imageUrlSquare: groupConfig.imageUrlSquare
                    // permissions omitted for default behavior
                }
            );

            console.log('✅ Investment group created:', {
                id: group.id,
                name: groupConfig.name,
                memberCount: memberAddresses.length + 1 // +1 for creator
            });

            return group;
        } catch (error) {
            console.error('❌ Failed to create investment group:', error);
            
            // Provide more specific error messages
            if (error instanceof Error) {
                if (error.message.includes('Addresses not found')) {
                    throw new Error('Some member addresses are not valid or cannot receive XMTP messages. Please verify all addresses are correct and have XMTP enabled.');
                } else if (error.message.includes('network')) {
                    throw new Error('Network error while creating group. Please check your connection and try again.');
                } else {
                    throw new Error(`Failed to create group: ${error.message}`);
                }
            } else {
                throw new Error(`Failed to create group: ${String(error)}`);
            }
        }
    }

    /**
     * Create a direct message conversation
     */
    async createDirectMessage(peerAddress: string): Promise<Conversation> {
        this.ensureClientReady();

        try {
            const dm = await this.client!.conversations.newDm(peerAddress);
            console.log('✅ Direct message created with:', peerAddress);
            return dm;
        } catch (error) {
            console.error('❌ Failed to create direct message:', error);
            throw new Error(`Failed to create DM: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get all conversations (groups and DMs)
     */
    async getConversations(): Promise<Conversation[]> {
        return await this.getConversationsWithRetry();
    }

    /**
     * Get a specific conversation by ID
     */
    async getConversationById(conversationId: string): Promise<Conversation | undefined> {
        this.ensureClientReady();

        try {
            return await this.client!.conversations.getConversationById(conversationId);
        } catch (error) {
            console.error('❌ Failed to fetch conversation:', error);
            throw new Error(`Failed to fetch conversation: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Send a message to a conversation
     */
    async sendMessage(
        conversation: Conversation, 
        content: string | any,
        contentType?: any
    ): Promise<string> {
        this.ensureClientReady();

        try {
            const messageId = await conversation.send(content, contentType);
            console.log('✅ Message sent:', { conversationId: conversation.id, messageId });
            return messageId;
        } catch (error) {
            console.error('❌ Failed to send message:', error);
            throw new Error(`Failed to send message: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get messages from a conversation
     */
    async getMessages(
        conversation: Conversation,
        limit?: number
    ): Promise<DecodedMessage[]> {
        this.ensureClientReady();
    
        const maxRetries = 3;
        let lastError: Error | null = null;
    
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`📥 Fetching messages (attempt ${attempt}/${maxRetries})...`);
                
                // Attempt to sync conversation first
                await this.syncConversationSafely(conversation);
                
                const messages = await conversation.messages({
                    limit: limit ? BigInt(limit) : undefined
                });
                
                console.log(`✅ Successfully fetched ${messages.length} messages`);
                return messages;
                
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                console.error(`❌ Message fetch attempt ${attempt} failed:`, lastError);
                
                // Check if it's a SequenceId error
                if (lastError.message.includes('SequenceId not found') || 
                    lastError.message.includes('sequence ID') ||
                    lastError.message.includes('local db')) {
                    
                    console.log(`🔧 SequenceId error detected, attempting database recovery...`);
                    
                    if (attempt < maxRetries) {
                        // Try to recover the conversation
                        try {
                            await this.recoverConversationDatabase(conversation);
                            continue; // Retry after recovery
                        } catch (recoveryError) {
                            console.warn('⚠️ Database recovery failed:', recoveryError);
                        }
                    } else {
                        // On final attempt, return empty array instead of crashing
                        console.log('🛡️ All recovery attempts failed, returning empty messages');
                        return [];
                    }
                } else {
                    // For non-SequenceId errors, retry with backoff
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                        continue;
                    }
                }
            }
        }
        
        // If all retries failed, return empty array instead of throwing
        console.warn('⚠️ All message fetch attempts failed, returning empty array');
        return [];
    }

    /**
     * Safely sync conversation without throwing errors
     */
    private async syncConversationSafely(conversation: Conversation): Promise<void> {
        try {
            await conversation.sync();
            console.log('✅ Conversation synced successfully');
        } catch (error) {
            console.warn('⚠️ Conversation sync failed (continuing anyway):', error);
            // Don't throw - sync failures shouldn't block message fetching
        }
    }

    /**
     * Attempt to recover corrupted conversation database
     */
    private async recoverConversationDatabase(conversation: Conversation): Promise<void> {
        try {
            console.log('🔄 Attempting conversation database recovery...');
            
            // Method 1: Force conversation sync
            try {
                await conversation.sync();
                console.log('✅ Conversation sync recovery successful');
                return;
            } catch (syncError) {
                console.warn('⚠️ Sync recovery failed:', syncError);
            }
            
            // Method 2: Try to get conversation info to verify it's valid
            try {
                const info = {
                    id: conversation.id,
                    topic: conversation.description,
                    createdAt: conversation.createdAtNs
                };
                console.log('📋 Conversation info:', info);
            } catch (infoError) {
                console.warn('⚠️ Conversation info retrieval failed:', infoError);
                throw new Error('Conversation appears to be corrupted');
            }
            
            console.log('✅ Conversation database recovery completed');
            
        } catch (error) {
            console.error('❌ Conversation recovery failed:', error);
            throw error;
        }
    }


    /**
     * Stream messages from a specific conversation
     */
    async streamConversationMessages(
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

            // Use client.conversations.streamAllMessages and filter by conversationId
            const streamPromise = this.client!.conversations.streamAllMessages();
            (async () => {
                try {
                    const stream = await streamPromise;
                    for await (const message of stream) {
                        if (!message) continue;
                        if (message.conversationId !== conversationId) continue;
                        // Filter out our own messages
                        if (message.senderInboxId === this.client!.inboxId) {
                            continue;
                        }
                        onMessage(message);
                    }
                } catch (error) {
                    if (onError) {
                        onError(error instanceof Error ? error : new Error(String(error)));
                    }
                }
            })();

            // Return cleanup function (no-op for browser SDK)
            return () => {
                console.log('🧹 Message stream stopped for conversation:', conversationId);
            };
        } catch (error) {
            console.error('❌ Failed to stream messages:', error);
            throw new Error(`Failed to stream messages: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Stream all conversations
     */
    async streamAllConversations(
        onConversation: (conversation: Conversation) => void,
        onError?: (error: Error) => void
    ): Promise<() => void> {
        this.ensureClientReady();

        try {
            const streamPromise = this.client!.conversations.stream();
            (async () => {
                try {
                    const stream = await streamPromise;
                    for await (const conversation of stream) {
                        if (!conversation) continue;
                        onConversation(conversation);
                    }
                } catch (error) {
                    if (onError) {
                        onError(error instanceof Error ? error : new Error(String(error)));
                    }
                }
            })();

            return () => {
                console.log('🧹 Conversation stream stopped');
            };
        } catch (error) {
            console.error('❌ Failed to stream conversations:', error);
            throw new Error(`Failed to stream conversations: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Add members to a group
     */
    async addGroupMembers(
        conversation: Conversation, 
        memberAddresses: string[]
    ): Promise<void> {
        this.ensureClientReady();

        try {
            await conversation.addMembers(memberAddresses);
            console.log('✅ Members added to group:', { 
                conversationId: conversation.id, 
                newMembers: memberAddresses 
            });
        } catch (error) {
            console.error('❌ Failed to add group members:', error);
            throw new Error(`Failed to add members: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Remove members from a group
     */
    async removeGroupMembers(
        conversation: Conversation, 
        memberAddresses: string[]
    ): Promise<void> {
        this.ensureClientReady();

        try {
            await conversation.removeMembers(memberAddresses);
            console.log('✅ Members removed from group:', { 
                conversationId: conversation.id, 
                removedMembers: memberAddresses 
            });
        } catch (error) {
            console.error('❌ Failed to remove group members:', error);
            throw new Error(`Failed to remove members: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Check if addresses can receive messages
     */
    async canMessage(addresses: string[]): Promise<Map<string, boolean>> {
        this.ensureClientReady();

        try {
            return await this.client!.canMessage(addresses);
        } catch (error) {
            console.error('❌ Failed to check message capability:', error);
            throw new Error(`Failed to check message capability: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get client info
     */
    getClientInfo() {
        if (!this.client) return null;
        
        return {
            address: this.client.accountAddress,
            inboxId: this.client.inboxId,
            installationId: this.client.installationId,
            isReady: this.isInitialized
        };
    }

    /**
     * Get initialization status
     */
    get isClientInitialized(): boolean {
        return this.isInitialized && this.client !== null;
    }

    /**
     * Reset local database to fix sync issues
     */
    async resetDatabase(): Promise<void> {
        try {
            console.log('🔄 Starting comprehensive XMTP database reset...');
            
            // Step 1: Cleanup current client
            await this.cleanup();
            console.log('✅ Client cleanup completed');
            
            // Step 2: Clear IndexedDB databases
            await this.clearIndexedDBDatabases();
            console.log('✅ IndexedDB cleanup completed');
            
            // Step 3: Clear localStorage
            await this.clearLocalStorage();
            console.log('✅ localStorage cleanup completed');
            
            // Step 4: Clear session storage
            await this.clearSessionStorage();
            console.log('✅ sessionStorage cleanup completed');
            
            // Step 5: Reset internal state
            this.client = null;
            this.isInitialized = false;
            this.encryptionKey = null;
            
            console.log('✅ XMTP database reset completed successfully');
            
        } catch (error) {
            console.error('❌ Database reset failed:', error);
            throw new Error(`Failed to reset database: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Clear all XMTP-related IndexedDB databases
     */
    private async clearIndexedDBDatabases(): Promise<void> {
        try {
            const databases = await indexedDB.databases();
            const xmtpDatabases = databases.filter(db => 
                db.name && (
                    db.name.includes('xmtp') || 
                    db.name.includes('echofi') ||
                    db.name.includes('libxmtp') ||
                    db.name.toLowerCase().includes('mls')
                )
            );
            
            console.log(`🗑️ Found ${xmtpDatabases.length} XMTP databases to delete`);
            
            for (const db of xmtpDatabases) {
                if (db.name) {
                    console.log(`🗑️ Deleting database: ${db.name}`);
                    await this.deleteDatabase(db.name);
                }
            }
            
        } catch (error) {
            console.warn('⚠️ IndexedDB cleanup failed (continuing anyway):', error);
        }
    }

    /**
     * Delete a specific IndexedDB database
     */
    private async deleteDatabase(dbName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const deleteReq = indexedDB.deleteDatabase(dbName);
            
            deleteReq.onsuccess = () => {
                console.log(`✅ Database ${dbName} deleted successfully`);
                resolve();
            };
            
            deleteReq.onerror = () => {
                console.error(`❌ Failed to delete database ${dbName}:`, deleteReq.error);
                resolve(); // Don't reject - continue with other cleanup
            };
            
            deleteReq.onblocked = () => {
                console.warn(`⚠️ Database ${dbName} deletion blocked (might be open in another tab)`);
                // Wait a bit and resolve anyway
                setTimeout(() => resolve(), 2000);
            };
            
            // Timeout after 10 seconds
            setTimeout(() => {
                console.warn(`⏰ Database ${dbName} deletion timed out`);
                resolve();
            }, 10000);
        });
    }

    /**
     * Clear XMTP-related localStorage entries
     */
    private async clearLocalStorage(): Promise<void> {
        try {
            const keysToRemove: string[] = [];
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && this.isXMTPStorageKey(key)) {
                    keysToRemove.push(key);
                }
            }
            
            console.log(`🗑️ Clearing ${keysToRemove.length} localStorage entries`);
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
                console.log(`🗑️ Removed localStorage key: ${key}`);
            });
            
        } catch (error) {
            console.warn('⚠️ localStorage cleanup failed (continuing anyway):', error);
        }
    }

    /**
     * Clear XMTP-related sessionStorage entries
     */
    private async clearSessionStorage(): Promise<void> {
        try {
            const keysToRemove: string[] = [];
            
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key && this.isXMTPStorageKey(key)) {
                    keysToRemove.push(key);
                }
            }
            
            console.log(`🗑️ Clearing ${keysToRemove.length} sessionStorage entries`);
            keysToRemove.forEach(key => {
                sessionStorage.removeItem(key);
                console.log(`🗑️ Removed sessionStorage key: ${key}`);
            });
            
        } catch (error) {
            console.warn('⚠️ sessionStorage cleanup failed (continuing anyway):', error);
        }
    }

    /**
     * Check if a storage key is XMTP-related
     */
    private isXMTPStorageKey(key: string): boolean {
        const xmtpKeywords = [
            'xmtp',
            'echofi',
            'libxmtp',
            'mls',
            'encryption_key',
            'sequence',
            'inbox',
            'conversation'
        ];
        
        const lowerKey = key.toLowerCase();
        return xmtpKeywords.some(keyword => lowerKey.includes(keyword));
    }

    /**
     * Safe conversation sync without throwing errors
     */
    async safeSyncConversations(): Promise<void> {
        if (!this.client) return;
        
        try {
            console.log('🔄 Syncing conversations...');
            await this.client.conversations.sync();
            console.log('✅ Conversations synced successfully');
        } catch (error) {
            console.warn('⚠️ Conversation sync failed (continuing anyway):', error);
            // Don't throw - sync failures shouldn't block the app
        }
    }

    /**
     * Enhanced conversation fetching with better error handling
     */
    async getConversationsWithRetry(maxRetries = 3): Promise<Conversation[]> {
        this.ensureClientReady();

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`📡 Fetching conversations (attempt ${attempt}/${maxRetries})`);
                
                // Try to sync first, but don't fail if sync fails
                await this.safeSyncConversations();
                
                // Fetch conversations
                const conversations = await this.client!.conversations.list();
                console.log(`✅ Found ${conversations.length} conversations`);
                
                // Validate conversations
                const validConversations = await this.validateConversations(conversations);
                console.log(`✅ ${validConversations.length} valid conversations`);
                
                return validConversations;
                
            } catch (error) {
                console.error(`❌ Conversation fetch attempt ${attempt} failed:`, error);
                
                if (attempt === maxRetries) {
                    // On final attempt, check if it's a database issue
                    if (error instanceof Error && (
                        error.message.includes('SequenceId') ||
                        error.message.includes('database') ||
                        error.message.includes('sync')
                    )) {
                        console.log('🔧 Database corruption detected, reset may be needed');
                        throw new Error('XMTP database corruption detected. Please reset your chat database.');
                    }
                    
                    // For other errors, return empty array
                    console.warn('⚠️ All conversation fetch attempts failed, returning empty array');
                    return [];
                }
                
                // Wait before retry with exponential backoff
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
            }
        }
        
        return [];
    }


    /**
     * Validate conversations to ensure they're not corrupted
     */
    private async validateConversations(conversations: Conversation[]): Promise<Conversation[]> {
        const validConversations: Conversation[] = [];
        
        for (const conversation of conversations) {
            try {
                // Basic validation - check if conversation has required properties
                if (conversation.id && conversation.description) {
                    validConversations.push(conversation);
                } else {
                    console.warn('⚠️ Skipping invalid conversation:', conversation.id);
                }
            } catch (error) {
                console.warn('⚠️ Skipping corrupted conversation:', error);
            }
        }
        
        return validConversations;
    }

    /**
     * Cleanup and close connections
     */
    async cleanup(): Promise<void> {
        if (this.client) {
            try {
                // Browser SDK doesn't require explicit cleanup like Node SDK
                this.client = null;
                this.isInitialized = false;
                this.encryptionKey = null;
                
                console.log('🧹 XMTP client cleanup completed');
            } catch (error) {
                console.error('❌ Error during cleanup:', error);
            }
        }
    }
}