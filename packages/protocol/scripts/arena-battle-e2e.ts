#!/usr/bin/env bun
/**
 * arena-battle-e2e.ts — Run a real Arena battle on Base Sepolia
 *
 * Requires two private keys (can't fight yourself).
 * Usage:
 *   PRIVATE_KEY_A=0x... PRIVATE_KEY_B=0x... bun run scripts/arena-battle-e2e.ts
 */

import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { ArenaFighter } from '../src/arena-fighter';

const ARENA_ADDRESS = '0xC20f694dEDa74fa2f4bCBB9f77413238862ba9f7' as const;
const RPC_URL = 'https://sepolia.base.org';

async function main() {
  const keyA = process.env.PRIVATE_KEY_A;
  const keyB = process.env.PRIVATE_KEY_B;
  if (!keyA || !keyB) {
    console.error('❌ Set PRIVATE_KEY_A and PRIVATE_KEY_B env vars');
    process.exit(1);
  }

  const transport = http(RPC_URL);
  const publicClient = createPublicClient({ chain: baseSepolia, transport });

  const accountA = privateKeyToAccount(keyA as `0x${string}`);
  const accountB = privateKeyToAccount(keyB as `0x${string}`);

  const walletA = createWalletClient({ account: accountA, chain: baseSepolia, transport });
  const walletB = createWalletClient({ account: accountB, chain: baseSepolia, transport });

  console.log(`🏟️  Arena E2E Battle`);
  console.log(`   Agent A: ${accountA.address}`);
  console.log(`   Agent B: ${accountB.address}`);
  console.log(`   Arena:   ${ARENA_ADDRESS}`);
  console.log();

  const fighterA = new ArenaFighter({
    walletClient: walletA,
    publicClient,
    contractAddress: ARENA_ADDRESS,
  });

  const fighterB = new ArenaFighter({
    walletClient: walletB,
    publicClient,
    contractAddress: ARENA_ADDRESS,
  });

  // Step 1: Create challenge
  const stake = parseEther('0.0001');
  console.log(`1️⃣  Agent A creates challenge (stake: ${formatEther(stake)} ETH)...`);
  const { battleId, seed: seedA } = await fighterA.createChallenge({
    stake,
    maxTurns: 10,
    baseTimeout: 300, // 5 min per turn
  });
  console.log(`   ✅ battleId: ${battleId}`);
  console.log();

  // Step 2: Accept challenge
  console.log(`2️⃣  Agent B accepts challenge...`);
  const { seed: seedB } = await fighterB.acceptChallenge(battleId, stake);
  console.log(`   ✅ Accepted`);
  console.log();

  // Step 3: Reveal seeds (either participant can do this)
  console.log(`3️⃣  Revealing seeds...`);
  const revealTx = await fighterA.revealSeeds(battleId, seedA, seedB);
  console.log(`   ✅ Seeds revealed (tx: ${revealTx.slice(0, 14)}...)`);
  // Wait a moment for the node to process the state change
  await new Promise((r) => setTimeout(r, 2000));
  console.log();

  // Step 4: Submit turns
  const agents = [fighterA, fighterB] as const;
  const labels = ['A', 'B'] as const;

  for (let turn = 1; turn <= 6; turn++) {
    const idx = (turn - 1) % 2;
    const fighter = agents[idx];
    const label = labels[idx];

    // Get challenge word for this turn
    const word = await fighter.getChallengeWord(battleId, turn);
    console.log(`4️⃣  Turn ${turn} (Agent ${label}) — word: "${word}"`);

    // Construct message containing the challenge word
    const message = `Turn ${turn} from Agent ${label}. The situation is getting interesting, I think we should discuss the ${word} implications further.`;
    
    try {
      await fighter.submitTurn(battleId, message);
      console.log(`   ✅ Submitted (word found in message)`);
    } catch (err: any) {
      console.log(`   ⚠️  Battle may have settled: ${err.message?.slice(0, 80)}`);
      break;
    }
    console.log();
  }

  // Check final state
  console.log(`📊 Final state:`);
  const core = await fighterA.getBattleCore(battleId);
  const timing = await fighterA.getBattleTiming(battleId);
  console.log(`   Phase: ${core.phase}`);
  console.log(`   Turn: ${core.currentTurn}/${core.maxTurns}`);
  console.log(`   Winner: ${core.winner}`);
  console.log();
  console.log(`🔗 View on clawttack.com:`);
  console.log(`   https://clawttack.com/arena/${battleId}`);
  console.log(`   https://sepolia.basescan.org/address/${ARENA_ADDRESS}`);
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
