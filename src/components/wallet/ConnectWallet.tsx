'use client';

import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ConnectWalletProps {
  onConnected?: () => void;
  className?: string;
}

export function ConnectWallet({ onConnected, className }: ConnectWalletProps) {
  const { isConnected, address, chainId, connect, disconnect } = useWallet();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      await connect();
      onConnected?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setError(null);
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getChainName = (chainId: number) => {
    const chains: Record<number, string> = {
      1: 'Ethereum',
      8453: 'Base',
      84532: 'Base Sepolia',
    };
    return chains[chainId] || `Chain ${chainId}`;
  };

  if (isConnected && address) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">Wallet Connected</CardTitle>
          <CardDescription>
            Your wallet is connected and ready to use
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Address:</span>
              <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                {formatAddress(address)}
              </span>
            </div>
            {chainId && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Network:</span>
                <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {getChainName(chainId)}
                </span>
              </div>
            )}
          </div>
          
          <Button 
            variant="outline" 
            onClick={handleDisconnect}
            className="w-full"
          >
            Disconnect Wallet
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-4">
        <Button
          onClick={handleConnect}
          disabled={isConnecting}
          className="w-full"
          size="lg"
        >
          {isConnecting ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Connecting...</span>
            </div>
          ) : (
            'Connect Wallet'
          )}
        </Button>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">
            Don't have a wallet?
          </p>
          <div className="space-y-2">
            <a
              href="https://metamask.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-blue-600 hover:text-blue-800 text-sm underline"
            >
              Download MetaMask
            </a>
            <br />
            <a
              href="https://www.coinbase.com/wallet"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-blue-600 hover:text-blue-800 text-sm underline"
            >
              Download Coinbase Wallet
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// Wallet Status Indicator Component
export function WalletStatus() {
  const { isConnected, address, chainId } = useWallet();

  if (!isConnected) {
    return (
      <div className="flex items-center space-x-2 text-gray-500">
        <div className="w-2 h-2 bg-red-500 rounded-full" />
        <span className="text-sm">Not Connected</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <div className="w-2 h-2 bg-green-500 rounded-full" />
      <span className="text-sm font-medium">
        {address?.slice(0, 6)}...{address?.slice(-4)}
      </span>
      {chainId && (
        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
          {chainId === 8453 ? 'Base' : chainId === 84532 ? 'Base Sepolia' : `Chain ${chainId}`}
        </span>
      )}
    </div>
  );
}