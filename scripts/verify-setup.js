const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function verifySetup() {
  console.log('✅ Verifying Database Setup (Fixed)...');
  console.log('====================================\n');
  
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL not found');
    return;
  }
  
  try {
    const sql = postgres(process.env.DATABASE_URL);
    
    // Check all required tables exist
    console.log('1. Checking required tables...');
    const requiredTables = ['investment_groups', 'group_members', 'proposals', 'votes'];
    const existingTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ANY(${requiredTables})
    `;
    
    const tableNames = existingTables.map(t => t.table_name);
    
    requiredTables.forEach(table => {
      if (tableNames.includes(table)) {
        console.log(`   ✅ ${table}`);
      } else {
        console.log(`   ❌ ${table} - MISSING!`);
      }
    });
    
    if (tableNames.length === 4) {
      console.log('\n✅ All tables present!');
    } else {
      console.log(`\n❌ Missing ${4 - tableNames.length} tables`);
      await sql.end();
      return;
    }
    
    // Test basic operations with proper string handling
    console.log('\n2. Testing basic operations...');
    
    // Test insert/select/delete on investment_groups
    const testGroupId = `test-${Date.now()}`;
    const testXmtpId = `${testGroupId}-xmtp`;
    
    await sql`
      INSERT INTO investment_groups (id, name, xmtp_group_id, created_by) 
      VALUES (${testGroupId}, 'Test Group', ${testXmtpId}, '0x123456')
    `;
    
    const testGroup = await sql`
      SELECT id, name, xmtp_group_id FROM investment_groups WHERE id = ${testGroupId}
    `;
    
    if (testGroup.length > 0) {
      console.log(`   ✅ Insert/Select works: Found group "${testGroup[0].name}" with XMTP ID "${testGroup[0].xmtp_group_id}"`);
    } else {
      console.log('   ❌ Insert/Select failed');
    }
    
    // Test group_members table with foreign key
    console.log('\n3. Testing relationships...');
    
    const testMemberId = `member-${Date.now()}`;
    await sql`
      INSERT INTO group_members (id, group_id, wallet_address) 
      VALUES (${testMemberId}, ${testGroupId}, '0x789abc')
    `;
    
    const testMember = await sql`
      SELECT gm.id, gm.wallet_address, ig.name as group_name
      FROM group_members gm
      JOIN investment_groups ig ON gm.group_id = ig.id
      WHERE gm.id = ${testMemberId}
    `;
    
    if (testMember.length > 0) {
      console.log(`   ✅ Foreign key relationship works: Member ${testMember[0].wallet_address} joined "${testMember[0].group_name}"`);
    }
    
    // Test proposals table
    const testProposalId = `proposal-${Date.now()}`;
    await sql`
      INSERT INTO proposals (id, group_id, title, description, strategy, requested_amount, proposed_by, deadline, required_votes)
      VALUES (${testProposalId}, ${testGroupId}, 'Test Proposal', 'Test Description', 'Test Strategy', '1000.50', '0x123456', NOW() + INTERVAL '7 days', 3)
    `;
    
    const testProposal = await sql`
      SELECT title, requested_amount FROM proposals WHERE id = ${testProposalId}
    `;
    
    if (testProposal.length > 0) {
      console.log(`   ✅ Proposals table works: "${testProposal[0].title}" requesting ${testProposal[0].requested_amount}`);
    }
    
    // Test votes table
    const testVoteId = `vote-${Date.now()}`;
    await sql`
      INSERT INTO votes (id, proposal_id, voter_address, vote)
      VALUES (${testVoteId}, ${testProposalId}, '0x789abc', 'approve')
    `;
    
    const testVote = await sql`
      SELECT vote FROM votes WHERE id = ${testVoteId}
    `;
    
    if (testVote.length > 0) {
      console.log(`   ✅ Votes table works: Vote recorded as "${testVote[0].vote}"`);
    }
    
    // Clean up all test data
    console.log('\n4. Cleaning up test data...');
    await sql`DELETE FROM votes WHERE id = ${testVoteId}`;
    await sql`DELETE FROM proposals WHERE id = ${testProposalId}`;
    await sql`DELETE FROM group_members WHERE id = ${testMemberId}`;
    await sql`DELETE FROM investment_groups WHERE id = ${testGroupId}`;
    console.log('   ✅ All test data cleaned up');
    
    await sql.end();
    
    console.log('\n🎉 Database setup verification PASSED!');
    console.log('\n🎯 Your database is ready! Next steps:');
    console.log('   1. Create your API files (if not done yet)');
    console.log('   2. Start your app: npm run dev');
    console.log('   3. Test endpoint: curl "http://localhost:3000/api/user-groups?address=0x123"');
    console.log('   4. Should return JSON response instead of 404!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.log('\n💡 Common fixes:');
    console.log('   - Make sure all tables have the correct column names');
    console.log('   - Check if foreign key constraints are properly set up');
    console.log('   - Verify data types match your schema definition');
  }
}

verifySetup();