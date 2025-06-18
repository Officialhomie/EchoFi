export function debugEnvironmentVariables() {
    console.log('🔍 Environment Variables Debug:');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('CDP_API_KEY_NAME exists:', !!process.env.CDP_API_KEY_NAME);
    console.log('CDP_API_KEY_PRIVATE_KEY exists:', !!process.env.CDP_API_KEY_PRIVATE_KEY);
    console.log('PRIVATE_KEY exists:', !!process.env.PRIVATE_KEY);
    console.log('NETWORK_ID:', process.env.NETWORK_ID || 'base-sepolia (default)');
    console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
    
    // Check for common issues
    const issues = [];
    if (!process.env.CDP_API_KEY_NAME) issues.push('CDP_API_KEY_NAME missing');
    if (!process.env.CDP_API_KEY_PRIVATE_KEY) issues.push('CDP_API_KEY_PRIVATE_KEY missing');
    if (!process.env.OPENAI_API_KEY) issues.push('OPENAI_API_KEY missing');
    
    if (issues.length > 0) {
      console.error('❌ Configuration Issues:', issues);
      return false;
    }
    
    console.log('✅ All required environment variables present');
    return true;
  }