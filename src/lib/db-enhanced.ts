/**
 * Enhanced Database Schema - Agent State Persistence
 * 
 * This extends your existing database schema with comprehensive agent state management.
 * Builds on top of your current investment_groups, group_members, proposals, and votes tables.
 * 
 * Key Design Principles:
 * - Zero data loss during application restarts
 * - Instant recovery to exact previous state
 * - Comprehensive audit trail for all operations
 * - Scalable architecture for multiple agent instances
 * - Integration with existing business logic tables
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
  pgTable, 
  text, 
  timestamp, 
  integer, 
  decimal, 
  boolean,
  jsonb,
  uuid,
  index
} from 'drizzle-orm/pg-core';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client);

// =============================================================================
// EXISTING SCHEMA (for reference - already in your db.ts)
// =============================================================================

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

// =============================================================================
// NEW SCHEMA: AGENT STATE PERSISTENCE TABLES
// =============================================================================

/**
 * Agent Instances - Track each agent deployment
 * 
 * This table maintains a registry of all agent instances, allowing for
 * multiple agents to run simultaneously while maintaining separate state.
 * Think of this as the "birth certificate" for each agent instance.
 */
export const agentInstances = pgTable('agent_instances', {
  // Primary identification
  id: uuid('id').defaultRandom().primaryKey(),
  agentId: text('agent_id').notNull().unique(), // Human-readable ID like "echofi-prod-1"
  version: text('version').notNull(), // Agent version for compatibility tracking
  
  // Configuration and status
  walletAddress: text('wallet_address').notNull(),
  chainId: integer('chain_id').notNull(),
  networkName: text('network_name').notNull(),
  treasuryAddress: text('treasury_address').notNull(),
  xmtpEnv: text('xmtp_env').notNull(), // 'dev' or 'production'
  
  // Operational state
  status: text('status').notNull().default('initializing'), // 'initializing', 'active', 'stopped', 'error', 'recovering'
  lastHeartbeat: timestamp('last_heartbeat').defaultNow(),
  lastRestart: timestamp('last_restart').defaultNow(),
  
  // Metrics
  totalMessagesProcessed: integer('total_messages_processed').default(0),
  totalCommandsExecuted: integer('total_commands_executed').default(0),
  totalErrors: integer('total_errors').default(0),
  uptimeSeconds: integer('uptime_seconds').default(0),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  agentIdIdx: index('agent_instances_agent_id_idx').on(table.agentId),
  statusIdx: index('agent_instances_status_idx').on(table.status),
  walletIdx: index('agent_instances_wallet_idx').on(table.walletAddress),
}));

/**
 * Agent State Snapshots - Core operational state persistence
 * 
 * This is the heart of the persistence system. Every critical piece of agent
 * state is stored here as JSONB, allowing for flexible schema evolution
 * while maintaining strong consistency for recovery operations.
 */
export const agentStateSnapshots = pgTable('agent_state_snapshots', {
  // Primary identification
  id: uuid('id').defaultRandom().primaryKey(),
  agentInstanceId: uuid('agent_instance_id').references(() => agentInstances.id).notNull(),
  groupId: text('group_id').references(() => investmentGroups.xmtpGroupId), // Can be null for global state
  
  // State classification
  stateType: text('state_type').notNull(), // 'global', 'group', 'stream', 'command', 'error'
  stateName: text('state_name').notNull(), // Specific identifier like 'stream_health', 'message_queue'
  
  // State data - using JSONB for flexibility and PostgreSQL's advanced JSON features
  stateData: jsonb('state_data').notNull(),
  
  // State metadata
  version: integer('version').default(1), // For state schema versioning
  checksum: text('checksum'), // For data integrity verification
  isActive: boolean('is_active').default(true), // Allows soft deletion of old state
  
  // Operational metadata
  lastActivity: timestamp('last_activity').defaultNow(),
  expiresAt: timestamp('expires_at'), // For automatic cleanup of temporary state
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  agentGroupIdx: index('agent_state_agent_group_idx').on(table.agentInstanceId, table.groupId),
  stateTypeIdx: index('agent_state_type_idx').on(table.stateType, table.stateName),
  activeStateIdx: index('agent_state_active_idx').on(table.isActive, table.lastActivity),
  // Note: Unique constraint for active state records will be enforced at application level
  // since Drizzle doesn't support conditional unique constraints with WHERE clauses
}));

