// scripts/inspect-existing-tables.js
const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function inspectExistingTables() {
  console.log('🔍 Inspecting Existing Tables...');
  console.log('===============================\n');
  
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL not found');
    return;
  }
  
  try {
    const sql = postgres(process.env.DATABASE_URL);
    
    // Check structure of each table
    const tables = ['groups', 'group_members', 'proposals', 'votes'];
    
    for (const tableName of tables) {
      console.log(`📋 Table: ${tableName}`);
      console.log('─'.repeat(50));
      
      // Get column information
      const columns = await sql`
        SELECT 
          column_name, 
          data_type, 
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
        ORDER BY ordinal_position
      `;
      
      if (columns.length === 0) {
        console.log(`❌ Table ${tableName} not found`);
      } else {
        columns.forEach(col => {
          console.log(`   ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}${col.column_default ? ` DEFAULT ${col.column_default}` : ''}`);
        });
        
        // Check if table has data
        const count = await sql`SELECT COUNT(*) as count FROM ${sql(tableName)}`;
        console.log(`   📊 Records: ${count[0].count}`);
      }
      console.log('');
    }
    
    // Check what migration was last applied
    console.log('📋 Drizzle Migrations:');
    console.log('─'.repeat(50));
    const migrations = await sql`
      SELECT * FROM drizzle_migrations ORDER BY created_at DESC LIMIT 5
    `;
    
    if (migrations.length === 0) {
      console.log('   No migrations found');
    } else {
      migrations.forEach(migration => {
        console.log(`   ${migration.hash} - ${migration.created_at}`);
      });
    }
    
    await sql.end();
    
  } catch (error) {
    console.error('❌ Inspection failed:', error.message);
  }
}

inspectExistingTables();