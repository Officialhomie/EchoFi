// src/lib/db-queries.ts
import { eq, and, desc, sql } from 'drizzle-orm';
import { db, investmentGroups, groupMembers, proposals, votes } from './db';
import { generateId } from './utils';

// Investment Group Queries
export async function createInvestmentGroup(data: {
  name: string;
  description?: string;
  xmtpGroupId: string;
  createdBy: string;
}) {
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
}

export async function getInvestmentGroup(groupId: string) {
  const [group] = await db
    .select()
    .from(investmentGroups)
    .where(eq(investmentGroups.id, groupId));
  
  return group;
}

export async function getInvestmentGroupByXMTPId(xmtpGroupId: string) {
  const [group] = await db
    .select()
    .from(investmentGroups)
    .where(eq(investmentGroups.xmtpGroupId, xmtpGroupId));
  
  return group;
}

export async function getUserGroups(walletAddress: string) {
  return await db
    .select({
      group: investmentGroups,
      member: groupMembers,
    })
    .from(investmentGroups)
    .innerJoin(groupMembers, eq(investmentGroups.id, groupMembers.groupId))
    .where(and(
      eq(groupMembers.walletAddress, walletAddress),
      eq(groupMembers.isActive, true)
    ))
    .orderBy(desc(groupMembers.joinedAt));
}

export async function updateGroupFunds(groupId: string, totalFunds: string) {
  await db
    .update(investmentGroups)
    .set({ totalFunds })
    .where(eq(investmentGroups.id, groupId));
}

// Group Member Queries
export async function addGroupMember(data: {
  groupId: string;
  walletAddress: string;
  contributedAmount?: string;
  votingPower?: string;
}) {
  const memberId = generateId('member');
  
  const [member] = await db.insert(groupMembers).values({
    id: memberId,
    groupId: data.groupId,
    walletAddress: data.walletAddress,
    contributedAmount: data.contributedAmount || '0',
    votingPower: data.votingPower || '1.0',
  }).returning();

  // Update member count
  await db
    .update(investmentGroups)
    .set({
      memberCount: sql`member_count + 1`
    })
    .where(eq(investmentGroups.id, data.groupId));

  return member;
}

export async function getGroupMembers(groupId: string) {
  return await db
    .select()
    .from(groupMembers)
    .where(and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.isActive, true)
    ))
    .orderBy(desc(groupMembers.joinedAt));
}

export async function removeGroupMember(groupId: string, walletAddress: string) {
  await db
    .update(groupMembers)
    .set({ isActive: false })
    .where(and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.walletAddress, walletAddress)
    ));

  // Update member count
  await db
    .update(investmentGroups)
    .set({
      memberCount: sql`member_count - 1`
    })
    .where(eq(investmentGroups.id, groupId));
}

export async function updateMemberContribution(
  groupId: string, 
  walletAddress: string, 
  contributedAmount: string
) {
  await db
    .update(groupMembers)
    .set({ contributedAmount })
    .where(and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.walletAddress, walletAddress)
    ));
}

// Proposal Queries
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
}

export async function getProposal(proposalId: string) {
  const [proposal] = await db
    .select()
    .from(proposals)
    .where(eq(proposals.id, proposalId));
  
  return proposal;
}

export async function getGroupProposals(groupId: string, status?: string) {
  const conditions = [eq(proposals.groupId, groupId)];
  
  if (status) {
    conditions.push(eq(proposals.status, status));
  }

  return await db
    .select()
    .from(proposals)
    .where(and(...conditions))
    .orderBy(desc(proposals.createdAt));
}

export async function updateProposalStatus(
  proposalId: string, 
  status: 'active' | 'approved' | 'rejected' | 'executed'
) {
  await db
    .update(proposals)
    .set({ status })
    .where(eq(proposals.id, proposalId));
}

export async function getActiveProposals() {
  return await db
    .select()
    .from(proposals)
    .where(and(
      eq(proposals.status, 'active'),
      sql`deadline > NOW()`
    ))
    .orderBy(desc(proposals.createdAt));
}