/**
 * Command Execution History - Complete audit trail of all commands
 * 
 * This table provides a comprehensive record of every command processed by
 * the agent, enabling debugging, analytics, and recovery of incomplete operations.
 * Think of this as the agent's "memory" of everything it has ever done.
 */
export const commandHistory = pgTable('command_history', {
  // Primary identification
  id: uuid('id').defaultRandom().primaryKey(),
  agentInstanceId: uuid('agent_instance_id').references(() => agentInstances.id).notNull(),
  groupId: text('group_id').references(() => investmentGroups.xmtpGroupId).notNull(),
  
  // Command details
  commandId: text('command_id').notNull().unique(), // Unique ID for tracking
  commandType: text('command_type').notNull(), // 'deposit', 'withdraw', 'status', etc.
  originalMessage: text('original_message').notNull(), // Raw user input
  parsedCommand: jsonb('parsed_command').notNull(), // Structured command data
  
  // User information
  userAddress: text('user_address').notNull(),
  userName: text('user_name'), // Optional display name
  
  // Execution tracking
  executionStatus: text('execution_status').notNull().default('pending'), 
  // Possible values: 'pending', 'processing', 'success', 'failed', 'timeout', 'cancelled'
  
  executionSteps: jsonb('execution_steps').default('[]'), // Array of execution steps
  currentStep: text('current_step'), // Which step is currently executing
  
  // Results and errors
  resultData: jsonb('result_data'), // Command execution results
  errorMessage: text('error_message'), // Error details if failed
  retryCount: integer('retry_count').default(0),
  maxRetries: integer('max_retries').default(3),
  
  // Blockchain integration
  transactionHash: text('transaction_hash'), // On-chain transaction hash
  transactionStatus: text('transaction_status'), // 'pending', 'confirmed', 'failed'
  blockNumber: integer('block_number'), // Block where transaction was confirmed
  gasUsed: text('gas_used'), // Gas consumed by transaction
  
  // Timing information
  processingStartedAt: timestamp('processing_started_at'),
  processingCompletedAt: timestamp('processing_completed_at'),
  processingDurationMs: integer('processing_duration_ms'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  agentGroupIdx: index('command_history_agent_group_idx').on(table.agentInstanceId, table.groupId),
  statusIdx: index('command_history_status_idx').on(table.executionStatus),
  userIdx: index('command_history_user_idx').on(table.userAddress),
  typeIdx: index('command_history_type_idx').on(table.commandType),
  transactionIdx: index('command_history_tx_idx').on(table.transactionHash),
  processingTimeIdx: index('command_history_processing_idx').on(table.processingStartedAt, table.processingCompletedAt),
}));

/**
 * Agent Metrics - Performance and health monitoring data
 * 
 * This table captures quantitative metrics about agent performance,
 * enabling monitoring, alerting, and optimization. Data is aggregated
 * by time periods to support both real-time and historical analysis.
 */
