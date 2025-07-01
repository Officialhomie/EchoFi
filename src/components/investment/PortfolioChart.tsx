'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUpIcon, 
  TrendingDownIcon,
  BarChart3Icon,
  PieChartIcon,
  CalendarIcon,
  DollarSignIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from 'lucide-react';
import { formatUSD, formatPercentage } from '@/lib/utils';

interface PortfolioData {
  timestamp: number;
  totalValue: number;
  deposits: number;
  yields: number;
  strategies: {
    name: string;
    allocation: number;
    value: number;
    apy: number;
    change24h: number;
  }[];
}

interface PortfolioChartProps {
  groupId: string;
  detailed?: boolean;
}

export function PortfolioChart({ groupId, detailed = false }: PortfolioChartProps) {
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d' | '90d'>('30d');
  const [chartType, setChartType] = useState<'line' | 'allocation'>('line');
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPortfolioData = async () => {
      setLoading(true);
      
      // Mock portfolio data - in real app, this would come from API
      const mockData: PortfolioData = {
        timestamp: Date.now(),
        totalValue: 267842.50,
        deposits: 245750.00,
        yields: 22092.50,
        strategies: [
          {
            name: 'Aave USDC Lending',
            allocation: 45.2,
            value: 121061.41,
            apy: 4.2,
            change24h: 0.15
          },
          {
            name: 'Aerodrome LP Farming',
            allocation: 32.8,
            value: 87812.35,
            apy: 12.4,
            change24h: 2.34
          },
          {
            name: 'Base ETH Staking',
            allocation: 22.0,
            value: 58968.74,
            apy: 3.8,
            change24h: -0.45
          }
        ]
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setPortfolioData(mockData);
      setLoading(false);
    };

    loadPortfolioData();
  }, [groupId, timeframe]);

  if (loading) {
    return (
      <Card className="rounded-2xl border-0 shadow-lg bg-white/70 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!portfolioData) {
    return (
      <Card className="rounded-2xl border-0 shadow-lg bg-white/70 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <BarChart3Icon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Unable to load portfolio data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalReturn = portfolioData.totalValue - portfolioData.deposits;
  const returnPercentage = (totalReturn / portfolioData.deposits) * 100;

  return (
    <Card className="rounded-2xl border-0 shadow-lg bg-white/70 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <TrendingUpIcon className="w-5 h-5 mr-2 text-blue-600" />
            Portfolio Performance
          </CardTitle>
          <div className="flex items-center space-x-2">
            {/* Chart Type Toggle */}
            <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setChartType('line')}
                className={`p-2 rounded-md transition-colors ${
                  chartType === 'line'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <BarChart3Icon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChartType('allocation')}
                className={`p-2 rounded-md transition-colors ${
                  chartType === 'allocation'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <PieChartIcon className="w-4 h-4" />
              </button>
            </div>
            
            {/* Timeframe Selector */}
            <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
              {['24h', '7d', '30d', '90d'].map((period) => (
                <button
                  key={period}
                  onClick={() => setTimeframe(period as any)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    timeframe === period
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Portfolio Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4">
            <div className="flex items-center">
              <DollarSignIcon className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-blue-700">Total Value</p>
                <p className="text-2xl font-bold text-blue-900">
                  {formatUSD(portfolioData.totalValue)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4">
            <div className="flex items-center">
              <ArrowUpIcon className="w-8 h-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-green-700">Total Yield</p>
                <p className="text-2xl font-bold text-green-900">
                  {formatUSD(portfolioData.yields)}
                </p>
              </div>
            </div>
          </div>
          
          <div className={`bg-gradient-to-r rounded-xl p-4 ${
            returnPercentage >= 0 
              ? 'from-emerald-50 to-green-50' 
              : 'from-red-50 to-rose-50'
          }`}>
            <div className="flex items-center">
              {returnPercentage >= 0 ? (
                <TrendingUpIcon className="w-8 h-8 text-emerald-600 mr-3" />
              ) : (
                <TrendingDownIcon className="w-8 h-8 text-red-600 mr-3" />
              )}
              <div>
                <p className={`text-sm font-medium ${
                  returnPercentage >= 0 ? 'text-emerald-700' : 'text-red-700'
                }`}>
                  Total Return
                </p>
                <p className={`text-2xl font-bold ${
                  returnPercentage >= 0 ? 'text-emerald-900' : 'text-red-900'
                }`}>
                  {formatPercentage(Math.abs(returnPercentage))}
                </p>
              </div>
            </div>
          </div>
        </div>

        {chartType === 'line' ? (
          // Performance Chart Placeholder
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-6 mb-6">
            <div className="text-center">
              <BarChart3Icon className="w-16 h-16 text-blue-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Portfolio Performance Chart
              </h3>
              <p className="text-blue-700 mb-4">
                Interactive chart showing {timeframe} performance would be displayed here
              </p>
              <div className="flex items-center justify-center space-x-4 text-sm text-blue-600">
                <span>📈 +{formatPercentage(returnPercentage)} return</span>
                <span>•</span>
                <span>💰 {formatUSD(portfolioData.yields)} yield earned</span>
              </div>
            </div>
          </div>
        ) : (
          // Strategy Allocation
          <div className="space-y-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Strategy Allocation</h3>
            {portfolioData.strategies.map((strategy, index) => (
              <div key={strategy.name} className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">{strategy.name}</h4>
                    <p className="text-sm text-gray-600">
                      {formatPercentage(strategy.allocation)} allocation • {formatPercentage(strategy.apy)} APY
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {formatUSD(strategy.value)}
                    </p>
                    <div className={`flex items-center text-sm ${
                      strategy.change24h >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {strategy.change24h >= 0 ? (
                        <ArrowUpIcon className="w-3 h-3 mr-1" />
                      ) : (
                        <ArrowDownIcon className="w-3 h-3 mr-1" />
                      )}
                      {formatPercentage(Math.abs(strategy.change24h))} 24h
                    </div>
                  </div>
                </div>
                
                {/* Allocation Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      index === 0 ? 'bg-blue-500' :
                      index === 1 ? 'bg-emerald-500' : 'bg-purple-500'
                    }`}
                    style={{ width: `${strategy.allocation}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {detailed && (
          <div className="border-t border-gray-200 pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-600">Total Deposits</p>
                <p className="font-semibold text-gray-900">
                  {formatUSD(portfolioData.deposits)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Yield Generated</p>
                <p className="font-semibold text-green-600">
                  {formatUSD(portfolioData.yields)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Strategies</p>
                <p className="font-semibold text-gray-900">
                  {portfolioData.strategies.length}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg APY</p>
                <p className="font-semibold text-blue-600">
                  {formatPercentage(
                    portfolioData.strategies.reduce((acc, s) => acc + s.apy, 0) / 
                    portfolioData.strategies.length
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}