// src/components/groups/GroupChat.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useXMTP } from '@/hooks/useXMTP';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner as LoadingSpinner } from '@/components/ui/loading';
import { UI_CONFIG, VALIDATION_RULES, APP_LIMITS } from '@/lib/config/app';
import { formatAddress, getRelativeTime, truncateText } from '@/lib/utils';
import { MessageCircle, Send, Users, Clock } from 'lucide-react';
import { DecodedMessage } from '@xmtp/browser-sdk';
import { GroupChatMessage, GroupChatState } from '@/types';

interface GroupChatProps {
  groupId: string;
  groupName: string;
  className?: string;
  maxHeight?: string;
}

interface ChatConfig {
  maxMessageLength: number;
  debounceDelay: number;
  animationDuration: number;
  pollingInterval: number;
  retryAttempts: number;
  autoScrollThreshold: number;
}

export function GroupChat({ 
  groupId, 
  groupName, 
  className = '',
  maxHeight = 'min-h-[400px] max-h-[600px]'
}: GroupChatProps) {
  const { address } = useWallet();
  const { getMessages, sendMessage, streamMessages } = useXMTP();
  
  // Dynamic configuration from app config
  const chatConfig: ChatConfig = {
    maxMessageLength: VALIDATION_RULES.PROPOSAL_DESCRIPTION.MAX_LENGTH,
    debounceDelay: UI_CONFIG.DEBOUNCE_DELAY,
    animationDuration: UI_CONFIG.ANIMATION_DURATION,
    pollingInterval: UI_CONFIG.POLLING_INTERVAL,
    retryAttempts: 3, // Could be moved to config
    autoScrollThreshold: 100,
  };

  // Chat state
  const [state, setState] = useState<GroupChatState>({
    messages: [],
    loading: false,
    error: null,
  });

  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const streamCleanupRef = useRef<(() => void) | null>(null);

  // Derived state
  const canSendMessage = inputMessage.trim().length > 0 && 
                        inputMessage.length <= chatConfig.maxMessageLength && 
                        !state.loading;

  const messageCount = state.messages.length;
  const charactersRemaining = chatConfig.maxMessageLength - inputMessage.length;

  // Message transformation with user context
  const transformMessage = useCallback((message: DecodedMessage): GroupChatMessage => {
    const isOwnMessage = message.senderInboxId === address;
    const senderDisplayName = isOwnMessage 
      ? 'You' 
      : formatAddress(message.senderInboxId || 'Unknown');

    return {
      id: message.id,
      sender: message.senderInboxId as `0x${string}`,
      content: message.content.toString(),
      timestamp: Number(message.sentAtNs),
      type: 'text',
      senderDisplayName
    };
  }, [address]);

  // Auto-scroll functionality
  const scrollToBottom = useCallback((force = false) => {
    if (!messagesEndRef.current || !messagesContainerRef.current) return;

    const container = messagesContainerRef.current;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < chatConfig.autoScrollThreshold;

    if (force || isNearBottom) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'end' 
        });
      }, chatConfig.animationDuration);
    }
  }, [chatConfig.autoScrollThreshold, chatConfig.animationDuration]);

  // Load message history
  const loadMessages = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const conversation = await getMessages(groupId, APP_LIMITS.maxProposalsPerGroup);
      const transformedMessages = conversation.map(transformMessage);
      
      setState(prev => ({
        ...prev,
        messages: transformedMessages,
        lastActivity: transformedMessages.length > 0 
          ? Number(transformedMessages[transformedMessages.length - 1].sentAtNs)
          : null,
        loading: false,
      }));

      scrollToBottom(true);
    } catch (error) {
      console.error('Failed to load messages:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to load chat history',
        loading: false,
      }));
    }
  }, [groupId, getMessages, transformMessage, scrollToBottom]);

  // Stream real-time messages
  const startMessageStream = useCallback(async () => {
    if (streamCleanupRef.current) {
      streamCleanupRef.current();
    }

    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const stopStream = await streamMessages(groupId, (newMessage) => {
        const transformedMessage = transformMessage(newMessage);
        
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, transformedMessage],
          lastActivity: Number(newMessage.sentAtNs),
        }));

        scrollToBottom();
      });

      streamCleanupRef.current = stopStream;
    } catch (error) {
      console.error('Failed to start message stream:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to connect to real-time updates',
        loading: false,
      }));
    }
  }, [groupId, streamMessages, transformMessage, scrollToBottom]);

  // Send message
  const handleSendMessage = useCallback(async () => {
    if (!canSendMessage) return;

    const messageText = inputMessage.trim();
    setInputMessage('');
    setState(prev => ({ ...prev, loading: true, error: null }));

    let retryCount = 0;
    while (retryCount < chatConfig.retryAttempts) {
      try {
        await sendMessage(groupId, messageText);
        setState(prev => ({ ...prev, loading: false }));
        return;
      } catch (error) {
        retryCount++;
        if (retryCount >= chatConfig.retryAttempts) {
          console.error('Failed to send message after retries:', error);
          setInputMessage(messageText); // Restore message
          setState(prev => ({
            ...prev,
            error: 'Failed to send message. Please try again.',
            loading: false,
          }));
        } else {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
    }
  }, [canSendMessage, inputMessage, groupId, sendMessage, chatConfig.retryAttempts]);

  // Handle Enter key
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Initialize chat
  useEffect(() => {
    loadMessages();
    startMessageStream();

    return () => {
      if (streamCleanupRef.current) {
        streamCleanupRef.current();
      }
    };
  }, [loadMessages, startMessageStream]);

  // Error retry mechanism
  const handleRetry = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
    loadMessages();
    startMessageStream();
  }, [loadMessages, startMessageStream]);

  // Clear error after timeout
  useEffect(() => {
    if (state.error) {
      const timer = setTimeout(() => {
        setState(prev => ({ ...prev, error: null }));
      }, UI_CONFIG.NOTIFICATION_DURATION);
      return () => clearTimeout(timer);
    }
  }, [state.error]);

  return (
    <div className={`flex flex-col bg-card border rounded-lg ${className}`}>
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/10 rounded-t-lg">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">
            {truncateText(groupName, VALIDATION_RULES.GROUP_NAME.MAX_LENGTH)}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>{messageCount} messages</span>
          </div>
          {state.lastActivity && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Last: {getRelativeTime(state.lastActivity / 1000000)}</span>
            </div>
          )}
          {state.loading && (
            <div className="flex items-center gap-1 text-green-600">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
              <span>Live</span>
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        className={`flex-1 overflow-y-auto p-4 space-y-3 ${maxHeight}`}
        style={{ 
          scrollBehavior: 'smooth',
          animationDuration: `${chatConfig.animationDuration}ms` 
        }}
      >
        {state.loading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
            <span className="ml-2 text-sm text-muted-foreground">Loading messages...</span>
          </div>
        ) : state.messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs">Start the conversation!</p>
          </div>
        ) : (
          state.messages.map((message, index) => (
            <div 
              key={`${message.id}-${index}`}
              className={`flex ${message.isOwnMessage ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              <div className={`max-w-[70%] px-3 py-2 rounded-lg ${
                message.isOwnMessage 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {!message.isOwnMessage && (
                  <div className="text-xs opacity-70 mb-1">
                    {message.senderDisplayName}
                  </div>
                )}
                <div className="break-words">{message.content}</div>
                <div className="text-xs opacity-70 mt-1">
                  {getRelativeTime(Number(message.sentAtNs) / 1000000)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {state.error && (
        <div className="px-4 py-2 bg-destructive/10 border-destructive/20 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-destructive">{state.error}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRetry}
              className="text-xs h-6"
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t bg-muted/5 rounded-b-lg">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Message ${groupName}...`}
              disabled={state.loading}
              className="resize-none"
              maxLength={chatConfig.maxMessageLength}
            />
            {inputMessage.length > chatConfig.maxMessageLength * 0.8 && (
              <div className="text-xs text-muted-foreground mt-1">
                {charactersRemaining} characters remaining
              </div>
            )}
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={!canSendMessage}
            size="sm"
            className="px-3"
          >
            {state.loading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}