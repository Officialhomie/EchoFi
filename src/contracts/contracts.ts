// Frontend Integration for EchoFi Smart Contracts
// WAGMI + Viem integration with TypeScript types

import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
} from 'wagmi';
import type { Address } from 'viem';
import { parseUnits } from 'viem';

// =============================================================================
// CONTRACT ABIS (Complete ABIs from deployed contracts)
// =============================================================================

export const EchoFiFactoryABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_aUSDC",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_initialOwner",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "InsufficientFee",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidMemberCount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidVotingPowers",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "OwnableInvalidOwner",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "OwnableUnauthorizedAccount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReentrancyGuardReentrantCall",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TreasuryNotFound",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "UnauthorizedAccess",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "oldFee",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newFee",
        "type": "uint256"
      }
    ],
    "name": "CreationFeeUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "treasury",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "memberCount",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "treasuryId",
        "type": "uint256"
      }
    ],
    "name": "TreasuryCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "treasury",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "isActive",
        "type": "bool"
      }
    ],
    "name": "TreasuryStatusUpdated",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "aUSDC",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "allTreasuries",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "_name",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "_xmtpGroupId",
        "type": "string"
      }
    ],
    "name": "createGroup",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "_name",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "_description",
        "type": "string"
      },
      {
        "internalType": "address[]",
        "name": "_members",
        "type": "address[]"
      },
      {
        "internalType": "uint256[]",
        "name": "_votingPowers",
        "type": "uint256[]"
      }
    ],
    "name": "createTreasury",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "creationFee",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getActiveTreasuries",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "",
        "type": "address[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getStats",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "totalTreasuries",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "activeTreasuries",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "totalMembers",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "totalFeesCollected",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_treasury",
        "type": "address"
      }
    ],
    "name": "getTreasuryInfo",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "treasuryAddress",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "creator",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "name",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "description",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "memberCount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "totalVotingPower",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "createdAt",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "isActive",
            "type": "bool"
          }
        ],
        "internalType": "struct EchoFiFactory.TreasuryInfo",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_user",
        "type": "address"
      }
    ],
    "name": "getUserTreasuries",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "",
        "type": "address[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "maxMembers",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "minMembers",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "treasuries",
    "outputs": [
      {
        "internalType": "address",
        "name": "treasuryAddress",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "description",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "memberCount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "totalVotingPower",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "createdAt",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "isActive",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "treasuryCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_newFee",
        "type": "uint256"
      }
    ],
    "name": "updateCreationFee",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_minMembers",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_maxMembers",
        "type": "uint256"
      }
    ],
    "name": "updateMemberLimits",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_treasury",
        "type": "address"
      },
      {
        "internalType": "bool",
        "name": "_isActive",
        "type": "bool"
      }
    ],
    "name": "updateTreasuryStatus",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "userTreasuries",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "withdrawFees",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

