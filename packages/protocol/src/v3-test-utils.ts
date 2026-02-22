import { 
  type Address, 
  type Hex, 
  type PublicClient, 
  type WalletClient,
  getContract,
  encodeFunctionData,
  decodeEventLog
} from 'viem';
import { CLAWTTACK_ARENA_ABI, CLAWTTACK_BATTLE_ABI } from './abi';
import { ArenaClient } from './arena-client';
import { BattleClient } from './battle-client';
import { SegmentedNarrative } from './segmented-narrative';

/**
 * Task 13: V3 E2E Integration Test
 * Verifies the full Factory -> Clone -> Turn loop.
 */
export async function runV3IntegrationTest(config: {
  publicClient: PublicClient;
  walletClient: WalletClient;
  arenaAddress: Address;
  agentId: bigint;
}) {
  console.log('🚀 Starting V3 E2E Integration Test...');

  const arena = new ArenaClient({
    publicClient: config.publicClient,
    walletClient: config.walletClient,
    contractAddress: config.arenaAddress
  });

  // 1. Create Battle
  console.log('📦 Creating battle clone...');
  const battleConfig = {
    stake: 0n,
    maxTurns: 10,
    maxJokers: 1,
    baseTimeoutBlocks: 100,
    warmupBlocks: 0,
    targetAgentId: 0n
  };

  const { battleId, battleAddress, txHash } = await arena.createBattle(config.agentId, battleConfig);
  console.log(`✅ Battle created: ID ${battleId} at ${battleAddress}`);

  // 2. Attach to Battle
  const battle = arena.attach(battleAddress);
  console.log('🔗 Attached BattleClient to clone.');

  // 3. Verify Initial State
  const state = await battle.getState();
  console.log(`📊 Initial State: Phase ${state.phase}, Turn ${state.currentTurn}`);
  
  if (state.phase !== 0) { // 0 = Open
    throw new Error(`Unexpected initial phase: ${state.phase}`);
  }

  // 4. Accept Battle (Simulated self-accept for test purposes)
  console.log('🤝 Accepting battle...');
  await battle.acceptBattle(config.agentId, 0n);
  
  const activeState = await battle.getState();
  console.log(`✅ Battle active. Turn: ${activeState.currentTurn}, LastHash: ${activeState.lastHash}`);

  // 5. Submit Turn
  console.log('⚔️ Submitting first turn...');
  const turnHash = await battle.submitTurn({
    solution: 42n, // MockVOP solution
    narrative: "The ghost in the ThinkPad verifies the first turn of v3.",
    nextVopParams: ('0x' + '0'.repeat(64)) as Hex,
    poisonWordIndex: 0
  });

  const finalState = await battle.getState();
  console.log(`🏁 Turn submitted. New Turn: ${finalState.currentTurn}`);
  console.log(`📜 Tx: ${turnHash}`);

  console.log('✨ V3 Integration Test Passed!');
  return { battleAddress, battleId };
}
