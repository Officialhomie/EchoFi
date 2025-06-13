import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { pgTable, text, timestamp, integer, decimal, boolean } from 'drizzle-orm/pg-core';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client);

// Existing schema
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
  status: text('status').default('active'),
  approvalVotes: integer('approval_votes').default(0),
  rejectionVotes: integer('rejection_votes').default(0),
  requiredVotes: integer('required_votes').notNull(),
});

export const votes = pgTable('votes', {
  id: text('id').primaryKey(),
  proposalId: text('proposal_id').references(() => proposals.id),
  voterAddress: text('voter_address').notNull(),
  vote: text('vote').notNull(),
  votingPower: decimal('voting_power', { precision: 5, scale: 2 }).default('1.0'),
  votedAt: timestamp('voted_at').defaultNow(),
});

// NEW: Fallback Messages Schema for Hybrid Message Delivery
export const fallbackMessages = pgTable('fallback_messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull(),
  content: text('content').notNull(),
  senderAddress: text('sender_address'),
  originalTimestamp: timestamp('original_timestamp').notNull(),
  fallbackMethod: text('fallback_method').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  syncStatus: text('sync_status').default('pending'), // pending, attempted, synced, failed
  lastSyncAttempt: timestamp('last_sync_attempt'),
  xmtpMessageId: text('xmtp_message_id'), // If successfully synced to XMTP
  retryCount: integer('retry_count').default(0),
  isDeleted: boolean('is_deleted').default(false),
});

// Message Delivery Status Tracking
export const messageDeliveryLogs = pgTable('message_delivery_logs', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull(),
  messageId: text('message_id').notNull(),
  deliveryMethod: text('delivery_method').notNull(), // xmtp, api, hybrid
  deliveryStatus: text('delivery_status').notNull(), // success, failed, pending, retrying
  deliveryTime: integer('delivery_time'), // milliseconds
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// XMTP Conversation Health Tracking
export const conversationHealth = pgTable('conversation_health', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().unique(),
  lastHealthCheck: timestamp('last_health_check').defaultNow(),
  isHealthy: boolean('is_healthy').default(true),
  sequenceIdValid: boolean('sequence_id_valid').default(true),
  syncStatus: text('sync_status').default('synced'), // synced, syncing, failed
  lastMessageTime: timestamp('last_message_time'),
  issueCount: integer('issue_count').default(0),
  lastIssue: text('last_issue'),
  recoveryAttempts: integer('recovery_attempts').default(0),
  lastRecoveryAttempt: timestamp('last_recovery_attempt'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Message Operation Metrics for Performance Monitoring
export const messageMetrics = pgTable('message_metrics', {
  id: text('id').primaryKey(),
  date: timestamp('date').defaultNow(),
  conversationId: text('conversation_id'),
  operationType: text('operation_type').notNull(), // send, receive, stream, sync
  method: text('method').notNull(), // xmtp, api, hybrid
  successCount: integer('success_count').default(0),
  failureCount: integer('failure_count').default(0),
  averageLatency: integer('average_latency'), // milliseconds
  errorRate: decimal('error_rate', { precision: 5, scale: 2 }).default('0.00'),
  sequenceIdErrors: integer('sequence_id_errors').default(0),
  databaseErrors: integer('database_errors').default(0),
  networkErrors: integer('network_errors').default(0),
  recoverySuccessRate: decimal('recovery_success_rate', { precision: 5, scale: 2 }).default('0.00'),
});

export default db;