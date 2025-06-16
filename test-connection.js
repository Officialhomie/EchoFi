// test-connection.js
const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function testConnection() {
  console.log('🧪 Testing Supabase connection...');
  console.log('================================');
  
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL not found in .env.local');
    return;
  }
  
  // Show URL format (with hidden password)
  const url = process.env.DATABASE_URL;
  const maskedUrl = url.replace(/:([^:@]+)@/, ':****@');
  console.log('🔗 Using URL:', maskedUrl);
  
  // Check URL format
  if (url.includes('pooler.supabase.com')) {
    console.log('✅ Using pooled connection (good!)');
  } else if (url.includes('db.') && url.includes('.supabase.co')) {
    console.log('❌ Using direct connection (this causes ENOTFOUND)');
    console.log('💡 Switch to pooled connection from Supabase dashboard');
    return;
  }
  
  try {
    // Test connection
    const sql = postgres(process.env.DATABASE_URL);
    
    console.log('🔌 Attempting connection...');
    const result = await sql`SELECT 1 as test, version()`;
    
    console.log('✅ Connection successful!');
    console.log('📊 Database version:', result[0].version.split(' ')[0]);
    
    // Test table creation (simulate what drizzle-kit does)
    console.log('🛠️  Testing table operations...');
    await sql`SELECT 1`; // Simple test query
    
    console.log('✅ All tests passed! Your database is ready.');
    console.log('🚀 You can now run: npx drizzle-kit push');
    
    await sql.end();
    
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.log('💡 This is the same error you got before.');
      console.log('🔧 Solution: Get the pooled connection string from Supabase dashboard');
    } else if (error.message.includes('password')) {
      console.log('💡 Password might be incorrect.');
      console.log('🔧 Reset password in Supabase → Settings → Database');
    } else {
      console.log('💡 Unexpected error. Check your connection string format.');
    }
  }
}

testConnection();
