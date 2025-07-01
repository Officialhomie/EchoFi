#!/bin/bash

# Environment Variable Diagnosis Script
# Run this in your project root to diagnose configuration issues

echo "🔍 EchoFi Environment Diagnostic Report"
echo "======================================="
echo "Timestamp: $(date)"
echo "Current Directory: $(pwd)"
echo ""

# Check for .env files
echo "📁 Environment File Check:"
for env_file in ".env" ".env.local" ".env.development" ".env.production"; do
    if [ -f "$env_file" ]; then
        echo "✅ $env_file exists"
        lines=$(grep -v '^#' "$env_file" | grep -v '^$' | wc -l)
        echo "   📝 Contains $lines non-comment lines"
    else
        echo "❌ $env_file not found"
    fi
done
echo ""

# Check Node.js environment loading
echo "🚀 Node.js Environment Variable Loading Test:"
node -e "
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const requiredVars = [
    'CDP_API_KEY_NAME',
    'CDP_API_KEY_PRIVATE_KEY', 
    'OPENAI_API_KEY',
    'DATABASE_URL',
    'NETWORK_ID'
];

let allPresent = true;

console.log('Required Variables:');
requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
        const masked = varName.includes('KEY') || varName.includes('URL') ? 
            value.substring(0, 15) + '...' : value;
        console.log('✅', varName + ':', masked);
    } else {
        console.log('❌', varName + ':', 'NOT SET');
        allPresent = false;
    }
});

console.log('');
if (allPresent) {
    console.log('✅ All required variables are set');
} else {
    console.log('❌ Some required variables are missing');
    console.log('');
    console.log('Quick Fix:');
    console.log('1. Create .env.local file in project root');
    console.log('2. Add missing variables with your actual values');
    console.log('3. Restart development server');
}
"

echo ""
echo "🔧 CDP API Key Format Check:"
node -e "
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const keyName = process.env.CDP_API_KEY_NAME;
const privateKey = process.env.CDP_API_KEY_PRIVATE_KEY;

if (keyName && privateKey) {
    console.log('Key Name Format:', keyName.length > 20 ? '✅ Looks valid' : '⚠️ Seems too short');
    console.log('Private Key Format:', privateKey.length > 100 ? '✅ Looks valid' : '⚠️ Seems too short');
    
    // Check for common issues
    if (keyName.includes('your_') || privateKey.includes('your_')) {
        console.log('❌ Placeholder values detected - replace with actual keys');
    }
    if (keyName.includes(' ') || privateKey.includes(' ')) {
        console.log('⚠️ Spaces detected in keys - this may cause issues');
    }
} else {
    console.log('❌ CDP API keys not found in environment variables');
}
"

echo ""
echo "🧪 Agent Endpoint Health Test:"
if command -v curl &> /dev/null; then
    echo "Testing /api/agent health endpoint..."
    curl -s -o /dev/null -w "Status: %{http_code}" http://localhost:3000/api/agent || echo "❌ Cannot reach development server"
    echo ""
else
    echo "❌ curl not available - cannot test endpoint"
fi

echo ""
echo "💡 Next Steps:"
echo "1. Fix any missing environment variables above"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Run the Agent API test script for detailed diagnosis"