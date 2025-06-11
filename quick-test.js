// Quick test for EchoFi agent
console.log('🧪 EchoFi Agent Quick Test');

// Test environment variables
const requiredVars = ['CDP_API_KEY_NAME', 'CDP_API_KEY_PRIVATE_KEY', 'OPENAI_API_KEY'];
console.log('\n📋 Environment Variables:');
for (const varName of requiredVars) {
  if (process.env[varName]) {
    console.log(`✅ ${varName}: ${process.env[varName].substring(0, 10)}...`);
  } else {
    console.log(`❌ ${varName}: MISSING`);
  }
}

console.log('✅ Test completed! Now run: npm run dev');
