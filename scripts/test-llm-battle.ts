#!/usr/bin/env bun
/**
 * scripts/test-llm-battle.ts — Run a Clawttack battle with LLM-generated narratives
 * 
 * Uses Gemini Flash for creative narrative generation instead of templates.
 * Falls back to templates if LLM fails.
 *
 * Usage:
 *   WALLET_PASSWORD=xxx bun scripts/test-llm-battle.ts
 *   WALLET_PASSWORD=xxx BATTLE_MAX_TURNS=14 bun scripts/test-llm-battle.ts
 *
 * Env:
 *   WALLET_PASSWORD  - Foundry keystore password (required)
 *   BATTLE_MAX_TURNS - Number of turns (default: 12)
 *   BATTLE_STAKE     - Stake in wei (default: 0)
 *   LLM_MODEL        - Model name (default: gemini-2.0-flash)
 */

import { createPublicClient, createWalletClient, http, type Hex, type Address } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { ArenaClient, BattleClient } from '../packages/protocol/src/index';
import { CLAWTTACK_BATTLE_ABI } from '../packages/protocol/src/abi';
import {
  createLLMNarrativeGenerator,
  validateNarrative,
  generateTemplateNarrative,
  type NarrativeContext,
} from '../packages/protocol/src/llm-narrative';

// --- Config ---

const ARENA_ADDRESS = '0x6045d9b8Ab1583AD4cEb600c0E8d515E9922d2eB' as Address;
const WORD_DICTIONARY = '0xa5bAC96F55e46563D0B0b57694E7Ac7Bc7DA25eC' as Address;
const RPC_URL = 'https://sepolia.base.org';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

const WORD_DICTIONARY_ABI = [
  { name: 'word', type: 'function', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint16' }], outputs: [{ name: '', type: 'string' }] },
  { name: 'wordCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint16' }] },
] as const;

// --- Helpers ---

async function loadKeystoreKey(name: string, password: string): Promise<Hex> {
  const proc = Bun.spawn([
    `${process.env.HOME}/.foundry/bin/cast`, 'wallet', 'decrypt-keystore', name,
    '--unsafe-password', password
  ], { stdout: 'pipe', stderr: 'pipe' });
  const stdout = await new Response(proc.stdout).text();
  await proc.exited;
  const match = stdout.match(/0x[0-9a-fA-F]{64}/);
  if (!match) throw new Error(`No private key found for ${name}`);
  return match[0] as Hex;
}

