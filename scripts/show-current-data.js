const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function showCurrentData() {
  console.log('📊 Current Database Contents');
  console.log('===========================\n');
  
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL not found');
    return;
  }
  
  try {
    const sql = postgres(process.env.DATABASE_URL);
    
    // Show all groups
    const groups = await sql`
      SELECT id, name, created_by, total_funds, member_count 
      FROM investment_groups 
      ORDER BY created_at
    `;
    
    console.log(`🏛️  Investment Groups (${groups.length}):`);
    if (groups.length === 0) {
      console.log('   (No groups found)');
    } else {
      groups.forEach((group, i) => {
        console.log(`   ${i + 1}. "${group.name}" by ${group.created_by.slice(0, 8)}... - $${group.total_funds} (${group.member_count} members)`);
      });
    }
    
    // Show all members with group names
    const members = await sql`
      SELECT gm.wallet_address, ig.name as group_name, gm.contributed_amount, gm.voting_power
      FROM group_members gm
      JOIN investment_groups ig ON gm.group_id = ig.id
      ORDER BY gm.wallet_address, ig.name
    `;
    
    console.log(`\n👥 Group Members (${members.length}):`);
    if (members.length === 0) {
      console.log('   (No members found)');
    } else {
      let currentWallet = '';
      members.forEach(member => {
        if (member.wallet_address !== currentWallet) {
          console.log(`\n   ${member.wallet_address}:`);
          currentWallet = member.wallet_address;
        }
        console.log(`     • ${member.group_name} - $${member.contributed_amount} contributed, ${member.voting_power} voting power`);
      });
    }
    
    // Show proposals
    const proposals = await sql`
      SELECT p.title, p.requested_amount, p.status, ig.name as group_name, p.proposed_by
      FROM proposals p
      JOIN investment_groups ig ON p.group_id = ig.id
      ORDER BY p.created_at
    `;
    
    console.log(`\n🗳️  Proposals (${proposals.length}):`);
    if (proposals.length === 0) {
      console.log('   (No proposals found)');
    } else {
      proposals.forEach((proposal, i) => {
        console.log(`   ${i + 1}. "${proposal.title}" in "${proposal.group_name}" - $${proposal.requested_amount} (${proposal.status})`);
      });
    }
    
    // Show votes
    const votes = await sql`
      SELECT v.vote, v.voting_power, v.voter_address, p.title as proposal_title
      FROM votes v
      JOIN proposals p ON v.proposal_id = p.id
      ORDER BY v.voted_at
    `;
    
    console.log(`\n✅ Votes Cast (${votes.length}):`);
    if (votes.length === 0) {
      console.log('   (No votes found)');
    } else {
      votes.forEach((vote, i) => {
        console.log(`   ${i + 1}. ${vote.voter_address.slice(0, 8)}... voted "${vote.vote}" on "${vote.proposal_title}" (${vote.voting_power} power)`);
      });
    }
    
    await sql.end();
    
    console.log('\n🧪 Test these API endpoints:');
    console.log(`   curl "http://localhost:3000/api/user-groups?address=0x123456789abcdef"`);
    console.log(`   curl "http://localhost:3000/api/groups"`);
    console.log(`   curl "http://localhost:3000/api/proposals"`);
    
  } catch (error) {
    console.error('❌ Failed to show data:', error.message);
  }
}

showCurrentData();