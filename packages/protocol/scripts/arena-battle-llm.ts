#!/usr/bin/env bun
/**
 * arena-battle-llm.ts — Run a real Arena battle with LLM-powered strategies
 *
 * Two agents fight using AI-generated messages. Each agent reads the opponent's
 * previous messages and crafts responses that naturally embed their challenge word
 * while trying to manipulate the opponent.
 *
 * Usage:
 *   PRIVATE_KEY_A=0x... PRIVATE_KEY_B=0x... \
 *   LLM_API_KEY=... \
 *   bun run scripts/arena-battle-llm.ts
 *
 * Optional env:
 *   LLM_ENDPOINT  — OpenAI-compatible endpoint (default: OpenRouter)
 *   MODEL_A       — Model for Agent A (default: google/gemini-2.0-flash-001)
 *   MODEL_B       — Model for Agent B (default: google/gemini-2.0-flash-001)
 */

import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { ArenaFighter, BattlePhase } from '../src/arena-fighter';
import { createLLMStrategy, templateStrategy } from '../src/strategies';
import { createWakuBroadcaster } from '../src/waku-broadcaster';

const ARENA_ADDRESS = '0xC20f694dEDa74fa2f4bCBB9f77413238862ba9f7' as const;
const RPC_URL = 'https://sepolia.base.org';

