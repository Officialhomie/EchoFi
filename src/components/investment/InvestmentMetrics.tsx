'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  TrendingUpIcon,
  DollarSignIcon,
  BarChart3Icon,
  ActivityIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ClockIcon,
  UsersIcon,
  TargetIcon,
  ZapIcon
} from 'lucide-react';
import { formatUSD, formatPercentage, getRelativeTime } from '@/lib/utils';

interface MetricData {
  label: string;
  value: string;
  change: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

interface ActivityItem {
  id: string;
  type: 'deposit' | 'withdrawal' | 'yield' | 'rebalance' | 'vote';
  description: string;
  amount?: string;
  timestamp: number;
  status: 'completed' | 'pending' | 'failed';
}

interface InvestmentMetricsProps {
  groupId: string;
  detailed?: boolean;
}

export function InvestmentMetrics({ groupId, detailed = false }: InvestmentMetricsProps) {
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMetrics = async () => {
      setLoading(true);
      
      // Mock metrics data - in real app, this would come from API
      const mockMetrics: MetricData[] = [
        {
          label: '30-Day APY',
          value: '8.99%',
          change: 1.23,
          icon: TrendingUpIcon,
          color: 'text-green-600',
          bgColor: 'bg-green-100'
        },
        {
          label: 'Monthly Yield',
          value: '$5,847.32',
          change: 12.45,
          icon: DollarSignIcon,
          color: 'text-blue-600',
          bgColor: 'bg-blue-100'
        },
        {
          label: 'Risk Score',
          value: '6.2/10',
          change: -0.3,
          icon: TargetIcon,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100'
        },
        {
          label: 'Active Strategies',
          value: '3',
          change: 0,
          icon: ZapIcon,
          color: 'text-purple-600',
          bgColor: 'bg-purple-100'
        }
      ];

      // Mock recent activity
      const mockActivity: ActivityItem[] = [
        {
          id: '1',
          type: 'yield',
          description: 'Yield earned from Aave USDC strategy',
          amount: '247.83',
          timestamp: Date.now() - (2 * 60 * 60 * 1000), // 2 hours ago
          status: 'completed'
        },
        {
          id: '2',
          type: 'deposit',
          description: 'New deposit to treasury',
          amount: '5000.00',
          timestamp: Date.now() - (6 * 60 * 60 * 1000), // 6 hours ago
          status: 'completed'
        },
        {
          id: '3',
          type: 'rebalance',
          description: 'Portfolio rebalanced by AI agent',
          timestamp: Date.now() - (12 * 60 * 60 * 1000), // 12 hours ago
          status: 'completed'
        },
        {
          id: '4',
          type: 'vote',
          description: 'Voted on Aerodrome LP strategy proposal',
          timestamp: Date.now() - (18 * 60 * 60 * 1000), // 18 hours ago
          status: 'completed'
        },
        {
          id: '5',
          type: 'withdrawal',
          description: 'Partial withdrawal requested',
          amount: '2500.00',
          timestamp: Date.now() - (24 * 60 * 60 * 1000), // 1 day ago
          status: 'pending'
        }
      ];

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setMetrics(mockMetrics);
      setRecentActivity(mockActivity);
      setLoading(false);
    };

    loadMetrics();
  }, [groupId]);

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'deposit':
        return <ArrowUpIcon className="w-4 h-4 text-green-600" />;
      case 'withdrawal':
        return <ArrowDownIcon className="w-4 h-4 text-red-600" />;
      case 'yield':
        return <DollarSignIcon className="w-4 h-4 text-blue-600" />;
      case 'rebalance':
        return <BarChart3Icon className="w-4 h-4 text-purple-600" />;
      case 'vote':
        return <UsersIcon className="w-4 h-4 text-indigo-600" />;
      default:
        return <ActivityIcon className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: ActivityItem['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card className="rounded-2xl border-0 shadow-lg bg-white/70 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Key Metrics */}
      <Card className="rounded-2xl border-0 shadow-lg bg-white/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3Icon className="w-5 h-5 mr-2 text-blue-600" />
            Key Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4">
            {metrics.map((metric, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                    <metric.icon className={`w-4 h-4 ${metric.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">{metric.label}</p>
                    <p className="text-lg font-bold text-gray-900">{metric.value}</p>
                  </div>
                </div>
                
                {metric.change !== 0 && (
                  <div className={`flex items-center text-sm ${
                    metric.change > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {metric.change > 0 ? (
                      <ArrowUpIcon className="w-3 h-3 mr-1" />
                    ) : (
                      <ArrowDownIcon className="w-3 h-3 mr-1" />
                    )}
                    {Math.abs(metric.change).toFixed(2)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="rounded-2xl border-0 shadow-lg bg-white/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center">
            <ActivityIcon className="w-5 h-5 mr-2 text-blue-600" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentActivity.slice(0, detailed ? 10 : 5).map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-xl">
                <div className="p-1.5 bg-white rounded-lg shadow-sm">
                  {getActivityIcon(activity.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {activity.description}
                    </p>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(activity.status)}`}>
                      {activity.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center text-xs text-gray-500">
                    <ClockIcon className="w-3 h-3 mr-1" />
                    {getRelativeTime(activity.timestamp)}
                    {activity.amount && (
                      <>
                        <span className="mx-2">•</span>
                        <DollarSignIcon className="w-3 h-3 mr-1" />
                        {formatUSD(activity.amount)}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {detailed && recentActivity.length > 10 && (
            <div className="text-center mt-4">
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Load More Activity
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {detailed && (
        <>
          {/* Strategy Performance */}
          <Card className="rounded-2xl border-0 shadow-lg bg-white/70 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUpIcon className="w-5 h-5 mr-2 text-blue-600" />
                Strategy Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: 'Aave USDC Lending', apy: 4.2, allocation: 45.2, performance: 'Good' },
                  { name: 'Aerodrome LP Farming', apy: 12.4, allocation: 32.8, performance: 'Excellent' },
                  { name: 'Base ETH Staking', apy: 3.8, allocation: 22.0, performance: 'Stable' }
                ].map((strategy, index) => (
                  <div key={index} className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{strategy.name}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        strategy.performance === 'Excellent' ? 'bg-green-100 text-green-800' :
                        strategy.performance === 'Good' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {strategy.performance}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Current APY</p>
                        <p className="font-semibold text-gray-900">{formatPercentage(strategy.apy)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Allocation</p>
                        <p className="font-semibold text-gray-900">{formatPercentage(strategy.allocation)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Risk Analysis */}
          <Card className="rounded-2xl border-0 shadow-lg bg-white/70 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <TargetIcon className="w-5 h-5 mr-2 text-blue-600" />
                Risk Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <h4 className="font-semibold text-yellow-900 mb-2">Portfolio Risk Assessment</h4>
                  <p className="text-sm text-yellow-800 mb-3">
                    Current risk level is moderate with good diversification across DeFi protocols.
                  </p>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-yellow-700">Smart Contract Risk</span>
                      <span className="font-medium text-yellow-900">Medium</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-yellow-700">Liquidity Risk</span>
                      <span className="font-medium text-yellow-900">Low</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-yellow-700">Market Risk</span>
                      <span className="font-medium text-yellow-900">Medium</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}