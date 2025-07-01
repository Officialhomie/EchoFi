'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUpIcon, 
  PieChartIcon,
  DollarSignIcon,
  UsersIcon,
  BarChart3Icon,
  PlusIcon,
  FilterIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  ActivityIcon,
  CrownIcon,
  VoteIcon,
  TimerIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon
} from 'lucide-react';
import { formatUSD, formatPercentage, getRelativeTime, formatAddress } from '@/lib/utils';
import { PortfolioChart } from './PortfolioChart';
import { ProposalList } from './ProposalList';
import { InvestmentMetrics } from './InvestmentMetrics';
import { ProposalCreation } from './ProposalCreation';

// Types for Group Investment Dashboard
interface GroupData {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  totalInvestment: string;
  currentValue: string;
  totalReturn: string;
  returnPercentage: number;
  treasuryAddress: string;
  createdAt: number;
  lastActivity: number;
  userRole: 'admin' | 'member';
  userVotingPower: number;
}

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

interface GroupInvestmentDashboardProps {
  groupId: string;
  onBack: () => void;
}

export function GroupInvestmentDashboard({ groupId, onBack }: GroupInvestmentDashboardProps) {
  const [groupData, setGroupData] = useState<GroupData | null>(null);
  const [proposals, setProposals] = useState<ActiveProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'proposals' | 'analytics' | 'settings'>('overview');
  const [showCreateProposal, setShowCreateProposal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'pending' | 'completed'>('all');

  //  Load real data from API
  useEffect(() => {
    const loadGroupData = async () => {
      setLoading(true);
      try {
        // Load group data from API
        const groupResponse = await fetch(`/api/groups?id=${groupId}`);
        if (!groupResponse.ok) {
          throw new Error('Failed to load group data');
        }
        const groupResult = await groupResponse.json();
        const group = groupResult.group;

        // Load analytics for the group
        const analyticsResponse = await fetch(`/api/analytics?groupId=${groupId}`);
        let analytics = null;
        if (analyticsResponse.ok) {
          analytics = await analyticsResponse.json();
        }

        // Transform API data to component format
        const groupData: GroupData = {
          id: group.id,
          name: group.name || 'Investment Group',
          description: group.description || 'A collaborative investment group on Base network.',
          memberCount: group.memberCount || 1,
          totalInvestment: group.totalFunds || '0',
          currentValue: group.totalFunds || '0', // In real app, calculate current value from strategies
          totalReturn: '0', // Calculate from current vs initial value
          returnPercentage: 0, // Calculate percentage return
          treasuryAddress: group.treasuryAddress || '0x0000000000000000000000000000000000000000',
          createdAt: group.createdAt ? new Date(group.createdAt).getTime() : Date.now(),
          lastActivity: Date.now() - (2 * 60 * 60 * 1000), // Mock last activity
          userRole: 'member', // In real app, determine from group membership
          userVotingPower: 10.0 // In real app, get from member data
        };

        setGroupData(groupData);

        // Load proposals for the group
        const proposalsResponse = await fetch(`/api/proposals?groupId=${groupId}`);
        if (proposalsResponse.ok) {
          const proposalsResult = await proposalsResponse.json();
          const apiProposals = proposalsResult.proposals || [];

          // Transform API proposals to component format
          const transformedProposals: ActiveProposal[] = apiProposals.map((proposal: any) => ({
            id: proposal.id,
            title: proposal.title,
            description: proposal.description,
            amount: proposal.requestedAmount || '0',
            type: mapStrategyToType(proposal.strategy),
            status: mapApiStatusToComponentStatus(proposal.status),
            votesFor: proposal.approvalVotes || 0,
            votesAgainst: proposal.rejectionVotes || 0,
            totalVotes: (proposal.approvalVotes || 0) + (proposal.rejectionVotes || 0),
            quorum: proposal.requiredVotes || 5,
            endTime: proposal.deadline ? new Date(proposal.deadline).getTime() : Date.now() + (7 * 24 * 60 * 60 * 1000),
            proposer: proposal.proposedBy || '0x0000000000000000000000000000000000000000',
            userVoted: false, // In real app, check if current user voted
            userVote: undefined
          }));

          setProposals(transformedProposals);
        }

      } catch (error) {
        console.error('Failed to load group data:', error);
        // Fallback to minimal data structure to prevent crashes
        const fallbackGroupData: GroupData = {
          id: groupId,
          name: 'Investment Group',
          description: 'Unable to load group details.',
          memberCount: 1,
          totalInvestment: '0',
          currentValue: '0',
          totalReturn: '0',
          returnPercentage: 0,
          treasuryAddress: '0x0000000000000000000000000000000000000000',
          createdAt: Date.now(),
          lastActivity: Date.now(),
          userRole: 'member',
          userVotingPower: 0
        };
        setGroupData(fallbackGroupData);
        setProposals([]);
      } finally {
      setLoading(false);
      }
    };

    // Helper functions to map API data to component format
    const mapStrategyToType = (strategy: string): ActiveProposal['type'] => {
      if (strategy?.toLowerCase().includes('withdraw')) return 'withdraw';
      if (strategy?.toLowerCase().includes('governance')) return 'governance';
      if (strategy?.toLowerCase().includes('strategy')) return 'strategy';
      return 'deposit';
    };

    const mapApiStatusToComponentStatus = (status: string): ActiveProposal['status'] => {
      switch (status?.toLowerCase()) {
        case 'active': return 'active';
        case 'pending': return 'pending';
        case 'approved': return 'passed';
        case 'rejected': return 'failed';
        case 'executed': return 'executed';
        default: return 'pending';
      }
    };

    loadGroupData();
  }, [groupId]);

  // Filter proposals based on selected filter
  const filteredProposals = useMemo(() => {
    switch (filter) {
      case 'active':
        return proposals.filter(p => p.status === 'active');
      case 'pending':
        return proposals.filter(p => p.status === 'pending');
      case 'completed':
        return proposals.filter(p => ['passed', 'failed', 'executed'].includes(p.status));
      default:
        return proposals;
    }
  }, [proposals, filter]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading group dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!groupData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <AlertCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Group Not Found</h2>
            <p className="text-gray-600 mb-6">The requested investment group could not be loaded.</p>
            <Button onClick={onBack} variant="outline">
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* iOS-style Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onBack}
                className="text-blue-600 hover:bg-blue-50"
              >
                ← Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  {groupData.name}
                  {groupData.userRole === 'admin' && (
                    <CrownIcon className="w-5 h-5 text-yellow-500 ml-2" />
                  )}
                </h1>
                <p className="text-sm text-gray-500 flex items-center">
                  <UsersIcon className="w-4 h-4 mr-1" />
                  {groupData.memberCount} members • 
                  <span className="ml-1">Last activity {getRelativeTime(groupData.lastActivity)}</span>
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => setShowCreateProposal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg transition-all duration-200"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                New Proposal
              </Button>
            </div>
          </div>

          {/* iOS-style Tab Navigation */}
          <div className="flex space-x-1 mt-6 bg-gray-100 rounded-lg p-1">
            {[
              { id: 'overview', label: 'Overview', icon: PieChartIcon },
              { id: 'proposals', label: 'Proposals', icon: VoteIcon },
              { id: 'analytics', label: 'Analytics', icon: BarChart3Icon },
              { id: 'settings', label: 'Settings', icon: ActivityIcon }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="rounded-2xl border-0 shadow-lg bg-white/70 backdrop-blur-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <div className="p-3 bg-green-100 rounded-xl">
                      <DollarSignIcon className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Investment</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatUSD(groupData.totalInvestment)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-0 shadow-lg bg-white/70 backdrop-blur-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <div className="p-3 bg-blue-100 rounded-xl">
                      <TrendingUpIcon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Current Value</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatUSD(groupData.currentValue)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-0 shadow-lg bg-white/70 backdrop-blur-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <div className="p-3 bg-emerald-100 rounded-xl">
                      <ArrowUpIcon className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Return</p>
                      <div className="flex items-center">
                        <p className="text-2xl font-bold text-gray-900">
                          {formatUSD(groupData.totalReturn)}
                        </p>
                        <span className="ml-2 text-sm text-emerald-600 font-medium">
                          {formatPercentage(groupData.returnPercentage)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-0 shadow-lg bg-white/70 backdrop-blur-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <div className="p-3 bg-purple-100 rounded-xl">
                      <VoteIcon className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Voting Power</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatPercentage(groupData.userVotingPower)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Portfolio Chart and Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <PortfolioChart groupId={groupId} />
              </div>
              <div className="space-y-4">
                <InvestmentMetrics groupId={groupId} />
              </div>
            </div>

            {/* Recent Proposals Preview */}
            <Card className="rounded-2xl border-0 shadow-lg bg-white/70 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <VoteIcon className="w-5 h-5 mr-2 text-blue-600" />
                    Recent Proposals
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setActiveTab('proposals')}
                    className="text-blue-600 hover:bg-blue-50"
                  >
                    View All <ChevronRightIcon className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {proposals.slice(0, 3).map((proposal) => (
                    <div
                      key={proposal.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center space-x-3">
                        {getProposalStatusIcon(proposal.status)}
                        <div>
                          <h4 className="font-medium text-gray-900">{proposal.title}</h4>
                          <p className="text-sm text-gray-500">
                            {formatUSD(proposal.amount)} • Ends {getRelativeTime(proposal.endTime)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {proposal.votesFor}/{proposal.quorum} votes
                        </div>
                        <div className="text-xs text-gray-500 capitalize">
                          {proposal.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'proposals' && (
          <div className="space-y-6">
            {/* Filter Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Investment Proposals</h2>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1 bg-white rounded-lg border border-gray-200 p-1">
                  <FilterIcon className="w-4 h-4 text-gray-500 ml-2" />
                  {['all', 'active', 'pending', 'completed'].map((filterOption) => (
                    <button
                      key={filterOption}
                      onClick={() => setFilter(filterOption as any)}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        filter === filterOption
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <ProposalList 
              proposals={filteredProposals} 
              groupData={groupData}
              onProposalClick={(proposalId) => {
                console.log('View proposal:', proposalId);
              }}
            />
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Investment Analytics</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PortfolioChart groupId={groupId} detailed={true} />
              <InvestmentMetrics groupId={groupId} detailed={true} />
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Group Settings</h2>
            <Card className="rounded-2xl border-0 shadow-lg bg-white/70 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Group Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Group Name</label>
                        <p className="mt-1 text-sm text-gray-900">{groupData.name}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Treasury Address</label>
                        <p className="mt-1 text-sm text-gray-900 font-mono">
                          {formatAddress(groupData.treasuryAddress)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Your Role</label>
                        <p className="mt-1 text-sm text-gray-900 capitalize">
                          {groupData.userRole}
                          {groupData.userRole === 'admin' && (
                            <CrownIcon className="w-4 h-4 inline ml-1 text-yellow-500" />
                          )}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Voting Power</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {formatPercentage(groupData.userVotingPower)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
                    <p className="text-sm text-gray-600">{groupData.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Create Proposal Modal */}
      {showCreateProposal && groupData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Create New Proposal</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateProposal(false)}
                >
                  ✕
                </Button>
              </div>
              <ProposalCreation
                groupId={groupId}
                treasuryAddress={groupData.treasuryAddress as `0x${string}`}
                onSuccess={(txHash) => {
                  console.log('Proposal created:', txHash);
                  setShowCreateProposal(false);
                  // Refresh proposals by reloading the component
                  window.location.reload();
                }}
                onCancel={() => setShowCreateProposal(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}