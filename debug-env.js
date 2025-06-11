// debug-env.js - Run this to check your environment setup
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

console.log('🔍 Environment Variable Debug Report');
console.log('=====================================');

// Check if .env files exist
const fs = require('fs');
const envFiles = ['.env.local', '.env'];

envFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`📁 ${file}: ${exists ? '✅ Found' : '❌ Not found'}`);
  
  if (exists) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n').filter(line => 
        line.trim() && 
        !line.startsWith('#') && 
        line.includes('=')
      );
      console.log(`   📝 Contains ${lines.length} environment variables`);
      
      // Check for required variables
      const requiredVars = [
        'CDP_API_KEY_NAME',
        'CDP_API_KEY_PRIVATE_KEY', 
        'OPENAI_API_KEY'
      ];
      
      requiredVars.forEach(varName => {
        const line = lines.find(l => l.startsWith(varName + '='));
        if (line) {
          const value = line.split('=')[1]?.replace(/"/g, '');
          const hasValue = value && value.length > 0 && !value.includes('your_');
          console.log(`   🔑 ${varName}: ${hasValue ? '✅ Set' : '❌ Empty/placeholder'}`);
        } else {
          console.log(`   🔑 ${varName}: ❌ Not found`);
        }
      });
    } catch (err) {
      console.log(`   ❌ Error reading ${file}:`, err.message);
    }
  }
});

console.log('\n🧪 Environment Variable Loading Test:');
console.log('====================================');

// Test loading with current process.env
const envVars = {
  CDP_API_KEY_NAME: process.env.CDP_API_KEY_NAME,
  CDP_API_KEY_PRIVATE_KEY: process.env.CDP_API_KEY_PRIVATE_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  NETWORK_ID: process.env.NETWORK_ID,
  NODE_ENV: process.env.NODE_ENV
};

Object.entries(envVars).forEach(([key, value]) => {
  if (value) {
    const maskedValue = key.includes('KEY') ? 
      value.substring(0, 10) + '...' : 
      value;
    console.log(`✅ ${key}: ${maskedValue}`);
  } else {
    console.log(`❌ ${key}: NOT SET`);
  }
});

console.log('\n💡 Next Steps:');
if (!process.env.CDP_API_KEY_NAME || !process.env.CDP_API_KEY_PRIVATE_KEY || !process.env.OPENAI_API_KEY) {
  console.log('1. Create .env.local file in your project root');
  console.log('2. Add your environment variables:');
  console.log('   CDP_API_KEY_NAME=your_actual_key_name');
  console.log('   CDP_API_KEY_PRIVATE_KEY=your_actual_private_key');
  console.log('   OPENAI_API_KEY=your_actual_openai_key');
  console.log('3. Restart your development server');
} else {
  console.log('✅ Environment variables are properly set!');
}
