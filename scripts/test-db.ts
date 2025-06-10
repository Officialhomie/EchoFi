// scripts/test-db.ts
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function testDatabaseConnection() {
  try {
    console.log('🧪 Testing database connection...');
    
    // Test basic connection
    const result = await db.execute(sql`SELECT 1 as test`);
    console.log('✅ Database connection successful!', result);
    
    // Test if tables exist
    const tablesResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('investment_groups', 'group_members', 'proposals', 'votes')
    `);
    
    let tableNames: string[] = [];
    if (Array.isArray(tablesResult)) {
      tableNames = tablesResult.map((row) => (row as { table_name?: string }).table_name).filter(Boolean) as string[];
    }
    console.log('📊 Found tables:', tableNames);
    
    if (tableNames.length === 0) {
      console.log('❌ No EchoFi tables found. You need to run migrations!');
      console.log('🔧 Run: npx drizzle-kit push');
    } else if (tableNames.length < 4) {
      console.log('⚠️  Some tables missing. Expected 4 tables, found:', tableNames.length);
      console.log('🔧 Run: npx drizzle-kit push');
    } else {
      console.log('✅ All tables found!');
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('connect')) {
        console.log('💡 Possible fixes:');
        console.log('   1. Check your DATABASE_URL in .env.local');
        console.log('   2. Make sure your database server is running');
        console.log('   3. Check your database credentials');
      }
    }
  }
}

testDatabaseConnection();