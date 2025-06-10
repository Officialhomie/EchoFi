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
  
  // Utility functions
  canMessage: (addresses: string[]) => Promise<Map<string, boolean>>;
  refreshConversations: () => Promise<void>;
  cleanup: () => Promise<void>;
  clearError?: () => void;
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
      
      // Load existing conversations
      await refreshConversations();
      
      console.log('✅ XMTP initialized successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize XMTP';
      console.error('❌ XMTP initialization failed:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsInitializing(false);
    }
  }, [signer, isInitializing, config]);

  const refreshConversations = useCallback(async () => {
    if (!xmtpManager.current) return;

    try {
      const convos = await xmtpManager.current.getConversations();
      setConversations(convos);
    } catch (error) {
      console.error('Failed to refresh conversations:', error);
    }
  }, []);

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
    contentType: string = 'text'
  ) => {
    if (!xmtpManager.current) {
      throw new Error('XMTP not initialized');
    }

    try {
      const conversation = await xmtpManager.current.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Handle different content types
      let messageContent = content;
      let messageContentType = undefined;

      if (contentType === 'investment-proposal') {
        messageContent = content as InvestmentProposal;
        messageContentType = ContentTypeInvestmentProposal;
      } else if (contentType === 'investment-vote') {
        messageContent = content as InvestmentVote;
        messageContentType = ContentTypeInvestmentVote;
      }

      await xmtpManager.current.sendMessage(
        conversation, 
        messageContent as string, 
        messageContentType
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }, []);

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
        throw new Error('Conversation not found');
      }

      return await xmtpManager.current.getMessages(conversation, limit);
    } catch (error) {
      console.error('Failed to get messages:', error);
      throw error;
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

      // Start new stream
      const stopStream = await xmtpManager.current.streamConversationMessages(
        conversationId,
        onMessage,
        (error) => {
          console.error('Message stream error:', error);
          setError(error.message);
        }
      );

      // Store cleanup function
      messageStreams.current.set(conversationId, stopStream);

      return stopStream;
    } catch (error) {
      console.error('Failed to stream messages:', error);
      throw error;
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
    canMessage,
    refreshConversations,
    cleanup,
    clearError,
  };
}