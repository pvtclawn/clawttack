#!/usr/bin/env bun
/**
 * test-independent-reveal.ts — Validate the independent seed reveal flow
 *
 * Simulates two separate agents who don't share seeds.
 * Each reveals independently. Battle activates when both are in.
 *
 * Uses Foundry keystore for wallet A, env PRIVATE_KEY_B for wallet B.
 */

import { createPublicClient, createWalletClient, http, formatEther } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { ArenaFighter, BattlePhase } from '../src/arena-fighter';
import { templateStrategy } from '../src/strategies';

const ARENA_ADDRESS = '0xC20f694dEDa74fa2f4bCBB9f77413238862ba9f7' as const;
const RPC_URL = 'https://sepolia.base.org';
const DEPLOY_BLOCK = 24_600_000n;

async function main() {
  const keyA = process.env.PRIVATE_KEY_A;
  const keyB = process.env.PRIVATE_KEY_B;

  if (!keyA || !keyB) {
    console.error('❌ PRIVATE_KEY_A and PRIVATE_KEY_B required');
    process.exit(1);
  }

  const transport = http(RPC_URL);
  const publicClient = createPublicClient({ chain: baseSepolia, transport });

  const accountA = privateKeyToAccount(keyA as `0x${string}`);
  const accountB = privateKeyToAccount(keyB as `0x${string}`);

  const walletA = createWalletClient({ account: accountA, chain: baseSepolia, transport });
  const walletB = createWalletClient({ account: accountB, chain: baseSepolia, transport });

  console.log('🧪 Independent Seed Reveal Test');
  console.log(`   Agent A: ${accountA.address}`);
  console.log(`   Agent B: ${accountB.address}`);
  console.log(`   Arena:   ${ARENA_ADDRESS}`);
  console.log('');

  const fighterA = new ArenaFighter({
    walletClient: walletA,
    publicClient,
    contractAddress: ARENA_ADDRESS,
    deployBlock: DEPLOY_BLOCK,
  });

  const fighterB = new ArenaFighter({
    walletClient: walletB,
    publicClient,
    contractAddress: ARENA_ADDRESS,
    deployBlock: DEPLOY_BLOCK,
  });

  // Step 1: Agent A creates challenge
  console.log('1️⃣  Agent A creates challenge...');
  const { battleId, seed: seedA } = await fighterA.createChallenge({
    stake: 0n,
    maxTurns: 4,
    baseTimeout: 1800,
  });
  console.log(`   ✅ battleId: ${battleId.slice(0, 18)}...`);

  // Step 2: Agent B accepts (independently, doesn't know seedA)
  console.log('2️⃣  Agent B accepts challenge...');
  const { seed: seedB } = await fighterB.acceptChallenge(battleId, 0n);
  console.log(`   ✅ Accepted`);

  // Verify: Committed phase
  let core = await fighterA.getBattleCore(battleId);
  console.log(`   Phase: ${['Open','Committed','Active','Settled','Cancelled'][core.phase]}`);

  // Step 3: Each agent reveals their OWN seed independently
  console.log('3️⃣  Agent B reveals seed (independently)...');
  await fighterB.revealSeed(battleId, seedB);
  core = await fighterA.getBattleCore(battleId);
  console.log(`   Phase after B reveal: ${['Open','Committed','Active','Settled','Cancelled'][core.phase]}`);

  console.log('4️⃣  Agent A reveals seed (independently)...');
  await fighterA.revealSeed(battleId, seedA);
  core = await fighterA.getBattleCore(battleId);
  console.log(`   Phase after A reveal: ${['Open','Committed','Active','Settled','Cancelled'][core.phase]}`);

  if (core.phase !== BattlePhase.Active) {
    console.error('❌ Battle did not activate!');
    process.exit(1);
  }
  console.log('   ✅ Battle ACTIVE — independent reveal works!');
  console.log('');

  // Step 5: Play 4 turns using template strategy
  console.log('⚔️  Playing 4 turns...');
  const fighters = [fighterA, fighterB];
  const labels = ['A', 'B'];

  for (let turn = 1; turn <= 4; turn++) {
    const idx = (turn - 1) % 2;
    const f = fighters[idx];
    await new Promise(r => setTimeout(r, 2000));

    const { message, txHash } = await f.playTurn(battleId, templateStrategy);
    console.log(`   Turn ${turn} (${labels[idx]}): "${message.slice(0, 60)}..." tx:${txHash.slice(0, 10)}`);
  }

  await new Promise(r => setTimeout(r, 2000));
  core = await fighterA.getBattleCore(battleId);
  console.log('');
  console.log(`📊 Result: ${['Open','Committed','Active','Settled','Cancelled'][core.phase]}`);
  console.log(`   Turns: ${core.currentTurn}/${core.maxTurns}`);
  const zeroAddr = '0x0000000000000000000000000000000000000000';
  if (core.winner === zeroAddr) console.log('   🤝 DRAW');
  else console.log(`   🏆 Winner: ${core.winner}`);
  console.log(`   🔗 https://clawttack.com/arena/${battleId}`);
}

main().catch((err) => {
  console.error('❌', err.message ?? err);
  process.exit(1);
});
