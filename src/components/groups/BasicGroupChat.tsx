// src/components/groups/BasicGroupChat.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  MessageCircleIcon, 
  SendIcon, 
  UsersIcon,
  ShieldIcon,
  ArrowLeftIcon
} from 'lucide-react';
import { useXMTP } from '@/hooks/useXMTP';
import { useWallet } from '@/hooks/useWallet';
import { Conversation, DecodedMessage } from '@xmtp/browser-sdk';
import { formatAddress, getRelativeTime } from '@/lib/utils';

interface BasicGroupChatProps {
  conversation: Conversation;
  groupData: {
    name: string;
    description: string;
    members: string[];
  };
  onBack: () => void;
}

export function BasicGroupChat({
  conversation,
  groupData,
  onBack
}: BasicGroupChatProps) {
  const { sendMessage, getMessages, streamMessages } = useXMTP();
  const { address } = useWallet();
  
  const [messages, setMessages] = useState<DecodedMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [streamCleanup, setStreamCleanup] = useState<(() => void) | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load initial messages and set up streaming
  useEffect(() => {
    let mounted = true;

    const initializeChat = async () => {
      try {
        console.log('🔄 Loading messages for conversation:', conversation.id);
        
        // Load initial messages
        const initialMessages = await getMessages(conversation.id, 50);
        
        if (mounted) {
          setMessages(initialMessages);
          setIsLoading(false);
        }

        // Set up message streaming
        const cleanup = await streamMessages(conversation.id, (newMessage) => {
          if (mounted) {
            setMessages(prev => {
              // Avoid duplicates
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) return prev;
              
              return [...prev, newMessage].sort((a, b) => 
                Number(a.sentAtNs) - Number(b.sentAtNs)
              );
            });
          }
        });

        if (mounted) {
          setStreamCleanup(() => cleanup);
        }

      } catch (error) {
        console.error('Failed to initialize chat:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeChat();

    return () => {
      mounted = false;
      if (streamCleanup) {
        streamCleanup();
      }
    };
  }, [conversation.id, getMessages, streamMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isSending) return;

    const messageText = inputMessage.trim();
    setInputMessage('');
    setIsSending(true);

    try {
      await sendMessage(conversation.id, messageText);
      console.log('✅ Message sent successfully');
    } catch (error) {
      console.error('Failed to send message:', error);
      // Restore message on failure
      setInputMessage(messageText);
    } finally {
      setIsSending(false);
    }
  }, [inputMessage, isSending, sendMessage, conversation.id]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const isOwnMessage = useCallback((message: DecodedMessage) => {
    return message.senderInboxId === address;
  }, [address]);

  const renderMessage = useCallback((message: DecodedMessage, index: number) => {
    const isOwn = isOwnMessage(message);
    const showSender = index === 0 || messages[index - 1]?.senderInboxId !== message.senderInboxId;

    return (
      <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          isOwn 
            ? 'bg-gradient-to-r from-purple-500 to-blue-600 text-white' 
            : 'bg-gray-100 text-gray-900'
        }`}>
          {showSender && !isOwn && (
            <div className="text-xs font-medium mb-1 opacity-70">
              {formatAddress(message.senderInboxId)}
            </div>
          )}
          <div className="text-sm break-words">
            {message.content}
          </div>
          <div className={`text-xs mt-1 ${isOwn ? 'text-purple-100' : 'text-gray-500'}`}>
            {getRelativeTime(Number(message.sentAtNs) / 1_000_000)}
          </div>
        </div>
      </div>
    );
  }, [messages, isOwnMessage]);

  return (
    <Card className="w-full max-w-2xl mx-auto h-[600px] flex flex-col">
      {/* Header */}
      <CardHeader className="border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="p-2"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
                <MessageCircleIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  {groupData.name}
                </CardTitle>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <UsersIcon className="w-3 h-3" />
                  <span>{groupData.members.length + 1} members</span>
                  <ShieldIcon className="w-3 h-3 ml-2" />
                  <span>Encrypted</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Messages Area */}
      <CardContent className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading messages...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageCircleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to your group!</h3>
              <p className="text-sm text-gray-600 mb-4">
                Start the conversation with your investment group members.
              </p>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 max-w-md">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldIcon className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">XMTP Security</span>
                </div>
                <p className="text-xs text-purple-700">
                  All messages are end-to-end encrypted and work across all XMTP-compatible apps.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message, index) => renderMessage(message, index))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </CardContent>

      {/* Message Input */}
      <div className="border-t border-gray-200 p-4 flex-shrink-0">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Type your message..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isSending}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isSending}
            className="bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white"
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <SendIcon className="w-4 h-4" />
            )}
          </Button>
        </div>
        
        {/* Group info */}
        <div className="mt-3 text-xs text-gray-500 text-center">
          <span>🔒 End-to-end encrypted • </span>
          <span>Conversation ID: {conversation.id.slice(0, 12)}...</span>
        </div>
      </div>
    </Card>
  );
}