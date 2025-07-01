'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  TrendingUpIcon, 
  TrendingDownIcon,
  BarChart3Icon,
  CalendarIcon,
  DollarSignIcon,
  ActivityIcon
} from 'lucide-react';
import { formatUSD, formatPercentage } from '@/lib/utils';

interface PortfolioChartProps {
  groupId: string;
  detailed?: boolean;
}

interface ChartData {
  date: string;
  value: number;
  change: number;
}

interface PerformanceMetrics {
  totalValue: string;
  change24h: number;
  change7d: number;
  change30d: number;
  maxDrawdown: number;
  sharpeRatio: number;
  volatility: number;
}

export function PortfolioChart({ groupId, detailed = false }: PortfolioChartProps) {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  useEffect(() => {
    const loadChartData = async () => {
      setLoading(true);
      
      try {
        // Try to fetch real analytics data first
        const analyticsResponse = await fetch(`/api/analytics?groupId=${groupId}&timeframe=${timeframe}`);

        let useRealData = false;
        let apiData = null;
        
        if (analyticsResponse.ok) {
          apiData = await analyticsResponse.json();
          useRealData = apiData && apiData.chartData && apiData.chartData.length > 0;
        }
        
        if (useRealData) {
          // Use real API data
          setChartData(apiData.chartData);
          setPerformance(apiData.performance);
        } else {
          // Fallback to mock data for demonstration
          const mockData: ChartData[] = [];
          const baseValue = 250000;
          const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 365;
          
          for (let i = days; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            
            // Simulate realistic portfolio growth with some volatility
            const trend = (days - i) / days * 0.1; // 10% growth over period
            const volatility = (Math.random() - 0.5) * 0.05; // ±2.5% daily volatility
            const value = baseValue * (1 + trend + volatility);
            const change = i === 0 ? 0 : (value - mockData[mockData.length - 1]?.value || value) / (mockData[mockData.length - 1]?.value || value) * 100;
            
            mockData.push({
              date: date.toISOString().split('T')[0],
              value,
              change
            });
          }
          
          setChartData(mockData);
          
          // Calculate performance metrics from mock data
          const currentValue = mockData[mockData.length - 1]?.value || baseValue;
          const value24h = mockData[mockData.length - 2]?.value || baseValue;
          const value7d = mockData[mockData.length - 8]?.value || baseValue;
          const value30d = mockData[mockData.length - 31]?.value || baseValue;
          
          const metrics: PerformanceMetrics = {
            totalValue: currentValue.toFixed(2),
            change24h: ((currentValue - value24h) / value24h) * 100,
            change7d: ((currentValue - value7d) / value7d) * 100,
            change30d: ((currentValue - value30d) / value30d) * 100,
            maxDrawdown: -5.2, // Mock value
            sharpeRatio: 1.8, // Mock value
            volatility: 12.4 // Mock value
          };
          
          setPerformance(metrics);
        }
      } catch (error) {
        console.error('Failed to load chart data:', error);
        // Set empty data on error
        setChartData([]);
        setPerformance(null);
      } finally {
        setLoading(false);
      }
    };

    loadChartData();
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

  const currentValue = performance?.totalValue || '0';
  const change24h = performance?.change24h || 0;
  const isPositive = change24h >= 0;

  return (
    <Card className="rounded-2xl border-0 shadow-lg bg-white/70 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <BarChart3Icon className="w-5 h-5 mr-2 text-blue-600" />
            Portfolio Performance
          </CardTitle>
          
          {/* Timeframe Selector */}
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
            {['7d', '30d', '90d', '1y'].map((period) => (
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
        
        {/* Portfolio Summary */}
        <div className="flex items-center space-x-4">
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatUSD(currentValue)}</p>
            <div className={`flex items-center text-sm ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              {isPositive ? (
                <TrendingUpIcon className="w-4 h-4 mr-1" />
              ) : (
                <TrendingDownIcon className="w-4 h-4 mr-1" />
              )}
              {formatPercentage(Math.abs(change24h))} 24h
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Simple Chart Visualization */}
        <div className="space-y-4">
          {/* Chart Area - Simplified SVG representation */}
          <div className="h-48 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 relative overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 400 150">
              {/* Grid Lines */}
              {[0, 1, 2, 3, 4].map((i) => (
                <line
                  key={i}
                  x1="0"
                  y1={30 * i + 15}
                  x2="400"
                  y2={30 * i + 15}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                  opacity="0.5"
                />
              ))}
              
              {/* Chart Line */}
              <path
                d={chartData.map((point, index) => {
                  const x = (index / (chartData.length - 1)) * 380 + 10;
                  const normalizedValue = ((point.value - Math.min(...chartData.map(d => d.value))) / 
                    (Math.max(...chartData.map(d => d.value)) - Math.min(...chartData.map(d => d.value)))) * 120 + 15;
                  const y = 150 - normalizedValue;
                  return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ')}
                stroke="#3b82f6"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {/* Gradient Fill */}
              <defs>
                <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2"/>
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
                </linearGradient>
              </defs>
              
              <path
                d={chartData.map((point, index) => {
                  const x = (index / (chartData.length - 1)) * 380 + 10;
                  const normalizedValue = ((point.value - Math.min(...chartData.map(d => d.value))) / 
                    (Math.max(...chartData.map(d => d.value)) - Math.min(...chartData.map(d => d.value)))) * 120 + 15;
                  const y = 150 - normalizedValue;
                  return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ') + ' L 390 150 L 10 150 Z'}
                fill="url(#chartGradient)"
              />
            </svg>
            
            {/* Chart Labels */}
            <div className="absolute bottom-2 left-4 text-xs text-gray-500">
              {chartData[0]?.date || ''}
            </div>
            <div className="absolute bottom-2 right-4 text-xs text-gray-500">
              {chartData[chartData.length - 1]?.date || ''}
            </div>
          </div>
          
          {/* Performance Metrics Grid */}
          {detailed && performance && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center">
                  <CalendarIcon className="w-4 h-4 text-gray-600 mr-2" />
                  <div>
                    <p className="text-xs text-gray-600">7D Change</p>
                    <p className={`font-semibold ${
                      performance.change7d >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatPercentage(Math.abs(performance.change7d))}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center">
                  <CalendarIcon className="w-4 h-4 text-gray-600 mr-2" />
                  <div>
                    <p className="text-xs text-gray-600">30D Change</p>
                    <p className={`font-semibold ${
                      performance.change30d >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatPercentage(Math.abs(performance.change30d))}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center">
                  <TrendingDownIcon className="w-4 h-4 text-gray-600 mr-2" />
                  <div>
                    <p className="text-xs text-gray-600">Max Drawdown</p>
                    <p className="font-semibold text-red-600">
                      {formatPercentage(Math.abs(performance.maxDrawdown))}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center">
                  <ActivityIcon className="w-4 h-4 text-gray-600 mr-2" />
                  <div>
                    <p className="text-xs text-gray-600">Volatility</p>
                    <p className="font-semibold text-gray-900">
                      {formatPercentage(performance.volatility)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}