async function loadGeminiKey(): Promise<string> {
  const secretsPath = `${process.env.HOME}/.config/pvtclawn/secrets.json`;
  const file = Bun.file(secretsPath);
  const secrets = await file.json();
  if (!secrets.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not found in secrets');
  return secrets.GEMINI_API_KEY;
}

// --- Main ---

async function main() {
  const password = process.env.WALLET_PASSWORD;
  if (!password) throw new Error('Set WALLET_PASSWORD env var');

  const geminiKey = await loadGeminiKey();
  const llmModel = process.env.LLM_MODEL ?? 'gemini-2.0-flash';

  console.log('🧠 LLM Battle Mode');
  console.log(`   Model: ${llmModel}`);
  console.log(`   Endpoint: Gemini OpenAI-compatible`);

  // Create two LLM generators with different personas
  const clawnLLM = createLLMNarrativeGenerator({
    endpoint: GEMINI_ENDPOINT,
    apiKey: geminiKey,
    model: llmModel,
    persona: 'You are a battle-hardened warrior-poet who weaves words like weapons. Your narratives are sharp, evocative, and always carry a hidden edge.',
    temperature: 0.9,
    maxRetries: 2,
  });

  const clawnjrLLM = createLLMNarrativeGenerator({
    endpoint: GEMINI_ENDPOINT,
    apiKey: geminiKey,
    model: llmModel,
    persona: 'You are a mischievous trickster who delights in wordplay and deception. Your narratives are playful, surprising, and full of clever twists.',
    temperature: 1.0,
    maxRetries: 2,
  });

  // Load wallets
  console.log('\n🔑 Loading keystores...');
  const clawnKey = await loadKeystoreKey('clawn', password);
  const clawnjrKey = await loadKeystoreKey('clawnjr', password);
  const clawnAccount = privateKeyToAccount(clawnKey);
  const clawnjrAccount = privateKeyToAccount(clawnjrKey);
  console.log(`  Clawn:   ${clawnAccount.address}`);
  console.log(`  ClawnJr: ${clawnjrAccount.address}`);

  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
  const clawnWallet = createWalletClient({ account: clawnAccount, chain: baseSepolia, transport: http(RPC_URL) });
  const clawnjrWallet = createWalletClient({ account: clawnjrAccount, chain: baseSepolia, transport: http(RPC_URL) });

  // Register agents (reuse existing)
  const arena = new ArenaClient({ publicClient, walletClient: clawnWallet, contractAddress: ARENA_ADDRESS });
  const arenaJr = new ArenaClient({ publicClient, walletClient: clawnjrWallet, contractAddress: ARENA_ADDRESS });

  console.log('\n📝 Finding agents...');
  let clawnId!: bigint, clawnjrId!: bigint;
  const stats = await arena.getGlobalStats();
  const agentCount = Number(stats.agentsCount);

  for (let i = 1; i <= Math.min(agentCount, 30); i++) {
    try {
      const profile = await publicClient.readContract({
        address: ARENA_ADDRESS,
        abi: [{ type: 'function', name: 'agents', inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ name: 'owner', type: 'address' }, { name: 'eloRating', type: 'uint32' }, { name: 'totalWins', type: 'uint32' }, { name: 'totalLosses', type: 'uint32' }], stateMutability: 'view' }],
        functionName: 'agents',
        args: [BigInt(i)],
      }) as [string, number, number, number];
      if (profile[0].toLowerCase() === clawnAccount.address.toLowerCase()) {
        clawnId = BigInt(i);
        console.log(`  ♻️ Clawn: agentId=${clawnId} (elo=${profile[1]})`);
      }
      if (profile[0].toLowerCase() === clawnjrAccount.address.toLowerCase()) {
        clawnjrId = BigInt(i);
        console.log(`  ♻️ ClawnJr: agentId=${clawnjrId} (elo=${profile[1]})`);
      }
      if (clawnId && clawnjrId) break;
    } catch {}
  }
  if (!clawnId) { clawnId = await arena.registerAgent(); console.log(`  ✅ Clawn registered: ${clawnId}`); }
  if (!clawnjrId) { clawnjrId = await arenaJr.registerAgent(); console.log(`  ✅ ClawnJr registered: ${clawnjrId}`); }

  // Create battle
  const STAKE = process.env.BATTLE_STAKE ? BigInt(process.env.BATTLE_STAKE) : 0n;
  const MAX_TURNS = Number(process.env.BATTLE_MAX_TURNS ?? '12');

  console.log(`\n⚔️ Creating LLM battle (${MAX_TURNS} turns)...`);
  const { battleId, battleAddress, txHash } = await arena.createBattle(clawnId, {
    stake: STAKE,
    maxTurns: MAX_TURNS,
    maxJokers: 1,
    baseTimeoutBlocks: 150,
    warmupBlocks: 15,
    targetAgentId: 0n,
  });
  console.log(`  ✅ Battle: ${battleAddress}`);
  console.log(`  📜 tx: ${txHash}`);

  // Accept
  console.log('\n🤝 ClawnJr accepting...');
  const battleJr = new BattleClient({ publicClient, walletClient: clawnjrWallet, battleAddress });
  const acceptTx = await battleJr.acceptBattle(clawnjrId, STAKE);
  await publicClient.waitForTransactionReceipt({ hash: acceptTx });

  // Wait warmup
  console.log('  ⏳ Warmup...');
  await new Promise(r => setTimeout(r, 35_000));

  const battle = arena.attach(battleAddress);
  const initState = await battle.getState();
  if (initState.phase !== 1) {
    console.log(`  ⏳ Not active yet, waiting more...`);
    await new Promise(r => setTimeout(r, 10_000));
    const retry = await battle.getState();
    if (retry.phase !== 1) { console.log('❌ Battle not active'); process.exit(1); }
  }

  const firstMover = await battle.whoseTurn();
  const isClawnFirst = firstMover.toLowerCase() === clawnAccount.address.toLowerCase();
  console.log(`\n🎮 First mover: ${isClawnFirst ? 'Clawn' : 'ClawnJr'}`);

  const players = isClawnFirst
    ? [
        { name: 'Clawn', client: battle, wallet: clawnWallet, llm: clawnLLM },
        { name: 'ClawnJr', client: battleJr, wallet: clawnjrWallet, llm: clawnjrLLM }
      ]
    : [
        { name: 'ClawnJr', client: battleJr, wallet: clawnjrWallet, llm: clawnjrLLM },
        { name: 'Clawn', client: battle, wallet: clawnWallet, llm: clawnLLM }
      ];

  // Track narratives for stats
  const battleLog: { turn: number; player: string; narrative: string; source: string; gas: number; targetWord: string; poisonWord: string }[] = [];
  let llmCount = 0;
  let templateCount = 0;

  // Play turns
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const player = players[turn % 2];
    const latestBlock = await publicClient.getBlockNumber();

    const [targetWordIdx, poisonWordIdx] = await Promise.all([
      publicClient.readContract({
        address: battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'targetWordIndex',
        blockNumber: latestBlock,
      }) as Promise<number>,
      publicClient.readContract({
        address: battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'poisonWordIndex',
        blockNumber: latestBlock,
      }) as Promise<number>,
    ]);

    const [targetWord, poisonWord] = await Promise.all([
      publicClient.readContract({ address: WORD_DICTIONARY, abi: WORD_DICTIONARY_ABI, functionName: 'word', args: [targetWordIdx] }),
      turn > 0 ? publicClient.readContract({ address: WORD_DICTIONARY, abi: WORD_DICTIONARY_ABI, functionName: 'word', args: [poisonWordIdx] }) : Promise.resolve(''),
    ]);

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`⚔️ Turn ${turn}: ${player.name}`);
    console.log(`   🎯 Target: "${targetWord}" | 💀 Poison: "${poisonWord || 'none'}"`);

    // Generate narrative via LLM
    const ctx: NarrativeContext = {
      targetWord: targetWord as string,
      poisonWord: (poisonWord || '') as string,
      turnNumber: turn,
      maxTurns: MAX_TURNS,
    };

    const { narrative, source, attempts } = await player.llm(ctx);
    if (source === 'llm') llmCount++;
    else templateCount++;

    console.log(`   📝 Source: ${source === 'llm' ? '🧠 LLM' : '📋 Template'} (${attempts} attempt${attempts > 1 ? 's' : ''})`);
    console.log(`   📖 "${narrative.substring(0, 100)}${narrative.length > 100 ? '...' : ''}"`);
    console.log(`   📏 ${narrative.length} chars`);

    // Final validation
    const check = validateNarrative(narrative, targetWord as string, (poisonWord || '') as string, turn === 0);
    if (!check.valid) {
      console.log(`   ❌ VALIDATION FAILED: ${check.errors.join(', ')}`);
      console.log(`   Full: "${narrative}"`);
      break;
    }

    // VOP params (trivial hash preimage)
    const nextVopParams = ('0x' + '00'.repeat(64)) as Hex;
    let nextPoisonIndex = ((turn + 7) * 137 + 42) % 2048;
    if (nextPoisonIndex === targetWordIdx) nextPoisonIndex = (nextPoisonIndex + 1) % 2048;

    try {
      let turnTx: Hex | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          turnTx = await player.client.submitTurn({
            solution: 0n,
            narrative,
            nextVopParams,
            poisonWordIndex: nextPoisonIndex,
          });
          break;
        } catch (retryErr: any) {
          if (attempt < 2 && retryErr.message?.includes('nonce')) {
            console.log(`  ⚠️ Nonce error, retrying (${attempt + 1}/3)...`);
            await new Promise(r => setTimeout(r, 3000));
            continue;
          }
          throw retryErr;
        }
      }
      if (!turnTx) throw new Error('Failed after 3 retries');

      const receipt = await publicClient.waitForTransactionReceipt({ hash: turnTx });
      const gasUsed = Number(receipt.gasUsed);
      console.log(`   ✅ Submitted (gas: ${gasUsed.toLocaleString()}, block: ${receipt.blockNumber})`);

      battleLog.push({
        turn,
        player: player.name,
        narrative,
        source,
        gas: gasUsed,
        targetWord: targetWord as string,
        poisonWord: (poisonWord || '') as string,
      });

      await new Promise(r => setTimeout(r, 4000));

      const newState = await battle.getState();
      if (newState.phase !== 1) {
        const phaseNames = ['Open', 'Active', 'Settled', 'Cancelled'];
        console.log(`\n🏁 Battle ended! Phase: ${phaseNames[newState.phase] || newState.phase}`);
        break;
      }
    } catch (e: any) {
      console.log(`   ❌ Turn failed: ${e.message?.substring(0, 300)}`);
      break;
    }
  }

  // Final summary
  const finalState = await battle.getState();
  const phaseNames = ['Open', 'Active', 'Settled', 'Cancelled'];

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 BATTLE SUMMARY`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Phase: ${phaseNames[finalState.phase] || finalState.phase}`);
  console.log(`  Turns: ${finalState.currentTurn}`);
  console.log(`  LLM narratives: ${llmCount}/${battleLog.length}`);
  console.log(`  Template fallbacks: ${templateCount}/${battleLog.length}`);
  console.log(`  Avg gas: ${battleLog.length > 0 ? Math.round(battleLog.reduce((s, l) => s + l.gas, 0) / battleLog.length).toLocaleString() : 'n/a'}`);
  console.log(`  Battle: ${battleAddress}`);
  console.log(`  Arena: ${ARENA_ADDRESS}`);

  if (battleLog.length > 0) {
    console.log(`\n📖 NARRATIVE LOG:`);
    for (const entry of battleLog) {
      console.log(`  Turn ${entry.turn} (${entry.player}, ${entry.source === 'llm' ? '🧠' : '📋'}):`);
      console.log(`    🎯 "${entry.targetWord}" | 💀 "${entry.poisonWord || 'none'}"`);
      console.log(`    "${entry.narrative}"`);
      console.log(`    Gas: ${entry.gas.toLocaleString()}`);
    }
  }
}

main().catch(e => {
  console.error('💀 Fatal:', e.message);
  process.exit(1);
});
