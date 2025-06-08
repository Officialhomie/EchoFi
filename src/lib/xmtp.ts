import { 
    Client, 
    Conversation, 
    DecodedMessage,
    type Signer,
    type ClientOptions,
    type SafeCreateGroupOptions,
    GroupPermissionsOptions
} from '@xmtp/browser-sdk';

export interface XMTPConfig {
env?: 'dev' | 'production' | 'local';
dbPath?: string;
enableLogging?: boolean;
}

export interface GroupConfig {
name: string;
description: string;
imageUrl?: string;
permissions?: GroupPermissionsOptions;
}

export class XMTPManager {
private client: Client | null = null;
private isInitialized = false;

/**
 * Initialize XMTP Client with proper configuration
 */
async initializeClient(
    signer: Signer, 
    config: XMTPConfig = {}
): Promise<Client> {
    try {
    // Generate encryption key (in production, you might want to derive this from user's wallet)
    const encryptionKey = crypto.getRandomValues(new Uint8Array(32));
    
    const clientOptions: ClientOptions = {
        env: config.env || 'dev',
        dbPath: config.dbPath,
        structuredLogging: config.enableLogging || false,
        // Register content type codecs
        codecs: [
        // Note: You'll need to import the actual codec classes, not just the ContentTypeId
        // These might need to be imported differently based on the package structure
        ]
    };

    this.client = await Client.create(signer, encryptionKey, clientOptions);
    this.isInitialized = true;

    console.log('XMTP Client initialized successfully', {
        address: this.client.accountAddress,
        inboxId: this.client.inboxId
    });

    return this.client;
    } catch (error) {
    console.error('XMTP Client initialization failed:', error);
    this.isInitialized = false;
    throw new Error(`Failed to initialize XMTP client: ${error}`);
    }
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
    const groupOptions: SafeCreateGroupOptions = {
        name: groupConfig.name,
        description: groupConfig.description,
        imageUrlSquare: groupConfig.imageUrl,
        permissions: groupConfig.permissions || GroupPermissionsOptions.Default
    };

    const group = await this.client!.conversations.newGroup(
        memberAddresses,
        groupOptions
    );

    console.log('Investment group created:', {
        id: group.id,
        name: groupConfig.name,
        memberCount: memberAddresses.length
    });

    return group;
    } catch (error) {
    console.error('Failed to create investment group:', error);
    throw new Error(`Failed to create group: ${error}`);
    }
}

/**
 * Create a direct message conversation
 */
async createDirectMessage(accountAddress: string): Promise<Conversation> {
    this.ensureClientReady();

    try {
    const dm = await this.client!.conversations.newDm(accountAddress);
    console.log('Direct message created with:', accountAddress);
    return dm;
    } catch (error) {
    console.error('Failed to create direct message:', error);
    throw new Error(`Failed to create DM: ${error}`);
    }
}

/**
 * Get all conversations (groups and DMs)
 */
async getConversations(): Promise<Conversation[]> {
    this.ensureClientReady();

    try {
    const conversations = await this.client!.conversations.list();
    return conversations;
    } catch (error) {
    console.error('Failed to fetch conversations:', error);
    throw new Error(`Failed to fetch conversations: ${error}`);
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
    console.error('Failed to fetch conversation:', error);
    throw new Error(`Failed to fetch conversation: ${error}`);
    }
}

/**
 * Send a message to a conversation
 */
async sendMessage(
    conversation: Conversation, 
    content: string
): Promise<string> {
    this.ensureClientReady();

    try {
    const messageId = await conversation.send(content);
    console.log('Message sent:', { conversationId: conversation.id, messageId });
    return messageId;
    } catch (error) {
    console.error('Failed to send message:', error);
    throw new Error(`Failed to send message: ${error}`);
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
    const options = limit ? { limit: BigInt(limit) } : undefined;
    const messages = await conversation.messages(options);
    return messages;
    } catch (error) {
    console.error('Failed to fetch messages:', error);
    throw new Error(`Failed to fetch messages: ${error}`);
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

    const stream = await conversation.stream((error, message) => {
        if (error && onError) {
        onError(error);
        return;
        }
        if (message) {
        onMessage(message);
        }
    });

    // Return cleanup function
    return () => {
        if (stream && typeof stream.return === 'function') {
        stream.return(undefined);
        }
    };
    } catch (error) {
    console.error('Failed to stream messages:', error);
    throw new Error(`Failed to stream messages: ${error}`);
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
    const stream = await this.client!.conversations.stream((error, conversation) => {
        if (error && onError) {
        onError(error);
        return;
        }
        if (conversation) {
        onConversation(conversation);
        }
    });

    // Return cleanup function
    return () => {
        if (stream && typeof stream.return === 'function') {
        stream.return(undefined);
        }
    };
    } catch (error) {
    console.error('Failed to stream conversations:', error);
    throw new Error(`Failed to stream conversations: ${error}`);
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
    console.log('Members added to group:', { 
        conversationId: conversation.id, 
        newMembers: memberAddresses 
    });
    } catch (error) {
    console.error('Failed to add group members:', error);
    throw new Error(`Failed to add members: ${error}`);
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
    console.log('Members removed from group:', { 
        conversationId: conversation.id, 
        removedMembers: memberAddresses 
    });
    } catch (error) {
    console.error('Failed to remove group members:', error);
    throw new Error(`Failed to remove members: ${error}`);
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
    console.error('Failed to check message capability:', error);
    throw new Error(`Failed to check message capability: ${error}`);
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
    isReady: this.client.isReady
    };
}

/**
 * Cleanup and close connections
 */
async cleanup(): Promise<void> {
    if (this.client) {
    try {
        // Close any active streams or connections
        this.client = null;
        this.isInitialized = false;
        console.log('XMTP client cleanup completed');
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
    }
}
}