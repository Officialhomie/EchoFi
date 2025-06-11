const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function setupEnvironment() {
  console.log('🚀 EchoFi Environment Setup');
  console.log('===========================\n');

  // Check if .env.local already exists
  if (fs.existsSync('.env.local')) {
    console.log('⚠️  .env.local already exists');
    const overwrite = await askQuestion('Do you want to overwrite it? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Setup cancelled. Please edit .env.local manually.');
      rl.close();
      return;
    }
  }

  console.log('Please provide the following environment variables:\n');

  // Collect required variables
  const envVars = {};

  console.log('1. CDP API Credentials (from https://portal.cdp.coinbase.com/)');
  envVars.CDP_API_KEY_NAME = await askQuestion('   CDP_API_KEY_NAME: ');
  envVars.CDP_API_KEY_PRIVATE_KEY = await askQuestion('   CDP_API_KEY_PRIVATE_KEY: ');

  console.log('\n2. OpenAI API Key (from https://platform.openai.com/api-keys)');
  envVars.OPENAI_API_KEY = await askQuestion('   OPENAI_API_KEY: ');

  console.log('\n3. Database Configuration');
  envVars.DATABASE_URL = await askQuestion('   DATABASE_URL (Supabase PostgreSQL URL): ');

  console.log('\n4. Optional: Network Configuration');
  const networkId = await askQuestion('   NETWORK_ID (base-sepolia for testing, base-mainnet for production) [base-sepolia]: ');
  envVars.NETWORK_ID = networkId || 'base-sepolia';

  const xmtpEnv = await askQuestion('   XMTP_ENV (dev for testing, production for mainnet) [dev]: ');
  envVars.NEXT_PUBLIC_XMTP_ENV = xmtpEnv || 'dev';

  // Generate .env.local content
  const envContent = `# EchoFi Environment Configuration
# Generated on ${new Date().toISOString()}

# =============================================================================
# COINBASE DEVELOPER PLATFORM (CDP) CREDENTIALS
# =============================================================================
CDP_API_KEY_NAME=${envVars.CDP_API_KEY_NAME}
CDP_API_KEY_PRIVATE_KEY=${envVars.CDP_API_KEY_PRIVATE_KEY}

# =============================================================================
# OPENAI CONFIGURATION
# =============================================================================
OPENAI_API_KEY=${envVars.OPENAI_API_KEY}

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================
DATABASE_URL=${envVars.DATABASE_URL}

# =============================================================================
# NETWORK CONFIGURATION
# =============================================================================
NETWORK_ID=${envVars.NETWORK_ID}

# =============================================================================
# XMTP CONFIGURATION
# =============================================================================
NEXT_PUBLIC_XMTP_ENV=${envVars.NEXT_PUBLIC_XMTP_ENV}

# =============================================================================
# APPLICATION CONFIGURATION
# =============================================================================
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# =============================================================================
# OPTIONAL FEATURES
# =============================================================================
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_AUTO_EXECUTION=false
NEXT_PUBLIC_ENABLE_ADVANCED=false
`;

  try {
    fs.writeFileSync('.env.local', envContent);
    console.log('\n✅ .env.local file created successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Restart your development server: npm run dev');
    console.log('2. Test the setup: node debug-env.js');
    console.log('3. Test the API: curl http://localhost:3000/api/agent');
    console.log('\n🔒 Security Note: Never commit .env.local to version control!');
  } catch (error) {
    console.error('❌ Failed to create .env.local:', error.message);
  }

  rl.close();
}

setupEnvironment().catch(console.error);