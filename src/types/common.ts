// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DatabaseError extends Error {
  code?: string;
  details?: string;
  hint?: string;
}

export interface ComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface FormFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
}

export interface AsyncOperationState<T = unknown> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

// Event handler types
export type ButtonClickHandler = (event: React.MouseEvent<HTMLButtonElement>) => void;
export type FormSubmitHandler = (event: React.FormEvent<HTMLFormElement>) => void;
export type InputChangeHandler = (event: React.ChangeEvent<HTMLInputElement>) => void;
export type TextareaChangeHandler = (event: React.ChangeEvent<HTMLTextAreaElement>) => void;

// Agent and performance related types
export interface AgentResponse<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
  metrics?: {
    executionTime: number;
    gasUsed?: string;
    transactionHash?: string;
  };
}

export interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  memory?: {
    used: number;
    total: number;
  };
  operations?: Record<string, number>;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
  error?: Error;
}

// Configuration types
export interface ConfigValue {
  key: string;
  value: unknown;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  environment?: 'development' | 'staging' | 'production';
}

// UI and interaction types
export interface NotificationOptions {
  title: string;
  message?: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  persistent?: boolean;
}

export interface ModalState {
  isOpen: boolean;
  title?: string;
  content?: React.ReactNode;
  onClose?: () => void;
  onConfirm?: () => void;
}

export interface LoadingState {
  isLoading: boolean;
  message?: string;
  progress?: number;
}

// Utility types for better type safety
export type NonEmptyArray<T> = [T, ...T[]];
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// React component enhancement types
export interface EnhancedComponentProps extends ComponentProps {
  testId?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

export interface InteractiveElementProps extends EnhancedComponentProps {
  disabled?: boolean;
  loading?: boolean;
  onClick?: ButtonClickHandler;
  onKeyDown?: (event: React.KeyboardEvent) => void;
}

// Form validation types
export interface ValidationRule<T = unknown> {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: T) => string | null;
}

export interface FormFieldState {
  value: string;
  error: string | null;
  touched: boolean;
  valid: boolean;
}

export interface FormState<T = Record<string, string>> {
  fields: Record<keyof T, FormFieldState>;
  isValid: boolean;
  isSubmitting: boolean;
  submitError: string | null;
}