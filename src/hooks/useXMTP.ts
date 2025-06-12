import { useState, useEffect, useCallback, useRef } from 'react';
import { Client, Conversation, DecodedMessage } from '@xmtp/browser-sdk';
import { XMTPManager, type XMTPConfig, type GroupConfig, type BrowserSigner } from '@/lib/xmtp';
import { useWallet } from '@/hooks/useWallet';
import { 
  InvestmentProposal,
  InvestmentVote,
  ContentTypeInvestmentProposal,
  ContentTypeInvestmentVote
} from '@/lib/content-types';
import type { JsonRpcSigner } from 'ethers';

export interface UseXMTPReturn {
  client: Client | null;
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  conversations: Conversation[];
  
  // Core functions
  initializeXMTP: () => Promise<void>;
  createGroup: (name: string, description: string, members: string[]) => Promise<Conversation>;
  createDM: (address: string) => Promise<Conversation>;
  sendMessage: (conversationId: string, content: unknown, contentType?: string) => Promise<void>;
  getMessages: (conversationId: string, limit?: number) => Promise<DecodedMessage[]>;
  streamMessages: (conversationId: string, onMessage: (message: DecodedMessage) => void) => Promise<() => void>;
  
  // Group management
  addMembers: (conversationId: string, addresses: string[]) => Promise<void>;
  removeMembers: (conversationId: string, addresses: string[]) => Promise<void>;
  
  // Database management
  resetDatabase: () => Promise<void>;
  
  // Utility functions
  canMessage: (addresses: string[]) => Promise<Map<string, boolean>>;
  refreshConversations: () => Promise<void>;
  cleanup: () => Promise<void>;
  clearError?: () => void;
  checkDatabaseHealth: () => Promise<boolean>;
  safeMessageOperation: <T>(operation: () => Promise<T>, fallbackValue: T, operationName: string) => Promise<T>;
}

/**
 * Create XMTP-compatible signer from ethers JsonRpcSigner
 */
function createBrowserSigner(jsonRpcSigner: JsonRpcSigner): BrowserSigner {
  return {
    getAddress: async (): Promise<string> => {
      return await jsonRpcSigner.getAddress();
    },
    signMessage: async (message: string): Promise<Uint8Array> => {
      const signature = await jsonRpcSigner.signMessage(message);
      // Convert hex signature to Uint8Array
      const hexSignature = signature.startsWith('0x') ? signature.slice(2) : signature;
      return new Uint8Array(Buffer.from(hexSignature, 'hex'));
    }
  };
}

