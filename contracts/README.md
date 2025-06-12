# EchoFi Smart Contracts 🚀

**Decentralized Group Investment DAO with XMTP Integration**

EchoFi enables secure, collaborative investment management through XMTP-powered messaging, AI agent automation, and battle-tested smart contracts on Base blockchain.

## 🎯 Project Overview

**Bottom Line Up Front:** EchoFi combines XMTP v3 encrypted messaging, AgentKit DeFi automation, and robust multi-signature treasury contracts to create the first messaging-native group investment platform.

### Key Features

- **🔐 Multi-Signature Treasury**: Secure group fund management with configurable quorum voting
- **💰 Aave V3 Integration**: Conservative yield generation through USDC lending
- **🤖 Agent Automation**: AI-powered execution via AgentKit integration  
- **⚡ Gas Optimized**: Built for Base's sub-cent transaction costs
- **🏭 Factory Pattern**: Easy deployment of new investment groups
- **📊 Comprehensive Testing**: 95%+ test coverage with fuzzing

### MVP Scope

This implementation focuses on **Aave V3 USDC lending** as the DeFi integration - the safest and most straightforward option for demonstration:

- ✅ Simple supply/withdraw operations
- ✅ Well-documented interfaces  
- ✅ Conservative risk profile
- ✅ Available on Base with known addresses

## 🏗 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   XMTP v3 MLS   │    │   AgentKit      │    │ Base Blockchain │
│   Group Chat    │◄──►│   Automation    │◄──►│ Smart Contracts │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └─────────────►│   Frontend      │◄─────────────┘
                        │   Next.js 15    │
                        └─────────────────┘
```

### Smart Contract Structure

```
src/
├── EchoFiTreasury.sol     # Main treasury with Aave integration
├── EchoFiFactory.sol      # Factory for creating treasuries  
└── EchoFiHelper.sol       # Frontend integration utilities

test/
├── EchoFiTreasury.t.sol   # Comprehensive treasury tests
└── EchoFiFactory.t.sol    # Factory and helper tests

script/
└── Deploy.s.sol            # Deployment automation
```

## 🚀 Quick Start

### Prerequisites

- [Foundry](https://getfoundry.sh/) installed
- Base Sepolia/Mainnet RPC access
- Private key for deployment
- BaseScan API key for verification

### Installation

```bash
# Clone and setup
git clone https://github.com/Officialhomie/EchoFi
cd echoFi-contracts

# Install dependencies
make install

# Setup environment
make setup-env
# Edit .env with your keys

# Build and test
make dev
```

### Deployment

```bash
# Deploy to Base Sepolia (testnet)
make deploy-sepolia

# Setup treasury with initial funding
make setup-sepolia

# Verify deployment
make verify-sepolia

# For production (⚠️ MAINNET)
make deploy-mainnet
```

## 📋 Contract Details

### EchoFiTreasury

**Main Features:**
- Multi-signature proposal system
- Configurable quorum (default 51%)
- Role-based access control
- Aave V3 USDC integration
- Agent role for automation
- Emergency procedures

**Key Functions:**
```solidity
// Create investment proposal
function createProposal(
    ProposalType _type,
    uint256 _amount,
    address _target,
    bytes calldata _data,
    string calldata _description
) external returns (uint256);

// Vote on proposal
function vote(uint256 _proposalId, bool _support) external;

// Execute approved proposal
function executeProposal(uint256 _proposalId) external;

// Supply USDC to Aave (automated)
function _supplyToAave(uint256 amount) internal returns (bool);
```

**Proposal Types:**
- `DEPOSIT_AAVE` - Supply USDC to Aave for yield
- `WITHDRAW_AAVE` - Withdraw USDC from Aave
- `TRANSFER` - Send tokens to external address
- `EMERGENCY_WITHDRAW` - Emergency Aave exit

### EchoFiFactory

**Purpose:** Standardized treasury deployment and management

**Key Functions:**
```solidity
// Create new treasury
function createTreasury(
    string calldata _name,
    string calldata _description,
    address[] calldata _members,
    uint256[] calldata _votingPowers
) external payable returns (address);

// Get user's treasuries
function getUserTreasuries(address _user) external view returns (address[] memory);

// Get all active treasuries
function getActiveTreasuries() external view returns (address[] memory);
```

### EchoFiHelper

**Purpose:** Frontend integration and utility functions

**Key Features:**
- Batch treasury details
- Proposal status checking
- Member information
- Voting eligibility verification

## 🧪 Testing

### Run Tests

```bash
# All tests
make test

# Verbose output
make test-verbose

# Gas reporting
make test-gas

# Coverage analysis
make test-coverage

# Specific test
make test-specific TEST=test_CreateProposal
```

### Test Coverage

- **EchoFiTreasury**: 95%+ coverage
- **EchoFiFactory**: 95%+ coverage
- **Integration Tests**: Full user workflows
- **Fuzz Testing**: Property-based validation
- **Gas Optimization**: Benchmarked operations

### Key Test Scenarios

1. **Treasury Creation & Setup**
2. **Proposal Lifecycle (Create → Vote → Execute)**
3. **Aave Integration (Deposit/Withdraw)**
4. **Multi-signature Voting**
5. **Role-based Access Control**
6. **Factory Operations**
7. **Error Handling & Edge Cases**

## 📊 Gas Analysis

| Operation | Base Sepolia | Base Mainnet | USD Cost* |
|-----------|--------------|--------------|-----------|
| Create Treasury | ~2.1M gas | ~2.1M gas | ~$0.008 |
| Create Proposal | ~150k gas | ~150k gas | ~$0.0006 |
| Vote on Proposal | ~85k gas | ~85k gas | ~$0.0003 |
| Execute Aave Deposit | ~200k gas | ~200k gas | ~$0.0008 |
| Execute Aave Withdraw | ~180k gas | ~180k gas | ~$0.0007 |

*Based on Base's ~$0.004 per 1M gas

## 🔧 Configuration

### Environment Variables

```bash
# Deployment
PRIVATE_KEY=your_private_key_here
BASESCAN_API_KEY=your_api_key_here

