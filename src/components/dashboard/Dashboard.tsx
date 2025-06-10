'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useXMTP } from '@/hooks/useXMTP';
import { useInvestmentAgent } from '@/hooks/useAgent';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/providers/AppProviders';
import { formatUSD, formatCrypto, getRelativeTime, formatAddress, formatPercentage } from '@/lib/utils';
import { 
  WalletIcon, 
  TrendingUpIcon, 
  UsersIcon, 
  ActivityIcon,
  PlusIcon,
  BarChartIcon,
  DollarSignIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from 'lucide-react';

interface DashboardProps {
  onViewGroups: () => void;
  onJoinGroup: (groupId: string, groupName: string) => void;
}

interface PortfolioData {
  totalValue: string;
  change24h: number;
  assets: Array<{
    symbol: string;
    amount: string;
    value: string;
    change24h: number;
  }>;
}

interface GroupSummary {
  id: string;
  name: string;
  memberCount: number;
  totalFunds: string;
  activeProposals: number;
  totalProposals: number;
  lastActivity: number;
}

export function Dashboard({ onViewGroups, onJoinGroup }: DashboardProps) {
  const { address } = useWallet();
  const { conversations } = useXMTP();
  const { getBalance, analyzePerformance, isInitialized } = useInvestmentAgent();
  
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [performanceAnalysis, setPerformanceAnalysis] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const loadPortfolio = useCallback(async () => {
    if (!isInitialized) return;

    try {
      const balance = await getBalance();
      
      // Mock price changes for demo (in real app, fetch from price API)
      const mockChanges = [2.5, -1.2, 0.8, 3.1, -0.5];
      
      const portfolioData: PortfolioData = {
        totalValue: balance.totalUsdValue || '0',
        change24h: 2.3, // Mock 24h change
        assets: balance.balances.map((asset: { asset: string; amount: string; usdValue?: string }, index: number) => ({
          symbol: asset.asset,
          amount: asset.amount,
          value: asset.usdValue || '0',
          change24h: mockChanges[index % mockChanges.length],
        })),
      };

      setPortfolio(portfolioData);
    } catch (error) {
      console.error('Failed to load portfolio:', error);
      setError('Failed to load portfolio data');
    }
  }, [isInitialized, getBalance]);

  // ✅ FIXED: Load actual groups with real proposal counts
  const loadGroups = useCallback(async () => {
    if (!address) return;

    try {
      // Fetch user's groups from API
      const groupsResponse = await fetch(`/api/groups?address=${address}`);
      if (!groupsResponse.ok) {
        throw new Error('Failed to fetch groups');
      }
      const { groups: userGroups } = await groupsResponse.json();

      // Fetch proposal counts for each group
      const groupSummaries: GroupSummary[] = await Promise.all(
        userGroups.map(async (userGroup: any) => {
          try {
            // Get all proposals for this group
            const proposalsResponse = await fetch(`/api/proposals?groupId=${userGroup.group.id}`);
            if (!proposalsResponse.ok) {
              console.warn(`Failed to fetch proposals for group ${userGroup.group.id}`);
              return createFallbackGroupSummary(userGroup);
            }

            const { proposals } = await proposalsResponse.json();
            
            // Count active proposals
            const activeProposals = proposals.filter((p: any) => 
              p.status === 'active' && new Date(p.deadline) > new Date()
            ).length;

            return {
              id: userGroup.group.id,
              name: userGroup.group.name || 'Unnamed Group',
              memberCount: userGroup.group.memberCount || 1,
              totalFunds: userGroup.group.totalFunds || '0',
              activeProposals,
              totalProposals: proposals.length,
              lastActivity: new Date(userGroup.member.joinedAt).getTime(),
            };
          } catch (error) {
            console.error(`Error loading data for group ${userGroup.group.id}:`, error);
            return createFallbackGroupSummary(userGroup);
          }
        })
      );

      // Also map XMTP conversations that might not be in database yet
      const conversationGroups = conversations
        .filter(conv => !groupSummaries.find(g => g.id === conv.id))
        .map(conv => ({
          id: conv.id,
          name: conv.name || 'Unnamed Group',
          memberCount: 1, // Will be updated when group is synced to database
          totalFunds: '0',
          activeProposals: 0,
          totalProposals: 0,
          lastActivity: conv.createdAtNs ? Number(conv.createdAtNs) : Date.now(),
        }));

      setGroups([...groupSummaries, ...conversationGroups]);
    } catch (error) {
      console.error('Failed to load groups:', error);
      setError('Failed to load groups data');
      
      // Fallback to XMTP conversations only
      const fallbackGroups = conversations.map(conv => ({
        id: conv.id,
        name: conv.name || 'Unnamed Group',
        memberCount: 1,
        totalFunds: '0',
        activeProposals: 0,
        totalProposals: 0,
        lastActivity: conv.createdAtNs ? Number(conv.createdAtNs) : Date.now(),
      }));
      setGroups(fallbackGroups);
    }
  }, [address, conversations]);

  const createFallbackGroupSummary = (userGroup: any): GroupSummary => ({
    id: userGroup.group.id,
    name: userGroup.group.name || 'Unnamed Group',
    memberCount: userGroup.group.memberCount || 1,
    totalFunds: userGroup.group.totalFunds || '0',
    activeProposals: 0, // Safe fallback
    totalProposals: 0,  // Safe fallback
    lastActivity: new Date(userGroup.member.joinedAt).getTime(),
  });

  const loadPerformanceAnalysis = useCallback(async () => {
    if (!isInitialized) return;

    try {
      const analysis = await analyzePerformance('7d');
      setPerformanceAnalysis(analysis);
    } catch (error) {
      console.error('Failed to load performance analysis:', error);
      setError('Failed to load performance analysis');
    }
  }, [isInitialized, analyzePerformance]);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await Promise.allSettled([
        loadPortfolio(),
        loadGroups(),
        loadPerformanceAnalysis(),
      ]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [loadPortfolio, loadGroups, loadPerformanceAnalysis]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Refresh data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLoading) {
        loadGroups(); // Refresh group data for updated proposal counts
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loadGroups, isLoading]);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center py-12">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadDashboardData}>Try Again</Button>
        </div>
      </div>
    );
  }

  // ✅ FIXED: Calculate totals from real data
  const totalActiveProposals = groups.reduce((sum, group) => sum + group.activeProposals, 0);
  const totalProposals = groups.reduce((sum, group) => sum + group.totalProposals, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Welcome Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back!
        </h1>
        <p className="text-gray-600">
          Here&apos;s an overview of your investment activity and portfolio performance
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <DollarSignIcon className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Portfolio</p>
                <div className="flex items-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {formatUSD(portfolio?.totalValue || '0')}
                  </p>
                  {portfolio && (
                    <span className={`ml-2 flex items-center text-sm ${
                      portfolio.change24h >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {portfolio.change24h >= 0 ? (
                        <ArrowUpIcon className="w-3 h-3 mr-1" />
                      ) : (
                        <ArrowDownIcon className="w-3 h-3 mr-1" />
                      )}
                      {formatPercentage(Math.abs(portfolio.change24h))}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <UsersIcon className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Groups</p>
                <p className="text-2xl font-bold text-gray-900">{groups.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <BarChartIcon className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Proposals</p>
                <p className="text-2xl font-bold text-gray-900">{totalActiveProposals}</p>
                <p className="text-xs text-gray-500">{totalProposals} total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <WalletIcon className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Connected Wallet</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatAddress(address || '')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Overview */}
      {portfolio && portfolio.assets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUpIcon className="w-5 h-5 mr-2" />
              Portfolio Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {portfolio.assets.map((asset, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{asset.symbol}</span>
                    <span className={`text-sm flex items-center ${
                      asset.change24h >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {asset.change24h >= 0 ? (
                        <ArrowUpIcon className="w-3 h-3 mr-1" />
                      ) : (
                        <ArrowDownIcon className="w-3 h-3 mr-1" />
                      )}
                      {formatPercentage(Math.abs(asset.change24h))}
                    </span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCrypto(asset.amount, asset.symbol)}
                  </p>
                  <p className="text-sm text-gray-600">{formatUSD(asset.value)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Investment Groups */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <UsersIcon className="w-5 h-5 mr-2" />
                Your Groups
              </CardTitle>
              <Button size="sm" onClick={onViewGroups}>
                <PlusIcon className="w-4 h-4 mr-1" />
                Manage
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {groups.length === 0 ? (
              <div className="text-center py-8">
                <UsersIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No groups yet</h3>
                <p className="text-gray-600 mb-4">
                  Create or join investment groups to start coordinating with others.
                </p>
                <Button onClick={onViewGroups}>Create Your First Group</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.slice(0, 3).map((group) => (
                  <div
                    key={group.id}
                    className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors cursor-pointer"
                    onClick={() => onJoinGroup(group.id, group.name)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{group.name}</h4>
                        <p className="text-sm text-gray-600">
                          {group.memberCount} members • {group.activeProposals} active proposals
                        </p>
                        <p className="text-xs text-gray-500">
                          Last activity {getRelativeTime(group.lastActivity)}
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        Open →
                      </Button>
                    </div>
                  </div>
                ))}
                {groups.length > 3 && (
                  <Button variant="outline" onClick={onViewGroups} className="w-full">
                    View All {groups.length} Groups
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ActivityIcon className="w-5 h-5 mr-2" />
              AI Performance Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {performanceAnalysis ? (
              <div className="prose prose-sm max-w-none">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="whitespace-pre-wrap text-sm text-blue-900">
                    {performanceAnalysis.slice(0, 300)}
                    {performanceAnalysis.length > 300 && '...'}
                  </div>
                  {performanceAnalysis.length > 300 && (
                    <Button variant="outline" size="sm" className="mt-3">
                      Read Full Analysis
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <BarChartIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No analysis yet</h3>
                <p className="text-gray-600">
                  Start investing through groups to get AI-powered performance insights.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Ready to get started?</h3>
            <p className="text-blue-700 mb-4">
              Create your first investment group or join an existing one to begin coordinating investments.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={onViewGroups} className="bg-blue-600 hover:bg-blue-700">
                Create Investment Group
              </Button>
              <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
                Learn How It Works
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}