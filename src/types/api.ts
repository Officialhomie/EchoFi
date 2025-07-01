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

// Health check types
export interface ServiceHealth {
  isHealthy: boolean;
  lastCheck: Date;
  responseTime?: number;
  error?: string;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  version: string;
  services: Record<string, ServiceHealth>;
  features: Record<string, boolean>;
  performance: {
    responseTime: number;
    metrics: Array<{
      name: string;
      value: number;
      unit: string;
      timestamp: Date;
    }>;
    errors: Array<{
      error: string;
      count: number;
      lastOccurrence: Date;
      severity: string;
      service?: string;
    }>;
  };
  cache: {
    totalEntries: number;
    hitRate: number;
    totalSize: number;
    enabled: boolean;
  };
  network: {
    metrics: Record<string, {
      requests: number;
      successes: number;
      failures: number;
      averageResponseTime: number;
    }>;
    retries: boolean;
    circuitBreaker: boolean;
  };
  alerts?: Array<{
    name: string;
    severity: string;
    message: string;
  }>;
}

// Agent types
export interface WalletProvider {
  getAddress(): string;
  getBalance(): Promise<bigint>;
  getNetwork(): {
    networkId?: string;
    chainId?: string;
  };
}

export interface AgentInfo {
  address: string;
  network: string;
  chainId: string;
  balance: string;
}

// Metrics types
export interface MetricsServiceData {
  requests?: number;
  failures?: number;
  averageResponseTime?: number;
  successRate?: number;
}

export interface SystemMetricsData {
  uptime: number;
  performance: Array<{
    name: string;
    value: number;
    unit: string;
    timestamp: Date;
    tags?: Record<string, string>;
  }>;
  errors: Array<{
    error: string;
    count: number;
    lastOccurrence: Date;
    severity: string;
    service?: string;
  }>;
  services: Record<string, ServiceHealth>;
  cache: {
    totalEntries: number;
    hitRate: number;
    totalSize: number;
  };
  network: Record<string, MetricsServiceData>;
  timestamp: Date;
}