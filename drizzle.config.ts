import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local and .env files
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// Debug: Check if DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  console.log('📝 Available env files:');
  console.log('   .env.local:', require('fs').existsSync('.env.local') ? '✅' : '❌');
  console.log('   .env:', require('fs').existsSync('.env') ? '✅' : '❌');
  console.log('💡 Make sure DATABASE_URL is set in .env.local or .env');
  process.exit(1);
}

console.log('✅ DATABASE_URL loaded successfully');
console.log('🔗 Database URL:', process.env.DATABASE_URL.replace(/:[^:]*@/, ':****@')); // Hide password

export default defineConfig({
  schema: './src/lib/db.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
  migrations: {
    table: 'drizzle_migrations',
    schema: 'public',
  },
});