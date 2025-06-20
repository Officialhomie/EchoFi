'use client';

import { useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input, Textarea, FormField } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UsersIcon, PenIcon, InfoIcon } from 'lucide-react';
import { useGroupValidation } from '@/hooks/useGroupValidation';
import { VALIDATION_CONFIG } from '@/lib/validation/group-validation';

interface GroupDetailsFormProps {
  onSubmit: (data: { name: string; description: string }) => void;
  onCancel: () => void;
  isLoading?: boolean;
  initialData?: { name?: string; description?: string };
}

export function GroupDetailsForm({ 
  onSubmit, 
  onCancel, 
  isLoading = false,
  initialData = {}
}: GroupDetailsFormProps) {
  const {
    formState,
    updateFormField,
    nameError,
    descriptionError,
    canSubmit
  } = useGroupValidation();

  // Initialize form with provided data
  if (initialData.name && !formState.name) {
    updateFormField('name', initialData.name);
  }
  if (initialData.description && !formState.description) {
    updateFormField('description', initialData.description);
  }

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (canSubmit && !nameError) {
      onSubmit({
        name: formState.name.trim(),
        description: formState.description.trim()
      });
    }
  }, [canSubmit, nameError, formState, onSubmit]);

  const isFormValid = !nameError && !descriptionError && formState.name.trim().length > 0;
  const descriptionCharCount = formState.description.length;
  const nameCharCount = formState.name.length;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center mb-4">
          <UsersIcon className="w-6 h-6 text-white" />
        </div>
        <CardTitle className="text-xl font-semibold text-gray-900">
          Create Investment Group
        </CardTitle>
        <p className="text-sm text-gray-600 mt-2">
          Set up your group for collaborative investment decisions
        </p>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <FormField
            label="Group Name"
            error={nameError || undefined}
            required
          >
            <div className="relative">
              <Input
                type="text"
                placeholder="e.g., DeFi Research Collective"
                value={formState.name}
                onChange={(e) => updateFormField('name', e.target.value)}
                error={nameError || undefined}
                disabled={isLoading}
                className="pl-10"
                maxLength={VALIDATION_CONFIG.GROUP_NAME.MAX_LENGTH}
              />
              <PenIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
            
            {/* Character count and guidance */}
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-gray-500">
                Choose a clear, descriptive name for your investment group
              </p>
              <span className={`text-xs ${
                nameCharCount > VALIDATION_CONFIG.GROUP_NAME.MAX_LENGTH * 0.8 
                  ? 'text-yellow-600' 
                  : 'text-gray-400'
              }`}>
                {nameCharCount}/{VALIDATION_CONFIG.GROUP_NAME.MAX_LENGTH}
              </span>
            </div>

            {/* Real-time validation feedback */}
            {formState.name && !nameError && (
              <div className="flex items-center gap-1 mt-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-green-600">Valid group name</span>
              </div>
            )}
          </FormField>

          <FormField
            label="Description"
            error={descriptionError || undefined}
          >
            <Textarea
              placeholder="Describe your group's investment focus, strategy, or goals..."
              value={formState.description}
              onChange={(e) => updateFormField('description', e.target.value)}
              error={descriptionError || undefined}
              disabled={isLoading}
              rows={3}
              className="resize-none"
              maxLength={VALIDATION_CONFIG.DESCRIPTION.MAX_LENGTH}
            />
            
            {/* Character count */}
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-gray-500">
                Optional - help members understand your group's purpose
              </p>
              <span className={`text-xs ${
                descriptionCharCount > VALIDATION_CONFIG.DESCRIPTION.MAX_LENGTH * 0.8 
                  ? 'text-yellow-600' 
                  : 'text-gray-400'
              }`}>
                {descriptionCharCount}/{VALIDATION_CONFIG.DESCRIPTION.MAX_LENGTH}
              </span>
            </div>
          </FormField>

          {/* Validation status indicator */}
          {formState.name && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <InfoIcon className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <div className="text-blue-800 font-medium">Next Step</div>
                  <div className="text-blue-700 text-xs mt-1">
                    After this, you'll add group members and configure messaging
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isFormValid || isLoading}
              className="flex-1 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating...
                </div>
              ) : (
                'Continue'
              )}
            </Button>
          </div>

          {/* Debug info in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-2 bg-gray-100 rounded text-xs">
              <div>Form Valid: {isFormValid ? '✅' : '❌'}</div>
              <div>Name Error: {nameError || 'None'}</div>
              <div>Description Error: {descriptionError || 'None'}</div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}