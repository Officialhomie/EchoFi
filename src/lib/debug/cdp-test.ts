import { cdpApiActionProvider } from '@coinbase/agentkit';

export async function testCDPCredentials() {
  try {
    console.log('🔐 Testing CDP API credentials...');
    
    // Test credentials by creating provider
    cdpApiActionProvider({
      apiKeyId: process.env.CDP_API_KEY_NAME!,
      apiKeySecret: process.env.CDP_API_KEY_PRIVATE_KEY!,
    });
    
    console.log('✅ CDP API provider created successfully');
    return true;
  } catch (error) {
    console.error('❌ CDP API test failed:', error);
    return false;
  }
}