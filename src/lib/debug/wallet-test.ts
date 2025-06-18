import { SmartWalletProvider } from '@coinbase/agentkit';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { Hex } from 'viem';

export async function testWalletProvider() {
  try {
    console.log('👛 Testing SmartWalletProvider...');
    
    const privateKey = (process.env.PRIVATE_KEY || generatePrivateKey()) as Hex;
    const signer = privateKeyToAccount(privateKey);
    const networkId = process.env.NETWORK_ID || 'base-sepolia';
    
    console.log('📝 Signer address:', signer.address);
    console.log('🌐 Network ID:', networkId);
    
    const walletProvider = await SmartWalletProvider.configureWithWallet({
      networkId,
      signer,
      smartWalletAddress: undefined,
      paymasterUrl: undefined,
    });
    
    const address = walletProvider.getAddress();
    const network = walletProvider.getNetwork();
    
    console.log('✅ SmartWalletProvider test successful:');
    console.log('   Address:', address);
    console.log('   Network:', network.networkId);
    console.log('   Chain ID:', network.chainId);
    
    return { success: true, address, network };
  } catch (error) {
    console.error('❌ SmartWalletProvider test failed:', error);
    return { success: false, error };
  }
}