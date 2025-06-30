'use client';

import { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  DollarSignIcon, 
  ArrowUpIcon, 
  ArrowDownIcon,
  SendIcon,
  AlertCircleIcon,
  InfoIcon
} from 'lucide-react';
import { useCreateProposal } from '@/contracts/contracts';
import { ProposalType, validateUSDCAmount } from '@/contracts/contracts';
import { parseUnits } from 'viem';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface ProposalCreationProps {
  treasuryAddress: `0x${string}`;
  onSuccess?: (txHash: string) => void;
  onCancel?: () => void;
  className?: string;
}

interface ProposalFormData {
  type: ProposalType;
  amount: string;
  description: string;
  target?: string;
}

interface ValidationErrors {
  amount?: string;
  description?: string;
  target?: string;
  general?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ProposalCreation({
  treasuryAddress,
  onSuccess,
  onCancel,
  className
}: ProposalCreationProps) {
  
  const { createProposal, isLoading, isSuccess, txHash } = useCreateProposal(treasuryAddress);
  
  const [formData, setFormData] = useState<ProposalFormData>({
    type: ProposalType.DEPOSIT_AAVE,
    amount: '',
    description: ''
  });
  
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Validate form data
   */
  const validateForm = useCallback((): ValidationErrors => {
    const newErrors: ValidationErrors = {};

    // Validate amount
    if (!formData.amount.trim()) {
      newErrors.amount = 'Amount is required';
    } else {
      const amountError = validateUSDCAmount(formData.amount);
      if (amountError) {
        newErrors.amount = amountError;
      }
    }

    // Validate description
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    } else if (formData.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    // Validate target for transfer proposals
    if (formData.type === ProposalType.TRANSFER) {
      if (!formData.target?.trim()) {
        newErrors.target = 'Target address is required for transfers';
      } else if (!/^0x[a-fA-F0-9]{40}$/.test(formData.target)) {
        newErrors.target = 'Invalid Ethereum address format';
      }
    }

    return newErrors;
  }, [formData]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validationErrors = validateForm();
    setErrors(validationErrors);
    
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Convert amount to wei (USDC has 6 decimals)
      const amountWei = parseUnits(formData.amount, 6);
      
      // Prepare proposal parameters
      const proposalParams = {
        proposalType: formData.type,
        amount: amountWei,
        target: (formData.target || '0x0000000000000000000000000000000000000000') as `0x${string}`,
        data: '0x' as `0x${string}`, // Empty data for simple proposals
        description: formData.description.trim()
      };

      console.log('🏗️ Creating proposal:', {
        type: ProposalType[formData.type],
        amount: formData.amount,
        description: formData.description,
        treasury: treasuryAddress
      });

      createProposal(proposalParams);
      
    } catch (error) {
      console.error('❌ Failed to create proposal:', error);
      setErrors({
        general: error instanceof Error ? error.message : 'Failed to create proposal'
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, createProposal, treasuryAddress]);

  /**
   * Handle successful transaction
   */
  React.useEffect(() => {
    if (isSuccess && txHash) {
      console.log('✅ Proposal created successfully:', txHash);
      onSuccess?.(txHash);
    }
  }, [isSuccess, txHash, onSuccess]);

  /**
   * Handle form field changes
   */
  const handleFieldChange = useCallback((field: keyof ProposalFormData, value: string | ProposalType) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear related errors
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [errors]);

  /**
   * Get proposal type info
   */
  const getProposalTypeInfo = useCallback((type: ProposalType) => {
    switch (type) {
      case ProposalType.DEPOSIT_AAVE:
        return {
          title: 'Deposit to Aave',
          description: 'Invest USDC in Aave lending protocol to earn yield',
          icon: ArrowUpIcon,
          color: 'text-green-600'
        };
      case ProposalType.WITHDRAW_AAVE:
        return {
          title: 'Withdraw from Aave',
          description: 'Withdraw USDC from Aave lending protocol',
          icon: ArrowDownIcon,
          color: 'text-blue-600'
        };
      case ProposalType.TRANSFER:
        return {
          title: 'Transfer Funds',
          description: 'Send USDC to another address',
          icon: SendIcon,
          color: 'text-purple-600'
        };
      default:
        return {
          title: 'Unknown',
          description: 'Unknown proposal type',
          icon: AlertCircleIcon,
          color: 'text-gray-600'
        };
    }
  }, []);

  const currentTypeInfo = getProposalTypeInfo(formData.type);
  const IconComponent = currentTypeInfo.icon;

  return (
    <Card className={cn("w-full max-w-lg mx-auto", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSignIcon className="w-5 h-5 text-green-600" />
          Create Investment Proposal
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Proposal Type Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">
              Proposal Type
            </label>
            
            <div className="grid grid-cols-1 gap-3">
              {[ProposalType.DEPOSIT_AAVE, ProposalType.WITHDRAW_AAVE, ProposalType.TRANSFER].map((type) => {
                const typeInfo = getProposalTypeInfo(type);
                const TypeIcon = typeInfo.icon;
                const isSelected = formData.type === type;
                
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleFieldChange('type', type)}
                    className={cn(
                      "flex items-center gap-3 p-3 border rounded-lg text-left transition-all",
                      isSelected 
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200" 
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <TypeIcon className={cn("w-5 h-5", typeInfo.color)} />
                    <div>
                      <div className="font-medium text-gray-900">{typeInfo.title}</div>
                      <div className="text-sm text-gray-600">{typeInfo.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <label htmlFor="amount" className="text-sm font-medium text-gray-700">
              Amount (USDC)
            </label>
            <div className="relative">
              <DollarSignIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => handleFieldChange('amount', e.target.value)}
                className={cn(
                  "pl-10",
                  errors.amount && "border-red-500 focus:ring-red-500"
                )}
              />
            </div>
            {errors.amount && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircleIcon className="w-4 h-4" />
                {errors.amount}
              </p>
            )}
          </div>

          {/* Target Address (for transfers) */}
          {formData.type === ProposalType.TRANSFER && (
            <div className="space-y-2">
              <label htmlFor="target" className="text-sm font-medium text-gray-700">
                Target Address
              </label>
              <Input
                id="target"
                placeholder="0x..."
                value={formData.target || ''}
                onChange={(e) => handleFieldChange('target', e.target.value)}
                className={errors.target ? "border-red-500 focus:ring-red-500" : ""}
              />
              {errors.target && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircleIcon className="w-4 h-4" />
                  {errors.target}
                </p>
              )}
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium text-gray-700">
              Description
            </label>
            <Textarea
              id="description"
              placeholder="Explain the purpose of this proposal..."
              rows={4}
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              className={errors.description ? "border-red-500 focus:ring-red-500" : ""}
            />
            <div className="flex justify-between items-center">
              {errors.description ? (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircleIcon className="w-4 h-4" />
                  {errors.description}
                </p>
              ) : (
                <p className="text-sm text-gray-500">
                  {formData.description.length}/500 characters
                </p>
              )}
            </div>
          </div>

          {/* Current Proposal Summary */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <InfoIcon className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Proposal Summary</span>
            </div>
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <IconComponent className={cn("w-4 h-4", currentTypeInfo.color)} />
                <span>{currentTypeInfo.title}</span>
              </div>
              {formData.amount && (
                <div>Amount: ${formData.amount} USDC</div>
              )}
              {formData.type === ProposalType.TRANSFER && formData.target && (
                <div>To: {formData.target.slice(0, 10)}...{formData.target.slice(-8)}</div>
              )}
            </div>
          </div>

          {/* General Error */}
          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircleIcon className="w-4 h-4" />
                {errors.general}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading || isSubmitting}
                className="flex-1"
              >
                Cancel
              </Button>
            )}
            
            <Button
              type="submit"
              disabled={isLoading || isSubmitting || Object.keys(validateForm()).length > 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isLoading || isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating...
                </div>
              ) : (
                'Create Proposal'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}