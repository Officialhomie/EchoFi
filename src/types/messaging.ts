export interface MessageContent {
  type: 'text' | 'proposal' | 'vote' | 'execution' | 'system';
  data: unknown;
  metadata?: Record<string, unknown>;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  sender: string;
  content: MessageContent;
  timestamp: number;
  replyTo?: string;
  reactions?: MessageReaction[];
}

export interface MessageReaction {
  emoji: string;
  users: string[];
  count: number;
}

export interface ConversationMetadata {
  groupId: string;
  groupName: string;
  description?: string;
  memberCount: number;
  isPrivate: boolean;
  createdAt: number;
  lastMessage?: {
      content: string;
      timestamp: number;
      sender: string;
  };
}

export interface XMTPClientState {
  isInitialized: boolean;
  isConnecting: boolean;
  error: string | null;
  address?: string;
  inboxId?: string;
  installationId?: string;
}