export const EchoFiHelperABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_factory",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_treasury",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_proposalId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_user",
        "type": "address"
      }
    ],
    "name": "canUserVote",
    "outputs": [
      {
        "internalType": "bool",
        "name": "canVote",
        "type": "bool"
      },
      {
        "internalType": "string",
        "name": "reason",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "factory",
    "outputs": [
      {
        "internalType": "contract EchoFiFactory",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_treasury",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_proposalId",
        "type": "uint256"
      }
    ],
    "name": "getProposalDetail",
    "outputs": [
      {
        "components": [
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
              },
              {
                "internalType": "address",
                "name": "proposer",
                "type": "address"
              },
              {
                "internalType": "enum EchoFiTreasury.ProposalType",
                "name": "proposalType",
                "type": "uint8"
              },
              {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
              },
              {
                "internalType": "string",
                "name": "description",
                "type": "string"
              }
            ],
            "internalType": "struct EchoFiHelper.ProposalBasicInfo",
            "name": "basic",
            "type": "tuple"
          },
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "votesFor",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "votesAgainst",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "deadline",
                "type": "uint256"
              },
              {
                "internalType": "bool",
                "name": "executed",
                "type": "bool"
              },
              {
                "internalType": "bool",
                "name": "cancelled",
                "type": "bool"
              },
              {
                "internalType": "bool",
                "name": "canExecute",
                "type": "bool"
              },
              {
                "internalType": "string",
                "name": "status",
                "type": "string"
              }
            ],
            "internalType": "struct EchoFiHelper.ProposalVotingInfo",
            "name": "voting",
            "type": "tuple"
          }
        ],
        "internalType": "struct EchoFiHelper.ProposalDetails",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_treasury",
        "type": "address"
      }
    ],
    "name": "getTreasuryDetail",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "treasuryAddress",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "name",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "memberCount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "totalVotingPower",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "usdcBalance",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "aUsdcBalance",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "activeProposals",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "isActive",
            "type": "bool"
          }
        ],
        "internalType": "struct EchoFiHelper.TreasuryDetails",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address[]",
        "name": "_treasuries",
        "type": "address[]"
      }
    ],
    "name": "getTreasuryDetails",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "treasuryAddress",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "name",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "memberCount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "totalVotingPower",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "usdcBalance",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "aUsdcBalance",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "activeProposals",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "isActive",
            "type": "bool"
          }
        ],
        "internalType": "struct EchoFiHelper.TreasuryDetails[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "getTreasuryMembers",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "memberAddress",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "votingPower",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "hasProposerRole",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "hasVoterRole",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "hasExecutorRole",
            "type": "bool"
          }
        ],
        "internalType": "struct EchoFiHelper.MemberInfo[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_treasury",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_limit",
        "type": "uint256"
      }
    ],
    "name": "getTreasuryProposals",
    "outputs": [
      {
        "components": [
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
              },
              {
                "internalType": "address",
                "name": "proposer",
                "type": "address"
              },
              {
                "internalType": "enum EchoFiTreasury.ProposalType",
                "name": "proposalType",
                "type": "uint8"
              },
              {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
              },
              {
                "internalType": "string",
                "name": "description",
                "type": "string"
              }
            ],
            "internalType": "struct EchoFiHelper.ProposalBasicInfo",
            "name": "basic",
            "type": "tuple"
          },
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "votesFor",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "votesAgainst",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "deadline",
                "type": "uint256"
              },
              {
                "internalType": "bool",
                "name": "executed",
                "type": "bool"
              },
              {
                "internalType": "bool",
                "name": "cancelled",
                "type": "bool"
              },
              {
                "internalType": "bool",
                "name": "canExecute",
                "type": "bool"
              },
              {
                "internalType": "string",
                "name": "status",
                "type": "string"
              }
            ],
            "internalType": "struct EchoFiHelper.ProposalVotingInfo",
            "name": "voting",
            "type": "tuple"
          }
        ],
        "internalType": "struct EchoFiHelper.ProposalDetails[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_treasury",
        "type": "address"
      }
    ],
    "name": "getTreasuryStats",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "totalProposals",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "activeProposals",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "executedProposals",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "totalVotingPower",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "treasuryValue",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_user",
        "type": "address"
      }
    ],
    "name": "getUserTreasuryDetails",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "treasuryAddress",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "name",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "memberCount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "totalVotingPower",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "usdcBalance",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "aUsdcBalance",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "activeProposals",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "isActive",
            "type": "bool"
          }
        ],
        "internalType": "struct EchoFiHelper.TreasuryDetails[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const EchoFiTreasuryABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_aUSDC",
        "type": "address"
      },
      {
        "internalType": "address[]",
        "name": "_initialMembers",
        "type": "address[]"
      },
      {
        "internalType": "uint256[]",
        "name": "_votingPowers",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "AccessControlBadConfirmation",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "neededRole",
        "type": "bytes32"
      }
    ],
    "name": "AccessControlUnauthorizedAccount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AlreadyVoted",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "EnforcedPause",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ExpectedPause",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InsufficientBalance",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidAddress",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidAmount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidProposalId",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotAuthorized",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ProposalAlreadyExecuted",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ProposalCancelled",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ProposalRejected",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "QuorumNotReached",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReentrancyGuardReentrantCall",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      }
    ],
    "name": "SafeERC20FailedOperation",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "VotingEnded",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "VotingStillActive",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "member",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "votingPower",
        "type": "uint256"
      }
    ],
    "name": "MemberAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "member",
        "type": "address"
      }
    ],
    "name": "MemberRemoved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "Paused",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "proposalId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "proposer",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "enum EchoFiTreasury.ProposalType",
        "name": "proposalType",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "description",
        "type": "string"
      }
    ],
    "name": "ProposalCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "proposalId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "success",
        "type": "bool"
      }
    ],
    "name": "ProposalExecuted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "previousAdminRole",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "newAdminRole",
        "type": "bytes32"
      }
    ],
    "name": "RoleAdminChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "RoleGranted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "RoleRevoked",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "aTokensReceived",
        "type": "uint256"
      }
    ],
    "name": "SuppliedToAave",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "Unpaused",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "proposalId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "voter",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "support",
        "type": "bool"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "votingPower",
        "type": "uint256"
      }
    ],
    "name": "VoteCast",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "aTokenAmount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "underlyingReceived",
        "type": "uint256"
      }
    ],
    "name": "WithdrawnFromAave",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "AAVE_POOL",
    "outputs": [
      {
        "internalType": "contract IAavePool",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "AGENT_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "DEFAULT_ADMIN_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "EXECUTOR_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "PROPOSER_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "USDC",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "VOTER_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "aUSDC",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum EchoFiTreasury.ProposalType",
        "name": "_proposalType",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "_amount",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_target",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "_data",
        "type": "bytes"
      },
      {
        "internalType": "string",
        "name": "_description",
        "type": "string"
      }
    ],
    "name": "createProposal",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "emergencyWithdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_proposalId",
        "type": "uint256"
      }
    ],
    "name": "executeProposal",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_proposalId",
        "type": "uint256"
      }
    ],
    "name": "getProposal",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "proposer",
        "type": "address"
      },
      {
        "internalType": "enum EchoFiTreasury.ProposalType",
        "name": "proposalType",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "target",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      },
      {
        "internalType": "string",
        "name": "description",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "votesFor",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "votesAgainst",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "deadline",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "executed",
        "type": "bool"
      },
      {
        "internalType": "bool",
        "name": "cancelled",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_proposalId",
        "type": "uint256"
      }
    ],
    "name": "getProposalBasic",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "id",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "proposer",
            "type": "address"
          },
          {
            "internalType": "enum EchoFiTreasury.ProposalType",
            "name": "proposalType",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "target",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "description",
            "type": "string"
          }
        ],
        "internalType": "struct EchoFiTreasury.ProposalData",
        "name": "data",
        "type": "tuple"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "votesFor",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "votesAgainst",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "deadline",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "executed",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "cancelled",
            "type": "bool"
          }
        ],
        "internalType": "struct EchoFiTreasury.VotingData",
        "name": "voting",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_proposalId",
        "type": "uint256"
      }
    ],
    "name": "getProposalExecutionData",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      }
    ],
    "name": "getRoleAdmin",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTreasuryBalance",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "usdcBalance",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "aUsdcBalance",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_proposalId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_voter",
        "type": "address"
      }
    ],
    "name": "getVoteChoice",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "grantRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "hasRole",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_proposalId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_voter",
        "type": "address"
      }
    ],
    "name": "hasVoted",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "maxProposalAmount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "memberVotingPower",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "minProposalAmount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "paused",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "proposalCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "proposals",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "id",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "proposer",
            "type": "address"
          },
          {
            "internalType": "enum EchoFiTreasury.ProposalType",
            "name": "proposalType",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "target",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "description",
            "type": "string"
          }
        ],
        "internalType": "struct EchoFiTreasury.ProposalData",
        "name": "data",
        "type": "tuple"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "votesFor",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "votesAgainst",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "deadline",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "executed",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "cancelled",
            "type": "bool"
          }
        ],
        "internalType": "struct EchoFiTreasury.VotingData",
        "name": "voting",
        "type": "tuple"
      },
      {
        "internalType": "bytes",
        "name": "executionData",
        "type": "bytes"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "quorumPercentage",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "callerConfirmation",
        "type": "address"
      }
    ],
    "name": "renounceRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "revokeRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "interfaceId",
        "type": "bytes4"
      }
    ],
    "name": "supportsInterface",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalVotingPower",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "unpause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_proposalId",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "_support",
        "type": "bool"
      }
    ],
    "name": "vote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "votingPeriod",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const AgentExecutorABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_factory",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "treasury",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "strategy",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "success",
        "type": "bool"
      }
    ],
    "name": "StrategyExecuted",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "agent",
        "type": "address"
      }
    ],
    "name": "addAgent",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "authorizedAgents",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "treasury",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "strategy",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "targetProtocol",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "name": "executeStrategy",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "factory",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// =============================================================================
