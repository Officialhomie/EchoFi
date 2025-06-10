// scripts/debug-env.js
const fs = require('fs');
const path = require('path');

console.log('🔍 EchoFi Environment Debug Script');
console.log('==================================\n');

// Check for .env files
const envFiles = ['.env.local', '.env'];
let foundEnvFile = false;

envFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`📁 ${file}: ${exists ? '✅ Found' : '❌ Not found'}`);
  
  if (exists) {
    foundEnvFile = true;
    try {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      console.log(`   📝 Contains ${lines.length} environment variables`);
      
      // Check for DATABASE_URL specifically
      const dbUrlLine = lines.find(line => line.startsWith('DATABASE_URL'));
      if (dbUrlLine) {
        const dbUrl = dbUrlLine.split('=')[1]?.replace(/"/g, '');
        if (dbUrl && dbUrl.length > 0 && !dbUrl.includes('your_') && !dbUrl.includes('placeholder')) {
          console.log(`   🔗 DATABASE_URL: ✅ Set (${dbUrl.substring(0, 20)}...)`);
        } else {
          console.log(`   🔗 DATABASE_URL: ❌ Not properly configured`);
          console.log(`      Current value: ${dbUrl}`);
        }
      } else {
        console.log(`   🔗 DATABASE_URL: ❌ Not found in ${file}`);
      }
    } catch (err) {
      console.log(`   ❌ Error reading ${file}:`, err.message);
    }
  }
});

if (!foundEnvFile) {
  console.log('\n❌ No environment files found!');
  console.log('📝 Create .env.local with your environment variables:');
  console.log('   touch .env.local');
  console.log('   echo "DATABASE_URL=your_database_url_here" >> .env.local');
}

console.log('\n🧪 Testing environment variable loading...');

// Test loading with dotenv
try {
  require('dotenv').config({ path: '.env.local' });
  require('dotenv').config({ path: '.env' });
  
  if (process.env.DATABASE_URL) {
    console.log('✅ DATABASE_URL loaded successfully');
    
    // Validate URL format
    const url = process.env.DATABASE_URL;
    if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
      console.log('✅ DATABASE_URL format appears correct');
      
      // Parse URL components
      try {
        const urlObj = new URL(url);
        console.log(`   Host: ${urlObj.hostname}`);
        console.log(`   Port: ${urlObj.port || '5432'}`);
        console.log(`   Database: ${urlObj.pathname.slice(1)}`);
        console.log(`   User: ${urlObj.username}`);
        console.log(`   Password: ${urlObj.password ? '✅ Set' : '❌ Missing'}`);
      } catch (e) {
        console.log('❌ DATABASE_URL is not a valid URL:', e.message);
      }
    } else {
      console.log('❌ DATABASE_URL should start with postgresql:// or postgres://');
      console.log(`   Current: ${url.substring(0, 20)}...`);
    }
  } else {
    console.log('❌ DATABASE_URL not loaded');
  }
} catch (err) {
  console.log('❌ Error loading environment variables:', err.message);
}

console.log('\n💡 Next Steps:');
if (!process.env.DATABASE_URL) {
  console.log('1. Create .env.local file with DATABASE_URL');
  console.log('2. Get your database URL from Supabase project settings');
  console.log('3. Format: postgresql://user:password@host:port/database');
} else {
  console.log('1. Environment looks good!');
  console.log('2. Try running: npx drizzle-kit push');
}

console.log('\n🔗 Helpful links:');
console.log('   Supabase Dashboard: https://supabase.com/dashboard');
console.log('   Database Settings: Project Settings → Database → Connection string');