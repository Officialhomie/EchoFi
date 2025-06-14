// Clean barrel exports for all EchoFi types


// Core domain types
export * from './core';

// Investment and DeFi types
export * from './investment';

// XMTP and messaging types
export * from './messaging';

// AI Agent types
export * from './agent';

// UI and component types
export * from './ui';

// API and response types
export * from './api';

// Analytics and metrics types
export * from './analytics';

// Event system types
export * from './events';

// Configuration types
export * from './config';

// Utility types
export * from './utils';

// Re-export XMTP content types for convenience
export type { InvestmentProposal, InvestmentVote } from '@/lib/content-types';