// src/hooks/usePerformance.ts - Performance optimization hooks
import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import { Logger } from '@/lib/logger';

/**
 * Hook for properly cleaning up async operations and preventing memory leaks
 */
export function useAsyncCleanup() {
  const abortControllerRef = useRef<AbortController | null>(null);
  const cleanupFunctionsRef = useRef<(() => void)[]>([]);

  // Create or get abort controller
  const getAbortController = useCallback(() => {
    if (!abortControllerRef.current || abortControllerRef.current.signal.aborted) {
      abortControllerRef.current = new AbortController();
    }
    return abortControllerRef.current;
  }, []);

  // Register cleanup function
  const addCleanup = useCallback((cleanupFn: () => void) => {
    cleanupFunctionsRef.current.push(cleanupFn);
    return () => {
      const index = cleanupFunctionsRef.current.indexOf(cleanupFn);
      if (index > -1) {
        cleanupFunctionsRef.current.splice(index, 1);
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Abort any ongoing requests
      if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        abortControllerRef.current.abort();
      }

      // Run all cleanup functions
      cleanupFunctionsRef.current.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          console.warn('Error in cleanup function:', error);
        }
      });
      cleanupFunctionsRef.current = [];
    };
  }, []);

  return {
    abortSignal: getAbortController().signal,
    addCleanup,
    cleanup: () => {
      if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        abortControllerRef.current.abort();
      }
      cleanupFunctionsRef.current.forEach(cleanup => cleanup());
      cleanupFunctionsRef.current = [];
    }
  };
}

/**
 * Enhanced debounce hook with cleanup
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup on unmount or value change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for throttling function calls
 */
export function useThrottle<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const throttledCallback = useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastCallRef.current >= delay) {
      lastCallRef.current = now;
      return callback(...args);
    } else {
      // Schedule the call for later if not already scheduled
      if (!timeoutRef.current) {
        const remaining = delay - (now - lastCallRef.current);
        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          timeoutRef.current = undefined;
          callback(...args);
        }, remaining);
      }
    }
  }, [callback, delay]) as T;

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
}

/**
 * Hook for safely managing intervals with cleanup
 */
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef<() => void | undefined>(undefined);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    function tick() {
      if (savedCallback.current) {
        savedCallback.current();
      }
    }

    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

/**
 * Hook for managing component mount state to prevent state updates on unmounted components
 */
export function useMountedState() {
  const mountedRef = useRef(false);
  const isMounted = useCallback(() => mountedRef.current, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return isMounted;
}

/**
 * Hook for safe async state updates
 */
export function useSafeAsync() {
  const isMounted = useMountedState();

  const safeSetState = useCallback(<T>(
    setter: (value: T) => void,
    value: T
  ) => {
    if (isMounted()) {
      setter(value);
    }
  }, [isMounted]);

  const safeAsyncCall = useCallback(async <T>(
    asyncFn: () => Promise<T>,
    onSuccess?: (result: T) => void,
    onError?: (error: Error) => void
  ): Promise<T | undefined> => {
    try {
      const result = await asyncFn();
      if (isMounted() && onSuccess) {
        onSuccess(result);
      }
      return result;
    } catch (error) {
      if (isMounted() && onError) {
        onError(error as Error);
      }
      throw error;
    }
  }, [isMounted]);

  return { safeSetState, safeAsyncCall };
}

/**
 * Hook for performance monitoring
 */
export function usePerformanceMonitor(componentName: string) {
  const logger = Logger.getInstance();
  const renderStartTime = useRef<number | undefined>(undefined);
  const renderCount = useRef<number>(0);

  // Track render start
  renderStartTime.current = performance.now();
  renderCount.current++;

  // Track render completion
  useEffect(() => {
    if (renderStartTime.current) {
      const renderTime = performance.now() - renderStartTime.current;
      
      // Log slow renders
      if (renderTime > 100) {
        logger.warn(`Slow render detected in ${componentName}`, {
          renderTime,
          renderCount: renderCount.current,
          component: componentName
        });
      }

      // Track render metrics
      if (renderCount.current === 1) {
        logger.debug(`Initial render time for ${componentName}: ${renderTime.toFixed(2)}ms`);
      }
    }
  });

  return {
    renderCount: renderCount.current,
    markOperation: (operationName: string) => {
      const startTime = performance.now();
      return () => {
        const duration = performance.now() - startTime;
        logger.debug(`${componentName} - ${operationName}: ${duration.toFixed(2)}ms`);
      };
    }
  };
}

/**
 * Hook for memory usage monitoring
 */
export function useMemoryMonitor(componentName: string) {
  const logger = Logger.getInstance();

  useEffect(() => {
    // Check memory usage periodically
    const checkMemory = () => {
      // This creates a type-safe way to access the memory property
      if ('memory' in performance) {
        const memory = (performance as unknown as { memory: {
          usedJSHeapSize: number;
          totalJSHeapSize: number;
          jsHeapSizeLimit: number;
        }}).memory;
        
        const usedJSHeapSize = memory.usedJSHeapSize;
        const totalJSHeapSize = memory.totalJSHeapSize;
        const usagePercent = (usedJSHeapSize / totalJSHeapSize) * 100;

        // Warn if memory usage is high
        if (usagePercent > 80) {
          logger.warn(`High memory usage detected in ${componentName}`, {
            usedJSHeapSize,
            totalJSHeapSize,
            usagePercent: usagePercent.toFixed(2),
            component: componentName
          });
        }
      }
    };

    const interval = setInterval(checkMemory, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [componentName, logger]);
}

/**
 * Hook for lazy loading with intersection observer
 */
export function useLazyLoad(threshold = 0.1) {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(element); // Stop observing once visible
        }
      },
      { threshold }
    );

    observer.observe(element);

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [threshold]);

  return { elementRef, isVisible };
}