async function main() {
  const keyA = process.env.PRIVATE_KEY_A;
  const keyB = process.env.PRIVATE_KEY_B;
  const llmKey = process.env.LLM_API_KEY;

  if (!keyA || !keyB) {
    console.error('❌ Set PRIVATE_KEY_A and PRIVATE_KEY_B env vars');
    process.exit(1);
  }

  const endpoint = process.env.LLM_ENDPOINT || 'https://openrouter.ai/api/v1/chat/completions';
  const modelA = process.env.MODEL_A || 'google/gemini-2.0-flash-001';
  const modelB = process.env.MODEL_B || 'google/gemini-2.0-flash-001';

  const transport = http(RPC_URL);
  const publicClient = createPublicClient({ chain: baseSepolia, transport });

  const accountA = privateKeyToAccount(keyA as `0x${string}`);
  const accountB = privateKeyToAccount(keyB as `0x${string}`);

  const walletA = createWalletClient({ account: accountA, chain: baseSepolia, transport });
  const walletB = createWalletClient({ account: accountB, chain: baseSepolia, transport });

  console.log(`🏟️  Arena LLM Battle`);
  console.log(`   Agent A: ${accountA.address} (${modelA})`);
  console.log(`   Agent B: ${accountB.address} (${modelB})`);
  console.log(`   Arena:   ${ARENA_ADDRESS}`);
  // Optional: Waku broadcaster for live spectating
  const nwakuRestUrl = process.env.NWAKU_REST_URL;
  const onTurnBroadcast = nwakuRestUrl
    ? createWakuBroadcaster({ nwakuRestUrl })
    : undefined;

  if (onTurnBroadcast) {
    console.log(`   Waku:    ${nwakuRestUrl} (live spectating enabled)`);
  }
  console.log();

  const fighterA = new ArenaFighter({
    walletClient: walletA,
    publicClient,
    contractAddress: ARENA_ADDRESS,
    deployBlock: 37_880_000n,
    onTurnBroadcast,
  });

  const fighterB = new ArenaFighter({
    walletClient: walletB,
    publicClient,
    contractAddress: ARENA_ADDRESS,
    deployBlock: 37_880_000n,
    onTurnBroadcast,
  });

  // Create strategies — LLM if key available, template fallback
  const strategyA = llmKey
    ? createLLMStrategy({
        endpoint,
        apiKey: llmKey,
        model: modelA,
        persona: 'You are PrivateClawn, a cunning AI agent who fights with sharp wit and strategic misdirection. You prefer subtle wordplay over brute force.',
      })
    : templateStrategy;

  const strategyB = llmKey
    ? createLLMStrategy({
        endpoint,
        apiKey: llmKey,
        model: modelB,
        persona: 'You are ClawnJr, a bold and aggressive AI challenger. You like to pressure opponents with rapid topic shifts and psychological tactics.',
      })
    : templateStrategy;

  if (!llmKey) {
    console.log('⚠️  No LLM_API_KEY — using template strategy (boring mode)');
    console.log();
  }

  // Fund Agent B if needed (temp wallet support)
  const balB = await publicClient.getBalance({ address: accountB.address });
  if (balB < parseEther('0.001')) {
    console.log(`💰 Funding Agent B (${formatEther(balB)} ETH → sending 0.003 ETH)...`);
    const fundTx = await walletA.sendTransaction({ to: accountB.address, value: parseEther('0.003') });
    await publicClient.waitForTransactionReceipt({ hash: fundTx });
    console.log(`   ✅ Funded`);
    console.log();
  }

  // Step 1: Create challenge
  const stake = 0n; // 0-stake for verification battles
  const maxTurns = 6;
  console.log(`1️⃣  Agent A creates challenge (stake: ${formatEther(stake)} ETH, ${maxTurns} turns)...`);
  const { battleId, seed: seedA } = await fighterA.createChallenge({
    stake,
    maxTurns,
    baseTimeout: 3600,
  });
  console.log(`   ✅ battleId: ${battleId.slice(0, 18)}...`);
  console.log();

  // Step 2: Accept challenge
  console.log(`2️⃣  Agent B accepts challenge...`);
  const { seed: seedB } = await fighterB.acceptChallenge(battleId, stake);
  console.log(`   ✅ Accepted`);
  console.log();

  // Step 3: Reveal seeds
  console.log(`3️⃣  Revealing seeds...`);
  await fighterA.revealSeeds(battleId, seedA, seedB);
  await new Promise((r) => setTimeout(r, 2000));
  console.log(`   ✅ Seeds revealed`);
  console.log();

  // Step 4: Play turns using strategies
  const fighters = [fighterA, fighterB] as const;
  const strategies = [strategyA, strategyB] as const;
  const labels = ['Agent A (pvtclawn)', 'Agent B (ClawnJr)'] as const;

  for (let turn = 1; turn <= maxTurns; turn++) {
    const idx = (turn - 1) % 2;
    const fighter = fighters[idx];
    const strategy = strategies[idx];
    const label = labels[idx];

    console.log(`── Turn ${turn} (${label}) ──`);

    try {
      const { message, txHash } = await fighter.playTurn(battleId, strategy);
      console.log(`   💬 "${message}"`);
      console.log(`   ✅ tx: ${txHash.slice(0, 14)}...`);
    } catch (err: any) {
      console.log(`   ⚠️  ${err.message?.slice(0, 120)}`);
      break;
    }
    // Wait for state propagation before next turn
    await new Promise((r) => setTimeout(r, 3000));
    console.log();
  }

  // Check final state
  await new Promise((r) => setTimeout(r, 2000));
  const core = await fighterA.getBattleCore(battleId);
  const phases = ['Open', 'Committed', 'Active', 'Settled', 'Cancelled'];

  console.log(`📊 Final state:`);
  console.log(`   Phase: ${phases[core.phase]}`);
  console.log(`   Turn: ${core.currentTurn}/${core.maxTurns}`);
  if (core.winner === '0x0000000000000000000000000000000000000000') {
    console.log(`   Result: DRAW 🤝`);
  } else if (core.winner.toLowerCase() === accountA.address.toLowerCase()) {
    console.log(`   Winner: Agent A (pvtclawn) 🏆`);
  } else {
    console.log(`   Winner: Agent B (ClawnJr) 🏆`);
  }
  console.log();
  console.log(`🔗 https://clawttack.com/arena/${battleId}`);
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
