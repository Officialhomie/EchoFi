export interface ApiResponse<T = unknown> {
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
  details?: Record<string, unknown>;
  stack?: string;
  timestamp: number;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  // Using unknown instead of any - forces type checking before use
  body?: unknown;
  timeout?: number;
  retries?: number;
}

export interface WebSocketMessage {
  type: string;
  // Using unknown instead of any - requires proper type checking in implementation
  data: unknown;
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