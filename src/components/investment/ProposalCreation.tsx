'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useWallet } from '@/hooks/useWallet';
import { 
  DollarSignIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  SettingsIcon,
  UsersIcon,
  CalendarIcon,
  FileTextIcon,
  CheckCircleIcon,
  AlertTriangleIcon
} from 'lucide-react';
import { formatUSD } from '@/lib/utils';

interface ProposalCreationProps {
  groupId: string;
  treasuryAddress: `0x${string}`;
  onSuccess: (txHash: string) => void;
  onCancel: () => void;
}

type ProposalType = 'deposit' | 'withdraw' | 'strategy' | 'governance';

interface ProposalForm {
  title: string;
  description: string;
  type: ProposalType;
  amount: string;
  strategy?: string;
  duration?: number; // in days
  targetApy?: number;
  riskLevel?: 'low' | 'medium' | 'high';
}

export function ProposalCreation({ groupId, treasuryAddress, onSuccess, onCancel }: ProposalCreationProps) {
  const { address } = useWallet();
  const [form, setForm] = useState<ProposalForm>({
    title: '',
    description: '',
    type: 'deposit',
    amount: '',
    duration: 7
  });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'type' | 'details' | 'review'>('type');

  const proposalTypes = [
    {
      id: 'deposit' as const,
      name: 'Deposit Funds',
      description: 'Deploy capital to new investment strategy',
      icon: TrendingUpIcon,
      color: 'text-green-600 bg-green-100'
    },
    {
      id: 'withdraw' as const,
      name: 'Withdraw Funds',
      description: 'Remove capital from existing strategy',
      icon: TrendingDownIcon,
      color: 'text-red-600 bg-red-100'
    },
    {
      id: 'strategy' as const,
      name: 'Change Strategy',
      description: 'Modify or add new investment strategy',
      icon: SettingsIcon,
      color: 'text-blue-600 bg-blue-100'
    },
    {
      id: 'governance' as const,
      name: 'Governance',
      description: 'Group settings or member changes',
      icon: UsersIcon,
      color: 'text-purple-600 bg-purple-100'
    }
  ];

  const strategies = [
    'Aave V3 USDC Lending',
    'Aerodrome LP Farming',
    'Uniswap V3 Liquidity',
    'Curve Stable Pools',
    'Lido ETH Staking',
    'Custom Strategy'
  ];

  const handleTypeSelect = (type: ProposalType) => {
    setForm({ ...form, type });
    setStep('details');
  };

  const handleSubmit = async () => {
    if (loading) return;
    
    setLoading(true);
    
    try {
      // Create proposal via API
      const response = await fetch('/api/proposals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Map form to API format
          title: form.title,
          description: form.description,
          strategy: form.strategy || form.type,
          requestedAmount: form.amount,
          proposedBy: treasuryAddress, // This should be the user's wallet address
          deadline: new Date(Date.now() + (form.duration || 7) * 24 * 60 * 60 * 1000).toISOString(),
          requiredVotes: 5, // Default quorum
          groupId: 'current-group-id' // This should come from context
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create proposal');
      }

      const result = await response.json();
      
      // In a real implementation, this would be a transaction hash
      onSuccess(result.proposal.id);
      
    } catch (error) {
      console.error('Failed to create proposal:', error);
      alert('Failed to create proposal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    return form.title.trim() && 
           form.description.trim() && 
           form.amount.trim() && 
           parseFloat(form.amount) > 0;
  };

  if (step === 'type') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Select Proposal Type</h2>
          <p className="text-gray-600 mt-2">Choose the type of proposal you want to create</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {proposalTypes.map((type) => (
            <Card 
              key={type.id}
              className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-blue-300"
              onClick={() => handleTypeSelect(type.id)}
            >
              <CardContent className="pt-6">
                <div className="text-center space-y-3">
                  <div className={`p-3 rounded-full inline-block ${type.color}`}>
                    <type.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{type.name}</h3>
                  <p className="text-sm text-gray-600">{type.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (step === 'details') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep('type')}>
            ← Back
          </Button>
          <h2 className="text-xl font-bold text-gray-900">Proposal Details</h2>
          <div />
        </div>
        
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileTextIcon className="w-4 h-4 inline mr-1" />
              Title
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., Deploy 50k USDC to Aave Strategy"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Provide detailed explanation of the proposal..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              maxLength={1000}
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <DollarSignIcon className="w-4 h-4 inline mr-1" />
              Amount (USDC)
            </label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="0"
              step="0.01"
            />
          </div>

          {/* Strategy (for deposit/strategy types) */}
          {(form.type === 'deposit' || form.type === 'strategy') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <SettingsIcon className="w-4 h-4 inline mr-1" />
                Strategy
              </label>
              <select
                value={form.strategy || ''}
                onChange={(e) => setForm({ ...form, strategy: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a strategy...</option>
                {strategies.map((strategy) => (
                  <option key={strategy} value={strategy}>
                    {strategy}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Voting Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <CalendarIcon className="w-4 h-4 inline mr-1" />
              Voting Duration (days)
            </label>
            <select
              value={form.duration || 7}
              onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
            </select>
          </div>
        </div>

        <div className="flex space-x-3">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={() => setStep('review')} 
            disabled={!isFormValid()}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            Review Proposal
          </Button>
        </div>
      </div>
    );
  }

  // Review step
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setStep('details')}>
          ← Back
        </Button>
        <h2 className="text-xl font-bold text-gray-900">Review Proposal</h2>
        <div />
      </div>
      
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center">
              <CheckCircleIcon className="w-5 h-5 text-blue-600 mr-2" />
              <span className="font-medium text-blue-900">Proposal Summary</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-blue-700 font-medium">Type</p>
                <p className="text-blue-900 capitalize">{form.type}</p>
              </div>
              <div>
                <p className="text-sm text-blue-700 font-medium">Amount</p>
                <p className="text-blue-900">{formatUSD(form.amount)}</p>
              </div>
              <div>
                <p className="text-sm text-blue-700 font-medium">Duration</p>
                <p className="text-blue-900">{form.duration} days</p>
              </div>
              {form.strategy && (
                <div>
                  <p className="text-sm text-blue-700 font-medium">Strategy</p>
                  <p className="text-blue-900">{form.strategy}</p>
                </div>
              )}
            </div>
            
            <div>
              <p className="text-sm text-blue-700 font-medium mb-1">Title</p>
              <p className="text-blue-900 font-medium">{form.title}</p>
            </div>
            
            <div>
              <p className="text-sm text-blue-700 font-medium mb-1">Description</p>
              <p className="text-blue-900 text-sm leading-relaxed">{form.description}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5 mr-2" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium mb-1">Important Notes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Once created, proposals cannot be edited</li>
              <li>The proposal will be open for voting for {form.duration} days</li>
              <li>Execution requires majority approval and quorum</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex space-x-3">
        <Button variant="outline" onClick={onCancel} className="flex-1" disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={loading || !isFormValid()}
          className="flex-1 bg-blue-600 hover:bg-blue-700"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Creating...
            </>
          ) : (
            'Create Proposal'
          )}
        </Button>
      </div>
    </div>
  );
}