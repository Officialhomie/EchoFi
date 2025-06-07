import { useState, useEffect } from 'react';
import { useXMTP } from '@/hooks/useXMTP';
import { useInvestmentAgent } from '@/hooks/useAgent';
import { InvestmentProposal, InvestmentVote } from '@/lib/content-types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface InvestmentGroupProps {
  groupId: string;
  groupName: string;
}

export function InvestmentGroup({ groupId, groupName }: InvestmentGroupProps) {
  const { client, sendMessage, streamMessages } = useXMTP();
  const { executeStrategy, getBalance, isInitialized } = useInvestmentAgent();
  const [proposals, setProposals] = useState<InvestmentProposal[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newProposal, setNewProposal] = useState({
    title: '',
    description: '',
    amount: '',
    strategy: '',
  });

  useEffect(() => {
    if (client) {
      // Stream messages for real-time updates
      streamMessages(groupId, (message) => {
        setMessages(prev => [...prev, message]);
        
        // Handle different message types
        if (message.contentType === 'investment-proposal') {
          const proposal = message.content as InvestmentProposal;
          setProposals(prev => [...prev, proposal]);
        }
      });
    }
  }, [client, groupId]);

  const createProposal = async () => {
    if (!client) return;

    const proposal: InvestmentProposal = {
      id: crypto.randomUUID(),
      title: newProposal.title,
      description: newProposal.description,
      amount: newProposal.amount,
      strategy: newProposal.strategy,
      deadline: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      requiredVotes: 3, // Minimum votes needed
      proposedBy: client.address,
      timestamp: Date.now(),
    };

    await sendMessage(groupId, proposal, 'investment-proposal');
    setNewProposal({ title: '', description: '', amount: '', strategy: '' });
  };

  const voteOnProposal = async (proposalId: string, vote: 'approve' | 'reject') => {
    if (!client) return;

    const voteMessage: InvestmentVote = {
      proposalId,
      vote,
      voterAddress: client.address,
      timestamp: Date.now(),
      votingPower: 1, // Could be dynamic based on contribution
    };

    await sendMessage(groupId, voteMessage, 'investment-vote');
  };

  const executeProposal = async (proposal: InvestmentProposal) => {
    if (!isInitialized) return;
    
    try {
      const result = await executeStrategy(proposal.strategy, proposal.amount);
      
      // Send execution result to group
      await sendMessage(
        groupId, 
        `✅ Proposal "${proposal.title}" executed successfully! ${result}`,
        'text'
      );
    } catch (error) {
      console.error('Proposal execution failed:', error);
      await sendMessage(
        groupId,
        `❌ Failed to execute proposal "${proposal.title}": ${error}`,
        'text'
      );
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{groupName} Investment Group</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Create New Proposal Form */}
          <div className="space-y-4 mb-6">
            <h3 className="text-lg font-semibold">Create Investment Proposal</h3>
            <input
              type="text"
              placeholder="Proposal Title"
              value={newProposal.title}
              onChange={(e) => setNewProposal(prev => ({ ...prev, title: e.target.value }))}
              className="w-full p-2 border rounded"
            />
            <textarea
              placeholder="Description"
              value={newProposal.description}
              onChange={(e) => setNewProposal(prev => ({ ...prev, description: e.target.value }))}
              className="w-full p-2 border rounded h-24"
            />
            <input
              type="text"
              placeholder="Amount (USDC)"
              value={newProposal.amount}
              onChange={(e) => setNewProposal(prev => ({ ...prev, amount: e.target.value }))}
              className="w-full p-2 border rounded"
            />
            <textarea
              placeholder="Investment Strategy"
              value={newProposal.strategy}
              onChange={(e) => setNewProposal(prev => ({ ...prev, strategy: e.target.value }))}
              className="w-full p-2 border rounded h-24"
            />
            <Button onClick={createProposal} className="w-full">
              Create Proposal
            </Button>
          </div>

          {/* Active Proposals */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Active Proposals</h3>
            {proposals.map((proposal) => (
              <Card key={proposal.id} className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <CardTitle className="text-lg">{proposal.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-2">{proposal.description}</p>
                  <p className="font-semibold">Amount: {proposal.amount} USDC</p>
                  <p className="text-sm text-gray-500 mb-4">{proposal.strategy}</p>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => voteOnProposal(proposal.id, 'approve')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Approve
                    </Button>
                    <Button 
                      onClick={() => voteOnProposal(proposal.id, 'reject')}
                      variant="destructive"
                    >
                      Reject
                    </Button>
                    <Button 
                      onClick={() => executeProposal(proposal)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Execute
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}