// src/types/api.ts - API and response types
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    timestamp: number;
  }
  
  export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    pagination: {
      page: number;
      limit: number;
      total: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  }
  
  export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, any>;
    stack?: string;
    timestamp: number;
  }
  
  export interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: any;
    timeout?: number;
    retries?: number;
  }
  
  export interface WebSocketMessage {
    type: string;
    data: any;
    timestamp: number;
    id?: string;
  }
  
  export interface WebSocketConnection {
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;
    lastPing: number | null;
    reconnectAttempts: number;
  }