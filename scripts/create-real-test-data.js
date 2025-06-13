// scripts/create-real-test-data.js
const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function createRealTestData() {
  console.log('🏗️  Creating REAL Test Data...');
  console.log('==============================\n');
  
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL not found');
    return;
  }
  
  try {
    const sql = postgres(process.env.DATABASE_URL);
    
    console.log('📊 Creating realistic investment groups and members...\n');
    
    // Real-looking test data
    const testData = {
      groups: [
        {
          id: `group-${Date.now()}-1`,
          name: 'DeFi Yield Maximizers',
          description: 'A group focused on high-yield DeFi strategies',
          xmtp_group_id: `xmtp-defi-yield-${Date.now()}`,
          created_by: '0x123456789abcdef',
          total_funds: '25000.500000',
          member_count: 3
        },
        {
          id: `group-${Date.now()}-2`, 
          name: 'NFT Investment Collective',
          description: 'Investing in blue-chip NFT collections',
          xmtp_group_id: `xmtp-nft-collective-${Date.now()}`,
          created_by: '0x987654321fedcba',
          total_funds: '150000.750000',
          member_count: 5
        },
        {
          id: `group-${Date.now()}-3`,
          name: 'Base Ecosystem Fund',
          description: 'Early stage investments in Base L2 projects',
          xmtp_group_id: `xmtp-base-fund-${Date.now()}`,
          created_by: '0x123456789abcdef', // Same user as first group
          total_funds: '75000.000000',
          member_count: 4
        }
      ],
      members: [
        // User 0x123456789abcdef is in groups 1 and 3
        { wallet: '0x123456789abcdef', groups: [0, 2], voting_power: '2.5' },
        { wallet: '0x987654321fedcba', groups: [1], voting_power: '3.0' },
        { wallet: '0xabc123def456789', groups: [0, 1, 2], voting_power: '1.5' },
        { wallet: '0x456789abcdef123', groups: [0, 1], voting_power: '1.0' },
        { wallet: '0xfedcba987654321', groups: [2], voting_power: '2.0' }
      ]
    };
    
    // Insert groups
    console.log('1. Creating investment groups...');
    for (let i = 0; i < testData.groups.length; i++) {
      const group = testData.groups[i];
      await sql`
        INSERT INTO investment_groups (id, name, description, xmtp_group_id, created_by, total_funds, member_count)
        VALUES (${group.id}, ${group.name}, ${group.description}, ${group.xmtp_group_id}, ${group.created_by}, ${group.total_funds}, ${group.member_count})
      `;
      console.log(`   ✅ "${group.name}" - $${group.total_funds} - ${group.member_count} members`);
    }
    
    // Insert members
    console.log('\n2. Adding group members...');
    let memberCount = 0;
    for (const member of testData.members) {
      for (const groupIndex of member.groups) {
        const memberId = `member-${Date.now()}-${memberCount++}`;
        const groupId = testData.groups[groupIndex].id;
        const contributedAmount = (Math.random() * 10000).toFixed(6);
        
        await sql`
          INSERT INTO group_members (id, group_id, wallet_address, contributed_amount, voting_power, is_active)
          VALUES (${memberId}, ${groupId}, ${member.wallet}, ${contributedAmount}, ${member.voting_power}, true)
        `;
        console.log(`   ✅ ${member.wallet} joined "${testData.groups[groupIndex].name}" - $${contributedAmount} contributed`);
      }
    }
    
    // Create some proposals
    console.log('\n3. Creating active proposals...');
    const proposals = [
      {
        id: `proposal-${Date.now()}-1`,
        group_id: testData.groups[0].id,
        title: 'Invest in Compound V3 USDC Pool',
        description: 'Allocate 40% of treasury to Compound V3 for stable yields',
        strategy: 'Low-risk lending strategy targeting 4-6% APY',
        requested_amount: '10000.000000',
        proposed_by: '0x123456789abcdef',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        required_votes: 2
      },
      {
        id: `proposal-${Date.now()}-2`,
        group_id: testData.groups[1].id,
        title: 'Purchase Azuki NFT Collection',
        description: 'Acquire 3 Azuki NFTs for long-term holding',
        strategy: 'Blue-chip NFT accumulation strategy',
        requested_amount: '45000.500000',
        proposed_by: '0x987654321fedcba',
        deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        required_votes: 3
      }
    ];
    
    for (const proposal of proposals) {
      await sql`
        INSERT INTO proposals (id, group_id, title, description, strategy, requested_amount, proposed_by, deadline, required_votes, status)
        VALUES (${proposal.id}, ${proposal.group_id}, ${proposal.title}, ${proposal.description}, ${proposal.strategy}, ${proposal.requested_amount}, ${proposal.proposed_by}, ${proposal.deadline}, ${proposal.required_votes}, 'active')
      `;
      console.log(`   ✅ "${proposal.title}" - $${proposal.requested_amount} requested`);
    }
    
    // Add some votes
    console.log('\n4. Adding votes to proposals...');
    const votes = [
      {
        id: `vote-${Date.now()}-1`,
        proposal_id: proposals[0].id,
        voter_address: '0xabc123def456789',
        vote: 'approve',
        voting_power: '1.5'
      },
      {
        id: `vote-${Date.now()}-2`,
        proposal_id: proposals[1].id,
        voter_address: '0x456789abcdef123',
        vote: 'reject',
        voting_power: '1.0'
      }
    ];
    
    for (const vote of votes) {
      await sql`
        INSERT INTO votes (id, proposal_id, voter_address, vote, voting_power)
        VALUES (${vote.id}, ${vote.proposal_id}, ${vote.voter_address}, ${vote.vote}, ${vote.voting_power})
      `;
      console.log(`   ✅ ${vote.voter_address} voted "${vote.vote}" with ${vote.voting_power} power`);
    }
    
    await sql.end();
    
    console.log('\n🎉 Real test data created successfully!');
    console.log('\n🧪 Now test your API with REAL data:');
    console.log('   User with 2 groups: curl "http://localhost:3000/api/user-groups?address=0x123456789abcdef"');
    console.log('   User with 1 group:  curl "http://localhost:3000/api/user-groups?address=0x987654321fedcba"');
    console.log('   User with 3 groups: curl "http://localhost:3000/api/user-groups?address=0xabc123def456789"');
    console.log('   All groups:         curl "http://localhost:3000/api/groups"');
    
    console.log('\n📋 Test Data Summary:');
    console.log('   📊 3 investment groups created');
    console.log('   👥 5 unique wallet addresses');
    console.log('   🗳️  2 active proposals');
    console.log('   ✅ 2 votes cast');
    console.log('   💰 Total funds: $250,000+');
    
  } catch (error) {
    console.error('❌ Failed to create test data:', error.message);
  }
}

createRealTestData();