import { db, investmentGroups, groupMembers, proposals, votes } from './db';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import { generateId } from './utils';

// Enhanced group analytics with accurate proposal counting
export async function getGroupAnalytics(groupId: string) {
  try {
    // Get group basic info
    const [group] = await db
      .select({
        id: investmentGroups.id,
        name: investmentGroups.name,
        totalFunds: investmentGroups.totalFunds,
        memberCount: investmentGroups.memberCount,
        createdAt: investmentGroups.createdAt,
      })
      .from(investmentGroups)
      .where(eq(investmentGroups.id, groupId));

    if (!group) {
      throw new Error('Group not found');
    }

    // Get detailed proposal statistics
    const proposalStats = await db
      .select({
        status: proposals.status,
        count: count(proposals.id).as('count'),
      })
      .from(proposals)
      .where(eq(proposals.groupId, groupId))
      .groupBy(proposals.status);

    // Get active proposals count (active + not expired)
    const activeProposalsCount = await db
      .select({
        count: count(proposals.id).as('count'),
      })
      .from(proposals)
      .where(
        and(
          eq(proposals.groupId, groupId),
          eq(proposals.status, 'active'),
          sql`${proposals.deadline} > NOW()`
        )
      );

    // Get recent activity (last 5 proposals with vote counts)
    const recentActivity = await db
      .select({
        proposal: {
          id: proposals.id,
          title: proposals.title,
          status: proposals.status,
          createdAt: proposals.createdAt,
          deadline: proposals.deadline,
          requestedAmount: proposals.requestedAmount,
          proposedBy: proposals.proposedBy,
        },
        voteCount: count(votes.id).as('voteCount'),
      })
      .from(proposals)
      .leftJoin(votes, eq(proposals.id, votes.proposalId))
      .where(eq(proposals.groupId, groupId))
      .groupBy(proposals.id)
      .orderBy(desc(proposals.createdAt))
      .limit(5);

    // Get member activity summary
    const memberActivity = await db
      .select({
        totalMembers: count(groupMembers.id).as('totalMembers'),
        activeMembers: sql<number>`COUNT(CASE WHEN ${groupMembers.isActive} = true THEN 1 END)`.as('activeMembers'),
      })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));

    // Get voting statistics
    const votingStats = await db
      .select({
        totalVotes: count(votes.id).as('totalVotes'),
        uniqueVoters: sql<number>`COUNT(DISTINCT ${votes.voterAddress})`.as('uniqueVoters'),
      })
      .from(votes)
      .innerJoin(proposals, eq(votes.proposalId, proposals.id))
      .where(eq(proposals.groupId, groupId));

    return {
      group,
      proposalStats,
      activeProposalsCount: activeProposalsCount[0]?.count || 0,
      recentActivity,
      memberActivity: memberActivity[0] || { totalMembers: 0, activeMembers: 0 },
      votingStats: votingStats[0] || { totalVotes: 0, uniqueVoters: 0 },
      summary: {
        totalProposals: proposalStats.reduce((sum, stat) => sum + stat.count, 0),
        activeProposals: activeProposalsCount[0]?.count || 0,
        completedProposals: proposalStats
          .filter(stat => stat.status && ['approved', 'rejected', 'executed'].includes(String(stat.status)))
          .reduce((sum, stat) => sum + stat.count, 0),
      }
    };
  } catch (error) {
    console.error('Failed to get group analytics:', error);
    throw new Error(`Failed to fetch group analytics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Enhanced user analytics
export async function getUserAnalytics(walletAddress: string) {
  try {
    // Get user groups with proposal counts
    const userGroups = await db
      .select({
        group: investmentGroups,
        member: groupMembers,
        proposalCount: sql<number>`(
          SELECT COUNT(*) FROM ${proposals} 
          WHERE ${proposals.groupId} = ${investmentGroups.id}
        )`.as('proposalCount'),
        activeProposalCount: sql<number>`(
          SELECT COUNT(*) FROM ${proposals} 
          WHERE ${proposals.groupId} = ${investmentGroups.id} 
          AND ${proposals.status} = 'active'
          AND ${proposals.deadline} > NOW()
        )`.as('activeProposalCount'),
      })
      .from(investmentGroups)
      .innerJoin(groupMembers, eq(investmentGroups.id, groupMembers.groupId))
      .where(
        and(
          eq(groupMembers.walletAddress, walletAddress),
          eq(groupMembers.isActive, true)
        )
      )
      .orderBy(desc(groupMembers.joinedAt));

    // Get user proposals with vote counts
    const userProposals = await db
      .select({
        proposal: proposals,
        voteCount: count(votes.id).as('voteCount'),
        approvalVotes: sql<number>`COUNT(CASE WHEN ${votes.vote} = 'approve' THEN 1 END)`.as('approvalVotes'),
        rejectionVotes: sql<number>`COUNT(CASE WHEN ${votes.vote} = 'reject' THEN 1 END)`.as('rejectionVotes'),
      })
      .from(proposals)
      .leftJoin(votes, eq(proposals.id, votes.proposalId))
      .where(eq(proposals.proposedBy, walletAddress))
      .groupBy(proposals.id)
      .orderBy(desc(proposals.createdAt));

    // Get user votes
    const userVotes = await db
      .select({
        vote: votes,
        proposal: {
          id: proposals.id,
          title: proposals.title,
          groupId: proposals.groupId,
          status: proposals.status,
        },
      })
      .from(votes)
      .innerJoin(proposals, eq(votes.proposalId, proposals.id))
      .where(eq(votes.voterAddress, walletAddress))
      .orderBy(desc(votes.votedAt));

    // Calculate user statistics
    const stats = {
      totalGroups: userGroups.length,
      totalProposals: userProposals.length,
      totalVotes: userVotes.length,
      totalActiveProposals: userGroups.reduce((sum, ug) => sum + ug.activeProposalCount, 0),
      totalInvested: userGroups.reduce((sum, ug) => sum + parseFloat(ug.member.contributedAmount ?? '0'), 0).toString(),
      averageVotingPower: userGroups.length > 0
        ? userGroups.reduce((sum, ug) => sum + parseFloat(ug.member.votingPower ?? '0'), 0) / userGroups.length
        : 0,
    };

    return {
      stats,
      groups: userGroups,
      proposals: userProposals,
      votes: userVotes,
    };
  } catch (error) {
    console.error('Failed to get user analytics:', error);
    throw new Error(`Failed to fetch user analytics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Enhanced group proposals query with proper filtering
export async function getGroupProposals(groupId: string, status?: string) {
  try {
    const conditions = [eq(proposals.groupId, groupId)];
    
    if (status) {
      conditions.push(eq(proposals.status, status));
    }

    const proposalsWithVotes = await db
      .select({
        proposal: proposals,
        voteCount: count(votes.id).as('voteCount'),
        approvalVotes: sql<number>`COUNT(CASE WHEN ${votes.vote} = 'approve' THEN 1 END)`.as('approvalVotes'),
        rejectionVotes: sql<number>`COUNT(CASE WHEN ${votes.vote} = 'reject' THEN 1 END)`.as('rejectionVotes'),
        abstainVotes: sql<number>`COUNT(CASE WHEN ${votes.vote} = 'abstain' THEN 1 END)`.as('abstainVotes'),
      })
      .from(proposals)
      .leftJoin(votes, eq(proposals.id, votes.proposalId))
      .where(and(...conditions))
      .groupBy(proposals.id)
      .orderBy(desc(proposals.createdAt));

    return proposalsWithVotes;
  } catch (error) {
    console.error('Failed to get group proposals:', error);
    throw new Error(`Failed to fetch group proposals: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Enhanced user groups query with proposal counts
export async function getUserGroups(walletAddress: string) {
  try {
    const userGroupsWithStats = await db
      .select({
        group: investmentGroups,
        member: groupMembers,
        proposalCount: sql<number>`(
          SELECT COUNT(*) FROM ${proposals} 
          WHERE ${proposals.groupId} = ${investmentGroups.id}
        )`.as('proposalCount'),
        activeProposalCount: sql<number>`(
          SELECT COUNT(*) FROM ${proposals} 
          WHERE ${proposals.groupId} = ${investmentGroups.id} 
          AND ${proposals.status} = 'active'
          AND ${proposals.deadline} > NOW()
        )`.as('activeProposalCount'),
        userProposalCount: sql<number>`(
          SELECT COUNT(*) FROM ${proposals} 
          WHERE ${proposals.groupId} = ${investmentGroups.id}
          AND ${proposals.proposedBy} = ${walletAddress}
        )`.as('userProposalCount'),
        userVoteCount: sql<number>`(
          SELECT COUNT(*) FROM ${votes} v
          JOIN ${proposals} p ON v.proposal_id = p.id
          WHERE p.group_id = ${investmentGroups.id}
          AND v.voter_address = ${walletAddress}
        )`.as('userVoteCount'),
      })
      .from(investmentGroups)
      .innerJoin(groupMembers, eq(investmentGroups.id, groupMembers.groupId))
      .where(
        and(
          eq(groupMembers.walletAddress, walletAddress),
          eq(groupMembers.isActive, true)
        )
      )
      .orderBy(desc(groupMembers.joinedAt));

    return userGroupsWithStats;
  } catch (error) {
    console.error('Failed to get user groups:', error);
    throw new Error(`Failed to fetch user groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Get active proposals across all groups (for dashboard summary)
export async function getActiveProposalsCount() {
  try {
    const [result] = await db
      .select({
        count: count(proposals.id).as('count'),
      })
      .from(proposals)
      .where(
        and(
          eq(proposals.status, 'active'),
          sql`${proposals.deadline} > NOW()`
        )
      );

    return result?.count || 0;
  } catch (error) {
    console.error('Failed to get active proposals count:', error);
    throw new Error(`Failed to fetch active proposals count: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Enhanced proposal creation with validation
export async function createProposal(data: {
  groupId: string;
  title: string;
  description: string;
  strategy: string;
  requestedAmount: string;
  proposedBy: string;
  deadline: Date;
  requiredVotes: number;
}) {
  try {
    // Validate group exists and user is a member
    const groupMember = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, data.groupId),
          eq(groupMembers.walletAddress, data.proposedBy),
          eq(groupMembers.isActive, true)
        )
      );

    if (groupMember.length === 0) {
      throw new Error('User is not an active member of this group');
    }

    // Check for similar recent proposals (prevent spam)
    const recentSimilarProposals = await db
      .select()
      .from(proposals)
      .where(
        and(
          eq(proposals.groupId, data.groupId),
          eq(proposals.proposedBy, data.proposedBy),
          eq(proposals.title, data.title),
          sql`${proposals.createdAt} > NOW() - INTERVAL '1 hour'`
        )
      );

    if (recentSimilarProposals.length > 0) {
      throw new Error('Similar proposal already exists within the last hour');
    }

    const proposalId = generateId('proposal');
    
    const [proposal] = await db.insert(proposals).values({
      id: proposalId,
      groupId: data.groupId,
      title: data.title,
      description: data.description,
      strategy: data.strategy,
      requestedAmount: data.requestedAmount,
      proposedBy: data.proposedBy,
      deadline: data.deadline,
      requiredVotes: data.requiredVotes,
    }).returning();

    return proposal;
  } catch (error) {
    console.error('Failed to create proposal:', error);
    throw new Error(`Failed to create proposal: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}



// Re-export createInvestmentGroup with enhanced error handling
export async function createInvestmentGroupEnhanced(data: {
  name: string;
  description?: string;
  xmtpGroupId: string;
  createdBy: string;
}) {
  try {
    // Check if group with same XMTP ID already exists
    const existingGroup = await db
      .select()
      .from(investmentGroups)
      .where(eq(investmentGroups.xmtpGroupId, data.xmtpGroupId));

    if (existingGroup.length > 0) {
      throw new Error('Group with this XMTP ID already exists');
    }

    const groupId = generateId('group');
    
    const [group] = await db.insert(investmentGroups).values({
      id: groupId,
      name: data.name,
      description: data.description,
      xmtpGroupId: data.xmtpGroupId,
      createdBy: data.createdBy,
    }).returning();

    // Add creator as first member
    await addGroupMember({
      groupId: group.id,
      walletAddress: data.createdBy,
      contributedAmount: '0',
      votingPower: '1.0',
    });

    return group;
  } catch (error) {
    console.error('Failed to create investment group:', error);
    throw new Error(`Failed to create investment group: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Add a member to a group
export async function addGroupMember({
  groupId,
  walletAddress,
  contributedAmount = '0',
  votingPower = '1.0',
}: {
  groupId: string;
  walletAddress: string;
  contributedAmount?: string;
  votingPower?: string;
}) {
  const memberId = generateId('member');
  const [member] = await db.insert(groupMembers).values({
    id: memberId,
    groupId,
    walletAddress,
    contributedAmount,
    votingPower,
  }).returning();
  return member;
}