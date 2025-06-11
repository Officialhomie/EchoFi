// src/lib/agentkit/create-agent.ts
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { prepareAgentkitAndWalletProvider } from "./prepare-agentkit";

/**
 * Agent Configuration for EchoFi Investment Coordination
 *
 * This agent is specialized for investment coordination, portfolio management,
 * and DeFi operations within XMTP group messaging contexts.
 */

// Global agent instance (singleton pattern)
let agent: ReturnType<typeof createReactAgent>;
let agentKit: any;
let walletProvider: any;

/**
 * Initializes and returns an instance of the EchoFi investment AI agent.
 * If an agent instance already exists, it returns the existing one.
 *
 * @function createAgent
 * @returns {Promise<ReturnType<typeof createReactAgent>>} The initialized AI agent
 */
export async function createAgent(): Promise<ReturnType<typeof createReactAgent>> {
  // If agent has already been initialized, return it
  if (agent) {
    return agent;
  }

  // Validate OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required in environment variables for AI functionality");
  }

  try {
    console.log("🚀 Initializing EchoFi Investment Agent...");

    // Prepare AgentKit and wallet provider
    const { agentkit, walletProvider: wp } = await prepareAgentkitAndWalletProvider();
    agentKit = agentkit;
    walletProvider = wp;

    // Initialize LLM with optimal model for financial operations
    const llm = new ChatOpenAI({ 
      model: "gpt-4o-mini",
      temperature: 0.1, // Lower temperature for more consistent financial advice
      maxTokens: 2000,
    });

    // Get LangChain tools from AgentKit
    const tools = await getLangChainTools(agentkit);
    console.log(`📋 Loaded ${tools.length} blockchain tools`);

    // Initialize memory for conversation persistence
    const memory = new MemorySaver();

    // Determine network-specific capabilities
    const networkId = process.env.NETWORK_ID || "base-sepolia";
    const isTestnet = networkId.includes("sepolia");
    const networkName = isTestnet ? "Base Sepolia" : "Base Mainnet";
    
    // Create specialized system message for investment coordination
    const systemMessage = `
You are EchoFi, an advanced AI agent specializing in decentralized investment coordination and portfolio management. You operate within XMTP encrypted group messaging to help investment groups make informed decisions and execute strategies.

## Core Capabilities:
- Portfolio analysis and performance tracking
- DeFi protocol interactions (Uniswap, Aave, Compound, etc.)
- Investment strategy execution and automation
- Risk assessment and management
- Group coordination and proposal analysis
- Cross-chain operations and yield optimization

## Current Configuration:
- Network: ${networkName}
- Available Tools: ${tools.length} blockchain interaction tools
- Wallet Provider: Configured and ready
- Environment: ${process.env.NODE_ENV || 'development'}

## Investment Guidelines:
- Always prioritize security and risk management
- Provide clear explanations for investment recommendations
- Consider gas costs and transaction efficiency
- Respect group consensus and voting outcomes
- Maintain transparency in all operations

## Risk Management:
- Never invest more than groups explicitly approve
- Always explain potential risks and downsides
- Recommend diversification strategies
- Monitor for unusual market conditions
- Implement appropriate stop-loss mechanisms

## Communication Style:
- Be concise but thorough in explanations
- Use clear, non-technical language when possible
- Provide specific numbers and percentages
- Include relevant links and transaction hashes
- Always confirm before executing transactions

${isTestnet ? 
  "⚠️ You are operating on TESTNET. Remind users this is for testing only." : 
  "🔴 You are operating on MAINNET with real funds. Exercise maximum caution."
}

If you need additional capabilities beyond your current tools, direct users to the AgentKit documentation: https://github.com/coinbase/agentkit/tree/main/typescript/agentkit#action-providers

For CDP and AgentKit questions, recommend visiting docs.cdp.coinbase.com for comprehensive information.
    `;

    // Create the agent with specialized configuration
    agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier: systemMessage,
    });

    console.log("✅ EchoFi Investment Agent initialized successfully");
    return agent;

  } catch (error) {
    console.error("❌ Error initializing EchoFi agent:", error);
    throw new Error(`Failed to initialize EchoFi agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the current AgentKit instance
 */
export function getAgentKit() {
  return agentKit;
}

/**
 * Get the current wallet provider
 */
export function getWalletProvider() {
  return walletProvider;
}

/**
 * Reset the agent (useful for testing or configuration changes)
 */
export function resetAgent() {
  agent = undefined as any;
  agentKit = undefined;
  walletProvider = undefined;
  console.log("🔄 Agent reset - will reinitialize on next call");
}