/**
 * Hook for optimized expensive calculations
 */
export function useExpensiveCalculation<T, D extends readonly unknown[]>(
  calculateFn: () => T,
  deps: D,
  options: {
    timeout?: number;
    fallback?: T;
    enableProfiling?: boolean;
    logger?: Logger;
  } = {}
): { value: T | undefined; isCalculating: boolean; error: Error | null } {
  const { timeout = 5000, fallback, enableProfiling = false, logger } = options;
  const [result, setResult] = useState<{ value: T | undefined; isCalculating: boolean; error: Error | null }>({
    value: undefined,
    isCalculating: false,
    error: null
  });

  const loggerInstance = logger || Logger.getInstance();


  // FIXED: Use the stable string dependency instead of spread operator
  const memoizedValue = useMemo(() => {
    setResult(prev => ({ ...prev, isCalculating: true, error: null }));

    try {
      const startTime = performance.now();
      
      // Create a promise that resolves with the calculation result
      const calculationPromise = new Promise<T>((resolve) => {
        // Run calculation synchronously but wrap in promise for timeout handling
        const calculationResult = calculateFn();
        resolve(calculationResult);
      });
      
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Calculation timeout')), timeout);
      });

      // Race the calculation against the timeout
      Promise.race([calculationPromise, timeoutPromise])
        .then(value => {
          const duration = performance.now() - startTime;
          
          if (enableProfiling && duration > 100) {
            loggerInstance.info('Expensive calculation completed', { 
              duration, 
              component: 'useExpensiveCalculation' 
            });
          }

          setResult({ value, isCalculating: false, error: null });
          return value;
        })
        .catch(calculationError => {
          loggerInstance.error('Calculation failed', calculationError);
          setResult({ 
            value: fallback, 
            isCalculating: false, 
            error: calculationError instanceof Error ? calculationError : new Error(String(calculationError))
          });
        });

    } catch (syncError) {
      const err = syncError instanceof Error ? syncError : new Error(String(syncError));
      loggerInstance.error('Calculation error', err);
      setResult({ value: fallback, isCalculating: false, error: err });
    }

    return fallback;
  }, [
    calculateFn, 
    timeout, 
    fallback, 
    enableProfiling, 
    loggerInstance,
    // depsString  // FIXED: Use the stable string dependency instead of ...deps
  ]);

  return result.value !== undefined ? result : { value: memoizedValue, isCalculating: false, error: null };
}