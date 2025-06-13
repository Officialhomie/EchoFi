const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function cleanDatabase() {
  console.log('🧹 Cleaning Database for Fresh Start...');
  console.log('=====================================\n');
  
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL not found');
    return;
  }
  
  try {
    const sql = postgres(process.env.DATABASE_URL);
    
    console.log('⚠️  WARNING: This will delete ALL existing data!');
    console.log('Press Ctrl+C to cancel or wait 5 seconds...\n');
    
    // Give user time to cancel
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Drop views first (they depend on tables)
    console.log('1. Dropping existing views...');
    const views = await sql`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public'
    `;
    
    for (const view of views) {
      console.log(`   Dropping view: ${view.table_name}`);
      await sql`DROP VIEW IF EXISTS ${sql(view.table_name)} CASCADE`;
    }
    
    // Drop functions and triggers
    console.log('\n2. Dropping functions and triggers...');
    const functions = await sql`
      SELECT proname 
      FROM pg_proc 
      WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `;
    
    for (const func of functions) {
      console.log(`   Dropping function: ${func.proname}`);
      await sql`DROP FUNCTION IF EXISTS ${sql(func.proname)}() CASCADE`;
    }
    
    // Drop all tables with CASCADE to handle foreign keys
    console.log('\n3. Dropping existing tables...');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `;
    
    for (const table of tables) {
      console.log(`   Dropping table: ${table.table_name}`);
      await sql`DROP TABLE IF EXISTS ${sql(table.table_name)} CASCADE`;
    }
    
    // Drop migration table to start fresh
    console.log('\n4. Dropping migration history...');
    await sql`DROP TABLE IF EXISTS drizzle_migrations CASCADE`;
    
    // Verify database is clean
    console.log('\n5. Verifying clean state...');
    const remainingTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    if (remainingTables.length === 0) {
      console.log('✅ Database is now completely clean!');
    } else {
      console.log('⚠️  Some tables remain:');
      remainingTables.forEach(table => {
        console.log(`   - ${table.table_name}`);
      });
    }
    
    await sql.end();
    
    console.log('\n🎯 Next Steps:');
    console.log('   1. Run: npm run db:push');
    console.log('   2. Run: npm run dev');
    console.log('   3. Test your API endpoints');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  }
}

cleanDatabase();