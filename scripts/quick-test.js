const fs = require('fs');
const path = require('path');

async function quickTest() {
  console.log('🧪 EchoFi Agent Quick Test Started\n');

  // Test 1: Environment Variables
  console.log('📋 Step 1: Checking Environment Variables...');
  const requiredVars = ['CDP_API_KEY_NAME', 'CDP_API_KEY_PRIVATE_KEY', 'OPENAI_API_KEY'];
  const missing = [];
  
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      console.log(`✅ ${varName}: ${process.env[varName].substring(0, 10)}...`);
    } else {
      console.log(`❌ ${varName}: MISSING`);
      missing.push(varName);
    }
  }
  
  console.log(`✅ NETWORK_ID: ${process.env.NETWORK_ID || 'base-sepolia (default)'}`);
  console.log(`✅ NODE_ENV: ${process.env.NODE_ENV || 'development (default)'}\n`);

  if (missing.length > 0) {
    console.error(`❌ Missing environment variables: ${missing.join(', ')}`);
    console.error('Please check your .env file and try again.\n');
    return false;
  }

  // Test 2: File Structure
  console.log('📁 Step 2: Checking File Structure...');
  const files = [
    'src/lib/agentkit/create-agent.ts',
    'src/lib/agentkit/prepare-agentkit.ts',
    'src/app/api/agent/route.ts'
  ];

  for (const file of files) {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file} exists`);
    } else {
      console.log(`❌ ${file} missing`);
      return false;
    }
  }
  console.log('');

  // Test 3: Dependencies
  console.log('📦 Step 3: Checking Dependencies...');
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    const requiredDeps = [
      '@coinbase/agentkit',
      '@coinbase/agentkit-langchain',
      '@langchain/openai',
      '@langchain/langgraph'
    ];

    for (const dep of requiredDeps) {
      if (deps[dep]) {
        console.log(`✅ ${dep}: ${deps[dep]}`);
      } else {
        console.log(`❌ ${dep}: MISSING`);
        return false;
      }
    }
    console.log('');
  } catch (error) {
    console.error('❌ Could not read package.json');
    return false;
  }

  // Test 4: Agent Initialization
  console.log('🤖 Step 4: Testing Agent Initialization...');
  try {
    // Dynamic import to handle TypeScript files
    const { createAgent } = await import('./src/lib/agentkit/create-agent.js').catch(() => {
      console.log('⚠️ Using require fallback for TypeScript...');
      // If running in development with ts-node
      return require('./src/lib/agentkit/create-agent.ts');
    });

    console.log('🚀 Initializing agent...');
    const startTime = Date.now();
    const agent = await createAgent();
    const initTime = Date.now() - startTime;

    console.log(`✅ Agent initialized successfully in ${initTime}ms`);
    console.log(`✅ Agent type: ${typeof agent}`);
    console.log('');

    return true;
  } catch (error) {
    console.error('❌ Agent initialization failed:');
    console.error(error.message);
    console.log('');
    return false;
  }
}

// Test 5: API Health Check (if server is running)
async function testAPI() {
  console.log('🌐 Step 5: Testing API Health (if server is running)...');
  
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('http://localhost:3000/api/agent', {
      method: 'GET'
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Health Check passed');
      console.log(`✅ Status: ${data.status}`);
      console.log(`✅ Network: ${data.details?.networkId || 'Unknown'}`);
      console.log('');
      return true;
    } else {
      console.log(`⚠️ API returned status ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('⚠️ API test skipped (server not running or no network)');
    console.log('   Start your server with: npm run dev');
    console.log('');
    return null; // Not a failure, just skipped
  }
}

// Test 6: Wallet Data Check
function testWalletData() {
  console.log('💰 Step 6: Checking Wallet Data...');
  
  try {
    if (fs.existsSync('wallet_data.json')) {
      const walletData = JSON.parse(fs.readFileSync('wallet_data.json', 'utf8'));
      console.log('✅ Wallet data file exists');
      console.log(`✅ Has private key: ${walletData.privateKey ? 'Yes' : 'No'}`);
      console.log(`✅ Has smart wallet: ${walletData.smartWalletAddress ? 'Yes' : 'No'}`);
      if (walletData.smartWalletAddress) {
        console.log(`✅ Smart wallet address: ${walletData.smartWalletAddress}`);
      }
    } else {
      console.log('ℹ️ No wallet_data.json found (will be created on first run)');
    }
    console.log('');
    return true;
  } catch (error) {
    console.log('⚠️ Could not read wallet data:', error.message);
    console.log('');
    return false;
  }
}

// Main test runner
async function main() {
  const startTime = Date.now();
  
  console.log('🎯 EchoFi Agent Real Values Test Suite');
  console.log('=====================================\n');

  const results = [];
  
  // Run all tests
  results.push(['Environment Variables', await quickTest()]);
  results.push(['Wallet Data', testWalletData()]);
  results.push(['API Health', await testAPI()]);

  // Summary
  const totalTime = Date.now() - startTime;
  console.log('📊 Test Results Summary');
  console.log('=======================');
  
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const [test, result] of results) {
    if (result === true) {
      console.log(`✅ ${test}: PASSED`);
      passed++;
    } else if (result === false) {
      console.log(`❌ ${test}: FAILED`);
      failed++;
    } else {
      console.log(`⚠️ ${test}: SKIPPED`);
      skipped++;
    }
  }

  console.log(`\n📈 Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log(`⏱️ Total time: ${totalTime}ms\n`);

  if (failed === 0) {
    console.log('🎉 All tests passed! Your EchoFi agent is ready with real values.');
    console.log('\n🚀 Next steps:');
    console.log('1. Start your server: npm run dev');
    console.log('2. Open http://localhost:3000 in your browser');
    console.log('3. Look for the "🐛 Debug Info" button to see real values');
    console.log('4. Test with: curl -X GET http://localhost:3000/api/agent');
  } else {
    console.log('❌ Some tests failed. Please fix the issues above and try again.');
    process.exit(1);
  }
}

// Load environment variables
if (fs.existsSync('.env')) {
  require('dotenv').config();
} else {
  console.log('⚠️ No .env file found. Make sure to set environment variables manually.');
}

main().catch(error => {
  console.error('💥 Test suite crashed:', error);
  process.exit(1);
});