// TYPESCRIPT TYPES BASED ON ACTUAL CONTRACT STRUCTURES
// =============================================================================

// Proposal Types as defined in the contract
export enum ProposalType {
  DEPOSIT_AAVE = 0,
  WITHDRAW_AAVE = 1,
  TRANSFER = 2,
  EMERGENCY_WITHDRAW = 3,
  ADD_MEMBER = 4,
  REMOVE_MEMBER = 5
}

// Factory Types
export interface FactoryTreasuryInfo {
  treasuryAddress: Address;
  creator: Address;
  name: string;
  description: string;
  memberCount: bigint;
  totalVotingPower: bigint;
  createdAt: bigint;
  isActive: boolean;
}

export interface FactoryStats {
  totalTreasuries: bigint;
  activeTreasuries: bigint;
  totalMembers: bigint;
  totalFeesCollected: bigint;
}

// Helper Types
export interface ProposalBasicInfo {
  id: bigint;
  proposer: Address;
  proposalType: ProposalType;
  amount: bigint;
  description: string;
}

export interface ProposalVotingInfo {
  votesFor: bigint;
  votesAgainst: bigint;
  deadline: bigint;
  executed: boolean;
  cancelled: boolean;
  canExecute: boolean;
  status: string;
}

export interface ProposalDetails {
  basic: ProposalBasicInfo;
  voting: ProposalVotingInfo;
}

