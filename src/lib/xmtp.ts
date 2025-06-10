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
            console.log('🚀 Initializing XMTP Browser Client...');
            
            // Generate or retrieve encryption key for local database
            this.encryptionKey = this.getOrCreateEncryptionKey();
            
            const clientOptions: ClientOptions = {
                env: config.env || 'dev',
                apiUrl: config.apiUrl,
                dbPath: config.dbPath || 'xmtp-db',
                // Note: Browser SDK doesn't use structuredLogging
                // logging is controlled via environment or client config
            };

            // Adapt BrowserSigner to XMTP Signer interface
            const adaptedSigner = {
                walletType: 'EOA' as const,
                getAddress: () => signer.getAddress(),
                signMessage: (message: string) => signer.signMessage(message),
            };

            // Browser SDK client creation pattern
            this.client = await Client.create(adaptedSigner, this.encryptionKey, clientOptions);
            this.isInitialized = true;

            console.log('✅ XMTP Client initialized successfully', {
                address: this.client.accountAddress,
                inboxId: this.client.inboxId,
                installationId: this.client.installationId
            });

            return this.client;
        } catch (error) {
            console.error('❌ XMTP Client initialization failed:', error);
            this.isInitialized = false;
            throw new Error(`Failed to initialize XMTP client: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get or create encryption key from environment variables
     * Falls back to generating a session key if no env key provided
     */
    private getOrCreateEncryptionKey(): Uint8Array {
        // Try to get key from environment variables
        const envKey = process.env.NEXT_PUBLIC_XMTP_ENCRYPTION_KEY;
        
        if (envKey) {
            try {
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
                
                console.warn('Invalid XMTP_ENCRYPTION_KEY format. Expected 32-byte hex (0x...) or base64 string');
            } catch (error) {
                console.warn('Failed to parse XMTP_ENCRYPTION_KEY from environment:', error);
            }
        }

        // Fallback: Generate session-specific key
        console.warn('No valid XMTP_ENCRYPTION_KEY found in environment. Generating session key.');
        console.warn('Note: Messages will not persist between sessions. Set NEXT_PUBLIC_XMTP_ENCRYPTION_KEY for persistence.');
        
        return crypto.getRandomValues(new Uint8Array(32));
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
        this.ensureClientReady();

        try {
            await this.client!.conversations.sync();
            const conversations = await this.client!.conversations.list();
            return conversations;
        } catch (error) {
            console.error('❌ Failed to fetch conversations:', error);
            throw new Error(`Failed to fetch conversations: ${error instanceof Error ? error.message : String(error)}`);
        }
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