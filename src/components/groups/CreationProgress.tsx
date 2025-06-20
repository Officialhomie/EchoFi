'use client';

import { CheckIcon } from 'lucide-react';

export interface ProgressStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'current' | 'completed' | 'error';
}

interface CreationProgressProps {
  steps: ProgressStep[];
  className?: string;
}

export function CreationProgress({ steps, className = '' }: CreationProgressProps) {
  return (
    <div className={`w-full max-w-2xl mx-auto ${className}`}>
      <div className="flex items-center justify-between relative">
        {/* Progress Line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 -z-10">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-blue-600 transition-all duration-500 ease-out"
            style={{ 
              width: `${(steps.filter(s => s.status === 'completed').length / (steps.length - 1)) * 100}%` 
            }}
          />
        </div>

        {steps.map((step, index) => {
          const isCompleted = step.status === 'completed';
          const isCurrent = step.status === 'current';
          const hasError = step.status === 'error';
          
          return (
            <div key={step.id} className="flex flex-col items-center relative">
              {/* Step Circle */}
              <div
                className={`
                  w-10 h-10 rounded-full border-2 flex items-center justify-center
                  transition-all duration-300 ease-out
                  ${isCompleted 
                    ? 'bg-gradient-to-r from-purple-500 to-blue-600 border-transparent text-white' 
                    : isCurrent
                    ? 'bg-white border-purple-500 text-purple-600 shadow-lg ring-4 ring-purple-100'
                    : hasError
                    ? 'bg-red-50 border-red-300 text-red-600'
                    : 'bg-gray-50 border-gray-300 text-gray-400'
                  }
                `}
              >
                {isCompleted ? (
                  <CheckIcon className="w-5 h-5" />
                ) : hasError ? (
                  <span className="text-sm font-bold">!</span>
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>

              {/* Step Label */}
              <div className="mt-3 text-center max-w-24">
                <div 
                  className={`
                    text-sm font-medium transition-colors duration-200
                    ${isCurrent 
                      ? 'text-purple-600' 
                      : isCompleted
                      ? 'text-gray-900'
                      : hasError
                      ? 'text-red-600'
                      : 'text-gray-500'
                    }
                  `}
                >
                  {step.title}
                </div>
                <div className="text-xs text-gray-500 mt-1 hidden sm:block">
                  {step.description}
                </div>
              </div>

              {/* Loading Animation for Current Step */}
              {isCurrent && (
                <div className="absolute -top-1 -right-1">
                  <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Current Step Description (Mobile) */}
      <div className="sm:hidden mt-6 text-center">
        {steps.map(step => (
          step.status === 'current' && (
            <div key={step.id} className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="text-sm font-medium text-purple-900">{step.title}</div>
              <div className="text-xs text-purple-700 mt-1">{step.description}</div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

// Predefined steps for group creation flow
export const DEFAULT_CREATION_STEPS: ProgressStep[] = [
  {
    id: 'details',
    title: 'Details',
    description: 'Group info',
    status: 'pending'
  },
  {
    id: 'members',
    title: 'Members',
    description: 'Add members',
    status: 'pending'
  },
  {
    id: 'create',
    title: 'Create',
    description: 'Setup group',
    status: 'pending'
  },
  {
    id: 'complete',
    title: 'Complete',
    description: 'Ready to use',
    status: 'pending'
  }
];

// Helper function to update step status
export function updateStepStatus(
  steps: ProgressStep[], 
  stepId: string, 
  status: ProgressStep['status']
): ProgressStep[] {
  return steps.map(step => 
    step.id === stepId ? { ...step, status } : step
  );
}

// Helper function to set current step (and mark previous as completed)
export function setCurrentStep(
  steps: ProgressStep[], 
  currentStepId: string
): ProgressStep[] {
  const currentIndex = steps.findIndex(step => step.id === currentStepId);
  
  return steps.map((step, index) => ({
    ...step,
    status: index < currentIndex 
      ? 'completed' 
      : index === currentIndex 
      ? 'current' 
      : 'pending'
  }));
}