export interface TreasuryDetails {
  treasuryAddress: Address;
  name: string;
  memberCount: bigint;
  totalVotingPower: bigint;
  usdcBalance: bigint;
  aUsdcBalance: bigint;
  activeProposals: bigint;
  isActive: boolean;
}

export interface MemberInfo {
  memberAddress: Address;
  votingPower: bigint;
  hasProposerRole: boolean;
  hasVoterRole: boolean;
  hasExecutorRole: boolean;
}

export interface TreasuryStats {
  totalProposals: bigint;
  activeProposals: bigint;
  executedProposals: bigint;
  totalVotingPower: bigint;
  treasuryValue: bigint;
}

// Treasury Types
export interface ProposalData {
  id: bigint;
  proposer: Address;
  proposalType: ProposalType;
  amount: bigint;
  target: Address;
  description: string;
}

export interface VotingData {
  votesFor: bigint;
  votesAgainst: bigint;
  deadline: bigint;
  executed: boolean;
  cancelled: boolean;
}

export interface FullProposal {
  data: ProposalData;
  voting: VotingData;
  executionData: string; // bytes as hex string
}

export interface TreasuryBalance {
  usdcBalance: bigint;
  aUsdcBalance: bigint;
}

export interface CanVoteResult {
  canVote: boolean;
  reason: string;
}

// Input Types for Frontend
export interface CreateTreasuryParams {
  name: string;
  description: string;
  members: Address[];
  votingPowers: number[];
}

export interface CreateGroupParams {
  name: string;
  xmtpGroupId: string;
}

export interface CreateProposalParams {
  proposalType: ProposalType;
  amount: bigint;
  target: Address;
  data: string; // bytes as hex string
  description: string;
}

export interface VoteParams {
  proposalId: bigint;
  support: boolean;
}

// Agent Executor Types
export interface ExecuteStrategyParams {
  treasury: Address;
  strategy: string;
  amount: bigint;
  token: Address;
  targetProtocol: Address;
  data: string; // bytes as hex string
}

// Event Log Types
export interface ContractLog {
  address: Address;
  topics: string[];
  data: string;
  transactionHash: string;
  blockNumber: bigint;
  blockHash: string;
  logIndex: number;
}

// =============================================================================
// CONTRACT ADDRESSES
// =============================================================================

export const CONTRACTS = {
  [8453]: { // Base Mainnet
    factory: '0x...' as Address,
    helper: '0x...' as Address,
    agentExecutor: '0x...' as Address,
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
    aUSDC: '0x...' as Address,
  },
  [84532]: { // Base Sepolia
    factory: '0x22e024c06a8D932587f0bDa6527CA951266c6FBB' as Address,
    helper: '0x63C163d9CDC0EB1751A79Bef7A64f5091C3d133F' as Address,
    agentExecutor: '0xb85702a8e35fc4F96F0E84D2496ff5D3708e31d0' as Address,
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address,
    aUSDC: '0x8E80d69DfE8cfeEb08bd5e5A2E18CC9Af3d1f1A0' as Address,
  }
} as const;

// =============================================================================
// CUSTOM HOOKS
// =============================================================================

/**
 * Hook to create a new treasury via factory
 */
