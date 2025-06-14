
// API Response Types
export interface ApiResponse<T = unknown> {
    success: boolean
    data?: T
    error?: string
    message?: string
  }
  
  // Event Handler Types
  export interface ButtonClickHandler {
    (event: React.MouseEvent<HTMLButtonElement>): void | Promise<void>
  }
  
  export interface FormSubmitHandler {
    (event: React.FormEvent<HTMLFormElement>): void | Promise<void>
  }
  
  // Agent Types
  export interface AgentResponse {
    id: string
    message: string
    timestamp: number
    metadata?: Record<string, unknown>
  }
  
  export interface AgentConfig {
    cdpApiKeyName?: string
    cdpApiKeyPrivate?: string
    actionProviders?: unknown[]
    options?: Record<string, unknown>
  }
  
  // XMTP Types
  export interface XMTPMessage {
    id: string
    content: string
    sender: string
    timestamp: number
    conversationId: string
  }
  
  export interface XMTPConversation {
    id: string
    peerAddress: string
    messages: XMTPMessage[]
    metadata?: Record<string, unknown>
  }
  
  // Wallet Types
export interface WalletConnection {
    address: string
    chainId: number
    isConnected: boolean
    provider?: unknown
}
  
  // Logger Types
export interface LoggerConfig {
    level: 'debug' | 'info' | 'warn' | 'error'
    enableFileLogging?: boolean
    metadata?: Record<string, unknown>
}
  
  // Performance Types
 export interface PerformanceMetrics {
    duration: number
    memory: number
    timestamp: number
    operation: string
}  