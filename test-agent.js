// test-agent.js - Manual agent testing
require('dotenv').config({ path: '.env.local' });

async function testAgent() {
  console.log('🧪 Testing Agent Initialization...');
  console.log('===================================');
  
  // Check environment variables
  const requiredVars = ['CDP_API_KEY_NAME', 'CDP_API_KEY_PRIVATE_KEY', 'OPENAI_API_KEY'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.log('❌ Missing environment variables:', missing);
    return;
  }
  
  console.log('✅ All required environment variables present');
  console.log('📊 Environment check:');
  console.log(`   CDP_API_KEY_NAME: ${process.env.CDP_API_KEY_NAME?.substring(0, 20)}...`);
  console.log(`   CDP_API_KEY_PRIVATE_KEY: ${process.env.CDP_API_KEY_PRIVATE_KEY?.substring(0, 20)}...`);
  console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY?.substring(0, 20)}...`);
  
  try {
    // Test the health endpoint directly
    console.log('\n🔍 Testing agent health endpoint...');
    
    const response = await fetch('http://localhost:3000/api/agent', {
      method: 'GET',
    });
    
    console.log(`Response status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Agent health check passed:', data);
    } else {
      const errorText = await response.text();
      console.log('❌ Agent health check failed:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAgent();