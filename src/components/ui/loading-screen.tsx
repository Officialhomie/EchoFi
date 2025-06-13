import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface LoadingScreenProps {
  progress: number;
  currentPhase: string;
  onRetry: () => void;
  onResetDatabase: () => void;
  onPerformHealthCheck: () => void;
}

export function LoadingScreen({
  progress,
  currentPhase,
  onRetry,
  onResetDatabase,
  onPerformHealthCheck
}: LoadingScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-4">Initializing XMTP Client</h2>
          <p className="text-sm text-gray-600 mb-4">{currentPhase}</p>
          <Progress value={progress} className="mb-6" />
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={onRetry}
            >
              Retry Initialization
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={onResetDatabase}
            >
              Reset Database
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={onPerformHealthCheck}
            >
              Check Database Health
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 