export function useCreateTreasury(chainId: number) {
  const factoryAddress = CONTRACTS[chainId as keyof typeof CONTRACTS]?.factory;
  
  const { error: simError, isPending: isSimPending } = useSimulateContract({
    address: factoryAddress,
    abi: EchoFiFactoryABI,
    functionName: 'createTreasury',
  });
  
  const { data, writeContract, isPending } = useWriteContract();
  const { isPending: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: data,
  });

  const createTreasury = (params: CreateTreasuryParams) => {
    if (!writeContract) return;
    
    const total = params.votingPowers.reduce((sum, power) => sum + power, 0);
    if (total !== 100) {
      throw new Error('Voting powers must sum to 100');
    }
    
    writeContract({
      address: factoryAddress,
      abi: EchoFiFactoryABI,
      functionName: 'createTreasury',
      args: [
        params.name,
        params.description,
        params.members,
        params.votingPowers.map((p) => BigInt(p)),
      ],
      value: parseUnits('0.001', 18), // Creation fee
    });
  };

  return {
    createTreasury,
    isLoading: isPending || isConfirming || isSimPending,
    isSuccess,
    txHash: data,
    error: simError,
  };
}

/**
 * Hook to create a new group via factory
 */
export function useCreateGroup(chainId: number) {
  const factoryAddress = CONTRACTS[chainId as keyof typeof CONTRACTS]?.factory;
  
  const { data, writeContract, isPending } = useWriteContract();
  const { isPending: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: data,
  });

  const createGroup = (params: CreateGroupParams) => {
    if (!writeContract) return;
    
    writeContract({
      address: factoryAddress,
      abi: EchoFiFactoryABI,
      functionName: 'createGroup',
      args: [params.name, params.xmtpGroupId],
      value: parseUnits('0.001', 18), // Creation fee
    });
  };

  return {
    createGroup,
    isLoading: isPending || isConfirming,
    isSuccess,
    txHash: data,
  };
}

/**
 * Hook to get user's treasuries
 */
export function useUserTreasuries(userAddress: Address, chainId: number) {
  const factoryAddress = CONTRACTS[chainId as keyof typeof CONTRACTS]?.factory;
  
  const { data, error, isPending } = useReadContract({
    address: factoryAddress,
    abi: EchoFiFactoryABI,
    functionName: 'getUserTreasuries',
    args: [userAddress],
  });
  
  return {
    treasuries: data || [],
    isError: !!error,
    isLoading: isPending,
  };
}

/**
 * Hook to get treasury details using helper
 */
export function useTreasuryDetails(treasuryAddress: Address, chainId: number) {
  const helperAddress = CONTRACTS[chainId as keyof typeof CONTRACTS]?.helper;
  
  const { data, error, isPending } = useReadContract({
    address: helperAddress,
    abi: EchoFiHelperABI,
    functionName: 'getTreasuryDetail',
    args: [treasuryAddress],
  });

  return {
    treasury: data,
    isError: !!error,
    isLoading: isPending,
  };
}

/**
 * Hook to get treasury balance from treasury contract
 */
export function useTreasuryBalance(treasuryAddress: Address) {
  const { data, error, isPending } = useReadContract({
    address: treasuryAddress,
    abi: EchoFiTreasuryABI,
    functionName: 'getTreasuryBalance',
  });

  const [usdcBalance, aUsdcBalance] = data || [0n, 0n];
  
  const balance: TreasuryBalance = {
    usdcBalance,
    aUsdcBalance,
  };

  return {
    balance,
    totalValue: usdcBalance + aUsdcBalance,
    formattedTotal: (Number(usdcBalance + aUsdcBalance) / 1e6).toFixed(2),
    isLoading: isPending,
    error,
  };
}

/**
 * Hook to create a proposal
 */
export function useCreateProposal(treasuryAddress: Address) {
  const { data, writeContract, isPending } = useWriteContract();
  const { isPending: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: data,
  });

  const createProposal = (params: CreateProposalParams) => {
    if (!writeContract) return;
    
    writeContract({
      address: treasuryAddress,
      abi: EchoFiTreasuryABI,
      functionName: 'createProposal',
      args: [
        params.proposalType,
        params.amount,
        params.target,
        params.data as `0x${string}`,
        params.description,
      ],
    });
  };

  return {
    createProposal,
    isLoading: isPending || isConfirming,
    isSuccess,
    txHash: data,
  };
}

/**
 * Hook to vote on a proposal
 */
export function useVote(treasuryAddress: Address) {
  const { data, writeContract, isPending } = useWriteContract();
  const { isPending: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: data,
  });

  const vote = (params: VoteParams) => {
    if (!writeContract) return;
    
    writeContract({
      address: treasuryAddress,
      abi: EchoFiTreasuryABI,
      functionName: 'vote',
      args: [params.proposalId, params.support],
    });
  };

  return {
    vote,
    isLoading: isPending || isConfirming,
    isSuccess,
    txHash: data,
  };
}

