'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  VoteIcon,
  TimerIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  DollarSignIcon,
  UserIcon,
  CalendarIcon,
  ArrowRightIcon,
  ThumbsUpIcon,
  ThumbsDownIcon
} from 'lucide-react';
import { formatUSD, formatPercentage, getRelativeTime, formatAddress } from '@/lib/utils';

interface ActiveProposal {
  id: string;
  title: string;
  description: string;
  amount: string;
  type: 'deposit' | 'withdraw' | 'strategy' | 'governance';
  status: 'pending' | 'active' | 'passed' | 'failed' | 'executed';
  votesFor: number;
  votesAgainst: number;
  totalVotes: number;
  quorum: number;
  endTime: number;
  proposer: string;
  userVoted: boolean;
  userVote?: 'for' | 'against';
  executionData?: any;
}

interface GroupData {
  id: string;
  name: string;
  userRole: 'admin' | 'member';
  userVotingPower: number;
}

interface ProposalListProps {
  proposals: ActiveProposal[];
  groupData: GroupData;
  onProposalClick: (proposalId: string) => void;
}

export function ProposalList({ proposals, groupData, onProposalClick }: ProposalListProps) {
  const [votingProposal, setVotingProposal] = useState<string | null>(null);

  // Get proposal type icon and color
  const getProposalTypeIcon = (type: ActiveProposal['type']) => {
    switch (type) {
      case 'deposit':
        return <TrendingUpIcon className="w-5 h-5 text-green-600" />;
      case 'withdraw':
        return <TrendingDownIcon className="w-5 h-5 text-red-600" />;
      case 'strategy':
        return <DollarSignIcon className="w-5 h-5 text-blue-600" />;
      case 'governance':
        return <UserIcon className="w-5 h-5 text-purple-600" />;
      default:
        return <AlertCircleIcon className="w-5 h-5 text-gray-600" />;
    }
  };

  // Get proposal status icon and color
  const getProposalStatusIcon = (status: ActiveProposal['status']) => {
    switch (status) {
      case 'active':
        return <VoteIcon className="w-4 h-4 text-blue-500" />;
      case 'pending':
        return <TimerIcon className="w-4 h-4 text-yellow-500" />;
      case 'passed':
        return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="w-4 h-4 text-red-500" />;
      case 'executed':
        return <CheckCircleIcon className="w-4 h-4 text-emerald-500" />;
      default:
        return <AlertCircleIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  // Get status badge styling
  const getStatusBadge = (status: ActiveProposal['status']) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'passed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'executed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Calculate vote progress
  const getVoteProgress = (proposal: ActiveProposal) => {
    const totalPossibleVotes = proposal.votesFor + proposal.votesAgainst;
    const forPercentage = totalPossibleVotes > 0 ? (proposal.votesFor / totalPossibleVotes) * 100 : 0;
    const againstPercentage = totalPossibleVotes > 0 ? (proposal.votesAgainst / totalPossibleVotes) * 100 : 0;
    const quorumProgress = (proposal.totalVotes / proposal.quorum) * 100;
    
    return { forPercentage, againstPercentage, quorumProgress };
  };

  // Handle voting
  const handleVote = async (proposalId: string, vote: 'for' | 'against') => {
    setVotingProposal(proposalId);
    
    try {
     // Make API call to vote
     const response = await fetch('/api/votes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        proposalId,
        voterAddress: 'current-user-address', // Should come from wallet context
        vote: vote === 'for' ? 'approve' : 'reject',
        votingPower: groupData.userVotingPower.toString()
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to submit vote');
    }
    
    const result = await response.json();
    console.log('Vote submitted successfully:', result);
    
    // In a real app, this would trigger a refetch of proposals
    alert(`Vote submitted successfully! You voted ${vote}.`);
      
    } catch (error) {
      console.error('Failed to vote:', error);
      alert('Failed to submit vote. Please try again.');
    } finally {
      setVotingProposal(null);
    }
  };

  if (proposals.length === 0) {
    return (
      <Card className="rounded-2xl border-0 shadow-lg bg-white/70 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <VoteIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Proposals Found</h3>
            <p className="text-gray-600 mb-6">
              There are no investment proposals matching your current filter.
            </p>
            <Button className="bg-blue-600 hover:bg-blue-700">
              Create First Proposal
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {proposals.map((proposal) => {
        const { forPercentage, againstPercentage, quorumProgress } = getVoteProgress(proposal);
        const isExpired = proposal.endTime < Date.now();
        const canVote = !proposal.userVoted && !isExpired && proposal.status === 'active';
        
        return (
          <Card key={proposal.id} className="rounded-2xl border-0 shadow-lg bg-white/70 backdrop-blur-sm hover:shadow-xl transition-all duration-200">
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      {getProposalTypeIcon(proposal.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900">{proposal.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(proposal.status)}`}>
                          {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed">{proposal.description}</p>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onProposalClick(proposal.id)}
                    className="text-blue-600 hover:bg-blue-50"
                  >
                    View Details <ArrowRightIcon className="w-4 h-4 ml-1" />
                  </Button>
                </div>

                {/* Proposal Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center">
                      <DollarSignIcon className="w-4 h-4 text-gray-600 mr-2" />
                      <div>
                        <p className="text-xs text-gray-600">Amount</p>
                        <p className="font-semibold text-gray-900">{formatUSD(proposal.amount)}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center">
                      <UserIcon className="w-4 h-4 text-gray-600 mr-2" />
                      <div>
                        <p className="text-xs text-gray-600">Proposer</p>
                        <p className="font-semibold text-gray-900 font-mono text-sm">
                          {formatAddress(proposal.proposer)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center">
                      <CalendarIcon className="w-4 h-4 text-gray-600 mr-2" />
                      <div>
                        <p className="text-xs text-gray-600">
                          {isExpired ? 'Ended' : 'Ends'}
                        </p>
                        <p className="font-semibold text-gray-900">
                          {getRelativeTime(proposal.endTime)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Voting Progress */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getProposalStatusIcon(proposal.status)}
                      <span className="text-sm font-medium text-gray-700">
                        Voting Progress
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {proposal.totalVotes}/{proposal.quorum} votes needed
                    </div>
                  </div>

                  {/* Vote Bars */}
                  <div className="space-y-2">
                    {/* For votes */}
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2 w-20">
                        <ThumbsUpIcon className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-600">For</span>
                      </div>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${forPercentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-12">
                        {proposal.votesFor}
                      </span>
                    </div>

                    {/* Against votes */}
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2 w-20">
                        <ThumbsDownIcon className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium text-red-600">Against</span>
                      </div>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-red-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${againstPercentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-12">
                        {proposal.votesAgainst}
                      </span>
                    </div>

                    {/* Quorum progress */}
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2 w-20">
                        <VoteIcon className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-600">Quorum</span>
                      </div>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(quorumProgress, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-12">
                        {formatPercentage(quorumProgress, 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Voting Actions */}
                {canVote && (
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        Your voting power: <span className="font-medium">{formatPercentage(groupData.userVotingPower)}</span>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVote(proposal.id, 'against')}
                          disabled={votingProposal === proposal.id}
                          className="border-red-200 text-red-600 hover:bg-red-50"
                        >
                          {votingProposal === proposal.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600" />
                          ) : (
                            <>
                              <ThumbsDownIcon className="w-4 h-4 mr-1" />
                              Vote Against
                            </>
                          )}
                        </Button>
                        
                        <Button
                          size="sm"
                          onClick={() => handleVote(proposal.id, 'for')}
                          disabled={votingProposal === proposal.id}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {votingProposal === proposal.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          ) : (
                            <>
                              <ThumbsUpIcon className="w-4 h-4 mr-1" />
                              Vote For
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* User Vote Status */}
                {proposal.userVoted && (
                  <div className="border-t border-gray-200 pt-4">
                    <div className={`flex items-center space-x-2 text-sm ${
                      proposal.userVote === 'for' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {proposal.userVote === 'for' ? (
                        <ThumbsUpIcon className="w-4 h-4" />
                      ) : (
                        <ThumbsDownIcon className="w-4 h-4" />
                      )}
                      <span className="font-medium">
                        You voted {proposal.userVote} this proposal
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}