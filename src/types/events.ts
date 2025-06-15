export interface AppEvent {
  type: string;
  data: unknown;
  timestamp: number;
  source: 'user' | 'system' | 'agent' | 'blockchain';
}

export interface ProposalEvent extends AppEvent {
  type: 'proposal_created' | 'proposal_voted' | 'proposal_executed' | 'proposal_expired';
  data: {
      proposalId: string;
      groupId: string;
      actor: string;
  };
}

export interface GroupEvent extends AppEvent {
  type: 'group_created' | 'member_added' | 'member_removed' | 'settings_updated';
  data: {
      groupId: string;
      actor: string;
      details?: Record<string, unknown>;
  };
}

export interface WalletEvent extends AppEvent {
  type: 'wallet_connected' | 'wallet_disconnected' | 'network_changed' | 'account_changed';
  data: {
      address?: string;
      chainId?: number;
      previousAddress?: string;
      previousChainId?: number;
  };
}

export interface MessageEvent extends AppEvent {
  type: 'message_sent' | 'message_received' | 'message_failed';
  data: {
      messageId: string;
      conversationId: string;
      sender: string;
      contentType: string;
  };
}

export interface AgentEvent extends AppEvent {
  type: 'agent_initialized' | 'agent_analyzing' | 'agent_executing' | 'agent_error';
  data: {
      agentId?: string;
      operation?: string;
      result?: unknown;
      error?: string;
  };
}

export interface EventListener<T extends AppEvent = AppEvent> {
  eventType: T['type'];
  handler: (event: T) => void | Promise<void>;
  once?: boolean;
}

export interface EventEmitter {
  emit<T extends AppEvent>(event: T): void;
  on<T extends AppEvent>(eventType: T['type'], handler: (event: T) => void): () => void;
  once<T extends AppEvent>(eventType: T['type'], handler: (event: T) => void): () => void;
  off<T extends AppEvent>(eventType: T['type'], handler?: (event: T) => void): void;
}