'use client';

import { useState, useCallback, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input, Textarea, FormField } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  UsersIcon, 
  PlusIcon, 
  XIcon, 
  CheckIcon, 
  AlertCircleIcon,
  InfoIcon,
  ClockIcon,
  CopyIcon
} from 'lucide-react';
import { useGroupValidation } from '@/hooks/useGroupValidation';
import { parseAddressInput } from '@/lib/validation/group-validation';
import { formatAddress } from '@/lib/utils';
import { MemberValidationResult } from '@/types/group-creation';

interface MemberManagementProps {
  onSubmit: (members: string[]) => void;
  onBack: () => void;
  isLoading?: boolean;
  maxMembers?: number;
}

export function MemberManagementEnhanced({ 
  onSubmit, 
  onBack, 
  isLoading = false,
  maxMembers = 20
}: MemberManagementProps) {
  const {
    formState,
    updateFormField,
    isValidating,
    validMemberCount,
    membersError,
    warnings,
    memberValidation,
    validateMembers,
    clearField
  } = useGroupValidation();

  const [showBulkInput, setShowBulkInput] = useState(false);
  const [bulkInput, setBulkInput] = useState('');

  // Parse current member input for display
  const parsedAddresses = useMemo(() => 
    parseAddressInput(formState.members), 
    [formState.members]
  );

  const handleMemberInputChange = useCallback((value: string) => {
    updateFormField('members', value);
  }, [updateFormField]);

  const handleBulkImport = useCallback(() => {
    if (bulkInput.trim()) {
      const existingInput = formState.members.trim();
      const newInput = existingInput 
        ? `${existingInput}, ${bulkInput.trim()}`
        : bulkInput.trim();
      
      updateFormField('members', newInput);
      setBulkInput('');
      setShowBulkInput(false);
    }
  }, [bulkInput, formState.members, updateFormField]);

  const handleAddSampleAddresses = useCallback(() => {
    const sampleAddresses = [
      '0x742d35Cc6634C0532925a3b8D9c38f28a482B43e',
      '0x8ba1f109551bD432803012645Hac136c5E75db9b'
    ];
    
    const sampleInput = sampleAddresses.join(', ');
    updateFormField('members', sampleInput);
  }, [updateFormField]);

  const canProceed = validMemberCount > 0 && !membersError && !isValidating;

  const handleSubmit = useCallback(() => {
    if (canProceed) {
      const validAddresses = parsedAddresses.valid.filter(addr => 
        memberValidation[addr]?.canMessage === true
      );
      onSubmit(validAddresses);
    }
  }, [canProceed, parsedAddresses.valid, memberValidation, onSubmit]);

  // Render individual address validation status
  const renderAddressStatus = useCallback((
    address: string, 
    validation: MemberValidationResult
  ) => {
    if (validation.isValidating) {
      return (
        <div className="flex items-center gap-1">
          <ClockIcon className="w-3 h-3 text-blue-500 animate-pulse" />
          <span className="text-xs text-blue-600">Checking...</span>
        </div>
      );
    }

    if (!validation.isValidFormat) {
      return (
        <div className="flex items-center gap-1">
          <AlertCircleIcon className="w-3 h-3 text-red-500" />
          <span className="text-xs text-red-600">Invalid format</span>
        </div>
      );
    }

    if (validation.canMessage) {
      return (
        <div className="flex items-center gap-1">
          <CheckIcon className="w-3 h-3 text-green-500" />
          <span className="text-xs text-green-600">XMTP ready</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1">
        <AlertCircleIcon className="w-3 h-3 text-red-500" />
        <span className="text-xs text-red-600">No XMTP</span>
      </div>
    );
  }, []);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center mb-4">
          <UsersIcon className="w-6 h-6 text-white" />
        </div>
        <CardTitle className="text-xl font-semibold text-gray-900">
          Add Group Members
        </CardTitle>
        <p className="text-sm text-gray-600 mt-2">
          Invite members to join your investment group
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Validation Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <InfoIcon className="w-4 h-4 text-blue-600" />
            <div className="flex-1">
              <div className="text-sm text-blue-800 font-medium">
                {isValidating ? (
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    Validating addresses...
                  </span>
                ) : (
                  `${validMemberCount} member${validMemberCount !== 1 ? 's' : ''} ready`
                )}
              </div>
              {parsedAddresses.total > 0 && (
                <div className="text-xs text-blue-700 mt-1">
                  {parsedAddresses.total} total, {parsedAddresses.invalid.length} invalid format
                </div>
              )}
            </div>
          </div>
          
          {/* Validation errors */}
          {membersError && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
              {membersError}
            </div>
          )}
          
          {/* Warnings */}
          {warnings.map((warning, index) => (
            <div key={index} className="mt-2 text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 rounded p-2">
              ⚠️ {warning}
            </div>
          ))}
        </div>

        {/* Input Mode Toggle */}
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Member Addresses</span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowBulkInput(!showBulkInput)}
              className="text-xs"
            >
              {showBulkInput ? 'Single Entry' : 'Bulk Import'}
            </Button>
            {!formState.members && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddSampleAddresses}
                className="text-xs"
              >
                <CopyIcon className="w-3 h-3 mr-1" />
                Sample
              </Button>
            )}
          </div>
        </div>

        {showBulkInput ? (
          /* Bulk Import Mode */
          <div className="space-y-3">
            <FormField label="Paste Addresses" error="">
              <Textarea
                placeholder="Paste multiple addresses (one per line or comma-separated)&#10;0x742d35Cc6634C0532925a3b8D9c38f28a482B43e&#10;0x8ba1f109551bD432803012645Hac136c5E75db9b"
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                rows={4}
                className="text-xs font-mono"
              />
            </FormField>
            <Button
              type="button"
              onClick={handleBulkImport}
              disabled={!bulkInput.trim()}
              className="w-full"
            >
              Import Addresses
            </Button>
          </div>
        ) : (
          /* Single Entry Mode */
          <div className="space-y-3">
            <FormField label="Member Addresses" error={membersError || undefined}>
              <Textarea
                placeholder="Enter wallet addresses separated by commas&#10;0x742d35Cc6634C0532925a3b8D9c38f28a482B43e, 0x8ba1f109551bD432803012645Hac136c5E75db9b"
                value={formState.members}
                onChange={(e) => handleMemberInputChange(e.target.value)}
                error={membersError || undefined}
                rows={3}
                className="font-mono text-sm"
              />
            </FormField>

            {/* Address Validation Display */}
            {parsedAddresses.total > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-2">
                <div className="text-xs font-medium text-gray-700 mb-2">
                  Address Validation Status:
                </div>
                
                {/* Valid addresses */}
                {parsedAddresses.valid.map((addr) => (
                  <div key={addr} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                    <div className="font-mono text-xs text-gray-700">
                      {formatAddress(addr)}
                    </div>
                    {memberValidation[addr] && renderAddressStatus(addr, memberValidation[addr])}
                  </div>
                ))}
                
                {/* Invalid addresses */}
                {parsedAddresses.invalid.map((addr, index) => (
                  <div key={`invalid-${index}`} className="flex items-center justify-between bg-red-50 rounded-lg p-2">
                    <div className="font-mono text-xs text-red-700 truncate">
                      {addr}
                    </div>
                    <div className="flex items-center gap-1">
                      <AlertCircleIcon className="w-3 h-3 text-red-500" />
                      <span className="text-xs text-red-600">Invalid</span>
                    </div>
                  </div>
                ))}
                
                {/* Duplicates */}
                {parsedAddresses.duplicates.map((addr, index) => (
                  <div key={`duplicate-${index}`} className="flex items-center justify-between bg-yellow-50 rounded-lg p-2">
                    <div className="font-mono text-xs text-yellow-700">
                      {formatAddress(addr)}
                    </div>
                    <div className="flex items-center gap-1">
                      <AlertCircleIcon className="w-3 h-3 text-yellow-500" />
                      <span className="text-xs text-yellow-600">Duplicate</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Clear button */}
            {formState.members && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => clearField('members')}
                className="text-xs"
              >
                Clear All
              </Button>
            )}
          </div>
        )}

        {/* Footer Info */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Members will receive XMTP messaging invitations</p>
          <p>• Only addresses with XMTP capability can join</p>
          <p>• Maximum {maxMembers} members per group</p>
          <p>• You can add more members later</p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isLoading}
            className="flex-1"
          >
            Back
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canProceed || isLoading}
            className="flex-1 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Processing...
              </div>
            ) : (
              `Continue with ${validMemberCount} member${validMemberCount !== 1 ? 's' : ''}`
            )}
          </Button>
        </div>

        {/* Debug info in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-2 bg-gray-100 rounded text-xs">
            <div>Valid Members: {validMemberCount}</div>
            <div>Can Proceed: {canProceed ? '✅' : '❌'}</div>
            <div>Validating: {isValidating ? '⏳' : '✅'}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}