export const agentMetrics = pgTable('agent_metrics', {
  // Primary identification
  id: uuid('id').defaultRandom().primaryKey(),
  agentInstanceId: uuid('agent_instance_id').references(() => agentInstances.id).notNull(),
  
  // Metric classification
  metricType: text('metric_type').notNull(), // 'performance', 'health', 'usage', 'error'
  metricName: text('metric_name').notNull(), // Specific metric like 'messages_per_minute'
  metricCategory: text('metric_category'), // Optional grouping like 'stream_management'
  
  // Metric values - supporting different data types
  numericValue: decimal('numeric_value', { precision: 18, scale: 6 }),
  textValue: text('text_value'),
  booleanValue: boolean('boolean_value'),
  jsonValue: jsonb('json_value'),
  
  // Aggregation metadata
  aggregationType: text('aggregation_type').default('point'), // 'point', 'sum', 'avg', 'count', 'rate'
  aggregationPeriod: text('aggregation_period').default('1min'), // '1min', '5min', '1hour', '1day'
  
  // Contextual information
  groupId: text('group_id'), // Optional - some metrics are global
  source: text('source').default('agent'), // Where the metric came from
  tags: jsonb('tags').default('{}'), // Additional metadata as key-value pairs
  
  // Timestamps
  recordedAt: timestamp('recorded_at').defaultNow(),
  aggregationWindowStart: timestamp('aggregation_window_start'),
  aggregationWindowEnd: timestamp('aggregation_window_end'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  agentMetricIdx: index('agent_metrics_agent_metric_idx').on(table.agentInstanceId, table.metricType, table.metricName),
  timeSeriesIdx: index('agent_metrics_time_series_idx').on(table.recordedAt, table.aggregationPeriod),
  categoryIdx: index('agent_metrics_category_idx').on(table.metricCategory),
  groupMetricsIdx: index('agent_metrics_group_idx').on(table.groupId, table.recordedAt),
}));

/**
 * Stream Health Records - Detailed XMTP stream management state
 * 
 * This table specifically tracks the health and status of XMTP message streams,
 * integrating with the StreamManager from Prompt 1 to provide complete
 * visibility into stream operations and recovery processes.
 */
export const streamHealthRecords = pgTable('stream_health_records', {
  // Primary identification
  id: uuid('id').defaultRandom().primaryKey(),
  agentInstanceId: uuid('agent_instance_id').references(() => agentInstances.id).notNull(),
  groupId: text('group_id').references(() => investmentGroups.xmtpGroupId).notNull(),
  streamId: text('stream_id').notNull(), // Internal stream identifier
  
  // Health status
  isHealthy: boolean('is_healthy').notNull(),
  healthScore: decimal('health_score', { precision: 5, scale: 2 }), // 0-100 health score
  lastHealthCheck: timestamp('last_health_check').defaultNow(),
  
  // Stream operational data
  isActive: boolean('is_active').notNull().default(true),
  connectionStatus: text('connection_status').notNull(), // 'connected', 'connecting', 'disconnected', 'error'
  connectionQuality: text('connection_quality'), // 'excellent', 'good', 'poor', 'critical'
  
  // Error and recovery tracking
  errorCount: integer('error_count').default(0),
  lastError: text('last_error'),
  lastErrorTime: timestamp('last_error_time'),
  
  // Recovery statistics
  reconnectionAttempts: integer('reconnection_attempts').default(0),
  successfulReconnections: integer('successful_reconnections').default(0),
  lastReconnectionTime: timestamp('last_reconnection_time'),
  circuitBreakerStatus: text('circuit_breaker_status').default('closed'), // 'closed', 'open', 'half-open'
  
  // Message queue information
  queuedMessageCount: integer('queued_message_count').default(0),
  messagesProcessed: integer('messages_processed').default(0),
  lastMessageTime: timestamp('last_message_time'),
  
  // Performance metrics
  averageLatencyMs: integer('average_latency_ms'),
  messagesThroughputPerMinute: decimal('messages_throughput_per_minute', { precision: 10, scale: 2 }),
  
  // Additional metadata
  streamMetadata: jsonb('stream_metadata').default('{}'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  agentGroupStreamIdx: index('stream_health_agent_group_stream_idx')
    .on(table.agentInstanceId, table.groupId, table.streamId),
  healthStatusIdx: index('stream_health_status_idx').on(table.isHealthy, table.isActive),
  connectionIdx: index('stream_health_connection_idx').on(table.connectionStatus, table.lastHealthCheck),
  errorTrackingIdx: index('stream_health_error_idx').on(table.errorCount, table.lastErrorTime),
  performanceIdx: index('stream_health_performance_idx').on(table.averageLatencyMs, table.messagesThroughputPerMinute),
}));

