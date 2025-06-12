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
            // Enhanced logging for buildathon demo
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

        try {
            await conversation.sync();
            const messages = await conversation.messages({
                limit: limit ? BigInt(limit) : undefined
            });
            return messages;
        } catch (error) {
            console.error('❌ Failed to fetch messages:', error);
            throw new Error(`Failed to fetch messages: ${error instanceof Error ? error.message : String(error)}`);
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
            console.log('🔄 Resetting XMTP local database...');
            
            // Cleanup current client
            await this.cleanup();
            
            // Clear IndexedDB databases that XMTP might use
            const databases = await indexedDB.databases();
            for (const db of databases) {
                if (db.name && (db.name.includes('xmtp') || db.name.includes('echofi'))) {
                    console.log(`🗑️ Deleting database: ${db.name}`);
                    const deleteReq = indexedDB.deleteDatabase(db.name);
                    await new Promise((resolve, reject) => {
                        deleteReq.onsuccess = () => resolve(undefined);
                        deleteReq.onerror = () => reject(deleteReq.error);
                        deleteReq.onblocked = () => {
                            console.warn(`Database ${db.name} deletion blocked`);
                            resolve(undefined);
                        };
                    });
                }
            }
            
            // Clear any localStorage items
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.includes('xmtp') || key.includes('echofi'))) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
            
            console.log('✅ XMTP database reset completed');
        } catch (error) {
            console.error('❌ Error resetting database:', error);
            throw new Error(`Failed to reset database: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Perform safe sync with error handling
     */
    async safeSyncConversations(): Promise<void> {
        if (!this.client) return;
        
        try {
            console.log('🔄 Syncing conversations...');
            await this.client.conversations.sync();
            console.log('✅ Conversations synced successfully');
        } catch (error) {
            console.warn('⚠️ Sync failed, continuing anyway:', error);
            // Don't throw - sync failures shouldn't block the app
        }
    }

    /**
     * Enhanced conversation fetching with retry logic
     */
    async getConversationsWithRetry(maxRetries = 3): Promise<Conversation[]> {
        this.ensureClientReady();

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`📡 Fetching conversations (attempt ${attempt}/${maxRetries})`);
                
                // Try to sync first, but don't fail if sync fails
                await this.safeSyncConversations();
                
                const conversations = await this.client!.conversations.list();
                console.log(`✅ Found ${conversations.length} conversations`);
                return conversations;
                
            } catch (error) {
                console.error(`❌ Attempt ${attempt} failed:`, error);
                
                if (attempt === maxRetries) {
                    // On final attempt, check if it's a sequence ID issue
                    if (error instanceof Error && error.message.includes('SequenceId')) {
                        console.log('🔧 Sequence ID error detected, database reset may be needed');
                        throw new Error('Database sync error. Please try resetting your chat database.');
                    }
                    throw error;
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
        
        return [];
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