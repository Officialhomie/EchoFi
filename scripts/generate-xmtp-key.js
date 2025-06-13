// scripts/generate-xmtp-key.js - Executable script to generate XMTP encryption key
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔑 EchoFi XMTP Encryption Key Generator');
console.log('=====================================');

try {
  // Generate 32 random bytes (256 bits) for AES-256 encryption
  const key = crypto.randomBytes(32);
  const hexKey = `0x${key.toString('hex')}`;
  const base64Key = key.toString('base64');
  
  console.log('\n🔑 Generated XMTP Encryption Key:');
  console.log(`Hex:    ${hexKey}`);
  console.log(`Base64: ${base64Key}`);
  
  // Update .env.local file
  const envPath = path.join(process.cwd(), '.env.local');
  let envContent = '';
  
  // Read existing .env.local if it exists
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Update or add the XMTP encryption key
  const xmtpKeyPattern = /^NEXT_PUBLIC_XMTP_ENCRYPTION_KEY=.*$/m;
  const newKeyLine = `NEXT_PUBLIC_XMTP_ENCRYPTION_KEY=${hexKey}`;
  
  if (xmtpKeyPattern.test(envContent)) {
    // Replace existing key
    envContent = envContent.replace(xmtpKeyPattern, newKeyLine);
    console.log('\n✅ Updated existing XMTP encryption key in .env.local');
  } else {
    // Add new key
    if (envContent && !envContent.endsWith('\n')) {
      envContent += '\n';
    }
    envContent += `\n# XMTP Encryption Key (Generated: ${new Date().toISOString()})\n`;
    envContent += `${newKeyLine}\n`;
    console.log('\n✅ Added new XMTP encryption key to .env.local');
  }
  
  // Write updated content
  fs.writeFileSync(envPath, envContent);
  
  console.log('\n📋 Next Steps:');
  console.log('==============');
  console.log('1. ✅ XMTP encryption key has been added to .env.local');
  console.log('2. 🚀 Restart your development server to use the new key');
  console.log('3. 🔒 Keep this key secure and do not commit to version control');
  
  console.log('\n⚠️  Security Note:');
  console.log('==================');
  console.log('• This key enables persistent XMTP message encryption');
  console.log('• Messages encrypted with this key will persist between sessions');
  console.log('• For production, generate a separate key and store securely');
  
} catch (error) {
  console.error('\n❌ Key generation failed:', error);
  process.exit(1);
}