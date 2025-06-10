// scripts/check-database.js
const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function checkDatabaseState() {
  console.log('🔍 Checking Supabase Database State...');
  console.log('====================================\n');
  
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL not found');
    return;
  }
  
  try {
    const sql = postgres(process.env.DATABASE_URL);
    
    // Check existing tables
    console.log('1. Checking existing tables...');
    const tables = await sql`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    if (tables.length === 0) {
      console.log('✅ No existing tables found - clean database');
    } else {
      console.log(`📋 Found ${tables.length} existing tables:`);
      tables.forEach(table => {
        console.log(`   - ${table.table_name} (${table.table_type})`);
      });
    }
    
    // Check for constraints that might cause issues
    console.log('\n2. Checking constraints...');
    const constraints = await sql`
      SELECT 
        conname as constraint_name, 
        contype as constraint_type,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ORDER BY conname
    `;
    
    if (constraints.length === 0) {
      console.log('✅ No existing constraints found');
    } else {
      console.log(`📋 Found ${constraints.length} constraints:`);
      constraints.forEach(constraint => {
        console.log(`   - ${constraint.constraint_name} (${constraint.constraint_type})`);
        if (constraint.constraint_type === 'c') { // CHECK constraints
          console.log(`     Definition: ${constraint.definition}`);
        }
      });
    }
    
    // Check for Drizzle migrations table
    console.log('\n3. Checking for Drizzle migrations...');
    const migrationTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%migration%'
    `;
    
    if (migrationTables.length > 0) {
      console.log('📋 Found migration tables:');
      migrationTables.forEach(table => {
        console.log(`   - ${table.table_name}`);
      });
    } else {
      console.log('✅ No migration tables found');
    }
    
    await sql.end();
    
    // Provide recommendations
    console.log('\n🎯 Recommendations:');
    if (tables.length === 0) {
      console.log('   ✨ Database is clean - proceed with migrations');
    } else {
      console.log('   🧹 Consider clearing existing tables if they\'re not needed');
      console.log('   🔄 Or try alternative migration approach');
    }
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  }
}

checkDatabaseState();