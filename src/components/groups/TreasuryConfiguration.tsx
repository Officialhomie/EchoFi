'use client';

import { useState, useCallback, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, FormField } from '@/components/ui/input';
import { 
  Wallet as WalletIcon,
  Users as UsersIcon,
  AlertCircleIcon,
  InfoIcon,
  TrendingUpIcon,
  ShieldIcon,
  Calculator as CalculatorIcon
} from 'lucide-react';
import { TreasuryDeploymentParams, TreasuryDeploymentResult } from '@/types/group-creation';
import { useWallet } from '@/hooks/useWallet';
import { formatAddress, cn } from '@/lib/utils';

// =============================================================================
// INTERFACES & TYPES
// =============================================================================

interface TreasuryConfigurationProps {
  groupName: string;
  xmtpGroupId: string;
  members: string[];
  onDeploy: (params: TreasuryDeploymentParams) => Promise<TreasuryDeploymentResult>;
  onSkip: () => void;
  onCancel: () => void;
  isDeploying?: boolean;
  estimatedGasFee?: string;
  deploymentFee?: string;
}

interface VotingPowerState {
  powers: Record<string, number>;
  total: number;
  isValid: boolean;
  errors: Record<string, string>;
}

interface TreasuryConfig {
  equalVoting: boolean;
  customVoting: boolean;
  totalPowerDistributed: number;
  remainingPower: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const VOTING_POWER_TOTAL = 100;
const MIN_VOTING_POWER = 1;
const MAX_VOTING_POWER = 50; // Prevent single member dominance

const TREASURY_FEATURES = [
  {
    icon: ShieldIcon,
    title: 'Multi-signature Security',
    description: 'Requires group consensus for all transactions'
  },
  {
    icon: TrendingUpIcon,
    title: 'Investment Coordination',
    description: 'Pool funds for larger investment opportunities'
  },
  {
    icon: UsersIcon,
    title: 'Democratic Governance',
    description: 'Weighted voting based on contribution and expertise'
  },
  {
    icon: CalculatorIcon,
    title: 'Transparent Accounting',
    description: 'All transactions recorded on-chain for full transparency'
  }
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function TreasuryConfiguration({
  groupName,
  xmtpGroupId,
  members,
  onDeploy,
  onSkip,
  onCancel,
  isDeploying = false,
  estimatedGasFee = '0.005',
  deploymentFee = '0.01'
}: TreasuryConfigurationProps) {
  
  const { address } = useWallet();
  
  // All members including creator
  const allMembers = useMemo(() => {
    const memberSet = new Set([...members]);
    if (address) memberSet.add(address);
    return Array.from(memberSet);
  }, [members, address]);

  // Voting power state management
  const [votingPowerState, setVotingPowerState] = useState<VotingPowerState>(() => {
    const equalPower = Math.floor(VOTING_POWER_TOTAL / allMembers.length);
    const remainder = VOTING_POWER_TOTAL % allMembers.length;
    
    const powers: Record<string, number> = {};
    allMembers.forEach((member, index) => {
      powers[member] = equalPower + (index < remainder ? 1 : 0);
    });
    
    return {
      powers,
      total: VOTING_POWER_TOTAL,
      isValid: true,
      errors: {}
    };
  });

  const [config, setConfig] = useState<TreasuryConfig>({
    equalVoting: true,
    customVoting: false,
    totalPowerDistributed: VOTING_POWER_TOTAL,
    remainingPower: 0
  });

  // =============================================================================
  // VALIDATION & CALCULATIONS
  // =============================================================================

  const validateVotingPowers = useCallback((powers: Record<string, number>): { isValid: boolean; errors: Record<string, string> } => {
    const errors: Record<string, string> = {};
    let total = 0;
    
    for (const [member, power] of Object.entries(powers)) {
      total += power;
      
      if (power < MIN_VOTING_POWER) {
        errors[member] = `Minimum ${MIN_VOTING_POWER}% required`;
      }
      
      if (power > MAX_VOTING_POWER) {
        errors[member] = `Maximum ${MAX_VOTING_POWER}% allowed`;
      }
      
      if (!Number.isInteger(power)) {
        errors[member] = 'Must be a whole number';
      }
    }
    
    if (total !== VOTING_POWER_TOTAL) {
      for (const member of allMembers) {
        if (!errors[member]) {
          errors[member] = `Total must equal ${VOTING_POWER_TOTAL}%`;
        }
      }
    }
    
    return {
      isValid: Object.keys(errors).length === 0 && total === VOTING_POWER_TOTAL,
      errors
    };
  }, [allMembers]);

  const recalculateVotingState = useCallback((newPowers: Record<string, number>) => {
    const validation = validateVotingPowers(newPowers);
    const total = Object.values(newPowers).reduce((sum, power) => sum + power, 0);
    
    setVotingPowerState({
      powers: newPowers,
      total,
      isValid: validation.isValid,
      errors: validation.errors
    });
    
    setConfig(prev => ({
      ...prev,
      totalPowerDistributed: total,
      remainingPower: VOTING_POWER_TOTAL - total
    }));
  }, [validateVotingPowers]);

  // =============================================================================
  // VOTING POWER HANDLERS
  // =============================================================================

  const handleEqualDistribution = useCallback(() => {
    const equalPower = Math.floor(VOTING_POWER_TOTAL / allMembers.length);
    const remainder = VOTING_POWER_TOTAL % allMembers.length;
    
    const newPowers: Record<string, number> = {};
    allMembers.forEach((member, index) => {
      newPowers[member] = equalPower + (index < remainder ? 1 : 0);
    });
    
    recalculateVotingState(newPowers);
    
    setConfig(prev => ({
      ...prev,
      equalVoting: true,
      customVoting: false
    }));
  }, [allMembers, recalculateVotingState]);

  const handleCustomVoting = useCallback(() => {
    setConfig(prev => ({
      ...prev,
      equalVoting: false,
      customVoting: true
    }));
  }, []);

  const handleVotingPowerChange = useCallback((member: string, value: string) => {
    const numericValue = parseInt(value) || 0;
    
    const newPowers = {
      ...votingPowerState.powers,
      [member]: Math.max(0, Math.min(MAX_VOTING_POWER, numericValue))
    };
    
    recalculateVotingState(newPowers);
  }, [votingPowerState.powers, recalculateVotingState]);

  // =============================================================================
  // DEPLOYMENT HANDLERS
  // =============================================================================

  const handleDeploy = useCallback(async () => {
    if (!votingPowerState.isValid) {
      console.warn('Cannot deploy with invalid voting configuration');
      return;
    }
    
    const deploymentParams: TreasuryDeploymentParams = {
      name: groupName,
      xmtpGroupId,
      members: allMembers,
      votingPowers: allMembers.map(member => votingPowerState.powers[member])
    };
    
    try {
      await onDeploy(deploymentParams);
    } catch (error) {
      console.error('Treasury deployment failed:', error);
    }
  }, [
    votingPowerState.isValid,
    groupName,
    xmtpGroupId,
    allMembers,
    votingPowerState.powers,
    onDeploy
  ]);

  // =============================================================================
  // COMPUTED VALUES
  // =============================================================================

  const totalDeploymentCost = useMemo(() => {
    const gas = parseFloat(estimatedGasFee);
    const fee = parseFloat(deploymentFee);
    return (gas + fee).toFixed(4);
  }, [estimatedGasFee, deploymentFee]);

  const canDeploy = votingPowerState.isValid && !isDeploying;

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  const renderFeatures = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      {TREASURY_FEATURES.map((feature, index) => (
        <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
          <feature.icon className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-blue-900">{feature.title}</div>
            <div className="text-xs text-blue-700 mt-1">{feature.description}</div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderVotingConfiguration = () => (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Button
          variant={config.equalVoting ? 'default' : 'outline'}
          onClick={handleEqualDistribution}
          disabled={isDeploying}
          className="flex-1"
          size="sm"
        >
          Equal Voting Power
        </Button>
        <Button
          variant={config.customVoting ? 'default' : 'outline'}
          onClick={handleCustomVoting}
          disabled={isDeploying}
          className="flex-1"
          size="sm"
        >
          Custom Distribution
        </Button>
      </div>

      <div className="space-y-3">
        <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <UsersIcon className="w-4 h-4" />
          Member Voting Powers
          <span className={cn(
            "text-xs px-2 py-1 rounded-full",
            votingPowerState.isValid 
              ? "bg-green-100 text-green-700" 
              : "bg-red-100 text-red-700"
          )}>
            Total: {votingPowerState.total}%
          </span>
        </div>

        {allMembers.map((member) => (
          <div key={member} className="space-y-1">
            <FormField
              label={address === member ? 'You (Creator)' : formatAddress(member)}
              error={votingPowerState.errors[member]}
            >
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={MIN_VOTING_POWER}
                  max={MAX_VOTING_POWER}
                  value={votingPowerState.powers[member]}
                  onChange={(e) => handleVotingPowerChange(member, e.target.value)}
                  disabled={isDeploying || config.equalVoting}
                  className="w-20 text-center"
                />
                <span className="text-sm text-gray-500">%</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-500 h-2 rounded-full transition-all duration-200"
                    style={{ width: `${(votingPowerState.powers[member] / VOTING_POWER_TOTAL) * 100}%` }}
                  />
                </div>
              </div>
            </FormField>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCostBreakdown = () => (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      <div className="text-sm font-medium text-gray-900">Deployment Cost</div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Gas Fee (estimated):</span>
          <span className="font-mono">{estimatedGasFee} ETH</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Platform Fee:</span>
          <span className="font-mono">{deploymentFee} ETH</span>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-2 font-medium">
          <span>Total:</span>
          <span className="font-mono">{totalDeploymentCost} ETH</span>
        </div>
      </div>
    </div>
  );

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
          <WalletIcon className="w-8 h-8 text-white" />
        </div>
        <CardTitle className="text-2xl font-semibold text-gray-900">
          Deploy Group Treasury
        </CardTitle>
        <p className="text-base text-gray-600 mt-2">
          Optional smart contract for secure group investment coordination
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Features Overview */}
        {renderFeatures()}

        {/* Important Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <InfoIcon className="w-5 h-5 text-amber-600 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-amber-900 mb-1">Optional Deployment</div>
              <div className="text-amber-700">
                You can deploy the treasury now or skip and deploy it later when your group is ready to pool funds. 
                The messaging features work independently of the treasury.
              </div>
            </div>
          </div>
        </div>

        {/* Voting Configuration */}
        {renderVotingConfiguration()}

        {/* Cost Breakdown */}
        {renderCostBreakdown()}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isDeploying}
            className="flex-1"
          >
            Cancel
          </Button>
          
          <Button
            variant="outline"
            onClick={onSkip}
            disabled={isDeploying}
            className="flex-1"
          >
            Skip for Now
          </Button>
          
          <Button
            onClick={handleDeploy}
            disabled={!canDeploy}
            className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
          >
            {isDeploying ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Deploying...
              </div>
            ) : (
              <>
                <WalletIcon className="w-4 h-4 mr-2" />
                Deploy Treasury
              </>
            )}
          </Button>
        </div>

        {/* Validation Status */}
        {!votingPowerState.isValid && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircleIcon className="w-4 h-4" />
              <span className="text-sm font-medium">
                Please fix voting power distribution before deploying
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}