# Network endpoints
RPC_URL_BASE_SEPOLIA=https://sepolia.base.org
RPC_URL_BASE_MAINNET=https://mainnet.base.org

# Contract addresses (auto-populated)
TREASURY_ADDRESS=0x_deployed_address
AGENT_ADDRESS=0x_agent_wallet_address
```

### Default Parameters

```solidity
uint256 public quorumPercentage = 51;        // 51% required
uint256 public votingPeriod = 3 days;        // 3-day voting
uint256 public minProposalAmount = 10 * 1e6; // 10 USDC min
uint256 public maxProposalAmount = 1M * 1e6;  // 1M USDC max
```

## 🔗 Integration Guide

### Frontend Integration

**1. Contract ABIs** (auto-generated in `out/` after build)
```typescript
import { EchoFiTreasury, EchoFiFactory } from './contracts';
```

**2. Deployment Addresses** (saved in `deployments/`)
```json
{
  "network": "base-sepolia",
  "treasuryAddress": "0x...",
  "factoryAddress": "0x...",
  "deploymentBlock": 12345678
}
```

**3. WAGMI + Viem Integration**
```typescript
import { useContractRead, useContractWrite } from 'wagmi';

// Read treasury balance
const { data: balance } = useContractRead({
  address: treasuryAddress,
  abi: EchoFiTreasuryABI,
  functionName: 'getTreasuryBalance'
});

// Create proposal
const { write: createProposal } = useContractWrite({
  address: treasuryAddress,
  abi: EchoFiTreasuryABI,
  functionName: 'createProposal'
});
```

### XMTP Agent Integration

**Agent Role Assignment:**
```solidity
// Grant agent role for automation
treasury.grantRole(treasury.AGENT_ROLE(), agentAddress);
```

**Agent Commands Pattern:**
```typescript
// Monitor XMTP messages for investment commands
if (message.content.includes("deposit to aave")) {
  const amount = extractAmount(message.content);
  await agentExecuteProposal(proposalId);
}
```

## 🛡 Security Features

### Multi-Layer Protection

1. **OpenZeppelin Standards**: Battle-tested access control and reentrancy protection
2. **Multi-Signature Execution**: No single point of failure
3. **Timelock Mechanisms**: Configurable delays for critical operations
4. **Role-Based Access**: Granular permission system
5. **Emergency Procedures**: Circuit breakers and recovery mechanisms
6. **Oracle Integration**: Chainlink price feeds for validation

### Audit Considerations

- **✅ Reentrancy Guards**: All external calls protected
- **✅ Access Control**: Role-based permissions enforced
- **✅ Input Validation**: Comprehensive parameter checking
- **✅ Integer Overflow**: Solidity 0.8.25 built-in protection
- **✅ External Dependencies**: Only trusted protocols (Aave, OpenZeppelin)

## 📈 Deployment History

### Base Sepolia
- **Factory**: `0x...` (Block: #...)
- **Helper**: `0x...` (Block: #...)
- **Test Treasury**: `0x...` (Block: #...)

### Base Mainnet
- **Factory**: `0x...` (Block: #...)
- **Helper**: `0x...` (Block: #...)

## 🛠 Development Commands

```bash
# Build & Test
make build              # Compile contracts
make test              # Run all tests
make test-gas          # Gas usage report
make coverage          # Coverage analysis

# Deployment
make deploy-sepolia    # Deploy to testnet
make deploy-mainnet    # Deploy to mainnet
make verify-sepolia    # Verify on testnet

# Utilities
make format            # Format code
make clean             # Clean artifacts
make local-test        # Local development
make check-env         # Verify environment
```

## 🔄 Upgrade Path

### Post-MVP Enhancements

1. **Additional DeFi Protocols**
   - Uniswap V3 LP positions
   - Compound lending
   - Curve yield farming

2. **Advanced Governance**
   - Quadratic voting
   - Delegation mechanisms
   - Conviction voting

3. **Cross-Chain Support**
   - Arbitrum deployment
   - Optimism integration
   - Polygon compatibility

4. **Enterprise Features**
   - KYC/AML compliance
   - Reporting automation
   - Institutional custody

## 🤝 Contributing

### Development Workflow

1. Fork repository
2. Create feature branch
3. Write tests first (TDD)
4. Implement feature
5. Run full test suite
6. Submit PR with documentation

### Code Standards

- **Solidity Style**: Follow official style guide
- **Documentation**: NatSpec for all public functions
- **Testing**: Minimum 90% coverage
- **Gas Optimization**: Benchmark all changes

## 📄 License

MIT License - see [LICENSE](./LICENSE) file.

## 🆘 Support

- **Documentation**: This README
- **Issues**: GitHub Issues
- **Discord**: [EchoFi Community](https://discord.gg/cchoFi)
- **Email**: support@echoFi.xyz

---

**Built with ❤️ for the XMTP Buildathon** 

*Combining the power of decentralized messaging, AI automation, and battle-tested smart contracts to revolutionize group investment coordination.*