/**
 * Message Queue Records - Persistent message queue for reliability
 * 
 * When the StreamManager queues messages during outages, they're persisted here
 * to ensure zero message loss even during application crashes. This provides
 * the foundation for guaranteed message delivery.
 */
export const messageQueueRecords = pgTable('message_queue_records', {
  // Primary identification
  id: uuid('id').defaultRandom().primaryKey(),
  agentInstanceId: uuid('agent_instance_id').references(() => agentInstances.id).notNull(),
  groupId: text('group_id').references(() => investmentGroups.xmtpGroupId).notNull(),
  messageId: text('message_id').notNull().unique(), // XMTP message ID
  
  // Message details
  messageContent: text('message_content').notNull(),
  senderAddress: text('sender_address').notNull(),
  messageType: text('message_type').default('text'), // 'text', 'command', 'system'
  
  // Queue management
  queueStatus: text('queue_status').notNull().default('pending'), 
  // Possible values: 'pending', 'processing', 'processed', 'failed', 'expired'
  
  priority: integer('priority').default(10), // Higher numbers = higher priority
  retryCount: integer('retry_count').default(0),
  maxRetries: integer('max_retries').default(3),
  
  // Processing tracking
  firstAttemptAt: timestamp('first_attempt_at'),
  lastAttemptAt: timestamp('last_attempt_at'),
  processedAt: timestamp('processed_at'),
  
  // Error handling
  lastError: text('last_error'),
  errorHistory: jsonb('error_history').default('[]'),
  
  // Expiration and cleanup
  expiresAt: timestamp('expires_at'), // For automatic cleanup
  
  // Message metadata
  originalTimestamp: timestamp('original_timestamp').notNull(), // When message was originally received
  messageMetadata: jsonb('message_metadata').default('{}'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  agentGroupQueueIdx: index('message_queue_agent_group_idx').on(table.agentInstanceId, table.groupId),
  queueStatusIdx: index('message_queue_status_idx').on(table.queueStatus, table.priority),
  processingIdx: index('message_queue_processing_idx').on(table.firstAttemptAt, table.lastAttemptAt),
  expirationIdx: index('message_queue_expiration_idx').on(table.expiresAt),
  retryIdx: index('message_queue_retry_idx').on(table.retryCount, table.maxRetries),
}));

/**
 * Error Recovery Logs - Detailed error and recovery tracking
 * 
 * This table maintains a comprehensive log of all errors encountered by
 * the agent and the recovery actions taken. This is crucial for debugging
 * production issues and improving system reliability.
 */
