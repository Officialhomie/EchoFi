// src/hooks/useXMTP-enhanced.ts - Enhanced XMTP Hook with Database Synchronization Fix
import { useState, useEffect, useCallback, useRef } from 'react';
import { Client, Conversation, DecodedMessage } from '@xmtp/browser-sdk';
import { useWallet } from './useWallet';
import { 
  EnhancedXMTPManager, 
  XMTPConfig, 
  GroupConfig, 
  BrowserSigner,
  InitializationState,
  DatabaseHealthReport
} from '@/lib/xmtp-backup';

export interface UseXMTPReturn {
  // Core state
  client: Client | null;
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  conversations: Conversation[];
  
  // Initialization state
  initializationState: InitializationState;
  
  // Core methods
  initializeXMTP: () => Promise<void>;
  createGroup: (name: string, description: string, members: string[]) => Promise<Conversation>;
  createDM: (peerAddress: string) => Promise<Conversation>;
  sendMessage: (conversationId: string, message: string) => Promise<void>;
  getMessages: (conversationId: string, limit?: number) => Promise<DecodedMessage[]>;
  streamMessages: (conversationId: string, onMessage: (message: DecodedMessage) => void) => Promise<() => void>;
  
  // Group management
  addMembers: (conversationId: string, addresses: string[]) => Promise<void>;
  removeMembers: (conversationId: string, addresses: string[]) => Promise<void>;
  canMessage: (addresses: string[]) => Promise<Map<string, boolean>>;
  
  // Health and recovery
  performHealthCheck: () => Promise<DatabaseHealthReport>;
  resetDatabase: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  
  // Utility
  cleanup: () => Promise<void>;
  clearError: () => void;
}

function createBrowserSigner(signer: any): BrowserSigner {
  return {
    getAddress: async (): Promise<string> => {
      if (typeof signer.getAddress === 'function') {
        return await signer.getAddress();
      }
      throw new Error('Signer does not support getAddress');
    },
    signMessage: async (message: string): Promise<Uint8Array> => {
      if (typeof signer.signMessage === 'function') {
        const signature = await signer.signMessage(message);
        const hexSignature = signature.startsWith('0x') ? signature.slice(2) : signature;
        return new Uint8Array(Buffer.from(hexSignature, 'hex'));
      }
      throw new Error('Signer does not support signMessage');
    }
  };
}

