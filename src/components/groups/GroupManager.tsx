'use client';

import { useState, useEffect, useCallback } from 'react';
import { useXMTP } from '@/hooks/useXMTP';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input, Textarea, FormField } from '@/components/ui/input';
import { Spinner } from '@/components/ui/loading';
import { formatAddress, getRelativeTime, isValidAddress } from '@/lib/utils';
import { PlusIcon, UsersIcon, MessageCircleIcon } from 'lucide-react';

interface GroupManagerProps {
  onCreateGroup: (groupData: { name: string; description: string; members: string[] }) => Promise<void>;
  onJoinGroup: (groupId: string, groupName: string) => void;
  isLoading?: boolean;
}

interface GroupData {
  name: string;
  description: string;
  members: string;
}

export function GroupManager({ onCreateGroup, onJoinGroup, isLoading }: GroupManagerProps) {
  const { canMessage, conversations } = useXMTP();
  const { address } = useWallet();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [groupData, setGroupData] = useState<GroupData>({
    name: '',
    description: '',
    members: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [validatingMembers, setValidatingMembers] = useState(false);
  const [memberValidation, setMemberValidation] = useState<Record<string, boolean>>({});

  // Validate member addresses as user types
  const validateMembers = useCallback(async () => {
    const addresses = groupData.members
      .split(',')
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0);

    if (addresses.length === 0) return;

    setValidatingMembers(true);
    try {
      const validation: Record<string, boolean> = {};
      
      // Check address format
      for (const addr of addresses) {
        if (!isValidAddress(addr)) {
          validation[addr] = false;
        }
      }

      // Check if addresses can receive XMTP messages
      const validAddresses = addresses.filter(addr => isValidAddress(addr));
      if (validAddresses.length > 0) {
        const canMessageMap = await canMessage(validAddresses);
        canMessageMap.forEach((canMsg, addr) => {
          validation[addr] = canMsg;
        });
      }

      setMemberValidation(validation);
    } catch (error) {
      console.error('Failed to validate members:', error);
    } finally {
      setValidatingMembers(false);
    }
  }, [groupData.members, canMessage]);

  useEffect(() => {
    if (groupData.members.trim()) {
      validateMembers();
    } else {
      setMemberValidation({});
    }
  }, [groupData.members, validateMembers]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!groupData.name.trim()) {
      errors.name = 'Group name is required';
    }

    if (!groupData.description.trim()) {
      errors.description = 'Description is required';
    }

    // Validate member addresses
    if (groupData.members.trim()) {
      const addresses = groupData.members
        .split(',')
        .map(addr => addr.trim())
        .filter(addr => addr.length > 0);

      const invalidAddresses = addresses.filter(addr => 
        !isValidAddress(addr) || memberValidation[addr] === false
      );

      if (invalidAddresses.length > 0) {
        errors.members = `Invalid or unreachable addresses: ${invalidAddresses.join(', ')}`;
      }

      // Check for duplicates
      const uniqueAddresses = new Set(addresses);
      if (uniqueAddresses.size !== addresses.length) {
        errors.members = 'Duplicate addresses found';
      }

      // Check if user included themselves
      if (address && addresses.includes(address)) {
        errors.members = 'You are automatically included as the group creator';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateGroup = async () => {
    if (!validateForm()) return;

    const members = groupData.members
      .split(',')
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0 && isValidAddress(addr));

    try {
      await onCreateGroup({
        name: groupData.name,
        description: groupData.description,
        members,
      });

      // Reset form
      setGroupData({ name: '', description: '', members: '' });
      setFormErrors({});
      setMemberValidation({});
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create group:', error);
    }
  };

  const renderMemberValidation = () => {
    if (!groupData.members.trim()) return null;

    const addresses = groupData.members
      .split(',')
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0);

    return (
      <div className="mt-2 space-y-1">
        {addresses.map((addr, index) => {
          const isValid = memberValidation[addr];
          const isValidFormat = isValidAddress(addr);
          
          return (
            <div key={index} className="flex items-center text-xs">
              <span className="mr-2">
                {validatingMembers ? (
                  <div className="w-3 h-3 border border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                ) : isValidFormat && isValid ? (
                  <span className="text-green-500">✓</span>
                ) : (
                  <span className="text-red-500">✗</span>
                )}
              </span>
              <span className={`font-mono ${isValidFormat && isValid ? 'text-green-700' : 'text-red-700'}`}>
                {formatAddress(addr)}
              </span>
              {!isValidFormat && (
                <span className="ml-2 text-red-500">Invalid format</span>
              )}
              {isValidFormat && isValid === false && (
                <span className="ml-2 text-red-500">Cannot receive messages</span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Investment Groups</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Create or join investment coordination groups to start building wealth together through decentralized decision making.
        </p>
      </div>

      {/* Create Group Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <PlusIcon className="w-5 h-5 mr-2" />
              Create New Group
            </CardTitle>
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              disabled={isLoading}
            >
              {showCreateForm ? 'Cancel' : 'New Group'}
            </Button>
          </div>
        </CardHeader>

        {showCreateForm && (
          <CardContent className="border-t space-y-4">
            <FormField label="Group Name" error={formErrors.name} required>
              <Input
                placeholder="e.g., DeFi Yield Hunters"
                value={groupData.name}
                onChange={(e) => setGroupData(prev => ({ ...prev, name: e.target.value }))}
              />
            </FormField>

            <FormField label="Description" error={formErrors.description} required>
              <Textarea
                placeholder="Describe your group's investment focus and goals"
                value={groupData.description}
                onChange={(e) => setGroupData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </FormField>

            <FormField 
              label="Member Addresses (Optional)" 
              error={formErrors.members}
            >
              <Textarea
                placeholder="0x742d35Cc6436C0532925a3b8D400f1C0d4e2F7c5, 0x8ba1f109551bD432803012645Hac136c..."
                value={groupData.members}
                onChange={(e) => setGroupData(prev => ({ ...prev, members: e.target.value }))}
                rows={2}
              />
              <p className="text-xs text-gray-500 mt-1">
                Comma-separated Ethereum addresses. You can add members later.
              </p>
              {renderMemberValidation()}
            </FormField>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleCreateGroup}
                disabled={isLoading || validatingMembers}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    {/* <LoadingSpinner size="sm" /> */}
                    <span className="ml-2">Creating...</span>
                  </>
                ) : (
                  'Create Group'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false);
                  setGroupData({ name: '', description: '', members: '' });
                  setFormErrors({});
                }}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Existing Groups */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <UsersIcon className="w-5 h-5 mr-2" />
            Your Groups
          </CardTitle>
        </CardHeader>
        <CardContent>
          {conversations.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No groups yet</h3>
              <p className="text-gray-600 mb-4">
                Create your first investment group to start coordinating with others.
              </p>
              <Button onClick={() => setShowCreateForm(true)}>
                Create Your First Group
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors cursor-pointer"
                  onClick={() => onJoinGroup(conversation.id, conversation.name || 'Unnamed Group')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {conversation.name || 'Unnamed Group'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {conversation.description || 'Investment coordination group'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {/* Use createdAtNs if available, else fallback to now */}
                        Created {getRelativeTime(conversation.createdAtNs ? Number(conversation.createdAtNs) : Date.now())}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">
                        Members: N/A
                      </div>
                      <Button variant="outline" size="sm" className="mt-2">
                        Open →
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-sm">💡</span>
            </div>
            <div>
              <h3 className="font-medium text-blue-900 mb-2">How it works</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Create a group and invite friends by their wallet addresses</li>
                <li>• Group members can propose investment strategies</li>
                <li>• Vote on proposals democratically</li>
                <li>• AI agents execute approved strategies automatically</li>
                <li>• Track portfolio performance and profits together</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}