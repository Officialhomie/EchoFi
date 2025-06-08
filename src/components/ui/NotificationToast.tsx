// src/components/ui/NotificationToast.tsx
'use client';

import { useEffect, useState } from 'react';
import { CheckCircleIcon, XCircleIcon, XIcon } from 'lucide-react';
import { Button } from './button';

interface NotificationToastProps {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  title?: string;
  duration?: number; // in milliseconds, 0 for no auto-dismiss
  onClose: () => void;
  className?: string;
}

export function NotificationToast({
  type,
  message,
  title,
  duration = 5000,
  onClose,
  className = '',
}: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsRemoving(true);
    setTimeout(() => {
      onClose();
    }, 300); // Match the exit animation duration
  };

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-50 border-green-200',
          text: 'text-green-800',
          icon: <CheckCircleIcon className="w-5 h-5 text-green-500" />,
          button: 'text-green-600 hover:text-green-800',
        };
      case 'error':
        return {
          bg: 'bg-red-50 border-red-200',
          text: 'text-red-800',
          icon: <XCircleIcon className="w-5 h-5 text-red-500" />,
          button: 'text-red-600 hover:text-red-800',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50 border-yellow-200',
          text: 'text-yellow-800',
          icon: <span className="w-5 h-5 text-yellow-500 text-lg">⚠️</span>,
          button: 'text-yellow-600 hover:text-yellow-800',
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-50 border-blue-200',
          text: 'text-blue-800',
          icon: <span className="w-5 h-5 text-blue-500 text-lg">ℹ️</span>,
          button: 'text-blue-600 hover:text-blue-800',
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div
      className={`
        fixed top-4 right-4 z-50 max-w-sm w-full
        transform transition-all duration-300 ease-in-out
        ${isVisible && !isRemoving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${className}
      `}
    >
      <div className={`
        border rounded-lg shadow-lg p-4
        ${styles.bg}
      `}>
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {styles.icon}
          </div>
          
          <div className="ml-3 flex-1">
            {title && (
              <h3 className={`text-sm font-medium ${styles.text} mb-1`}>
                {title}
              </h3>
            )}
            <p className={`text-sm ${styles.text}`}>
              {message}
            </p>
          </div>

          <div className="ml-4 flex-shrink-0">
            <button
              onClick={handleClose}
              className={`
                inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2
                ${styles.button}
              `}
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress bar for auto-dismiss */}
        {duration > 0 && (
          <div className="mt-3 h-1 bg-black/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-current opacity-30 transition-all ease-linear"
              style={{
                animation: `shrink ${duration}ms linear`,
              }}
            />
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

// Toast Container for managing multiple toasts
interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  title?: string;
  duration?: number;
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{ 
            zIndex: 60 - index, // Stack toasts properly
            marginTop: index > 0 ? `${index * 80}px` : '0'
          }}
        >
          <NotificationToast
            type={toast.type}
            message={toast.message}
            title={toast.title}
            duration={toast.duration}
            onClose={() => onRemove(toast.id)}
          />
        </div>
      ))}
    </div>
  );
}

// Toast Hook for easy management
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { ...toast, id }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const clearAll = () => {
    setToasts([]);
  };

  return {
    toasts,
    addToast,
    removeToast,
    clearAll,
    success: (message: string, title?: string) => addToast({ type: 'success', message, title }),
    error: (message: string, title?: string) => addToast({ type: 'error', message, title }),
    info: (message: string, title?: string) => addToast({ type: 'info', message, title }),
    warning: (message: string, title?: string) => addToast({ type: 'warning', message, title }),
  };
}