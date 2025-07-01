'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  TrendingUpIcon,
  PieChartIcon,
  DollarSignIcon,
  PercentIcon,
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon
} from 'lucide-react';
import { formatUSD, formatPercentage } from '@/lib/utils';

interface InvestmentMetricsProps {
  groupId: string;
  detailed?: boolean;
}

interface Strategy {
  name: string;
  allocation: number;
  apy: number;
  risk: 'low' | 'medium' | 'high';
  protocol: string;
  status: 'active' | 'paused' | 'pending';
}

interface Metrics {
  totalApy: number;
  riskScore: number;
  diversificationScore: number;
  strategies: Strategy[];
  recentActivity: {
    type: 'deposit' | 'withdraw' | 'rebalance' | 'reward';
    amount: string;
    timestamp: number;
    description: string;
  }[];
}

export function InvestmentMetrics({ groupId, detailed = false }: InvestmentMetricsProps) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMetrics = async () => {
      setLoading(true);
      
      try {
        // Try to fetch real metrics data first
        const metricsResponse = await fetch(`/api/metrics?groupId=${groupId}`);
        
        let useRealData = false;
        let apiData = null;
        
        if (metricsResponse.ok) {
          apiData = await metricsResponse.json();
          useRealData = apiData && apiData.metrics;
        }
        
        if (useRealData) {
          // Use real API data
          setMetrics(apiData.metrics);
        } else {
          // Fallback to mock data for demonstration
          const mockMetrics: Metrics = {
            totalApy: 8.45,
            riskScore: 6.2, // out of 10
            diversificationScore: 8.1, // out of 10
            strategies: [
              {
                name: 'Aave USDC Lending',
                allocation: 35,
                apy: 4.2,
                risk: 'low',
                protocol: 'Aave V3',
                status: 'active'
              },
              {
                name: 'Aerodrome LP Farming',
                allocation: 30,
                apy: 12.8,
                risk: 'medium',
                protocol: 'Aerodrome',
                status: 'active'
              },
              {
                name: 'ETH Liquid Staking',
                allocation: 25,
                apy: 5.1,
                risk: 'low',
                protocol: 'Lido',
                status: 'active'
              },
              {
                name: 'Base Yield Strategy',
                allocation: 10,
                apy: 15.2,
                risk: 'high',
                protocol: 'Base Ecosystem',
                status: 'pending'
              }
            ],
            recentActivity: [
              {
                type: 'deposit',
                amount: '50000',
                timestamp: Date.now() - (2 * 60 * 60 * 1000),
                description: 'Deployed to Aave USDC strategy'
              },
              {
                type: 'reward',
                amount: '342.18',
                timestamp: Date.now() - (6 * 60 * 60 * 1000),
                description: 'Aerodrome LP rewards claimed'
              },
              {
                type: 'rebalance',
                amount: '25000',
                timestamp: Date.now() - (24 * 60 * 60 * 1000),
                description: 'Portfolio rebalanced - moved funds to higher yield'
              }
            ]
          };
          
          setMetrics(mockMetrics);
        }
        
      } catch (error) {
        console.error('Failed to load investment metrics:', error);
        setMetrics(null);
      } finally {
        setLoading(false);
      }
    };

    loadMetrics();
  }, [groupId]);

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

  if (!metrics) {
    return (
      <Card className="rounded-2xl border-0 shadow-lg bg-white/70 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <AlertTriangleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Failed to load investment metrics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: Strategy['status']) => {
    switch (status) {
      case 'active': return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
      case 'paused': return <AlertTriangleIcon className="w-4 h-4 text-yellow-500" />;
      case 'pending': return <ClockIcon className="w-4 h-4 text-blue-500" />;
      default: return <ActivityIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'deposit': return <TrendingUpIcon className="w-4 h-4 text-green-500" />;
      case 'withdraw': return <TrendingUpIcon className="w-4 h-4 text-red-500 rotate-180" />;
      case 'rebalance': return <ActivityIcon className="w-4 h-4 text-blue-500" />;
      case 'reward': return <DollarSignIcon className="w-4 h-4 text-emerald-500" />;
      default: return <ActivityIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Key Metrics Summary */}
      <Card className="rounded-2xl border-0 shadow-lg bg-white/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center">
            <PieChartIcon className="w-5 h-5 mr-2 text-blue-600" />
            Investment Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4">
            {/* Total APY */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
              <div className="flex items-center">
                <PercentIcon className="w-5 h-5 text-green-600 mr-2" />
                <div>
                  <p className="text-sm text-green-700 font-medium">Total APY</p>
                  <p className="text-xs text-green-600">Weighted average yield</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-green-700">
                  {formatPercentage(metrics.totalApy)}
                </p>
              </div>
            </div>

            {/* Risk Score */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
              <div className="flex items-center">
                <AlertTriangleIcon className="w-5 h-5 text-blue-600 mr-2" />
                <div>
                  <p className="text-sm text-blue-700 font-medium">Risk Score</p>
                  <p className="text-xs text-blue-600">{metrics.riskScore}/10 risk level</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center space-x-2">
                  <div className="w-16 h-2 bg-gray-200 rounded-full">
                    <div 
                      className="h-2 bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${metrics.riskScore * 10}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-blue-700">
                    {metrics.riskScore}
                  </span>
                </div>
              </div>
            </div>

            {/* Diversification */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
              <div className="flex items-center">
                <PieChartIcon className="w-5 h-5 text-purple-600 mr-2" />
                <div>
                  <p className="text-sm text-purple-700 font-medium">Diversification</p>
                  <p className="text-xs text-purple-600">Portfolio spread quality</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center space-x-2">
                  <div className="w-16 h-2 bg-gray-200 rounded-full">
                    <div 
                      className="h-2 bg-purple-500 rounded-full transition-all duration-300"
                      style={{ width: `${metrics.diversificationScore * 10}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-purple-700">
                    {metrics.diversificationScore}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Strategies */}
      <Card className="rounded-2xl border-0 shadow-lg bg-white/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center text-sm">
            <ActivityIcon className="w-4 h-4 mr-2 text-blue-600" />
            Active Strategies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.strategies.map((strategy, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(strategy.status)}
                    <h4 className="font-medium text-gray-900 text-sm">{strategy.name}</h4>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(strategy.risk)}`}>
                      {strategy.risk}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-gray-600">Allocation</p>
                    <p className="font-semibold text-gray-900">{strategy.allocation}%</p>
                  </div>
                  <div>
                    <p className="text-gray-600">APY</p>
                    <p className="font-semibold text-green-600">{formatPercentage(strategy.apy)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Protocol</p>
                    <p className="font-semibold text-gray-900">{strategy.protocol}</p>
                  </div>
                </div>
                
                {/* Allocation Bar */}
                <div className="mt-2">
                  <div className="w-full h-1.5 bg-gray-200 rounded-full">
                    <div 
                      className="h-1.5 bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${strategy.allocation}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      {detailed && (
        <Card className="rounded-2xl border-0 shadow-lg bg-white/70 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center text-sm">
              <ClockIcon className="w-4 h-4 mr-2 text-blue-600" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                  {getActivityIcon(activity.type)}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                    <p className="text-xs text-gray-600">
                      {new Date(activity.timestamp).toLocaleDateString()} • {formatUSD(activity.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}