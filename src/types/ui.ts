// src/types/ui.ts - UI and component related types
export interface LoadingState {
    isLoading: boolean;
    operation?: string;
    progress?: number;
  }
  
  export interface ErrorState {
    hasError: boolean;
    error?: Error | string;
    code?: string;
    details?: Record<string, any>;
  }
  
  export interface NotificationOptions {
    title?: string;
    duration?: number;
    persistent?: boolean;
    actions?: NotificationAction[];
  }
  
  export interface NotificationAction {
    label: string;
    action: () => void;
    variant?: 'primary' | 'secondary';
  }
  
  export interface FormField {
    name: string;
    label: string;
    type: 'text' | 'number' | 'email' | 'password' | 'textarea' | 'select' | 'checkbox';
    required?: boolean;
    placeholder?: string;
    validation?: ValidationRule[];
    options?: SelectOption[];
  }
  
  export interface ValidationRule {
    type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
    value?: any;
    message: string;
    validator?: (value: any) => boolean;
  }
  
  export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
  }
  
  export interface FormError {
    field: string;
    message: string;
    code?: string;
  }
  
  export interface ComponentVariant {
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
    color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray';
  }
  
  export interface TableColumn<T = any> {
    key: keyof T;
    label: string;
    sortable?: boolean;
    width?: string;
    align?: 'left' | 'center' | 'right';
    render?: (value: any, row: T) => React.ReactNode;
  }