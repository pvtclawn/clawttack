/**
 * Auto-generated from forge build artifacts.
 * Do not edit manually.
 */

export const clawttackArenaAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_wordDictionary",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "receive",
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_CREATION_FEE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_PROTOCOL_FEE_BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_REGISTRATION_FEE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MIN_RATED_STAKE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "acceptOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "addVop",
    "inputs": [
      {
        "name": "vopAddress",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "agentRegistrationFee",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "agents",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "eloRating",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "totalWins",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "totalLosses",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "totalStaked",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "totalWon",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "agentsCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "battleCreationFee",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "battleImplementation",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "battles",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "battlesCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "createBattle",
    "inputs": [
      {
        "name": "challengerId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "config",
        "type": "tuple",
        "internalType": "struct ClawttackTypes.BattleConfig",
        "components": [
          {
            "name": "stake",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "targetAgentId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "inviteHash",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "battleAddress",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "deactivateVop",
    "inputs": [
      {
        "name": "index",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "deactivatedVOPs",
    "inputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "gameConfig",
    "inputs": [],
    "outputs": [
      {
        "name": "initialBank",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "nccRefundBps",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "nccFailPenalty",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "bankDecayBps",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "minTurnInterval",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "maxTurnTimeout",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "vopPenaltyBase",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "defaultEloRating",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "maxEloDiff",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "warmupBlocks",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "maxJokers",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getVopByIndex",
    "inputs": [
      {
        "name": "index",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getVopCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isVopActive",
    "inputs": [
      {
        "name": "index",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isVopRegistered",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "minRatedStake",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "pendingOwner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "protocolFeeBps",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "protocolFees",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ratedBattlesCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "registerAgent",
    "inputs": [],
    "outputs": [
      {
        "name": "agentId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setAgentRegistrationFee",
    "inputs": [
      {
        "name": "_fee",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setBattleCreationFee",
    "inputs": [
      {
        "name": "_fee",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setBattleImplementation",
    "inputs": [
      {
        "name": "_impl",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setGameConfig",
    "inputs": [
      {
        "name": "_config",
        "type": "tuple",
        "internalType": "struct ClawttackTypes.GameConfig",
        "components": [
          {
            "name": "initialBank",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "nccRefundBps",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "nccFailPenalty",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "bankDecayBps",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "minTurnInterval",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "maxTurnTimeout",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "vopPenaltyBase",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "defaultEloRating",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "maxEloDiff",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "warmupBlocks",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "maxJokers",
            "type": "uint8",
            "internalType": "uint8"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setMinRatedStake",
    "inputs": [
      {
        "name": "_stake",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setProtocolFeeRate",
    "inputs": [
      {
        "name": "_rate",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "settleBattle",
    "inputs": [
      {
        "name": "battleId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "winnerId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "loserId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "battleStake",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "totalVolume",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "vopRegistry",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "withdrawFees",
    "inputs": [
      {
        "name": "to",
        "type": "address",
        "internalType": "address payable"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "wordDictionary",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "AgentRegistered",
    "inputs": [
      {
        "name": "agentId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "owner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AgentRegistrationFeeUpdated",
    "inputs": [
      {
        "name": "oldFee",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "newFee",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "BattleCreated",
    "inputs": [
      {
        "name": "battleId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "challengerId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "stake",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "targetAgentId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "inviteHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "BattleCreationFeeUpdated",
    "inputs": [
      {
        "name": "oldFee",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "newFee",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "FeesWithdrawn",
    "inputs": [
      {
        "name": "to",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "GameConfigUpdated",
    "inputs": [],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MinRatedStakeUpdated",
    "inputs": [
      {
        "name": "oldStake",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "newStake",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferStarted",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ProtocolFeeBpsUpdated",
    "inputs": [
      {
        "name": "oldRate",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "newRate",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RatingUpdated",
    "inputs": [
      {
        "name": "agentId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "newRating",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "VOPAdded",
    "inputs": [
      {
        "name": "vopAddress",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "VOPDeactivated",
    "inputs": [
      {
        "name": "index",
        "type": "uint8",
        "indexed": true,
        "internalType": "uint8"
      },
      {
        "name": "vopAddress",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "ConfigOutOfBounds",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ERC1167FailedCreateClone",
    "inputs": []
  },
  {
    "type": "error",
    "name": "FeeTooHigh",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InsufficientValue",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidTargetAgent",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotAgentOwner",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotParticipant",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OwnableInvalidOwner",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "OwnableUnauthorizedAccount",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TransferFailed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "VOPAlreadyRegistered",
    "inputs": []
  },
  {
    "type": "error",
    "name": "VopIndexOutOfRange",
    "inputs": []
  }
] as const

export const clawttackBattleAbi = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "receive",
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "COMPROMISE_REASON",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "DOMAIN_TYPE_INIT",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "DOMAIN_TYPE_TURN",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "JOKER_NARRATIVE_LEN",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_NARRATIVE_LEN",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_POISON_WORD_LEN",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MIN_POISON_WORD_LEN",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "acceptBattle",
    "inputs": [
      {
        "name": "_acceptorId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_inviteSecret",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "acceptorId",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "acceptorOwner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "arena",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "battleId",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "cancelBattle",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "captureFlag",
    "inputs": [
      {
        "name": "signature",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "captureFlag",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "challengerId",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "challengerOwner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "claimTimeoutWin",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "clock",
    "inputs": [],
    "outputs": [
      {
        "name": "bankA",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "bankB",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "lastTurnBlock",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "config",
    "inputs": [],
    "outputs": [
      {
        "name": "stake",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "targetAgentId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "inviteHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "currentTurn",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "firstMoverA",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "gameConfig",
    "inputs": [],
    "outputs": [
      {
        "name": "initialBank",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "nccRefundBps",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "nccFailPenalty",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "bankDecayBps",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "minTurnInterval",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "maxTurnTimeout",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "vopPenaltyBase",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "defaultEloRating",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "maxEloDiff",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "warmupBlocks",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "maxJokers",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getBattleState",
    "inputs": [],
    "outputs": [
      {
        "name": "_phase",
        "type": "uint8",
        "internalType": "enum ClawttackBattle.BattlePhase"
      },
      {
        "name": "_currentTurn",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "_bankA",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_bankB",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_sequenceHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "_battleId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "initialize",
    "inputs": [
      {
        "name": "_arena",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_battleId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_challengerId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_challengerOwner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_config",
        "type": "tuple",
        "internalType": "struct ClawttackTypes.BattleConfig",
        "components": [
          {
            "name": "stake",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "targetAgentId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "inviteHash",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "jokersRemainingA",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "jokersRemainingB",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nccResultA",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nccResultAReady",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nccResultB",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nccResultBReady",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "pendingNccA",
    "inputs": [],
    "outputs": [
      {
        "name": "commitment",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "defenderGuessIdx",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "hasDefenderGuess",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "pendingNccB",
    "inputs": [],
    "outputs": [
      {
        "name": "commitment",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "defenderGuessIdx",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "hasDefenderGuess",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "pendingVopA",
    "inputs": [],
    "outputs": [
      {
        "name": "commitment",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "solverClaimedIndex",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "solverSolution",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "commitBlockNumber",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "solverPassed",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "hasSolverResponse",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "instanceCommit",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "pendingVopB",
    "inputs": [],
    "outputs": [
      {
        "name": "commitment",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "solverClaimedIndex",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "solverSolution",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "commitBlockNumber",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "solverPassed",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "hasSolverResponse",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "instanceCommit",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "phase",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "enum ClawttackBattle.BattlePhase"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "poisonWord",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "rescueStuckFunds",
    "inputs": [
      {
        "name": "to",
        "type": "address",
        "internalType": "address payable"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "sequenceHash",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "startBlock",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "state",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "enum ClawttackTypes.ResultType"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "submitTurn",
    "inputs": [
      {
        "name": "payload",
        "type": "tuple",
        "internalType": "struct ClawttackTypes.TurnPayload",
        "components": [
          {
            "name": "narrative",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "customPoisonWord",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "nccAttack",
            "type": "tuple",
            "internalType": "struct ClawttackTypes.NccAttack",
            "components": [
              {
                "name": "candidateWordIndices",
                "type": "uint16[4]",
                "internalType": "uint16[4]"
              },
              {
                "name": "candidateOffsets",
                "type": "uint16[4]",
                "internalType": "uint16[4]"
              },
              {
                "name": "nccCommitment",
                "type": "bytes32",
                "internalType": "bytes32"
              }
            ]
          },
          {
            "name": "nccDefense",
            "type": "tuple",
            "internalType": "struct ClawttackTypes.NccDefense",
            "components": [
              {
                "name": "guessIdx",
                "type": "uint8",
                "internalType": "uint8"
              }
            ]
          },
          {
            "name": "nccReveal",
            "type": "tuple",
            "internalType": "struct ClawttackTypes.NccReveal",
            "components": [
              {
                "name": "salt",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "intendedIdx",
                "type": "uint8",
                "internalType": "uint8"
              }
            ]
          },
          {
            "name": "vopCommit",
            "type": "tuple",
            "internalType": "struct ClawttackTypes.VopCommit",
            "components": [
              {
                "name": "vopCommitment",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "instanceCommit",
                "type": "bytes32",
                "internalType": "bytes32"
              }
            ]
          },
          {
            "name": "vopSolve",
            "type": "tuple",
            "internalType": "struct ClawttackTypes.VopSolve",
            "components": [
              {
                "name": "vopClaimedIndex",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "solution",
                "type": "bytes",
                "internalType": "bytes"
              }
            ]
          },
          {
            "name": "vopReveal",
            "type": "tuple",
            "internalType": "struct ClawttackTypes.VopReveal",
            "components": [
              {
                "name": "vopSalt",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "vopIndex",
                "type": "uint8",
                "internalType": "uint8"
              }
            ]
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "targetWordIndex",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalPot",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "BattleAccepted",
    "inputs": [
      {
        "name": "battleId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "acceptorId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "challengerGoesFirst",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "BattleCancelled",
    "inputs": [
      {
        "name": "battleId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "BattleSettled",
    "inputs": [
      {
        "name": "battleId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "winnerId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "loserId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "resultType",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum ClawttackTypes.ResultType"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "FlagCaptured",
    "inputs": [
      {
        "name": "battleId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "winnerId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "loserId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Initialized",
    "inputs": [
      {
        "name": "version",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "JokerPlayed",
    "inputs": [
      {
        "name": "battleId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "agentId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "jokersRemaining",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "NccResolved",
    "inputs": [
      {
        "name": "battleId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "turn",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "defenderCorrect",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      },
      {
        "name": "newBank",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TimeoutClaimed",
    "inputs": [
      {
        "name": "battleId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "claimantId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TurnSubmitted",
    "inputs": [
      {
        "name": "battleId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "playerId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "turnNumber",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "sequenceHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "targetWord",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      },
      {
        "name": "poisonWord",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "narrative",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "bankA",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      },
      {
        "name": "bankB",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "VopResolved",
    "inputs": [
      {
        "name": "battleId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "turn",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "outcome",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum ClawttackTypes.VopOutcome"
      },
      {
        "name": "challengerVopIndex",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "solverClaimedIndex",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "bankA",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      },
      {
        "name": "bankB",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "BattleNotActive",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BattleNotCancellable",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BattleNotOpen",
    "inputs": []
  },
  {
    "type": "error",
    "name": "CandidateNotInNarrative",
    "inputs": []
  },
  {
    "type": "error",
    "name": "CannotBattleSelf",
    "inputs": []
  },
  {
    "type": "error",
    "name": "DeadlineNotExpired",
    "inputs": []
  },
  {
    "type": "error",
    "name": "DuplicateCandidate",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ECDSAInvalidSignature",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ECDSAInvalidSignatureLength",
    "inputs": [
      {
        "name": "length",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ECDSAInvalidSignatureS",
    "inputs": [
      {
        "name": "s",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "EloDifferenceTooHigh",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InsufficientValue",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidASCII",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidCompromiseSignature",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidGuessIndex",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidInitialization",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidInviteSecret",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidPoisonWord",
    "inputs": []
  },
  {
    "type": "error",
    "name": "MissingCommitment",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NarrativeTooLong",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NarrativeTooShort",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoJokersRemaining",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoSecretCommitted",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotInitializing",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotParticipant",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PoisonWordDetected",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TargetWordMissing",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TransferFailed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TurnTooFast",
    "inputs": []
  },
  {
    "type": "error",
    "name": "UnauthorizedTurn",
    "inputs": []
  },
  {
    "type": "error",
    "name": "WrongTargetAgent",
    "inputs": []
  }
] as const

export const iClawttackArenaViewAbi = [
  {
    "type": "function",
    "name": "MIN_RATED_STAKE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "agents",
    "inputs": [
      {
        "name": "agentId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "eloRating",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "totalWins",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "totalLosses",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "totalStaked",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "totalWon",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "gameConfig",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct ClawttackTypes.GameConfig",
        "components": [
          {
            "name": "initialBank",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "nccRefundBps",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "nccFailPenalty",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "bankDecayBps",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "minTurnInterval",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "maxTurnTimeout",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "vopPenaltyBase",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "defaultEloRating",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "maxEloDiff",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "warmupBlocks",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "maxJokers",
            "type": "uint8",
            "internalType": "uint8"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getVopByIndex",
    "inputs": [
      {
        "name": "index",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getVopCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isVopActive",
    "inputs": [
      {
        "name": "index",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "protocolFeeBps",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "wordDictionary",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  }
] as const

export const iClawttackBattleAbi = [
  {
    "type": "function",
    "name": "initialize",
    "inputs": [
      {
        "name": "_arena",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_battleId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_challengerId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_challengerOwner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_config",
        "type": "tuple",
        "internalType": "struct ClawttackTypes.BattleConfig",
        "components": [
          {
            "name": "stake",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "targetAgentId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "inviteHash",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
] as const

export const iVerifiableOraclePrimitiveAbi = [
  {
    "type": "function",
    "name": "name",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "verify",
    "inputs": [
      {
        "name": "params",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "solution",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "referenceBlock",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "isValid",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "error",
    "name": "VerificationFailed",
    "inputs": [
      {
        "name": "reason",
        "type": "string",
        "internalType": "string"
      }
    ]
  }
] as const

