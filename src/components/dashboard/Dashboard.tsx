// src/components/dashboard/Dashboard.tsx - Updated with AgentKit Status
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useXMTP } from '@/hooks/useXMTP';
import { useInvestmentAgent } from '@/hooks/useAgent';
import { AgentStatus, AgentStatusCompact } from '@/components/agent/AgentStatus';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/loading';
import { formatUSD, formatCrypto, getRelativeTime, formatAddress, formatPercentage } from '@/lib/utils';
import { API_ENDPOINTS, UI_CONFIG } from '@/lib/config/app';
import { DecodedMessage } from '@xmtp/browser-sdk';
import { 
  WalletIcon, 
  TrendingUpIcon, 
  UsersIcon, 
  ActivityIcon,
  PlusIcon,
  BarChartIcon,
  DollarSignIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  BotIcon,
  AlertTriangle
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

interface BalanceAsset {
  asset: string;
  amount: string;
  usdValue?: string;
}

interface BalanceResponse {
  address: string;
  balances: BalanceAsset[];
  totalUsdValue?: string;
}

// Move these functions outside the Dashboard component for export
const loadPortfolio = async (
  agentInitialized: boolean,
  getBalance: () => Promise<BalanceResponse>,
  setPortfolio: (p: PortfolioData) => void,
  setError: (e: string | null) => void,
  error: string | null
) => {
  if (!agentInitialized) {
    console.log('🔄 [FIXED] Agent not initialized, skipping portfolio load');
    return;
  }

  try {
    console.log('🔄 [FIXED] Loading portfolio with defensive programming...');
    const balance: BalanceResponse = await getBalance();
    if (!balance || typeof balance !== 'object') {
      throw new Error('Invalid balance response: not an object');
    }
    if (!Array.isArray(balance.balances)) {
      console.warn('⚠️ [FIXED] balance.balances is not an array:', typeof balance.balances);
      throw new Error('Invalid balance response: balances is not an array');
    }
    console.log('✅ [FIXED] Balance validation passed:', {
      hasBalances: Array.isArray(balance.balances),
      balanceCount: balance.balances.length,
      totalValue: balance.totalUsdValue || '0'
    });
    const mockChanges = [2.5, -1.2, 0.8, 3.1, -0.5];
    const portfolioData: PortfolioData = {
      totalValue: balance.totalUsdValue || '0',
      change24h: 2.3,
      assets: balance.balances.map((asset: BalanceAsset, index: number) => {
        if (!asset || typeof asset !== 'object') {
          console.warn('⚠️ [FIXED] Invalid asset object at index', index, asset);
          return {
            symbol: 'UNKNOWN',
            amount: '0',
            value: '0',
            change24h: 0
          };
        }
        const symbol = asset.asset || 'UNKNOWN';
        const amount = asset.amount || '0';
        const usdValue = asset.usdValue || '0';
        const change24h = mockChanges[index % mockChanges.length] || 0;
        return {
          symbol,
          amount,
          value: usdValue,
          change24h
        };
      })
    };
    console.log('✅ [FIXED] Portfolio data created successfully:', {
      totalValue: portfolioData.totalValue,
      assetCount: portfolioData.assets.length,
      assets: portfolioData.assets.map(a => `${a.symbol}: ${a.amount}`)
    });
    setPortfolio(portfolioData);
    if (error && error.includes('portfolio')) {
      setError(null);
    }
  } catch (error: any) {
    console.error('❌ [FIXED] Failed to load portfolio:', error);
    const fallbackPortfolio: PortfolioData = {
      totalValue: '0',
      change24h: 0,
      assets: []
    };
    setPortfolio(fallbackPortfolio);
    setError(`Portfolio loading error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const createSafePortfolioData = (balance: BalanceResponse | null): PortfolioData => {
  if (!balance || !Array.isArray(balance.balances)) {
    return {
      totalValue: '0',
      change24h: 0,
      assets: []
    };
  }
  const mockChanges = [2.5, -1.2, 0.8, 3.1, -0.5];
  return {
    totalValue: balance.totalUsdValue || '0',
    change24h: 2.3,
    assets: balance.balances
      .filter(asset => asset && typeof asset === 'object')
      .map((asset, index) => ({
        symbol: asset.asset || 'UNKNOWN',
        amount: asset.amount || '0',
        value: asset.usdValue || '0',
        change24h: mockChanges[index % mockChanges.length] || 0
      }))
  };
};

const renderPortfolioContent = (
  portfolio: PortfolioData | null
) => {
  if (!portfolio) {
    return (
      <div className="text-center py-8">
        <WalletIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Portfolio...</h3>
        <p className="text-gray-600">Fetching your wallet balance...</p>
      </div>
    );
  }
  if (portfolio.assets.length === 0) {
    return (
      <div className="text-center py-8">
        <WalletIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Portfolio Empty</h3>
        <p className="text-gray-600 mb-4">
          Your wallet is connected but doesn't have any tracked assets yet.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
          <h4 className="font-medium text-blue-900 mb-2">💡 Getting Started:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Add funds to your connected wallet</li>
            <li>• Create or join investment groups</li>
            <li>• Participate in group investment proposals</li>
            <li>• Track your portfolio performance over time</li>
          </ul>
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {portfolio.assets.map((asset, index) => (
        <div key={`${asset.symbol}-${index}`} className="p-4 bg-gray-50 rounded-lg">
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
  );
};

export function Dashboard({ onViewGroups, onJoinGroup }: DashboardProps) {
  const { address } = useWallet();
  const { conversations, isInitialized: xmtpInitialized, getMessages, initializeXMTP, resetDatabase, clearError } = useXMTP();
  const { getBalance, analyzePerformance, isInitialized: agentInitialized } = useInvestmentAgent();
  
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [performanceAnalysis, setPerformanceAnalysis] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showAgentDetails, setShowAgentDetails] = useState(false);

  const loadPortfolio = useCallback(async () => {
    if (!agentInitialized) {
      console.log('🔄 [FIXED] Agent not initialized, skipping portfolio load');
      return;
    }
  
    try {
      console.log('🔄 [FIXED] Loading portfolio with defensive programming...');
      
      const balance: BalanceResponse = await getBalance();
      
      // Defensive check: ensure balance is valid object
      if (!balance || typeof balance !== 'object') {
        throw new Error('Invalid balance response: not an object');
      }
  
      // Defensive check: ensure balances is an array
      if (!Array.isArray(balance.balances)) {
        console.warn('⚠️ [FIXED] balance.balances is not an array:', typeof balance.balances);
        throw new Error('Invalid balance response: balances is not an array');
      }
  
      console.log('✅ [FIXED] Balance validation passed:', {
        hasBalances: Array.isArray(balance.balances),
        balanceCount: balance.balances.length,
        totalValue: balance.totalUsdValue || '0'
      });
  
      // Mock price changes for demo (matches balance array length)
      const mockChanges = [2.5, -1.2, 0.8, 3.1, -0.5];
  
      // Create portfolio data with proper error handling
      const portfolioData: PortfolioData = {
        totalValue: balance.totalUsdValue || '0',
        change24h: 2.3, // Mock 24h change for demo
        assets: balance.balances.map((asset: BalanceAsset, index: number) => {
          // Defensive checks for each asset
          if (!asset || typeof asset !== 'object') {
            console.warn('⚠️ [FIXED] Invalid asset object at index', index, asset);
            return {
              symbol: 'UNKNOWN',
              amount: '0',
              value: '0',
              change24h: 0
            };
          }
  
          // Ensure all required properties exist
          const symbol = asset.asset || 'UNKNOWN';
          const amount = asset.amount || '0';
          const usdValue = asset.usdValue || '0';
          const change24h = mockChanges[index % mockChanges.length] || 0;
  
          return {
            symbol,
            amount,
            value: usdValue,
            change24h
          };
        })
      };
  
      console.log('✅ [FIXED] Portfolio data created successfully:', {
        totalValue: portfolioData.totalValue,
        assetCount: portfolioData.assets.length,
        assets: portfolioData.assets.map(a => `${a.symbol}: ${a.amount}`)
      });
  
      setPortfolio(portfolioData);
      
      // Clear any previous errors
      if (error && error.includes('portfolio')) {
        setError(null);
      }
  
    } catch (error) {
      console.error('❌ [FIXED] Failed to load portfolio:', error);
      
      // Create safe fallback portfolio data
      const fallbackPortfolio: PortfolioData = {
        totalValue: '0',
        change24h: 0,
        assets: []
      };
      
      setPortfolio(fallbackPortfolio);
      setError(`Portfolio loading error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Don't throw - handle gracefully with fallback
    }
  }, [agentInitialized, getBalance, error]);

  const loadGroups = useCallback(async () => {
    if (!address || !conversations) return;
  
    try {
      setError(null);
      
      // Get user's groups from database with error handling
      let userGroups = [];
      try {
        const response = await fetch(`${API_ENDPOINTS.BASE_URL}/user-groups?address=${address}`);
        if (response.ok) {
          const data = await response.json();
          userGroups = data.groups || [];
        }
      } catch (dbError) {
        console.warn('⚠️ Failed to load user groups from database:', dbError);
        // Continue with XMTP-only groups
      }
  
      // Transform database groups with safe activity tracking
      const groupSummaries = await Promise.all(
        userGroups.map(async (userGroup: any): Promise<GroupSummary> => {
          try {
            // Safe activity tracking with fallback
            const conversation = conversations.find(conv => conv.id === userGroup.group.id);
            let realLastActivity = new Date(userGroup.member.joinedAt).getTime();
            
            if (conversation && getMessages) {
              try {
                // Use safe message fetching to avoid SequenceId errors
                const recentMessages = await getMessages(conversation.id, 1);
                if (recentMessages.length > 0) {
                  realLastActivity = Number(recentMessages[0].sentAtNs) / 1000000;
                }
              } catch (msgError) {
                console.warn('⚠️ Could not fetch recent messages for activity tracking:', msgError);
                // Fallback to conversation creation time
                realLastActivity = conversation.createdAtNs 
                  ? Number(conversation.createdAtNs) / 1000000
                  : realLastActivity;
              }
            }
  
            return {
              id: userGroup.group.id,
              name: userGroup.group.name || 'Unnamed Group',
              memberCount: userGroup.group.memberCount || 1,
              totalFunds: userGroup.group.totalFunds || '0',
              activeProposals: userGroup.group.activeProposals || 0,
              totalProposals: userGroup.group.totalProposals || 0,
              lastActivity: realLastActivity,
            };
          } catch (error) {
            console.warn('⚠️ Error processing group, using fallback:', error);
            return createFallbackGroupSummary(userGroup);
          }
        })
      );
  
      // Transform XMTP conversations with safe activity tracking
      const conversationGroups = await Promise.all(
        conversations
          .filter(conv => !userGroups.some((ug: any) => ug.group.id === conv.id))
          .map(async (conv): Promise<GroupSummary> => {
            let realLastActivity = conv.createdAtNs 
              ? Number(conv.createdAtNs) / 1000000 
              : Date.now();
  
            // Safe message fetching to avoid SequenceId errors
            if (getMessages) {
              try {
                const recentMessages = await getMessages(conv.id, 1);
                if (recentMessages.length > 0) {
                  realLastActivity = Number(recentMessages[0].sentAtNs) / 1000000;
                }
              } catch (msgError) {
                console.warn('⚠️ Could not fetch recent messages for conversation:', msgError);
                // Use conversation creation time as fallback
              }
            }
  
            return {
              id: conv.id,
              name: conv.name || 'Unnamed Group',
              memberCount: 1, // XMTP doesn't expose member count directly
              totalFunds: '0',
              activeProposals: 0,
              totalProposals: 0,
              lastActivity: realLastActivity,
            };
          })
      );
  
      const allGroups = [...groupSummaries, ...conversationGroups];
      setGroups(allGroups);
      
      console.log(`✅ Loaded ${allGroups.length} groups successfully`);
      
    } catch (error) {
      console.error('❌ Failed to load groups:', error);
      setError('Failed to load groups data');
      
      // Enhanced fallback with safe activity tracking
      const fallbackGroups = await Promise.all(
        conversations.map(async (conv): Promise<GroupSummary> => {
          let realLastActivity = conv.createdAtNs 
            ? Number(conv.createdAtNs) / 1000000 
            : Date.now();
  
          // Even in fallback, try to get real activity safely
          if (getMessages) {
            try {
              const recentMessages = await getMessages(conv.id, 1);
              if (recentMessages.length > 0) {
                realLastActivity = Number(recentMessages[0].sentAtNs) / 1000000;
              }
            } catch (msgError) {
              // Silent fallback to creation time
              console.warn('⚠️ Fallback message fetch failed, using creation time:', msgError);
            }
          }
  
          return {
            id: conv.id,
            name: conv.name || 'Unnamed Group',
            memberCount: 1,
            totalFunds: '0',
            activeProposals: 0,
            totalProposals: 0,
            lastActivity: realLastActivity,
          };
        })
      );
      
      setGroups(fallbackGroups);
    }
  }, [address, conversations, getMessages]);
  
  const safeGetRecentMessages = useCallback(async (
    conversationId: string, 
    limit: number = 1
  ): Promise<DecodedMessage[]> => {
    try {
      if (!getMessages) {
        return [];
      }
      
      const messages = await getMessages(conversationId, limit);
      return messages || [];
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Handle SequenceId errors specifically
      if (errorMessage.includes('SequenceId') || 
          errorMessage.includes('local db') ||
          errorMessage.includes('database')) {
        console.warn(`🛡️ Database error fetching messages for ${conversationId}, returning empty array`);
        return [];
      }
      
      // For other errors, also return empty array to prevent crashes
      console.warn(`⚠️ Error fetching messages for ${conversationId}:`, errorMessage);
      return [];
    }
  }, [getMessages]);

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
    if (!agentInitialized) return;

    try {
      const analysis = await analyzePerformance('7d');
      setPerformanceAnalysis(analysis);
    } catch (error) {
      console.error('Failed to load performance analysis:', error);
      setError('Failed to load performance analysis');
    }
  }, [agentInitialized, analyzePerformance]);

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

  const handleDatabaseError = useCallback(async () => {
    try {
      setError(null);
      
      // Try to reinitialize XMTP
      if (initializeXMTP) {
        console.log('🔄 Attempting to reinitialize XMTP...');
        await initializeXMTP();
      }
      
      // Reload groups after reinitialization
      await loadGroups();
      
    } catch (error) {
      console.error('❌ Error recovery failed:', error);
      setError('Failed to recover from database error. You may need to reset your chat database.');
    }
  }, [initializeXMTP, loadGroups]);

  const handleResetDatabase = useCallback(async () => {
    if (!resetDatabase) return;
    
    try {
      setError(null);
      console.log('🔄 Resetting XMTP database...');
      
      await resetDatabase();
      
      // Reload groups after reset
      setTimeout(() => {
        loadGroups();
      }, 2000); // Give time for reinitialization
      
    } catch (error) {
      console.error('❌ Database reset failed:', error);
      setError('Failed to reset database. Please refresh the page and try again.');
    }
  }, [resetDatabase, loadGroups]);

  const renderErrorRecovery = () => {
    if (!error) return null;
    
    const isDatabaseError = error.includes('SequenceId') || 
                           error.includes('database') || 
                           error.includes('sync');
    
    return (
      <Card className="border-destructive/50 bg-destructive/5 mb-4">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-destructive mb-1">
                {isDatabaseError ? 'Database Synchronization Issue' : 'XMTP Error'}
              </h3>
              <p className="text-sm text-destructive/80 mb-3">{error}</p>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={initializeXMTP}
                  className="border-destructive/30"
                >
                  Retry Connection
                </Button>
                {isDatabaseError && (
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    onClick={resetDatabase}
                  >
                    Reset Database
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={clearError}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLoading) {
        loadGroups();
      }
    }, UI_CONFIG.POLLING_INTERVAL);
  
    return () => clearInterval(interval);
  }, [loadGroups, isLoading]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Refresh data when agent becomes initialized
  useEffect(() => {
    if (agentInitialized && !isLoading) {
      loadPortfolio();
      loadPerformanceAnalysis();
    }
  }, [agentInitialized, loadPortfolio, loadPerformanceAnalysis, isLoading]);

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
          {/* <LoadingSpinner size="lg" /> */}
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

  // Calculate totals from real data
  const totalActiveProposals = groups.reduce((sum, group) => sum + group.activeProposals, 0);
  const totalProposals = groups.reduce((sum, group) => sum + group.totalProposals, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Error Display with Recovery Options */}
      {renderErrorRecovery()}

      {/* Welcome Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back!
        </h1>
        <p className="text-gray-600">
          Here&apos;s an overview of your investment activity and portfolio performance
        </p>
      </div>

      {/* AgentKit Status Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AgentStatus 
            showDetails={showAgentDetails}
            showMessages={true}
            className="h-full"
          />
        </div>
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center text-blue-900">
              <BotIcon className="w-5 h-5 mr-2" />
              AI Agent Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-blue-800">
              <div className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                Portfolio Analysis
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                Strategy Execution
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                Risk Management
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                Real-time Monitoring
          </div>
        </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4 w-full border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={() => setShowAgentDetails(!showAgentDetails)}
            >
              {showAgentDetails ? 'Hide Details' : 'Show Details'}
            </Button>
          </CardContent>
        </Card>
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
                  {portfolio && portfolio.totalValue !== '0' && (
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
                {(!portfolio || portfolio.totalValue === '0') && (
                  <p className="text-xs text-gray-500">Wallet connected, awaiting deposits</p>
                )}
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
                <div className="flex items-center mt-1">
                  <AgentStatusCompact />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Overview */}
      {portfolio && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUpIcon className="w-5 h-5 mr-2" />
              Portfolio Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderPortfolioContent(portfolio)}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Investment Groups */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <UsersIcon className="w-5 h-5 mr-2" />
              Your Groups
            </CardTitle>
          </CardHeader>
          <CardContent>
            {groups.length === 0 ? (
              <div className="text-center py-8">
                <UsersIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {isLoading ? 'Loading groups...' : 'No groups yet'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {isLoading 
                    ? 'Please wait while we load your groups...'
                    : 'Create or join investment groups to start coordinating with others.'
                  }
                </p>
                {!isLoading && (
                  <Button onClick={onViewGroups}>Create Your First Group</Button>
                )}
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
  
  export { loadPortfolio, createSafePortfolioData, renderPortfolioContent };