export const errorRecoveryLogs = pgTable('error_recovery_logs', {
  // Primary identification
  id: uuid('id').defaultRandom().primaryKey(),
  agentInstanceId: uuid('agent_instance_id').references(() => agentInstances.id).notNull(),
  
  // Error classification
  errorType: text('error_type').notNull(), // 'stream', 'command', 'network', 'blockchain', 'system'
  errorCategory: text('error_category').notNull(), // 'recoverable', 'critical', 'transient'
  severity: text('severity').notNull(), // 'low', 'medium', 'high', 'critical'
  
  // Error details
  errorMessage: text('error_message').notNull(),
  errorStack: text('error_stack'), // Full stack trace for debugging
  errorCode: text('error_code'), // Structured error codes
  
  // Context information
  groupId: text('group_id'), // May be null for global errors
  commandId: text('command_id'), // May be null for non-command errors
  streamId: text('stream_id'), // May be null for non-stream errors
  
  // Error context
  context: jsonb('context').default('{}'), // Additional context data
  userAddress: text('user_address'), // User who triggered the error, if applicable
  
  // Recovery actions
  recoveryAttempted: boolean('recovery_attempted').default(false),
  recoveryAction: text('recovery_action'), // What recovery action was taken
  recoveryStatus: text('recovery_status'), // 'pending', 'success', 'failed', 'partial'
  recoveryDetails: jsonb('recovery_details').default('{}'),
  
  // Resolution tracking
  isResolved: boolean('is_resolved').default(false),
  resolvedAt: timestamp('resolved_at'),
  resolutionNotes: text('resolution_notes'),
  
  // Administrative tracking
  requiresAttention: boolean('requires_attention').default(false),
  assignedTo: text('assigned_to'), // For manual intervention tracking
  
  // Timestamps
  occurredAt: timestamp('occurred_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  agentErrorIdx: index('error_recovery_agent_idx').on(table.agentInstanceId, table.occurredAt),
  errorTypeIdx: index('error_recovery_type_idx').on(table.errorType, table.errorCategory),
  severityIdx: index('error_recovery_severity_idx').on(table.severity, table.requiresAttention),
  resolutionIdx: index('error_recovery_resolution_idx').on(table.isResolved, table.resolvedAt),
  contextIdx: index('error_recovery_context_idx').on(table.groupId, table.commandId),
}));

// =============================================================================
// UTILITY TABLES FOR OPERATIONAL MANAGEMENT
// =============================================================================

/**
 * Agent Configuration History - Track configuration changes over time
 * 
 * This table maintains a history of all configuration changes made to agents,
 * enabling rollback capabilities and audit compliance.
 */
export const agentConfigHistory = pgTable('agent_config_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  agentInstanceId: uuid('agent_instance_id').references(() => agentInstances.id).notNull(),
  
  configType: text('config_type').notNull(), // 'startup', 'runtime', 'environment'
  configData: jsonb('config_data').notNull(),
  previousConfig: jsonb('previous_config'),
  
  changeReason: text('change_reason'),
  changedBy: text('changed_by'), // User or system that made the change
  
  isActive: boolean('is_active').default(true),
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  agentConfigIdx: index('agent_config_agent_idx').on(table.agentInstanceId, table.configType),
  activeConfigIdx: index('agent_config_active_idx').on(table.isActive, table.createdAt),
}));

/**
 * Data Retention Policies - Automatic cleanup configuration
 * 
 * This table defines how long different types of data should be retained
 * before automatic cleanup, helping manage database size and comply with
 * data retention policies.
 */
export const dataRetentionPolicies = pgTable('data_retention_policies', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  dataType: text('data_type').notNull().unique(), // 'metrics', 'logs', 'snapshots', etc.
  retentionDays: integer('retention_days').notNull(),
  compressionAfterDays: integer('compression_after_days'),
  
  isEnabled: boolean('is_enabled').default(true),
  lastCleanupAt: timestamp('last_cleanup_at'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// =============================================================================
// EXPORT ALL TABLES FOR USE IN OTHER MODULES
// =============================================================================

export const allTables = {
  // Existing business logic tables
  investmentGroups,
  groupMembers,
  proposals,
  votes,
  
  // New agent state persistence tables
  agentInstances,
  agentStateSnapshots,
  commandHistory,
  agentMetrics,
  streamHealthRecords,
  messageQueueRecords,
  errorRecoveryLogs,
  agentConfigHistory,
  dataRetentionPolicies,
};

// Export commonly used type definitions
export type AgentInstance = typeof agentInstances.$inferSelect;
export type AgentStateSnapshot = typeof agentStateSnapshots.$inferSelect;
export type CommandHistoryRecord = typeof commandHistory.$inferSelect;
export type AgentMetric = typeof agentMetrics.$inferSelect;
export type StreamHealthRecord = typeof streamHealthRecords.$inferSelect;
export type MessageQueueRecord = typeof messageQueueRecords.$inferSelect;
export type ErrorRecoveryLog = typeof errorRecoveryLogs.$inferSelect;

export default db;