export function useXMTP(config?: XMTPConfig): UseXMTPReturn {
  const { signer, isConnected, address } = useWallet();
  const [client, setClient] = useState<Client | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  
  const xmtpManager = useRef<XMTPManager | null>(null);
  const messageStreams = useRef<Map<string, () => void>>(new Map());

  const refreshConversations = useCallback(async () => {
    if (!xmtpManager.current) return;
  
    try {
      console.log('🔄 Refreshing conversations...');
      const convos = await xmtpManager.current.getConversations();
      setConversations(convos);
      console.log(`✅ Loaded ${convos.length} conversations`);
      
      // Clear any previous errors on successful load
      if (convos.length > 0) {
        setError(null);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Failed to refresh conversations:', errorMessage);
      
      // Handle different types of errors appropriately
      if (errorMessage.includes('SequenceId') || 
          errorMessage.includes('database') || 
          errorMessage.includes('sync')) {
        console.log('🔧 Database sync error detected');
        setError('Chat database sync error. You may need to reset your chat database.');
      } else if (errorMessage.includes('network') || 
                 errorMessage.includes('connection')) {
        setError('Network connection issue. Please check your internet connection.');
      } else {
        setError('Failed to load conversations. Please try again.');
      }
      
      // Don't crash the app - set empty conversations
      setConversations([]);
    }
  }, []);

  const safeMessageOperation = useCallback(async <T>(
    operation: () => Promise<T>,
    fallbackValue: T,
    operationName: string
  ): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ ${operationName} failed:`, errorMessage);
      
      // Handle SequenceId errors specifically
      if (errorMessage.includes('SequenceId') || 
          errorMessage.includes('local db') ||
          errorMessage.includes('database corruption')) {
        console.log(`🛡️ Database error in ${operationName}, using fallback`);
        setError(`Database sync issue during ${operationName.toLowerCase()}. Some features may be temporarily unavailable.`);
      }
      
      return fallbackValue;
    }
  }, []);

  const checkDatabaseHealth = useCallback(async (): Promise<boolean> => {
    if (!xmtpManager.current || !client) {
      return false;
    }
  
    try {
      console.log('🔍 Checking XMTP database health...');
      
      // Test basic operations
      await client.conversations.list();
      console.log('✅ Database health check passed');
      return true;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Database health check failed:', errorMessage);
      
      if (errorMessage.includes('SequenceId') || 
          errorMessage.includes('database') ||
          errorMessage.includes('sync')) {
        console.log('🔧 Database corruption detected in health check');
        setError('Database corruption detected. Consider resetting your chat database.');
        return false;
      }
      
      return false;
    }
  }, [client]);
  

  const initializeXMTP = useCallback(async () => {
    if (!signer || isInitializing) return;
    
    setIsInitializing(true);
    setError(null);
  
    try {
      console.log('🚀 Initializing XMTP...');
      
      // Create XMTP manager
      xmtpManager.current = new XMTPManager();
      
      // Create browser-compatible signer
      const browserSigner = createBrowserSigner(signer);
      
      // Initialize XMTP client with browser SDK
      const xmtpConfig: XMTPConfig = {
        env: config?.env || 'dev',
        enableLogging: config?.enableLogging || true,
        dbPath: config?.dbPath || 'echofi-xmtp',
        ...config,
      };
  
      const xmtpClient = await xmtpManager.current.initializeClient(browserSigner, xmtpConfig);
      
      setClient(xmtpClient);
      setIsInitialized(true);
      
      // Perform health check after initialization
      const isHealthy = await checkDatabaseHealth();
      
      if (isHealthy) {
        // Load existing conversations with safe error handling
        try {
          await refreshConversations();
        } catch (convError) {
          console.warn('⚠️ Failed to load conversations during init (continuing anyway):', convError);
          // Don't fail initialization just because conversation loading failed
        }
      } else {
        console.warn('⚠️ Database health check failed, but client initialized');
        setError('Chat database may have issues. Some features might not work properly.');
      }
      
      console.log('✅ XMTP initialized successfully');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize XMTP';
      console.error('❌ XMTP initialization failed:', errorMessage);
      
      // Provide specific error guidance
      if (errorMessage.includes('SequenceId') || 
          errorMessage.includes('database') || 
          errorMessage.includes('sync')) {
        setError('Database sync error during initialization. Click "Reset Database" below if the problem persists.');
      } else if (errorMessage.includes('signer') || 
                 errorMessage.includes('wallet')) {
        setError('Wallet connection issue. Please check your wallet and try again.');
      } else if (errorMessage.includes('network')) {
        setError('Network connection issue. Please check your internet connection.');
      } else {
        setError(`Initialization failed: ${errorMessage}`);
      }
    } finally {
      setIsInitializing(false);
    }
  }, [signer, isInitializing, config, refreshConversations, checkDatabaseHealth]);
  



  const resetDatabase = useCallback(async () => {
    if (!xmtpManager.current) return;
  
    try {
      setIsInitializing(true);
      setError(null);
      
      console.log('🔄 Resetting XMTP database...');
      await xmtpManager.current.resetDatabase();
      
      // Reset all state
      setClient(null);
      setIsInitialized(false);
      setConversations([]);
      
      // Stop all message streams
      messageStreams.current.forEach(stopStream => {
        try {
          stopStream();
        } catch (error) {
          console.warn('⚠️ Error stopping stream:', error);
        }
      });
      messageStreams.current.clear();
      
      // Recreate XMTP manager
      xmtpManager.current = new XMTPManager();
      
      console.log('✅ Database reset complete');
      
      // Reinitialize XMTP if wallet is connected
      if (signer && isConnected) {
        console.log('🔄 Reinitializing XMTP after database reset...');
        await initializeXMTP();
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Database reset failed:', errorMessage);
      setError(`Reset failed: ${errorMessage}`);
    } finally {
      setIsInitializing(false);
    }
  }, [signer, isConnected, initializeXMTP]);

  // Initialize XMTP when wallet is connected
  useEffect(() => {
    if (isConnected && signer && !isInitialized && !isInitializing) {
      initializeXMTP();
    }
  }, [isConnected, signer, isInitialized, isInitializing, initializeXMTP]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const createGroup = useCallback(async (
    name: string, 
    description: string, 
    members: string[]
  ): Promise<Conversation> => {
    console.log('🔄 Creating group:', { name, description, members, memberCount: members.length });
    
    if (!xmtpManager.current) {
      throw new Error('XMTP not initialized');
    }

    if (!address) {
      throw new Error('Wallet address not available');
    }

    try {
      // Log current state for debugging
      const clientInfo = xmtpManager.current.getClientInfo();
      console.log('📊 XMTP Client Info:', clientInfo);

      const groupConfig: GroupConfig = {
        name,
        description,
      };

      console.log('📝 Group config:', groupConfig);
      console.log('👥 Member addresses to add:', members);

      const conversation = await xmtpManager.current.createInvestmentGroup(groupConfig, members);
      
      console.log('✅ Group created successfully:', {
        id: conversation.id,
        name: name,
        memberCount: members.length + 1 // +1 for creator
      });
      
      // Refresh conversations list
      await refreshConversations();
      
      return conversation;
    } catch (error) {
      console.error('❌ Group creation failed:', error);
      
      // Provide more helpful error messages
      let errorMessage = 'Failed to create group';
      if (error instanceof Error) {
        if (error.message.includes('Addresses not found')) {
          errorMessage = 'Some member addresses are invalid or cannot receive XMTP messages. Please verify all addresses.';
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('permission')) {
          errorMessage = 'Permission denied. Please ensure your wallet is properly connected.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [refreshConversations, address]);

  const createDM = useCallback(async (address: string): Promise<Conversation> => {
    if (!xmtpManager.current) {
      throw new Error('XMTP not initialized');
    }

    try {
      const conversation = await xmtpManager.current.createDirectMessage(address);
      await refreshConversations();
      return conversation;
    } catch (error) {
      console.error('Failed to create DM:', error);
      throw error;
    }
  }, [refreshConversations]);

  const sendMessage = useCallback(async (
    conversationId: string,
    content: unknown,
    contentType?: string
  ): Promise<void> => {
    await safeMessageOperation(async () => {
      if (!xmtpManager.current) {
        throw new Error('XMTP not initialized');
      }
      const conversation = await xmtpManager.current.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }
      if (contentType) {
        await xmtpManager.current.sendMessage(conversation, content, contentType);
      } else {
        await xmtpManager.current.sendMessage(conversation, content);
      }
    }, undefined, 'Send Message');
  }, [safeMessageOperation]);

  const getMessages = useCallback(async (
    conversationId: string,
    limit?: number
  ): Promise<DecodedMessage[]> => {
    if (!xmtpManager.current) {
      throw new Error('XMTP not initialized');
    }
  
    try {
      const conversation = await xmtpManager.current.getConversationById(conversationId);
      if (!conversation) {
        console.warn(`⚠️ Conversation ${conversationId} not found`);
        return [];
      }
  
      return await xmtpManager.current.getMessages(conversation, limit);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Failed to get messages:', errorMessage);
      
      // Handle SequenceId errors gracefully
      if (errorMessage.includes('SequenceId') || 
          errorMessage.includes('local db') ||
          errorMessage.includes('database')) {
        console.log('🛡️ Database error detected, returning empty messages array');
        setError('Chat database sync issue detected. Messages may be temporarily unavailable.');
        return [];
      }
      
      // For other errors, still return empty array to prevent UI crashes
      setError(`Failed to load messages: ${errorMessage}`);
      return [];
    }
  }, []);

  const streamMessages = useCallback(async (
    conversationId: string,
    onMessage: (message: DecodedMessage) => void
  ): Promise<() => void> => {
    if (!xmtpManager.current) {
      throw new Error('XMTP not initialized');
    }
  
    try {
      // Stop existing stream for this conversation
      const existingStream = messageStreams.current.get(conversationId);
      if (existingStream) {
        existingStream();
      }
  
      // Start new stream with error handling
      const stopStream = await xmtpManager.current.streamConversationMessages(
        conversationId,
        (message) => {
          try {
            onMessage(message);
          } catch (error) {
            console.error('❌ Error in message callback:', error);
          }
        },
        (error) => {
          console.error('❌ Message stream error:', error);
          
          // Handle SequenceId errors in streaming
          if (error.message.includes('SequenceId') || 
              error.message.includes('database')) {
            console.log('🔧 Database sync error in message stream');
            setError('Real-time messaging temporarily unavailable due to database sync issue.');
          } else {
            setError(`Message streaming error: ${error.message}`);
          }
        }
      );
  
      // Store cleanup function
      messageStreams.current.set(conversationId, stopStream);
  
      return stopStream;
    } catch (error) {
      console.error('❌ Failed to start message stream:', error);
      
      // Return no-op function to prevent further errors
      return () => {};
    }
  }, []);

  const addMembers = useCallback(async (conversationId: string, addresses: string[]) => {
    if (!xmtpManager.current) {
      throw new Error('XMTP not initialized');
    }

    try {
      const conversation = await xmtpManager.current.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      await xmtpManager.current.addGroupMembers(conversation, addresses);
    } catch (error) {
      console.error('Failed to add members:', error);
      throw error;
    }
  }, []);

  const removeMembers = useCallback(async (conversationId: string, addresses: string[]) => {
    if (!xmtpManager.current) {
      throw new Error('XMTP not initialized');
    }

    try {
      const conversation = await xmtpManager.current.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      await xmtpManager.current.removeGroupMembers(conversation, addresses);
    } catch (error) {
      console.error('Failed to remove members:', error);
      throw error;
    }
  }, []);

  const canMessage = useCallback(async (addresses: string[]): Promise<Map<string, boolean>> => {
    if (!xmtpManager.current) {
      throw new Error('XMTP not initialized');
    }

    try {
      return await xmtpManager.current.canMessage(addresses);
    } catch (error) {
      console.error('Failed to check message capability:', error);
      throw error;
    }
  }, []);

  const cleanup = useCallback(async () => {
    try {
      // Stop all message streams
      messageStreams.current.forEach(stopStream => stopStream());
      messageStreams.current.clear();

      // Cleanup XMTP manager
      if (xmtpManager.current) {
        await xmtpManager.current.cleanup();
        xmtpManager.current = null;
      }

      // Reset state
      setClient(null);
      setIsInitialized(false);
      setConversations([]);
      setError(null);

      console.log('🧹 XMTP cleanup completed');
    } catch (error) {
      console.error('Error during XMTP cleanup:', error);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    client,
    isInitialized,
    isInitializing,
    error,
    conversations,
    initializeXMTP,
    createGroup,
    createDM,
    sendMessage,
    getMessages,
    streamMessages,
    addMembers,
    removeMembers,
    resetDatabase,
    canMessage,
    refreshConversations,
    cleanup,
    clearError,
    checkDatabaseHealth,
    safeMessageOperation,
  };
}