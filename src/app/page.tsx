'use client';

import { useState } from 'react';
import { ConnectWallet } from '@/components/wallet/ConnectWallet';
import { InvestmentGroup } from '@/components/investment/InvestmentGroup';
import { useWallet } from '@/hooks/useWallet';
import { useXMTP } from '@/hooks/useXMTP';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function HomePage() {
  const { isConnected, address } = useWallet();
  const { client, createGroup } = useXMTP();
  const [currentGroup, setCurrentGroup] = useState<string | null>(null);
  const [groups, setGroups] = useState<any[]>([]);

  const handleCreateGroup = async () => {
    if (!client) return;

    const groupName = prompt('Enter group name:');
    if (!groupName) return;

    const group = await createGroup(
      groupName,
      'Investment coordination group',
      [address] // Start with just creator, add members later
    );

    setGroups(prev => [...prev, group]);
    setCurrentGroup(group.id);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-center text-2xl">Welcome to EchoFi</CardTitle>
            <p className="text-center text-gray-600">
              Transform group chats into investment DAOs
            </p>
          </CardHeader>
          <CardContent>
            <ConnectWallet />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentGroup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">EchoFi Dashboard</h1>
            <p className="text-xl text-gray-600">
              Create or join investment groups to start coordinating with friends
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Create New Group</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Start a new investment group and invite friends to coordinate investments together.
                </p>
                <Button onClick={handleCreateGroup} className="w-full">
                  Create Investment Group
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>My Groups</CardTitle>
              </CardHeader>
              <CardContent>
                {groups.length === 0 ? (
                  <p className="text-gray-500">No groups yet. Create your first group!</p>
                ) : (
                  <div className="space-y-2">
                    {groups.map((group) => (
                      <Button
                        key={group.id}
                        variant="outline"
                        onClick={() => setCurrentGroup(group.id)}
                        className="w-full justify-start"
                      >
                        {group.name}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const selectedGroup = groups.find(g => g.id === currentGroup);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="p-6">
        <div className="mb-4">
          <Button 
            variant="outline" 
            onClick={() => setCurrentGroup(null)}
          >
            ← Back to Dashboard
          </Button>
        </div>
        <InvestmentGroup 
          groupId={currentGroup} 
          groupName={selectedGroup?.name || 'Investment Group'} 
        />
      </div>
    </div>
  );
}