export function useXMTP(config?: XMTPConfig): UseXMTPReturn {
  const { signer, isConnected, address } = useWallet();
  
  // State management
  const [client, setClient] = useState<Client | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [initializationState, setInitializationState] = useState<InitializationState>({
    phase: 'starting',
    progress: 0,
    currentOperation: 'Waiting for wallet connection',
    issues: []
  });
  
  // Manager and streams
  const xmtpManager = useRef<EnhancedXMTPManager | null>(null);
  const messageStreams = useRef<Map<string, () => void>>(new Map());
  const initializationInProgress = useRef(false);

  /**
   * Enhanced XMTP Initialization with Comprehensive Error Handling
   */
  const initializeXMTP = useCallback(async () => {
    if (!signer || !isConnected) {
      setError('Wallet not connected');
      return;
    }

    if (isInitializing || initializationInProgress.current) {
      console.log('🔄 Initialization already in progress, skipping...');
      return;
    }

    initializationInProgress.current = true;
    setIsInitializing(true);
    setError(null);

    try {
      console.log('🚀 [ENHANCED] Starting XMTP initialization...');
      
      // Create enhanced manager
      xmtpManager.current = new EnhancedXMTPManager({
        env: config?.env || 'dev',
        enableLogging: config?.enableLogging || true,
        dbPath: config?.dbPath || 'echofi-xmtp',
        maxRetries: 3,
        retryDelay: 2000,
        healthCheckInterval: 30000,
        ...config,
      });

      // Monitor initialization state
      const stateUpdateInterval = setInterval(() => {
        if (xmtpManager.current) {
          const state = xmtpManager.current.getInitializationState();
          setInitializationState(state);
          
          if (state.phase === 'ready' || state.phase === 'failed') {
            clearInterval(stateUpdateInterval);
          }
        }
      }, 500);

      // Create browser-compatible signer
      const browserSigner = createBrowserSigner(signer);
      
      // Initialize client with enhanced manager
      const xmtpClient = await xmtpManager.current.initializeClient(browserSigner, {
        env: config?.env || 'dev',
        enableLogging: config?.enableLogging || true,
        dbPath: config?.dbPath || 'echofi-xmtp',
        ...config,
      });
      
      setClient(xmtpClient);
      setIsInitialized(true);
      
      // Load existing conversations
      await refreshConversations();
      
      console.log('✅ [ENHANCED] XMTP initialization completed successfully');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize XMTP';
      console.error('❌ [ENHANCED] XMTP initialization failed:', errorMessage);
      setError(errorMessage);
      
      setInitializationState({
        phase: 'failed',
        progress: 0,
        currentOperation: 'Initialization failed',
        issues: [errorMessage]
      });
      
    } finally {
      setIsInitializing(false);
      initializationInProgress.current = false;
    }
  }, [signer, isConnected, config]);

  /**
   * Refresh conversations with enhanced error handling
   */
  const refreshConversations = useCallback(async () => {
    if (!xmtpManager.current) return;

    try {
      console.log('🔄 [ENHANCED] Refreshing conversations...');
      const convos = await xmtpManager.current.getConversations();
      setConversations(convos);
      console.log(`✅ [ENHANCED] Loaded ${convos.length} conversations`);
      
      // Clear any previous errors on successful load
      if (convos.length > 0 || error) {
        setError(null);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ [ENHANCED] Failed to refresh conversations:', errorMessage);
      
      // Enhanced error handling
      if (errorMessage.includes('SequenceId') || 
          errorMessage.includes('database') || 
          errorMessage.includes('sync')) {
        console.log('🔧 [ENHANCED] Database sync error detected, attempting automatic recovery...');
        
        try {
          await performHealthCheck();
          // Retry after health check
          const convos = await xmtpManager.current!.getConversations();
          setConversations(convos);
          setError(null);
        } catch (recoveryError) {
          setError('Database sync error detected. Please try resetting the database.');
        }
      } else {
        setError(`Failed to load conversations: ${errorMessage}`);
      }
      
      // Don't crash the app - set empty conversations
      setConversations([]);
    }
  }, [error]);

  /**
   * Enhanced group creation with comprehensive validation
   */
  const createGroup = useCallback(async (
    name: string, 
    description: string, 
    members: string[]
  ): Promise<Conversation> => {
    console.log('🔄 [ENHANCED] Creating group:', { name, description, members, memberCount: members.length });
    
    if (!xmtpManager.current) {
      throw new Error('XMTP not initialized');
    }

    if (!address) {
      throw new Error('Wallet address not available');
    }

    try {
      const groupConfig: GroupConfig = {
        name,
        description,
      };

      console.log('📝 [ENHANCED] Group config:', groupConfig);
      console.log('👥 [ENHANCED] Member addresses to add:', members);

      // Use enhanced manager for group creation
      const conversation = await xmtpManager.current.createInvestmentGroup(groupConfig, members);
      
      console.log('✅ [ENHANCED] Group created successfully:', {
        id: conversation.id,
        name: name,
        memberCount: members.length + 1
      });
      
      // Refresh conversations list
      await refreshConversations();
      
      return conversation;
      
    } catch (error) {
      console.error('❌ [ENHANCED] Group creation failed:', error);
      
      // Enhanced error handling with specific messages
      let errorMessage = 'Failed to create group';
      if (error instanceof Error) {
        if (error.message.includes('Database Synchronization Error')) {
          errorMessage = 'Database synchronization issue detected. Please try resetting the database and try again.';
        } else if (error.message.includes('addresses cannot receive XMTP messages')) {
          errorMessage = error.message; // Use the specific validation message
        } else if (error.message.includes('Network Error')) {
          errorMessage = 'Network connection issue. Please check your internet connection and try again.';
        } else if (error.message.includes('health check failed')) {
          errorMessage = 'Database health check failed. Please try resetting the database.';
        } else {
          errorMessage = error.message;
        }
      }
      
      throw new Error(errorMessage);
    }
  }, [address, refreshConversations]);

  /**
   * Enhanced database health check
   */
  const performHealthCheck = useCallback(async (): Promise<DatabaseHealthReport> => {
    if (!xmtpManager.current) {
      throw new Error('XMTP not initialized');
    }

    try {
      // The enhanced manager doesn't expose health check directly, but we can simulate it
      console.log('🔍 [ENHANCED] Performing database health check...');
      
      // Test basic operations
      await xmtpManager.current.getConversations();
      
      console.log('✅ [ENHANCED] Database health check passed');
      
      return {
        isHealthy: true,
        issues: [],
        lastSync: new Date(),
        sequenceIdStatus: 'valid',
        recommendedAction: 'none'
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ [ENHANCED] Database health check failed:', errorMessage);
      
      let recommendedAction: 'none' | 'reset' | 'repair' = 'none';
      let sequenceIdStatus: 'valid' | 'corrupted' | 'missing' = 'valid';
      
      if (errorMessage.includes('SequenceId')) {
        sequenceIdStatus = 'corrupted';
        recommendedAction = 'repair';
      } else if (errorMessage.includes('database')) {
        sequenceIdStatus = 'corrupted';
        recommendedAction = 'reset';
      }
      
      return {
        isHealthy: false,
        issues: [errorMessage],
        lastSync: null,
        sequenceIdStatus,
        recommendedAction
      };
    }
  }, []);

  /**
   * Enhanced database reset
   */
  const resetDatabase = useCallback(async () => {
    if (!xmtpManager.current) return;

    try {
      setIsInitializing(true);
      setError(null);
      
      console.log('🔄 [ENHANCED] Resetting XMTP database...');
      
      // Clean up current manager
      await xmtpManager.current.cleanup();
      
      // Clear browser storage
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.includes('xmtp') || key.includes('XMTP')
      );
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Reset state
      setClient(null);
      setIsInitialized(false);
      setConversations([]);
      
      // Stop all message streams
      messageStreams.current.forEach(stopStream => {
        try {
          stopStream();
        } catch (error) {
          console.warn('⚠️ [ENHANCED] Error stopping stream:', error);
        }
      });
      messageStreams.current.clear();
      
      // Recreate manager
      xmtpManager.current = null;
      
      console.log('✅ [ENHANCED] Database reset complete');
      
      // Reinitialize if wallet is connected
      if (signer && isConnected) {
        console.log('🔄 [ENHANCED] Reinitializing XMTP after database reset...');
        setTimeout(() => {
          initializeXMTP();
        }, 1000);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ [ENHANCED] Database reset failed:', errorMessage);
      setError(`Reset failed: ${errorMessage}`);
    } finally {
      setIsInitializing(false);
    }
  }, [signer, isConnected, initializeXMTP]);

  /**
   * Enhanced message operations
   */
  const createDM = useCallback(async (peerAddress: string): Promise<Conversation> => {
    if (!xmtpManager.current) {
      throw new Error('XMTP not initialized');
    }

    try {
      const client = xmtpManager.current.getClientInfo();
      if (!client) {
        throw new Error('Client not available');
      }

      // DM creation would need to be implemented in the enhanced manager
      throw new Error('DM creation not yet implemented in enhanced manager');
      
    } catch (error) {
      console.error('❌ [ENHANCED] Failed to create DM:', error);
      throw error;
    }
  }, []);

  const sendMessage = useCallback(async (conversationId: string, message: string): Promise<void> => {
    if (!xmtpManager.current) {
      throw new Error('XMTP not initialized');
    }

    try {
      // Message sending would need to be implemented in the enhanced manager
      throw new Error('Message sending not yet implemented in enhanced manager');
      
    } catch (error) {
      console.error('❌ [ENHANCED] Failed to send message:', error);
      throw error;
    }
  }, []);

  const getMessages = useCallback(async (conversationId: string, limit?: number): Promise<DecodedMessage[]> => {
    if (!xmtpManager.current) {
      throw new Error('XMTP not initialized');
    }

    try {
      // Message retrieval would need to be implemented in the enhanced manager
      throw new Error('Message retrieval not yet implemented in enhanced manager');
      
    } catch (error) {
      console.error('❌ [ENHANCED] Failed to get messages:', error);
      return []; // Return empty array instead of throwing
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
      // Message streaming would need to be implemented in the enhanced manager
      throw new Error('Message streaming not yet implemented in enhanced manager');
      
    } catch (error) {
      console.error('❌ [ENHANCED] Failed to start message stream:', error);
      return () => {}; // Return no-op function
    }
  }, []);

  const addMembers = useCallback(async (conversationId: string, addresses: string[]) => {
    if (!xmtpManager.current) {
      throw new Error('XMTP not initialized');
    }

    try {
      // Member addition would need to be implemented in the enhanced manager
      throw new Error('Member addition not yet implemented in enhanced manager');
      
    } catch (error) {
      console.error('❌ [ENHANCED] Failed to add members:', error);
      throw error;
    }
  }, []);

  const removeMembers = useCallback(async (conversationId: string, addresses: string[]) => {
    if (!xmtpManager.current) {
      throw new Error('XMTP not initialized');
    }

    try {
      // Member removal would need to be implemented in the enhanced manager
      throw new Error('Member removal not yet implemented in enhanced manager');
      
    } catch (error) {
      console.error('❌ [ENHANCED] Failed to remove members:', error);
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
      console.error('❌ [ENHANCED] Failed to check message capability:', error);
      throw error;
    }
  }, []);

  const cleanup = useCallback(async () => {
    try {
      // Stop all message streams
      messageStreams.current.forEach(stopStream => stopStream());
      messageStreams.current.clear();

      // Cleanup enhanced manager
      if (xmtpManager.current) {
        await xmtpManager.current.cleanup();
        xmtpManager.current = null;
      }

      // Reset state
      setClient(null);
      setIsInitialized(false);
      setConversations([]);
      setError(null);
      setInitializationState({
        phase: 'starting',
        progress: 0,
        currentOperation: 'Waiting for wallet connection',
        issues: []
      });

      console.log('🧹 [ENHANCED] XMTP cleanup completed');
    } catch (error) {
      console.error('❌ [ENHANCED] Error during XMTP cleanup:', error);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Effects
   */
  
  // Initialize XMTP when wallet is connected
  useEffect(() => {
    if (isConnected && signer && !isInitialized && !isInitializing && !initializationInProgress.current) {
      console.log('🔄 [ENHANCED] Wallet connected, initializing XMTP...');
      initializeXMTP();
    }
  }, [isConnected, signer, isInitialized, isInitializing, initializeXMTP]);

  // Update initialization state when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setInitializationState({
        phase: 'starting',
        progress: 0,
        currentOperation: 'Waiting for wallet connection',
        issues: []
      });
    }
  }, [isConnected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return {
    // Core state
    client,
    isInitialized,
    isInitializing,
    error,
    conversations,
    
    // Initialization state
    initializationState,
    
    // Core methods
    initializeXMTP,
    createGroup,
    createDM,
    sendMessage,
    getMessages,
    streamMessages,
    
    // Group management
    addMembers,
    removeMembers,
    canMessage,
    
    // Health and recovery
    performHealthCheck,
    resetDatabase,
    refreshConversations,
    
    // Utility
    cleanup,
    clearError,
  };
}