// src/lib/agentkit/create-agent.ts
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { prepareAgentkitAndWalletProvider } from "./prepare-agentkit";
import { formatEther } from "viem";

/**
 * EchoFi Investment Agent Configuration
 *
 * This agent is specialized for investment coordination, portfolio management,
 * and DeFi operations within XMTP group messaging contexts, following the
 * standard AgentKit example patterns with real runtime values.
 */

// Global agent instance (singleton pattern)
let agent: ReturnType<typeof createReactAgent>;

/**
 * Initializes and returns an instance of the EchoFi investment AI agent.
 * If an agent instance already exists, it returns the existing one.
 *
 * @function createAgent
 * @returns {Promise<ReturnType<typeof createReactAgent>>} The initialized AI agent
 * @throws {Error} If the agent initialization fails.
 */
export async function createAgent(): Promise<ReturnType<typeof createReactAgent>> {
  // If agent has already been initialized, return it
  if (agent) {
    console.log("♻️ Returning existing EchoFi agent instance");
    return agent;
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required in environment variables for AI functionality");
  }

  try {
    console.log("🚀 Initializing EchoFi Investment Agent...");

    // Prepare AgentKit and wallet provider using the standard pattern
    const { agentkit, walletProvider } = await prepareAgentkitAndWalletProvider();

    // Get real network and wallet information
    const network = walletProvider.getNetwork();
    const walletAddress = walletProvider.getAddress();
    const isTestnet = network?.networkId?.includes("sepolia");
    const networkDisplayName = isTestnet ? "Base Sepolia (Testnet)" : "Base Mainnet";

    console.log("📊 Agent Configuration:");
    console.log(`   Network: ${networkDisplayName}`);
    console.log(`   Chain ID: ${network.chainId}`);
    console.log(`   Wallet: ${walletAddress}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);

    // Try to get current wallet balance
    let currentBalance = "Unable to fetch";
    try {
      const balance = await walletProvider.getBalance();
      currentBalance = `${formatEther(BigInt(balance))} ETH`;
    } catch (error) {
      console.warn("⚠️ Could not fetch wallet balance:", error instanceof Error ? error.message : 'Unknown error');
    }

    // Initialize LLM with investment-optimized configuration
    const llm = new ChatOpenAI({ 
      model: "gpt-4o-mini",
      temperature: 0.1, // Lower temperature for consistent financial advice
      maxTokens: 2000,
    });

    console.log("🧠 LLM Configuration:");
    console.log(`   Model: gpt-4o-mini`);
    console.log(`   Temperature: 0.1 (conservative for financial advice)`);
    console.log(`   Max tokens: 2000`);

    // Get LangChain tools from AgentKit
    const tools = await getLangChainTools(agentkit);
    console.log(`🛠️ Loaded ${tools.length} blockchain interaction tools`);
    
    // Log available tool categories for transparency
    const toolNames = tools.map(tool => tool.name);
    console.log("📋 Available tools:", toolNames.join(", "));

    // Initialize memory for conversation persistence
    const memory = new MemorySaver();
    console.log("🧠 Memory system initialized for conversation persistence");

    // Determine network-specific capabilities (following example pattern)
    const canUseFaucet = network.networkId === "base-sepolia";
    
    const faucetMessage = canUseFaucet 
      ? "If you ever need funds for testing, you can request them from the faucet." 
      : "If you need funds, you can provide your wallet details and request funds from the user.";

    // Create specialized system message for EchoFi investment coordination
    const systemMessage = `
You are EchoFi, an advanced AI agent specializing in decentralized investment coordination and portfolio management. You are empowered to interact onchain using your tools. ${faucetMessage}

## LIVE SYSTEM STATUS:
- Network: ${networkDisplayName} (Chain ID: ${network.chainId})
- Wallet Address: ${walletAddress}
- Current Balance: ${currentBalance}
- Available Tools: ${tools.length} blockchain interaction capabilities
- Environment: ${process.env.NODE_ENV || 'development'}
- Agent Status: ACTIVE and ready for operations

## Core Capabilities:
- Portfolio analysis and performance tracking
- DeFi protocol interactions (Uniswap, Aave, Compound, etc.)
- Investment strategy execution and automation
- Risk assessment and management
- Group coordination and proposal analysis
- Cross-chain operations and yield optimization

## Operational Guidelines:
- Always prioritize security and risk management
- Before executing your first action, get the wallet details to see what network you're on
- Provide clear explanations for investment recommendations
- Consider gas costs and transaction efficiency
- Respect group consensus and voting outcomes
- Maintain transparency in all operations

## Risk Management Protocol:
- Never invest more than groups explicitly approve
- Always explain potential risks and downsides
- Recommend diversification strategies
- Monitor for unusual market conditions
- Implement appropriate stop-loss mechanisms

## Communication Standards:
- Be concise but thorough in explanations
- Use clear, non-technical language when possible
- Provide specific numbers and percentages
- Include relevant links and transaction hashes
- Always confirm before executing transactions

## Network-Specific Warnings:
${isTestnet ? 
  "⚠️ TESTNET MODE: You are operating on Base Sepolia testnet. All operations use test tokens with no real value. Remind users this is for testing and development only." : 
  "🔴 MAINNET MODE: You are operating on Base Mainnet with REAL FUNDS. Exercise maximum caution with all transactions. Always double-check amounts and addresses before execution."
}

## Error Handling:
If there is a 5XX (internal) HTTP error code, ask the user to try again later. If someone asks you to do something you can't do with your currently available tools, you must say so, and explain that they can add more capabilities by adding more action providers to your AgentKit configuration.

## Documentation References:
ALWAYS include this link when mentioning missing capabilities: https://github.com/coinbase/agentkit/tree/main/typescript/agentkit#action-providers

For CDP and AgentKit questions, recommend visiting docs.cdp.coinbase.com for comprehensive information.

## Response Standards:
Be concise and helpful with your responses. Refrain from restating your tools' descriptions unless explicitly requested. Focus on providing actionable insights and clear next steps for users.
    `;

    // Create the agent with specialized configuration
    agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier: systemMessage,
    });

    // Final status report
    console.log("✅ EchoFi Investment Agent initialization complete!");
    console.log("📈 Agent Capabilities Summary:");
    console.log(`   - Blockchain tools: ${tools.length} available`);
    console.log(`   - Network: ${networkDisplayName}`);
    console.log(`   - Wallet balance: ${currentBalance}`);
    console.log(`   - Mode: ${isTestnet ? 'TESTNET (Safe Testing)' : 'MAINNET (Real Funds)'}`);
    console.log(`   - Memory: Persistent conversation tracking enabled`);
    console.log(`   - Status: Ready for investment coordination operations`);
    
    return agent;

  } catch (error) {
    console.error("❌ Error initializing EchoFi agent:", error);
    
    // Provide detailed error context for debugging
    if (error instanceof Error) {
      if (error.message.includes('OPENAI_API_KEY')) {
        throw new Error(`OpenAI configuration error: Missing or invalid OPENAI_API_KEY. Please check your environment variables.`);
      } else if (error.message.includes('tools')) {
        throw new Error(`AgentKit tools error: ${error.message}. This may indicate an issue with wallet provider or action provider configuration.`);
      } else if (error.message.includes('network')) {
        throw new Error(`Network configuration error: ${error.message}. Please verify your network settings and connectivity.`);
      }
    }
    
    throw new Error(`Failed to initialize EchoFi agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}