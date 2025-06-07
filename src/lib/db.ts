import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { pgTable, text, timestamp, integer, decimal, boolean } from 'drizzle-orm/pg-core';

// Supabase connection
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client);

// Schema definitions
export const investmentGroups = pgTable('investment_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  xmtpGroupId: text('xmtp_group_id').notNull().unique(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  totalFunds: decimal('total_funds', { precision: 18, scale: 6 }).default('0'),
  memberCount: integer('member_count').default(1),
});

export const groupMembers = pgTable('group_members', {
  id: text('id').primaryKey(),
  groupId: text('group_id').references(() => investmentGroups.id),
  walletAddress: text('wallet_address').notNull(),
  joinedAt: timestamp('joined_at').defaultNow(),
  contributedAmount: decimal('contributed_amount', { precision: 18, scale: 6 }).default('0'),
  votingPower: decimal('voting_power', { precision: 5, scale: 2 }).default('1.0'),
  isActive: boolean('is_active').default(true),
});

export const proposals = pgTable('proposals', {
  id: text('id').primaryKey(),
  groupId: text('group_id').references(() => investmentGroups.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
  strategy: text('strategy').notNull(),
  requestedAmount: decimal('requested_amount', { precision: 18, scale: 6 }).notNull(),
  proposedBy: text('proposed_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  deadline: timestamp('deadline').notNull(),
  status: text('status').default('active'), // active, approved, rejected, executed
  approvalVotes: integer('approval_votes').default(0),
  rejectionVotes: integer('rejection_votes').default(0),
  requiredVotes: integer('required_votes').notNull(),
});

export const votes = pgTable('votes', {
  id: text('id').primaryKey(),
  proposalId: text('proposal_id').references(() => proposals.id),
  voterAddress: text('voter_address').notNull(),
  vote: text('vote').notNull(), // approve, reject, abstain
  votingPower: decimal('voting_power', { precision: 5, scale: 2 }).default('1.0'),
  votedAt: timestamp('voted_at').defaultNow(),
});