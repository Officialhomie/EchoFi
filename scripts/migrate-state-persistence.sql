-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agent Instances - Track each agent deployment
CREATE TABLE agent_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) NOT NULL UNIQUE,
  version VARCHAR(50) NOT NULL,
  wallet_address VARCHAR(42) NOT NULL,
  chain_id INTEGER NOT NULL,
  network_name VARCHAR(100) NOT NULL,
  treasury_address VARCHAR(42) NOT NULL,
  xmtp_env VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'initializing',
  last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_restart TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_messages_processed INTEGER DEFAULT 0,
  total_commands_executed INTEGER DEFAULT 0,
  total_errors INTEGER DEFAULT 0,
  uptime_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent State Snapshots - Core operational state persistence
CREATE TABLE agent_state_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_instance_id UUID REFERENCES agent_instances(id) NOT NULL,
  group_id VARCHAR(255) REFERENCES investment_groups(xmtp_group_id),
  state_type VARCHAR(50) NOT NULL,
  state_name VARCHAR(100) NOT NULL,
  state_data JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  checksum VARCHAR(64),
  is_active BOOLEAN DEFAULT true,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Command Execution History - Complete audit trail
CREATE TABLE command_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_instance_id UUID REFERENCES agent_instances(id) NOT NULL,
  group_id VARCHAR(255) REFERENCES investment_groups(xmtp_group_id) NOT NULL,
  command_id VARCHAR(255) NOT NULL UNIQUE,
  command_type VARCHAR(50) NOT NULL,
  original_message TEXT NOT NULL,
  parsed_command JSONB NOT NULL,
  user_address VARCHAR(42) NOT NULL,
  user_name VARCHAR(100),
  execution_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  execution_steps JSONB DEFAULT '[]',
  current_step VARCHAR(100),
  result_data JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  transaction_hash VARCHAR(66),
  transaction_status VARCHAR(20),
  block_number INTEGER,
  gas_used VARCHAR(50),
  processing_started_at TIMESTAMP WITH TIME ZONE,
  processing_completed_at TIMESTAMP WITH TIME ZONE,
  processing_duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent Metrics - Performance and health monitoring
CREATE TABLE agent_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_instance_id UUID REFERENCES agent_instances(id) NOT NULL,
  metric_type VARCHAR(50) NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  metric_category VARCHAR(50),
  numeric_value DECIMAL(18, 6),
  text_value TEXT,
  boolean_value BOOLEAN,
  json_value JSONB,
  aggregation_type VARCHAR(20) DEFAULT 'point',
  aggregation_period VARCHAR(20) DEFAULT '1min',
  group_id VARCHAR(255),
  source VARCHAR(50) DEFAULT 'agent',
  tags JSONB DEFAULT '{}',
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  aggregation_window_start TIMESTAMP WITH TIME ZONE,
  aggregation_window_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stream Health Records - XMTP stream management state
CREATE TABLE stream_health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_instance_id UUID REFERENCES agent_instances(id) NOT NULL,
  group_id VARCHAR(255) REFERENCES investment_groups(xmtp_group_id) NOT NULL,
  stream_id VARCHAR(255) NOT NULL,
  is_healthy BOOLEAN NOT NULL,
  health_score DECIMAL(5, 2),
  last_health_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  connection_status VARCHAR(50) NOT NULL,
  connection_quality VARCHAR(20),
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  last_error_time TIMESTAMP WITH TIME ZONE,
  reconnection_attempts INTEGER DEFAULT 0,
  successful_reconnections INTEGER DEFAULT 0,
  last_reconnection_time TIMESTAMP WITH TIME ZONE,
  circuit_breaker_status VARCHAR(20) DEFAULT 'closed',
  queued_message_count INTEGER DEFAULT 0,
  messages_processed INTEGER DEFAULT 0,
  last_message_time TIMESTAMP WITH TIME ZONE,
  average_latency_ms INTEGER,
  messages_throughput_per_minute DECIMAL(10, 2),
  stream_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Message Queue Records - Persistent message queue
CREATE TABLE message_queue_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_instance_id UUID REFERENCES agent_instances(id) NOT NULL,
  group_id VARCHAR(255) REFERENCES investment_groups(xmtp_group_id) NOT NULL,
  message_id VARCHAR(255) NOT NULL UNIQUE,
  message_content TEXT NOT NULL,
  sender_address VARCHAR(42) NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text',
  queue_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  priority INTEGER DEFAULT 10,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  first_attempt_at TIMESTAMP WITH TIME ZONE,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  error_history JSONB DEFAULT '[]',
  expires_at TIMESTAMP WITH TIME ZONE,
  original_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  message_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Error Recovery Logs - Detailed error tracking
CREATE TABLE error_recovery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_instance_id UUID REFERENCES agent_instances(id) NOT NULL,
  error_type VARCHAR(50) NOT NULL,
  error_category VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  error_code VARCHAR(50),
  group_id VARCHAR(255),
  command_id VARCHAR(255),
  stream_id VARCHAR(255),
  context JSONB DEFAULT '{}',
  user_address VARCHAR(42),
  recovery_attempted BOOLEAN DEFAULT false,
  recovery_action TEXT,
  recovery_status VARCHAR(20),
  recovery_details JSONB DEFAULT '{}',
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  requires_attention BOOLEAN DEFAULT false,
  assigned_to VARCHAR(100),
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_agent_instances_agent_id ON agent_instances(agent_id);
CREATE INDEX idx_agent_instances_status ON agent_instances(status);
CREATE INDEX idx_agent_instances_wallet ON agent_instances(wallet_address);

CREATE INDEX idx_agent_state_agent_group ON agent_state_snapshots(agent_instance_id, group_id);
CREATE INDEX idx_agent_state_type ON agent_state_snapshots(state_type, state_name);
CREATE INDEX idx_agent_state_active ON agent_state_snapshots(is_active, last_activity);

CREATE INDEX idx_command_history_agent_group ON command_history(agent_instance_id, group_id);
CREATE INDEX idx_command_history_status ON command_history(execution_status);
CREATE INDEX idx_command_history_user ON command_history(user_address);
CREATE INDEX idx_command_history_type ON command_history(command_type);
CREATE INDEX idx_command_history_tx ON command_history(transaction_hash);

CREATE INDEX idx_agent_metrics_agent_metric ON agent_metrics(agent_instance_id, metric_type, metric_name);
CREATE INDEX idx_agent_metrics_time_series ON agent_metrics(recorded_at, aggregation_period);
CREATE INDEX idx_agent_metrics_group ON agent_metrics(group_id, recorded_at);

CREATE INDEX idx_stream_health_agent_group_stream ON stream_health_records(agent_instance_id, group_id, stream_id);
CREATE INDEX idx_stream_health_status ON stream_health_records(is_healthy, is_active);
CREATE INDEX idx_stream_health_connection ON stream_health_records(connection_status, last_health_check);

CREATE INDEX idx_message_queue_agent_group ON message_queue_records(agent_instance_id, group_id);
CREATE INDEX idx_message_queue_status ON message_queue_records(queue_status, priority);
CREATE INDEX idx_message_queue_processing ON message_queue_records(first_attempt_at, last_attempt_at);

CREATE INDEX idx_error_recovery_agent ON error_recovery_logs(agent_instance_id, occurred_at);
CREATE INDEX idx_error_recovery_type ON error_recovery_logs(error_type, error_category);
CREATE INDEX idx_error_recovery_severity ON error_recovery_logs(severity, requires_attention);