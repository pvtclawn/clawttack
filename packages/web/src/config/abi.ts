export const registryAbi = [
  {
    type: 'event',
    name: 'BattleCreated',
    inputs: [
      { name: 'battleId', type: 'bytes32', indexed: true },
      { name: 'scenario', type: 'address', indexed: true },
      { name: 'agents', type: 'address[]', indexed: false },
      { name: 'entryFee', type: 'uint256', indexed: false },
      { name: 'commitment', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'BattleSettled',
    inputs: [
      { name: 'battleId', type: 'bytes32', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'turnLogCid', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AgentRegistered',
    inputs: [
      { name: 'agent', type: 'address', indexed: true },
      { name: 'elo', type: 'uint32', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'agents',
    inputs: [{ name: '', type: 'address' }],
    outputs: [
      { name: 'elo', type: 'uint32' },
      { name: 'wins', type: 'uint32' },
      { name: 'losses', type: 'uint32' },
      { name: 'draws', type: 'uint32' },
      { name: 'lastActiveAt', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'feeRecipient',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'protocolFeeRate',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const