/**
 * Hook to execute a proposal
 */
export function useExecuteProposal(treasuryAddress: Address) {
  const { data, writeContract, isPending } = useWriteContract();
  const { isPending: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: data,
  });

  const executeProposal = (proposalId: bigint) => {
    if (!writeContract) return;
    
    writeContract({
      address: treasuryAddress,
      abi: EchoFiTreasuryABI,
      functionName: 'executeProposal',
      args: [proposalId],
    });
  };

  return {
    executeProposal,
    isLoading: isPending || isConfirming,
    isSuccess,
    txHash: data,
  };
}

/**
 * Hook to get proposal details using helper
 */
export function useProposalDetails(treasuryAddress: Address, proposalId: bigint, chainId: number) {
  const helperAddress = CONTRACTS[chainId as keyof typeof CONTRACTS]?.helper;
  
  const { data, error, isPending } = useReadContract({
    address: helperAddress,
    abi: EchoFiHelperABI,
    functionName: 'getProposalDetail',
    args: [treasuryAddress, proposalId],
  });

  return {
    proposal: data,
    isError: !!error,
    isLoading: isPending,
  };
}

/**
 * Hook to check if user can vote
 */
export function useCanUserVote(treasuryAddress: Address, proposalId: bigint, userAddress: Address, chainId: number) {
  const helperAddress = CONTRACTS[chainId as keyof typeof CONTRACTS]?.helper;
  
  const { data, error, isPending } = useReadContract({
    address: helperAddress,
    abi: EchoFiHelperABI,
    functionName: 'canUserVote',
    args: [treasuryAddress, proposalId, userAddress],
  });

  const [canVote, reason] = data || [false, 'Unknown'];

  return {
    canVote,
    reason,
    isError: !!error,
    isLoading: isPending,
  };
}

/**
 * Hook to listen to contract events
 */
export function useContractEvents(treasuryAddress: Address) {
  useWatchContractEvent({
    address: treasuryAddress,
    abi: EchoFiTreasuryABI,
    eventName: 'ProposalCreated',
    onLogs(logs: ContractLog[]) {
      console.log('Proposal Created:', logs);
    }
  });

  useWatchContractEvent({
    address: treasuryAddress,
    abi: EchoFiTreasuryABI,
    eventName: 'VoteCast',
    onLogs(logs: ContractLog[]) {
      console.log('Vote Cast:', logs);
    }
  });

  useWatchContractEvent({
    address: treasuryAddress,
    abi: EchoFiTreasuryABI,
    eventName: 'ProposalExecuted',
    onLogs(logs: ContractLog[]) {
      console.log('Proposal Executed:', logs);
    }
  });
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format proposal type for display
 */
export function formatProposalType(type: ProposalType): string {
  switch (type) {
    case ProposalType.DEPOSIT_AAVE:
      return 'Deposit to Aave';
    case ProposalType.WITHDRAW_AAVE:
      return 'Withdraw from Aave';
    case ProposalType.TRANSFER:
      return 'Transfer';
    case ProposalType.EMERGENCY_WITHDRAW:
      return 'Emergency Withdraw';
    case ProposalType.ADD_MEMBER:
      return 'Add Member';
    case ProposalType.REMOVE_MEMBER:
      return 'Remove Member';
    default:
      return 'Unknown';
  }
}

/**
 * Format voting power as percentage
 */
export function formatVotingPower(power: bigint, total: bigint): string {
  if (total === 0n) return '0%';
  return `${(Number(power) * 100 / Number(total)).toFixed(1)}%`;
}

/**
 * Check if proposal can be executed
 */
export function canExecuteProposal(proposal: ProposalDetails): boolean {
  return proposal.voting.canExecute && 
         !proposal.voting.executed && 
         !proposal.voting.cancelled;
}

/**
 * Calculate quorum progress
 */
export function calculateQuorumProgress(votesFor: bigint, votesAgainst: bigint, totalVotingPower: bigint, quorumPercentage: bigint = 51n): number {
  const totalVotes = votesFor + votesAgainst;
  const requiredVotes = (totalVotingPower * quorumPercentage) / 100n;
  
  if (requiredVotes === 0n) return 0;
  return Math.min(100, (Number(totalVotes) / Number(requiredVotes)) * 100);
}