// Vote Queries
export async function createVote(data: {
  proposalId: string;
  voterAddress: string;
  vote: 'approve' | 'reject' | 'abstain';
  votingPower?: string;
}) {
  const voteId = generateId('vote');
  
  // Check if user already voted
  const existingVote = await db
    .select()
    .from(votes)
    .where(and(
      eq(votes.proposalId, data.proposalId),
      eq(votes.voterAddress, data.voterAddress)
    ));

  if (existingVote.length > 0) {
    throw new Error('User has already voted on this proposal');
  }

  const [vote] = await db.insert(votes).values({
    id: voteId,
    proposalId: data.proposalId,
    voterAddress: data.voterAddress,
    vote: data.vote,
    votingPower: data.votingPower || '1.0',
  }).returning();

  // Update proposal vote counts
  if (data.vote === 'approve') {
    await db
      .update(proposals)
      .set({
        approvalVotes: sql`approval_votes + 1`
      })
      .where(eq(proposals.id, data.proposalId));
  } else if (data.vote === 'reject') {
    await db
      .update(proposals)
      .set({
        rejectionVotes: sql`rejection_votes + 1`
      })
      .where(eq(proposals.id, data.proposalId));
  }

  return vote;
}

export async function getProposalVotes(proposalId: string) {
  return await db
    .select()
    .from(votes)
    .where(eq(votes.proposalId, proposalId))
    .orderBy(desc(votes.votedAt));
}

export async function getUserVote(proposalId: string, voterAddress: string) {
  const [vote] = await db
    .select()
    .from(votes)
    .where(and(
      eq(votes.proposalId, proposalId),
      eq(votes.voterAddress, voterAddress)
    ));
  
  return vote;
}

export async function getVoteSummary(proposalId: string) {
  const voteStats = await db
    .select({
      vote: votes.vote,
      count: sql<number>`count(*)::int`,
      totalPower: sql<number>`sum(${votes.votingPower})::float`,
    })
    .from(votes)
    .where(eq(votes.proposalId, proposalId))
    .groupBy(votes.vote);

  return {
    approve: voteStats.find(v => v.vote === 'approve') || { count: 0, totalPower: 0 },
    reject: voteStats.find(v => v.vote === 'reject') || { count: 0, totalPower: 0 },
    abstain: voteStats.find(v => v.vote === 'abstain') || { count: 0, totalPower: 0 },
  };
}

// Analytics Queries
export async function getGroupAnalytics(groupId: string) {
  const [group] = await db
    .select({
      totalFunds: investmentGroups.totalFunds,
      memberCount: investmentGroups.memberCount,
    })
    .from(investmentGroups)
    .where(eq(investmentGroups.id, groupId));

  const proposalStats = await db
    .select({
      status: proposals.status,
      count: sql<number>`count(*)::int`,
    })
    .from(proposals)
    .where(eq(proposals.groupId, groupId))
    .groupBy(proposals.status);

  const recentActivity = await db
    .select({
      proposal: proposals,
      votes: sql<number>`count(${votes.id})::int`,
    })
    .from(proposals)
    .leftJoin(votes, eq(proposals.id, votes.proposalId))
    .where(eq(proposals.groupId, groupId))
    .groupBy(proposals.id)
    .orderBy(desc(proposals.createdAt))
    .limit(5);

  return {
    group,
    proposalStats,
    recentActivity,
  };
}

export async function getUserAnalytics(walletAddress: string) {
  const userGroups = await getUserGroups(walletAddress);
  
  const userProposals = await db
    .select()
    .from(proposals)
    .where(eq(proposals.proposedBy, walletAddress))
    .orderBy(desc(proposals.createdAt));

  const userVotes = await db
    .select()
    .from(votes)
    .where(eq(votes.voterAddress, walletAddress))
    .orderBy(desc(votes.votedAt));

  return {
    groups: userGroups,
    proposals: userProposals,
    votes: userVotes,
  };
}