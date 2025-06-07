// src/components/investment/EnhancedInvestmentGroup.tsx
import { useState, useEffect } from 'react';
import { useXMTP } from '@/hooks/useXMTP';
import { useInvestmentAgent } from '@/hooks/useAgent';
import { useWallet } from '@/hooks/useWallet';
import { InvestmentProposal, InvestmentVote, ContentTypeInvestmentProposal, ContentTypeInvestmentVote } from '../../lib/content-types';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Input, Textarea, Label, FormField } from '../ui/input';
import { formatUSD, formatCrypto, getRelativeTime, formatAddress } from '../../lib/utils';
import { LoadingSpinner } from '@/components/providers/AppProviders';

interface InvestmentGroupProps {
  groupId: string;
  groupName: string;
}

interface ProposalWithVotes extends InvestmentProposal {
  votes: InvestmentVote[];
  userVote?: InvestmentVote;
  voteCount: {
    approve: number;
    reject: number;
    abstain: number;
  };
}

export function EnhancedInvestmentGroup({ groupId, groupName }: InvestmentGroupProps) {
  const { address } = useWallet();
  const { client, sendMessage, streamMessages } = useXMTP();
  const { executeStrategy, getBalance, isInitialized } = useInvestmentAgent();
  const [proposals, setProposals] = useState<ProposalWithVotes[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [balance, setBalance] = useState<any>(null);
  
  // Form states
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [newProposal, setNewProposal] = useState({
    title: '',
    description: '',
    amount: '',
    strategy: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (client) {
      // Stream messages for real-time updates
      streamMessages(groupId, (message) => {
        setMessages(prev => [...prev, message]);
        
        // Handle different message types (compare using toString)
        if (message.contentType?.toString?.() === ContentTypeInvestmentProposal.toString()) {
          const proposal = message.content as InvestmentProposal;
          setProposals(prev => [...prev, {
            ...proposal,
            votes: [],
            voteCount: { approve: 0, reject: 0, abstain: 0 }
          }]);
        } else if (message.contentType?.toString?.() === ContentTypeInvestmentVote.toString()) {
          const vote = message.content as InvestmentVote;
          updateProposalVotes(vote);
        }
      });

      // Load portfolio balance
      loadBalance();
    }
  }, [client, groupId]);

  const loadBalance = async () => {
    if (isInitialized) {
      try {
        const portfolioBalance = await getBalance();
        setBalance(portfolioBalance);
      } catch (error) {
        console.error('Failed to load balance:', error);
      }
    }
  };

  const validateProposal = () => {
    const errors: Record<string, string> = {};
    
    if (!newProposal.title.trim()) {
      errors.title = 'Title is required';
    }
    if (!newProposal.description.trim()) {
      errors.description = 'Description is required';
    }
    if (!newProposal.amount.trim()) {
      errors.amount = 'Amount is required';
    } else if (isNaN(parseFloat(newProposal.amount))) {
      errors.amount = 'Amount must be a valid number';
    }
    if (!newProposal.strategy.trim()) {
      errors.strategy = 'Strategy is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const createProposal = async () => {
    if (!client || !address || !validateProposal()) return;

    setIsLoading(true);
    try {
      const proposal: InvestmentProposal = {
        id: crypto.randomUUID(),
        title: newProposal.title,
        description: newProposal.description,
        amount: newProposal.amount,
        strategy: newProposal.strategy,
        deadline: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        requiredVotes: 3, // Minimum votes needed
        proposedBy: address,
        timestamp: Date.now(),
      };

      await sendMessage(groupId, proposal, 'investment-proposal');
      setNewProposal({ title: '', description: '', amount: '', strategy: '' });
      setShowProposalForm(false);
      setFormErrors({});
    } catch (error) {
      console.error('Failed to create proposal:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const voteOnProposal = async (proposalId: string, vote: 'approve' | 'reject') => {
    if (!client || !address) return;

    setIsLoading(true);
    try {
      const voteMessage: InvestmentVote = {
        proposalId,
        vote,
        voterAddress: address,
        timestamp: Date.now(),
        votingPower: 1, // Could be dynamic based on contribution
      };

      await sendMessage(groupId, voteMessage, 'investment-vote');
    } catch (error) {
      console.error('Failed to vote:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const executeProposal = async (proposal: InvestmentProposal) => {
    if (!isInitialized) return;
    
    setIsLoading(true);
    try {
      const result = await executeStrategy(proposal.strategy, proposal.amount);
      
      // Send execution result to group
      await sendMessage(
        groupId, 
        `✅ Proposal "${proposal.title}" executed successfully! ${result.summary}`,
        'text'
      );

      // Refresh balance after execution
      await loadBalance();
    } catch (error) {
      console.error('Proposal execution failed:', error);
      await sendMessage(
        groupId,
        `❌ Failed to execute proposal "${proposal.title}": ${error}`,
        'text'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const updateProposalVotes = (vote: InvestmentVote) => {
    setProposals(prev => prev.map(proposal => {
      if (proposal.id === vote.proposalId) {
        const updatedVotes = [...proposal.votes.filter(v => v.voterAddress !== vote.voterAddress), vote];
        const voteCount = updatedVotes.reduce(
          (acc, v) => {
            acc[v.vote]++;
            return acc;
          },
          { approve: 0, reject: 0, abstain: 0 }
        );
        
        return {
          ...proposal,
          votes: updatedVotes,
          voteCount,
          userVote: vote.voterAddress === address ? vote : proposal.userVote,
        };
      }
      return proposal;
    }));
  };

  const getProposalStatus = (proposal: ProposalWithVotes) => {
    if (Date.now() > proposal.deadline) {
      return proposal.voteCount.approve >= proposal.requiredVotes ? 'approved' : 'expired';
    }
    if (proposal.voteCount.approve >= proposal.requiredVotes) {
      return 'ready-to-execute';
    }
    return 'active';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-50 border-green-200';
      case 'ready-to-execute': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'expired': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header with Group Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{groupName}</CardTitle>
              <p className="text-gray-600 mt-1">Investment Coordination Group</p>
            </div>
            {balance && (
              <div className="text-right">
                <p className="text-sm text-gray-600">Portfolio Value</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatUSD(balance.totalUsdValue || '0')}
                </p>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Portfolio Summary */}
      {balance && (
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {balance.balances.map((asset: any, index: number) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <p className="font-medium">{asset.asset}</p>
                  <p className="text-lg">{formatCrypto(asset.amount, asset.asset)}</p>
                  {asset.usdValue && (
                    <p className="text-sm text-gray-600">{formatUSD(asset.usdValue)}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Proposal Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Investment Proposals</CardTitle>
            <Button 
              onClick={() => setShowProposalForm(!showProposalForm)}
              disabled={isLoading}
            >
              {showProposalForm ? 'Cancel' : 'New Proposal'}
            </Button>
          </div>
        </CardHeader>
        
        {showProposalForm && (
          <CardContent className="border-t">
            <div className="space-y-4">
              <FormField label="Proposal Title" error={formErrors.title} required>
                <Input
                  placeholder="e.g., Invest in DeFi yield farming"
                  value={newProposal.title}
                  onChange={(e) => setNewProposal(prev => ({ ...prev, title: e.target.value }))}
                />
              </FormField>

              <FormField label="Description" error={formErrors.description} required>
                <Textarea
                  placeholder="Describe the investment opportunity and rationale"
                  value={newProposal.description}
                  onChange={(e) => setNewProposal(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </FormField>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Amount (USDC)" error={formErrors.amount} required>
                  <Input
                    type="number"
                    placeholder="1000"
                    value={newProposal.amount}
                    onChange={(e) => setNewProposal(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </FormField>
              </div>

              <FormField label="Investment Strategy" error={formErrors.strategy} required>
                <Textarea
                  placeholder="Detailed strategy for the AI agent to execute"
                  value={newProposal.strategy}
                  onChange={(e) => setNewProposal(prev => ({ ...prev, strategy: e.target.value }))}
                  rows={4}
                />
              </FormField>

              <div className="flex gap-2">
                <Button onClick={createProposal} disabled={isLoading}>
                  {isLoading ? <LoadingSpinner size="sm" /> : 'Create Proposal'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowProposalForm(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Active Proposals */}
      <div className="space-y-4">
        {proposals.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-500">No proposals yet. Create the first one!</p>
            </CardContent>
          </Card>
        ) : (
          proposals.map((proposal) => {
            const status = getProposalStatus(proposal);
            const hasUserVoted = !!proposal.userVote;
            const canExecute = status === 'ready-to-execute' && !hasUserVoted;
            
            return (
              <Card key={proposal.id} className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{proposal.title}</CardTitle>
                      <p className="text-sm text-gray-500">
                        By {formatAddress(proposal.proposedBy)} • {getRelativeTime(proposal.timestamp)}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(status)}`}>
                      {status.replace('-', ' ')}
                    </span>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <p className="text-gray-600 mb-4">{proposal.description}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="font-semibold">Amount: {formatUSD(proposal.amount)}</p>
                      <p className="text-sm text-gray-500">Deadline: {new Date(proposal.deadline).toLocaleDateString()}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium mb-2">Votes Required: {proposal.requiredVotes}</p>
                      <div className="flex gap-2">
                        <span className="text-green-600">✓ {proposal.voteCount.approve}</span>
                        <span className="text-red-600">✗ {proposal.voteCount.reject}</span>
                        <span className="text-gray-600">- {proposal.voteCount.abstain}</span>
                      </div>
                    </div>
                  </div>

                  <details className="mb-4">
                    <summary className="cursor-pointer text-sm font-medium text-gray-700">
                      View Strategy Details
                    </summary>
                    <div className="mt-2 p-3 bg-gray-50 rounded text-sm">
                      {proposal.strategy}
                    </div>
                  </details>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {!hasUserVoted && status === 'active' && (
                      <>
                        <Button 
                          onClick={() => voteOnProposal(proposal.id, 'approve')}
                          className="bg-green-600 hover:bg-green-700"
                          disabled={isLoading}
                        >
                          {isLoading ? <LoadingSpinner size="sm" /> : 'Approve'}
                        </Button>
                        <Button 
                          onClick={() => voteOnProposal(proposal.id, 'reject')}
                          variant="destructive"
                          disabled={isLoading}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    
                    {canExecute && (
                      <Button 
                        onClick={() => executeProposal(proposal)}
                        className="bg-blue-600 hover:bg-blue-700"
                        disabled={isLoading}
                      >
                        {isLoading ? <LoadingSpinner size="sm" /> : 'Execute'}
                      </Button>
                    )}

                    {hasUserVoted && (
                      <span className="px-3 py-2 bg-gray-100 rounded text-sm">
                        You voted: {proposal.userVote?.vote}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}