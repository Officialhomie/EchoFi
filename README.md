# EchoFi 🚀

**XMTP-Powered Autonomous Group Investment DAO**

*The first messaging-native platform for coordinating group investments through encrypted chat, AI automation, and battle-tested smart contracts.*

---

## 🎯 Vision

EchoFi eliminates the coordination nightmare of group investing. Instead of juggling WhatsApp groups, Excel sheets, and personal wallets, everything happens in one secure, encrypted interface where AI agents execute your group's investment decisions automatically.

**Built for the XMTP Buildathon** - Combining the power of decentralized messaging, AI automation, and DeFi to revolutionize group financial coordination.

## ✨ Key Features

### 🔐 **Secure Group Coordination**
- **XMTP v3 MLS Encryption**: End-to-end encrypted group messaging for sensitive financial discussions
- **Wallet-Based Identity**: No email signups or centralized accounts - connect with your wallet
- **Cross-App Compatibility**: Messages work across any XMTP-enabled application

### 🤖 **AI-Powered Investment Automation**
- **Natural Language Commands**: "Invest 30% of treasury in high-yield protocols"
- **AgentKit Integration**: Sophisticated DeFi operations through conversational interface
- **Risk Assessment**: Automated analysis and portfolio recommendations

### 💰 **Battle-Tested Treasury Management**
- **Multi-Signature Security**: Configurable quorum voting for all treasury operations
- **Aave V3 Integration**: Conservative yield generation through USDC lending
- **Base L2 Optimization**: Sub-penny transaction costs for frequent operations

