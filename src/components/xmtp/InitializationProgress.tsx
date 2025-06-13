'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InitializationState, DatabaseHealthReport } from '@/lib/xmtp-enhanced';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  Database, 
  Shield, 
  Users, 
  RefreshCw,
  Zap,
  Network
} from 'lucide-react';

// Simple Progress component
function Progress({ value, className = "", indicatorClassName = "" }: { 
  value: number; 
  className?: string; 
  indicatorClassName?: string; 
}) {
  return (
    <div className={`w-full bg-gray-200 rounded-full h-2 ${className}`}>
      <div 
        className={`h-2 rounded-full transition-all duration-300 ${indicatorClassName || 'bg-blue-500'}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

interface InitializationProgressProps {
  initializationState: InitializationState;
  isInitializing: boolean;
  error: string | null;
  onRetry: () => void;
  onResetDatabase: () => void;
  onPerformHealthCheck: () => Promise<DatabaseHealthReport>;
  className?: string;
}

export function InitializationProgress({ 
  initializationState, 
  isInitializing, 
  error, 
  onRetry, 
  onResetDatabase,
  onPerformHealthCheck,
  className = "" 
}: InitializationProgressProps) {
  const [healthReport, setHealthReport] = useState<DatabaseHealthReport | null>(null);
  const [showHealthDetails, setShowHealthDetails] = useState(false);
  const [performingHealthCheck, setPerformingHealthCheck] = useState(false);

  const getPhaseIcon = (phase: InitializationState['phase']) => {
    switch (phase) {
      case 'starting':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case 'database_check':
        return <Database className="h-5 w-5 animate-pulse text-orange-500" />;
      case 'client_creation':
        return <Shield className="h-5 w-5 animate-pulse text-purple-500" />;
      case 'sync_validation':
        return <Network className="h-5 w-5 animate-pulse text-indigo-500" />;
      case 'ready':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Loader2 className="h-5 w-5 animate-spin text-gray-500" />;
    }
  };

  const getPhaseTitle = (phase: InitializationState['phase']) => {
    switch (phase) {
      case 'starting':
        return 'Starting Initialization';
      case 'database_check':
        return 'Checking Database Health';
      case 'client_creation':
        return 'Creating XMTP Client';
      case 'sync_validation':
        return 'Validating Synchronization';
      case 'ready':
        return 'Ready for Use';
      case 'failed':
        return 'Initialization Failed';
      default:
        return 'Initializing...';
    }
  };

  const getProgressColor = (phase: InitializationState['phase']) => {
    switch (phase) {
      case 'ready':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'database_check':
        return 'bg-orange-500';
      case 'client_creation':
        return 'bg-purple-500';
      case 'sync_validation':
        return 'bg-indigo-500';
      default:
        return 'bg-blue-500';
    }
  };

  const handleHealthCheck = async () => {
    setPerformingHealthCheck(true);
    try {
      const report = await onPerformHealthCheck();
      setHealthReport(report);
      setShowHealthDetails(true);
    } catch (error) {
      console.error('Health check failed:', error);
    } finally {
      setPerformingHealthCheck(false);
    }
  };

  const renderPhaseSteps = () => {
    const phases = [
      { key: 'starting', label: 'Initialize', icon: Zap },
      { key: 'database_check', label: 'Database Check', icon: Database },
      { key: 'client_creation', label: 'Create Client', icon: Shield },
      { key: 'sync_validation', label: 'Sync Validation', icon: Network },
      { key: 'ready', label: 'Ready', icon: CheckCircle }
    ];

    const currentPhaseIndex = phases.findIndex(p => p.key === initializationState.phase);

    return (
      <div className="flex items-center justify-between mb-4">
        {phases.map((phase, index) => {
          const Icon = phase.icon;
          const isActive = index === currentPhaseIndex;
          const isCompleted = index < currentPhaseIndex || initializationState.phase === 'ready';
          const isFailed = initializationState.phase === 'failed' && index === currentPhaseIndex;

          return (
            <div key={phase.key} className="flex flex-col items-center">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all duration-300
                ${isCompleted 
                  ? 'bg-green-100 border-2 border-green-500' 
                  : isActive 
                    ? 'bg-blue-100 border-2 border-blue-500 animate-pulse' 
                    : isFailed
                      ? 'bg-red-100 border-2 border-red-500'
                      : 'bg-gray-100 border-2 border-gray-300'
                }
              `}>
                <Icon className={`
                  h-5 w-5 
                  ${isCompleted 
                    ? 'text-green-600' 
                    : isActive 
                      ? 'text-blue-600' 
                      : isFailed
                        ? 'text-red-600'
                        : 'text-gray-400'
                  }
                  ${isActive && !isFailed ? 'animate-pulse' : ''}
                `} />
              </div>
              <span className={`
                text-xs font-medium text-center
                ${isCompleted 
                  ? 'text-green-600' 
                  : isActive 
                    ? 'text-blue-600' 
                    : isFailed
                      ? 'text-red-600'
                      : 'text-gray-400'
                }
              `}>
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderHealthReport = () => {
    if (!healthReport) return null;

    return (
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center">
            <Database className="h-4 w-4 mr-2" />
            Database Health Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Health:</span>
            <div className="flex items-center">
              {healthReport.isHealthy ? (
                <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span className={`text-sm ${healthReport.isHealthy ? 'text-green-600' : 'text-red-600'}`}>
                {healthReport.isHealthy ? 'Healthy' : 'Issues Detected'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">SequenceId Status:</span>
            <span className={`
              text-sm px-2 py-1 rounded-full text-xs font-medium
              ${healthReport.sequenceIdStatus === 'valid' 
                ? 'bg-green-100 text-green-700' 
                : healthReport.sequenceIdStatus === 'corrupted'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
              }
            `}>
              {healthReport.sequenceIdStatus}
            </span>
          </div>

          {healthReport.issues.length > 0 && (
            <div>
              <span className="text-sm font-medium text-red-600">Issues:</span>
              <ul className="mt-1 text-xs text-red-600 space-y-1">
                {healthReport.issues.map((issue, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {healthReport.recommendedAction !== 'none' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Recommended Action:</strong> {healthReport.recommendedAction === 'reset' 
                  ? 'Complete database reset required' 
                  : 'Selective database repair needed'}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Card className={`w-full max-w-2xl mx-auto ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          {getPhaseIcon(initializationState.phase)}
          <span className="ml-2">XMTP Initialization</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Phase Steps */}
        {renderPhaseSteps()}

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">{getPhaseTitle(initializationState.phase)}</span>
            <span className="text-sm text-gray-500">{initializationState.progress}%</span>
          </div>
          <Progress 
            value={initializationState.progress} 
            className="h-2"
            indicatorClassName={getProgressColor(initializationState.phase)}
          />
        </div>

        {/* Current Operation */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center">
            {isInitializing && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500 mr-2" />
            )}
            <span className="text-sm text-gray-700">
              {initializationState.currentOperation}
            </span>
          </div>
        </div>

        {/* Issues */}
        {initializationState.issues.length > 0 && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription>
              <div className="space-y-1">
                {initializationState.issues.map((issue, index) => (
                  <div key={index} className="text-sm text-yellow-800">• {issue}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-4">
          {initializationState.phase === 'failed' && (
            <Button 
              onClick={onRetry} 
              disabled={isInitializing}
              className="flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Initialization
            </Button>
          )}

          <Button 
            variant="outline" 
            onClick={handleHealthCheck}
            disabled={performingHealthCheck || isInitializing}
            className="flex items-center"
          >
            {performingHealthCheck ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Database className="h-4 w-4 mr-2" />
            )}
            Health Check
          </Button>

          {(error?.includes('database') || error?.includes('SequenceId') || 
            healthReport?.recommendedAction === 'reset') && (
            <Button 
              variant="destructive" 
              onClick={onResetDatabase}
              disabled={isInitializing}
              className="flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset Database
            </Button>
          )}

          {showHealthDetails && (
            <Button 
              variant="ghost" 
              onClick={() => setShowHealthDetails(false)}
              className="flex items-center"
            >
              Hide Details
            </Button>
          )}
        </div>

        {/* Health Report */}
        {showHealthDetails && renderHealthReport()}

        {/* Success State */}
        {initializationState.phase === 'ready' && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">
              XMTP is now ready for group creation and messaging!
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}