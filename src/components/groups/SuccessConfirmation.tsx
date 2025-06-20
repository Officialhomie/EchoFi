'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CheckIcon, 
  MessageCircleIcon, 
  UsersIcon, 
  TrendingUpIcon,
  CopyIcon,
  ExternalLinkIcon,
  ChevronRightIcon
} from 'lucide-react';
import { GroupCreationResult } from '@/types/group-creation';
import { formatAddress } from '@/lib/utils';

interface SuccessConfirmationProps {
  result: GroupCreationResult;
  groupData: {
    name: string;
    description: string;
    members: string[];
  };
  onJoinGroup: () => void;
  onCreateAnother: () => void;
  onViewDashboard: () => void;
}

export function SuccessConfirmation({
  result,
  groupData,
  onJoinGroup,
  onCreateAnother,
  onViewDashboard
}: SuccessConfirmationProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mb-4">
          <CheckIcon className="w-8 h-8 text-white" />
        </div>
        <CardTitle className="text-2xl font-semibold text-gray-900">
          🎉 Group Created Successfully!
        </CardTitle>
        <p className="text-base text-gray-600 mt-2">
          <span className="font-medium">{groupData.name}</span> is ready for collaborative investing
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Group Summary */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-green-900 mb-3">Your New Group</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <UsersIcon className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium text-green-900">{groupData.name}</div>
                <div className="text-sm text-green-700">
                  {groupData.members.length + 1} member{groupData.members.length !== 0 ? 's' : ''}
                </div>
              </div>
            </div>
            
            {groupData.description && (
              <div className="text-sm text-green-800 bg-green-100 rounded p-3">
                &quot;{groupData.description}&quot;
              </div>
            )}
          </div>
        </div>

        {/* Technical Details */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Technical Details</h4>
          
          {/* Database ID */}
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
            <div>
              <div className="text-sm font-medium text-gray-900">Database ID</div>
              <div className="text-xs text-gray-600 font-mono">
                {formatAddress(result.databaseGroupId)}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(result.databaseGroupId, 'database')}
              className="ml-2"
            >
              {copiedField === 'database' ? '✓' : <CopyIcon className="w-3 h-3" />}
            </Button>
          </div>
          
          {/* XMTP Group ID */}
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
            <div>
              <div className="text-sm font-medium text-gray-900">XMTP Group ID</div>
              <div className="text-xs text-gray-600 font-mono">
                {formatAddress(result.conversation.id)}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(result.conversation.id, 'xmtp')}
              className="ml-2"
            >
              {copiedField === 'xmtp' ? '✓' : <CopyIcon className="w-3 h-3" />}
            </Button>
          </div>
        </div>

        {/* Member List */}
        {groupData.members.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-900">
              Group Members ({groupData.members.length + 1})
            </h4>
            <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="font-mono text-gray-600">You (Creator)</span>
                </div>
                {groupData.members.map((member, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="font-mono text-gray-600">{formatAddress(member)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Feature Highlights */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-3">What&apos;s Next?</h4>
          <div className="space-y-2 text-sm text-blue-800">
            <div className="flex items-center gap-2">
              <MessageCircleIcon className="w-4 h-4 text-blue-600" />
              <span>Start messaging with group members</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUpIcon className="w-4 h-4 text-blue-600" />
              <span>Create investment proposals and vote</span>
            </div>
            <div className="flex items-center gap-2">
              <UsersIcon className="w-4 h-4 text-blue-600" />
              <span>Add more members anytime</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          {/* Primary Action */}
          <Button
            onClick={onJoinGroup}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white h-12"
          >
            <MessageCircleIcon className="w-5 h-5 mr-2" />
            Enter Group Chat
            <ChevronRightIcon className="w-4 h-4 ml-2" />
          </Button>

          {/* Secondary Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onCreateAnother}
              className="flex-1"
            >
              Create Another Group
            </Button>
            <Button
              variant="outline"
              onClick={onViewDashboard}
              className="flex-1"
            >
              <ExternalLinkIcon className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </div>
        </div>

        {/* Phase 3 Achievement Badge */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="text-sm font-medium text-purple-900 mb-1">
            ✅ Phase 3: Database Integration Complete
          </div>
          <div className="text-xs text-purple-700 space-y-1">
            <div>• Group persisted to database successfully</div>
            <div>• Members added with proper validation</div>
            <div>• XMTP integration points established</div>
            <div>• Error handling and recovery implemented</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}