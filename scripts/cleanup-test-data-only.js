const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function cleanupTestData() {
  console.log('🧹 Cleaning Up Test Data...');
  console.log('==========================\n');
  
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL not found');
    return;
  }
  
  try {
    const sql = postgres(process.env.DATABASE_URL);
    
    // Show what will be deleted
    console.log('📊 Current data count:');
    const groupCount = await sql`SELECT COUNT(*) as count FROM investment_groups`;
    const memberCount = await sql`SELECT COUNT(*) as count FROM group_members`;
    const proposalCount = await sql`SELECT COUNT(*) as count FROM proposals`;
    const voteCount = await sql`SELECT COUNT(*) as count FROM votes`;
    
    console.log(`   📋 Groups: ${groupCount[0].count}`);
    console.log(`   👥 Members: ${memberCount[0].count}`);
    console.log(`   🗳️  Proposals: ${proposalCount[0].count}`);
    console.log(`   ✅ Votes: ${voteCount[0].count}`);
    
    if (groupCount[0].count === 0 && memberCount[0].count === 0) {
      console.log('\n✅ Database is already clean!');
      await sql.end();
      return;
    }
    
    console.log('\n⚠️  This will delete ALL test data!');
    console.log('⚠️  Press Ctrl+C to cancel or wait 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Delete in correct order (foreign key constraints)
    console.log('\n🗑️  Deleting test data...');
    
    const votesDeleted = await sql`DELETE FROM votes`;
    console.log(`   ✅ Deleted ${votesDeleted.count} votes`);
    
    const proposalsDeleted = await sql`DELETE FROM proposals`;
    console.log(`   ✅ Deleted ${proposalsDeleted.count} proposals`);
    
    const membersDeleted = await sql`DELETE FROM group_members`;
    console.log(`   ✅ Deleted ${membersDeleted.count} members`);
    
    const groupsDeleted = await sql`DELETE FROM investment_groups`;
    console.log(`   ✅ Deleted ${groupsDeleted.count} groups`);
    
    await sql.end();
    
    console.log('\n🎉 Test data cleanup complete!');
    console.log('\n🧪 Verify cleanup:');
    console.log('   curl "http://localhost:3000/api/user-groups?address=0x123456789abcdef"');
    console.log('   Should return: {"groups":[],"total":0,"timestamp":"..."}');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  }
}

cleanupTestData();