### 📊 **Transparent Governance**
- **On-Chain Proposals**: Formal voting with cryptographic verification
- **Real-Time Tracking**: Live portfolio performance and member contributions
- **Factory Pattern**: Easy deployment of new group treasuries

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Messaging** | XMTP v3 MLS | Encrypted group coordination |
| **AI/Automation** | AgentKit + LangChain | Natural language DeFi operations |
| **Blockchain** | Base L2 | Smart contracts and DeFi integrations |
| **Frontend** | Next.js 15 + React 18 | Full-stack web application |
| **Smart Contracts** | Solidity + Foundry | Treasury and governance logic |
| **Database** | PostgreSQL + Supabase | Group metadata and voting records |
| **Styling** | TailwindCSS | Modern, responsive UI |

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn
- Wallet with Base Sepolia testnet ETH
- [Coinbase Developer Platform](https://portal.cdp.coinbase.com/) API keys
- [OpenAI API key](https://platform.openai.com/api-keys)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/echofi
cd echofi

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local with your API keys (see Configuration below)

# Run setup script for guided configuration
npm run setup-env

# Start development server
npm run dev
```

### Configuration

Required environment variables in `.env.local`:

```bash
# Coinbase Developer Platform
CDP_API_KEY_NAME=your_cdp_api_key_name
CDP_API_KEY_PRIVATE_KEY=your_cdp_private_key

# OpenAI for AgentKit
OPENAI_API_KEY=your_openai_api_key

# Database
DATABASE_URL=your_supabase_postgresql_url

# Network Configuration
NETWORK_ID=base-sepolia  # Use base-mainnet for production
NEXT_PUBLIC_XMTP_ENV=dev  # Use production for mainnet

# Optional
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Smart Contract Deployment

```bash
# Navigate to contracts directory
cd contracts

# Install Foundry dependencies
forge install

# Deploy to Base Sepolia
make deploy-sepolia

# Verify contracts (optional)
make verify-sepolia
```

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

### Smart Contract Architecture

- **EchoFiTreasury.sol**: Main treasury with multi-sig governance and Aave integration
- **EchoFiFactory.sol**: Factory for deploying new group treasuries
- **EchoFiHelper.sol**: View functions for frontend integration

### Data Flow

1. **Group Creation**: XMTP group chat creation triggers smart contract treasury deployment
2. **Proposal Discussion**: Members discuss investments in encrypted group chat
3. **Formal Voting**: Proposals submitted on-chain with transparent voting
4. **AI Execution**: AgentKit processes approved decisions and executes DeFi operations
5. **Results Reporting**: Automated updates sent to group chat with transaction details

## 🎮 Usage

### Creating an Investment Group

1. **Connect Wallet**: Connect your wallet to access XMTP messaging
2. **Create Group**: Start a new XMTP group and invite members by wallet address
3. **Deploy Treasury**: Use the factory to deploy a new multi-signature treasury
4. **Fund Treasury**: Members deposit USDC to begin group investing

### Making Investment Decisions

1. **Discuss Strategy**: Use encrypted group chat for sensitive investment discussions
2. **Submit Proposal**: Create formal on-chain proposals for specific investments
3. **Vote**: Members vote using their configured voting power
4. **Execute**: AI agent automatically executes approved proposals
5. **Track Performance**: Monitor portfolio performance in real-time dashboard

### AI Agent Commands

The AgentKit-powered agent responds to natural language:

- `"What's our current portfolio value?"`
- `"Invest 20% in Aave USDC lending"`
- `"Show me yield opportunities under 10% risk"`
- `"Exit our position in Protocol X if yield drops below 5%"`

## 📱 Demo

**Live Demo**: [https://echofi.vercel.app](https://echo-fi-one.vercel.app/) *(Base Sepolia testnet)*

**Example Treasury**: `0x824ee8407e0dcf964a7172b6b9e7e265abef85d25179f0c2cf87b0ea78d9e1a5`
**Example LInk**: `0x824ee8407e0dcf964a7172b6b9e7e265abef85d25179f0c2cf87b0ea78d9e1a5`(https://sepolia.basescan.org/tx/0x824ee8407e0dcf964a7172b6b9e7e265abef85d25179f0c2cf87b0ea78d9e1a5)

**Demo Video**: [Watch on YouTube](https://youtube.com/watch?v=demo-link)


### Demo Flow

1. Connect wallet and join demo group
2. Participate in sample investment discussion
3. Vote on mock proposal
4. Watch AI agent execute simulated DeFi operation
5. View updated portfolio dashboard

## ⚠️ Current Status

**This is a buildathon MVP** - built in 2 weeks for the XMTP Buildathon. Current implementation status:

### ✅ **Working Features**
- XMTP v3 group messaging with encryption
- Wallet connection and authentication
- Smart contract deployment and interaction
- Basic AgentKit integration
- Responsive UI with real-time updates

### 🚧 **In Development**
- Advanced AgentKit DeFi operations
- Cross-device message synchronization
- Complex investment strategy automation
- Mobile app optimization

### 🎯 **Demo-Ready**
- Group creation and messaging
- Proposal submission and voting
- Portfolio tracking dashboard
- Agent command interface

### Known Issues

- **XMTP v3 Database Sync**: Occasional SequenceId errors requiring database reset
- **AgentKit Integration**: Some advanced DeFi operations return mock responses
- **Cross-Device Sync**: Messages may not sync perfectly across devices
- **Error Handling**: Extensive fallback systems for demo reliability

## 🛣 Roadmap

### Immediate (Post-Buildathon)
- [ ] Resolve XMTP v3 synchronization issues
- [ ] Complete AgentKit DeFi integration
- [ ] Deploy to Base mainnet
- [ ] Mobile app optimization

### Short Term (3-6 months)
- [ ] Additional DeFi protocol integrations (Uniswap, Compound)
- [ ] Advanced governance mechanisms (quadratic voting, delegation)
- [ ] Multi-chain support (Arbitrum, Optimism)
- [ ] Institutional security features

### Long Term (6-12 months)
- [ ] KYC/AML compliance framework
- [ ] Traditional finance integrations
- [ ] White-label solutions for family offices
- [ ] Cross-platform mobile applications

## 🤝 Contributing

We welcome contributions! This project was built for the XMTP Buildathon but represents a long-term vision for decentralized group coordination.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards

- **TypeScript**: Strict type checking enabled
- **ESLint + Prettier**: Automated code formatting
- **Testing**: Add tests for new features
- **Documentation**: Update README and inline docs

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏆 Buildathon Submission

## 🙏 Acknowledgments

- **XMTP Team** for the revolutionary messaging protocol
- **Coinbase** for AgentKit and Base infrastructure
- **OpenZeppelin** for battle-tested smart contract libraries
- **Aave** for DeFi lending primitives
- **Vercel** for seamless deployment platform

---

**Built with ❤️ for the XMTP Buildathon**

*Combining the power of decentralized messaging, AI automation, and battle-tested smart contracts to revolutionize group investment coordination.*

---

### 📊 Project Stats

![GitHub Stars](https://img.shields.io/github/stars/yourusername/echofi?style=social)
![GitHub Forks](https://img.shields.io/github/forks/yourusername/echofi?style=social)
![License](https://img.shields.io/github/license/yourusername/echofi)
![Build Status](https://img.shields.io/github/workflow/status/yourusername/echofi/CI)

**Star this repo if EchoFi helps solve your group coordination challenges!** ⭐