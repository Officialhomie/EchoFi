import { NextResponse } from 'next/server';
import { debugEnvironmentVariables } from '@/lib/debug/env-check';
import { testCDPCredentials } from '@/lib/debug/cdp-test';
import { testWalletProvider } from '@/lib/debug/wallet-test';
import { getErrorMessage } from '@/lib/agentkit/prepare-agentkit';

export async function GET() {
  const results = {
    timestamp: new Date().toISOString(),
    environment: {
      valid: false,
      details: {} as { error?: string }
    },
    cdp: {
      valid: false,
      error: null as string | null
    },
    wallet: {
      valid: false,
      error: null as string | null,
      details: {} as Record<string, unknown>
    }
  };

  // Test environment variables
  try {
    results.environment.valid = debugEnvironmentVariables();
  } catch (error) {
    results.environment.details = { error: getErrorMessage(error) };
  }

  // Test CDP credentials
  if (results.environment.valid) {
    try {
      results.cdp.valid = await testCDPCredentials();
    } catch (error) {
      results.cdp.error = getErrorMessage(error);
    }
  }

  // Test wallet provider
  if (results.environment.valid) {
    try {
      const walletTest = await testWalletProvider();
      results.wallet.valid = walletTest.success;
      results.wallet.details = walletTest;
      if (!walletTest.success) {
        results.wallet.error = walletTest.error ? getErrorMessage(walletTest.error) : 'Unknown wallet error';
      }
    } catch (error) {
      results.wallet.error = getErrorMessage(error);
    }
  }

  const allValid = results.environment.valid && results.cdp.valid && results.wallet.valid;
  
  return NextResponse.json({
    status: allValid ? 'healthy' : 'unhealthy',
    ...results
  }, { 
    status: allValid ? 200 : 500 
  });
}