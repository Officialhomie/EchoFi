// src/components/groups/CreateGroupForm.tsx
// Comprehensive form for creating EchoFi investment groups with XMTP + Smart Contract integration

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useIntegratedGroupCreation, GroupMember, formatVotingDistribution } from '@/hooks/useIntegratedGroupCreation';
import { useWallet } from '@/hooks/useWallet';
import { useXMTP } from '@/hooks/useXMTP';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading';
import { 
  Users, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  MessageCircle, 
  Shield,
  Coins,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

// =============================================================================
// INTERFACES
// =============================================================================

interface CreateGroupFormProps {
  onSuccess?: (groupId: string, treasuryAddress: string) => void;
  onCancel?: () => void;
  className?: string;
}

interface MemberFormData {
  address: string;
  votingPower: number;
  name?: string;
  errors?: {
    address?: string;
    votingPower?: string;
  };
}

interface FormErrors {
  name?: string;
  description?: string;
  members?: string;
  general?: string;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function CreateGroupForm({ onSuccess, onCancel, className }: CreateGroupFormProps) {
  const { address, isConnected } = useWallet();
  const { isInitialized: isXMTPReady, initializeXMTP, error: xmtpError } = useXMTP();
  const {
    createInvestmentGroup,
    isCreating,
    isSuccess,
    progress,
    result,
    error,
    reset,
    canRetry,
    estimatedGasCost
  } = useIntegratedGroupCreation();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  const [members, setMembers] = useState<MemberFormData[]>([
    { address: '', votingPower: 50, name: '' },
  ]);

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  // =============================================================================
  // FORM VALIDATION
  // =============================================================================

  const validateForm = useCallback((): boolean => {
    const errors: FormErrors = {};

    // Basic validation
    if (!formData.name.trim()) {
      errors.name = 'Group name is required';
    } else if (formData.name.length < 3) {
      errors.name = 'Group name must be at least 3 characters';
    } else if (formData.name.length > 50) {
      errors.name = 'Group name must be less than 50 characters';
    }

    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    } else if (formData.description.length < 10) {
      errors.description = 'Description must be at least 10 characters';
    }

    // Member validation
    const validMembers = members.filter(m => m.address.trim());
    if (validMembers.length === 0) {
      errors.members = 'At least one member is required';
    }

    // Validate addresses and voting powers
    const memberErrors: { [index: number]: MemberFormData['errors'] } = {};
    let totalVotingPower = 0;
    const addressSet = new Set<string>();

    validMembers.forEach((member, index) => {
      const memberError: MemberFormData['errors'] = {};

      // Address validation
      if (!member.address.trim()) {
        memberError.address = 'Address is required';
      } else if (!/^0x[a-fA-F0-9]{40}$/.test(member.address)) {
        memberError.address = 'Invalid Ethereum address';
      } else if (addressSet.has(member.address.toLowerCase())) {
        memberError.address = 'Duplicate address';
      } else {
        addressSet.add(member.address.toLowerCase());
      }

      // Voting power validation
      if (member.votingPower <= 0) {
        memberError.votingPower = 'Must be greater than 0';
      } else if (member.votingPower > 100) {
        memberError.votingPower = 'Cannot exceed 100%';
      } else {
        totalVotingPower += member.votingPower;
      }

      if (memberError.address || memberError.votingPower) {
        memberErrors[index] = memberError;
      }
    });

    // Check total voting power
    if (totalVotingPower !== 100) {
      errors.members = `Total voting power is ${totalVotingPower}%, must equal 100%`;
    }

    // Update member errors
    const updatedMembers = [...members];
    Object.entries(memberErrors).forEach(([index, error]) => {
      updatedMembers[parseInt(index)].errors = error;
    });
    setMembers(updatedMembers);

    setFormErrors(errors);
    return Object.keys(errors).length === 0 && Object.keys(memberErrors).length === 0;
  }, [formData, members]);

  // =============================================================================
  // MEMBER MANAGEMENT
  // =============================================================================

  const addMember = useCallback(() => {
    const remainingVotingPower = 100 - members.reduce((sum, m) => sum + (m.votingPower || 0), 0);
    setMembers(prev => [...prev, {
      address: '',
      votingPower: Math.max(1, remainingVotingPower),
      name: '',
    }]);
  }, [members]);

  const removeMember = useCallback((index: number) => {
    setMembers(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateMember = useCallback((index: number, field: keyof MemberFormData, value: string | number) => {
    setMembers(prev => prev.map((member, i) => 
      i === index 
        ? { ...member, [field]: value, errors: undefined } 
        : member
    ));
  }, []);

  const redistributeVotingPower = useCallback(() => {
    const validMembers = members.filter(m => m.address.trim());
    if (validMembers.length === 0) return;

    const equalPower = Math.floor(100 / validMembers.length);
    const remainder = 100 % validMembers.length;

    setMembers(prev => prev.map((member, index) => {
      if (!member.address.trim()) return member;
      
      const memberIndex = validMembers.findIndex(vm => vm.address === member.address);
      return {
        ...member,
        votingPower: equalPower + (memberIndex < remainder ? 1 : 0),
        errors: undefined
      };
    }));
  }, [members]);

  // =============================================================================
  // FORM SUBMISSION
  // =============================================================================

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected) {
      setFormErrors({ general: 'Please connect your wallet first' });
      return;
    }

    if (!isXMTPReady) {
      setFormErrors({ general: 'XMTP is not ready. Please wait for initialization to complete.' });
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      const validMembers = members
        .filter(m => m.address.trim())
        .map(m => ({
          address: m.address.trim(),
          votingPower: m.votingPower,
          name: m.name?.trim() || undefined
        }));

      const groupParams = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        members: validMembers,
      };

      const result = await createInvestmentGroup(groupParams);
      
      if (onSuccess) {
        onSuccess(result.groupId, result.treasuryAddress);
      }

    } catch (submitError) {
      console.error('Form submission error:', submitError);
      setFormErrors({ 
        general: submitError instanceof Error ? submitError.message : 'Failed to create group' 
      });
    }
  }, [isConnected, isXMTPReady, validateForm, formData, members, createInvestmentGroup, onSuccess]);

  // =============================================================================
  // EFFECTS
  // =============================================================================

  // Initialize XMTP if not ready
  useEffect(() => {
    if (isConnected && !isXMTPReady && !xmtpError) {
      initializeXMTP();
    }
  }, [isConnected, isXMTPReady, xmtpError, initializeXMTP]);

  // Reset form on success
  useEffect(() => {
    if (isSuccess) {
      setFormData({ name: '', description: '' });
      setMembers([{ address: '', votingPower: 50, name: '' }]);
      setFormErrors({});
    }
  }, [isSuccess]);

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  const renderProgress = () => {
    if (!isCreating && !isSuccess) return null;

    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-blue-900">Creating Investment Group</h3>
              <span className="text-sm text-blue-700">{progress.progress}%</span>
            </div>
            
            <Progress value={progress.progress} className="w-full" />
            
            <div className="flex items-center space-x-2 text-sm text-blue-800">
              {isCreating && <LoadingSpinner size="sm" />}
              <span>{progress.message}</span>
            </div>
            
            <div className="text-xs text-blue-600">
              Current step: {progress.currentStep}
            </div>

            {progress.errors.length > 0 && (
              <div className="space-y-1">
                {progress.errors.map((err, index) => (
                  <div key={index} className="text-xs text-red-600">
                    • {err}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderSuccess = () => {
    if (!isSuccess || !result) return null;

    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-green-900">Group Created Successfully!</h3>
              <p className="text-green-700">Your investment group is ready for action</p>
            </div>
            
            <div className="bg-white rounded-lg p-4 space-y-2 text-left">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Group ID:</span>
                <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                  {result.groupId.slice(0, 8)}...
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Treasury Address:</span>
                <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                  {result.treasuryAddress.slice(0, 6)}...{result.treasuryAddress.slice(-4)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Transaction:</span>
                <a 
                  href={`https://sepolia-explorer.base.org/tx/${result.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-xs"
                >
                  View on Explorer →
                </a>
              </div>
            </div>

            <div className="flex space-x-2">
              <Button 
                onClick={() => onSuccess?.(result.groupId, result.treasuryAddress)}
                className="bg-green-600 hover:bg-green-700"
              >
                Open Group
              </Button>
              <Button 
                variant="outline" 
                onClick={reset}
              >
                Create Another
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderError = () => {
    if (!error && !formErrors.general) return null;

    const errorMessage = error || formErrors.general;

    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-red-800">
          {errorMessage}
          {canRetry && (
            <div className="mt-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={reset}
                className="border-red-300 text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Try Again
              </Button>
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  };

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className={`max-w-4xl mx-auto space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Create Investment Group
        </h1>
        <p className="text-gray-600">
          Transform group chats into investment DAOs with XMTP messaging and on-chain treasury management
        </p>
      </div>

      {/* Prerequisites Check */}
      <Card className="border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2 text-blue-600" />
            Prerequisites
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <span className={isConnected ? 'text-green-700' : 'text-red-700'}>
                Wallet Connected
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              {isXMTPReady ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <LoadingSpinner size="sm" />
              )}
              <span className={isXMTPReady ? 'text-green-700' : 'text-yellow-700'}>
                XMTP Ready
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Coins className="w-5 h-5 text-blue-600" />
              <span className="text-gray-700">
                Est. Cost: {estimatedGasCost}
              </span>
            </div>
          </div>

          {xmtpError && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-yellow-800 text-sm">
                XMTP Error: {xmtpError}
              </p>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={initializeXMTP}
                className="mt-2"
              >
                Retry XMTP Connection
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress, Success, or Error */}
      {renderProgress()}
      {renderSuccess()}
      {renderError()}

      {/* Form - only show if not creating/success */}
      {!isCreating && !isSuccess && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageCircle className="w-5 h-5 mr-2" />
                Group Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Group Name *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., DeFi Alpha Investment Group"
                  className={formErrors.name ? 'border-red-300' : ''}
                />
                {formErrors.name && (
                  <p className="text-red-600 text-sm mt-1">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the group's investment focus and strategy..."
                  rows={3}
                  className={formErrors.description ? 'border-red-300' : ''}
                />
                {formErrors.description && (
                  <p className="text-red-600 text-sm mt-1">{formErrors.description}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Members Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Group Members
                </CardTitle>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={redistributeVotingPower}
                  >
                    Equal Distribution
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addMember}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Member
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {members.map((member, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">Member {index + 1}</h4>
                    {members.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMember(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ethereum Address *
                      </label>
                      <Input
                        value={member.address}
                        onChange={(e) => updateMember(index, 'address', e.target.value)}
                        placeholder="0x..."
                        className={member.errors?.address ? 'border-red-300' : ''}
                      />
                      {member.errors?.address && (
                        <p className="text-red-600 text-sm mt-1">{member.errors.address}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Voting Power (%) *
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={member.votingPower}
                        onChange={(e) => updateMember(index, 'votingPower', parseInt(e.target.value) || 0)}
                        className={member.errors?.votingPower ? 'border-red-300' : ''}
                      />
                      {member.errors?.votingPower && (
                        <p className="text-red-600 text-sm mt-1">{member.errors.votingPower}</p>
                      )}
                    </div>
                  </div>

                  {showAdvanced && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Display Name (Optional)
                      </label>
                      <Input
                        value={member.name || ''}
                        onChange={(e) => updateMember(index, 'name', e.target.value)}
                        placeholder="Alice, Bob, etc."
                      />
                    </div>
                  )}
                </div>
              ))}

              {formErrors.members && (
                <p className="text-red-600 text-sm">{formErrors.members}</p>
              )}

              {/* Voting Power Summary */}
              {members.some(m => m.address.trim()) && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <h5 className="font-medium text-gray-900 mb-2">Voting Power Distribution</h5>
                  <p className="text-sm text-gray-600">
                    {formatVotingDistribution(
                      members
                        .filter(m => m.address.trim())
                        .map(m => ({ address: m.address, votingPower: m.votingPower }))
                    )}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Total: {members.reduce((sum, m) => sum + (m.votingPower || 0), 0)}%
                  </p>
                </div>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-blue-600"
              >
                {showAdvanced ? 'Hide' : 'Show'} Advanced Options
              </Button>
            </CardContent>
          </Card>

          {/* Submit Buttons */}
          <div className="flex space-x-4">
            <Button
              type="submit"
              disabled={!isConnected || !isXMTPReady || isCreating}
              className="flex-1"
            >
              {isCreating ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Creating Group...
                </>
              ) : (
                <>
                  Create Investment Group
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>

            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isCreating}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}