#!/usr/bin/env bun
/**
 * Standalone Clawttack v4 fighter — run as an independent agent process.
 * 
 * Usage:
 *   BATTLE=0x... PRIVATE_KEY=0x... AGENT_NAME=PrivateClawnJr bun run fight.ts
 * 
 * Environment:
 *   BATTLE          - Battle contract address (required)
 *   PRIVATE_KEY     - Wallet private key (required, or KEYSTORE+WALLET_PASSWORD)
 *   KEYSTORE        - Path to Foundry keystore file (alternative to PRIVATE_KEY)
 *   WALLET_PASSWORD - Keystore password
 *   AGENT_NAME      - Display name for logs (default: "Agent")
 *   AGENT_ID        - On-chain agent ID (default: 1)
 *   WORD_DICT       - Word dictionary contract address
 *   RPC_URL         - RPC endpoint (default: https://sepolia.base.org)
 *   GEMINI_API_KEY  - For LLM-powered narrative generation
 */

import { ethers } from 'ethers';
import { V4Fighter, type V4Strategy } from '../src/v4-fighter.ts';
import { generateNarrative, defendNcc } from './llm-strategy.ts';
import { loadWordList } from '../src/bip39-scanner.ts';

const BATTLE = process.env.BATTLE;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const KEYSTORE = process.env.KEYSTORE;
const WALLET_PASSWORD = process.env.WALLET_PASSWORD;
const AGENT_NAME = process.env.AGENT_NAME ?? 'Agent';
const AGENT_ID = BigInt(process.env.AGENT_ID ?? '1');
const WORD_DICT = process.env.WORD_DICT ?? '0x081838531bb3377ba4766ee9d0d32ee2bb0a341f';
const RPC_URL = process.env.RPC_URL ?? 'https://sepolia.base.org';

if (!BATTLE) {
  console.error('❌ BATTLE address required');
  process.exit(1);
}
if (!PRIVATE_KEY && !KEYSTORE) {
  console.error('❌ PRIVATE_KEY or KEYSTORE required');
  process.exit(1);
}

// Setup provider + wallet
const provider = new ethers.JsonRpcProvider(RPC_URL);
let wallet: ethers.Wallet;

if (PRIVATE_KEY) {
  wallet = new ethers.Wallet(PRIVATE_KEY, provider);
} else if (KEYSTORE && WALLET_PASSWORD) {
  const ks = await Bun.file(KEYSTORE).text();
  wallet = (await ethers.Wallet.fromEncryptedJson(ks, WALLET_PASSWORD)).connect(provider);
} else {
  console.error('❌ KEYSTORE requires WALLET_PASSWORD');
  process.exit(1);
}

console.log(`\n🎮 ${AGENT_NAME} entering battle at ${BATTLE}`);
console.log(`   Wallet: ${wallet.address}`);
console.log(`   RPC: ${RPC_URL}\n`);

// Use local BIP39 word list (avoid hammering RPC for 2048 word() calls)
const { BIP39_TEST_WORDS } = await import('../src/bip39-scanner.ts');

// Load a bigger BIP39 list from file if available, otherwise use test words
let wordList: string[];
try {
  const bip39Path = new URL('../data/bip39-english.txt', import.meta.url).pathname;
  wordList = (await Bun.file(bip39Path).text()).trim().split('\n');
  console.log(`📖 Loaded ${wordList.length} BIP39 words from file`);
} catch {
  wordList = BIP39_TEST_WORDS;
  console.log(`📖 Using ${wordList.length} test BIP39 words`);
}
const BIP39 = wordList.slice(0, 20); // first 20 for candidate selection

// LLM-powered strategy
const strategy: V4Strategy = async (ctx) => {
  // Pick 4 BIP39 candidates that aren't the target/poison
  const candidates = BIP39
    .filter(w => w !== ctx.targetWord && w !== ctx.poisonWord)
    .slice(0, 4)
    .map((w, i) => ({ word: w, index: i }));

  // Generate narrative via LLM
  const narrative = await generateNarrative({
    targetWord: ctx.targetWord,
    poisonWord: ctx.poisonWord,
    opponentNarrative: ctx.opponentNarrative || null,
    candidates,
    turnNumber: ctx.turnNumber,
    agentName: AGENT_NAME,
    isFirstTurn: ctx.turnNumber === 0,
  });

  console.log(`  📝 ${AGENT_NAME}: "${narrative.slice(0, 80)}..."`);

  // Defend NCC via LLM
  let nccGuessIdx = 0;
  if (ctx.opponentNarrative && ctx.opponentNccAttack) {
    const oppCandidates = [0, 1, 2, 3].map(i => ({
      word: BIP39[ctx.opponentNccAttack!.candidateWordIndices?.[i] ?? i] ?? `word_${i}`,
      index: i,
    }));
    nccGuessIdx = await defendNcc(ctx.opponentNarrative, oppCandidates);
    console.log(`  🧠 NCC defense: picked ${nccGuessIdx}`);
  }

  return {
    narrative,
    poisonWord: ctx.turnNumber === 0 ? 'shadow' : ctx.poisonWord || 'shadow',
    nccGuessIdx,
  };
};

// Create fighter and go!
const stateDir = `${process.env.HOME}/.openclaw/workspace/projects/clawttack/battle-results/fighter-state`;
const { mkdirSync } = await import('node:fs');
try { mkdirSync(stateDir, { recursive: true }); } catch {}

const fighter = new V4Fighter({
  provider,
  wallet,
  battleAddress: BATTLE,
  agentId: AGENT_ID,
  strategy,
  preloadedWordList: wordList,
  statePath: `${stateDir}/${BATTLE}-${wallet.address.slice(0, 10)}.json`,
  pollIntervalMs: 2000,
  verbose: true,
});

const result = await fighter.fight();

console.log('\n' + '='.repeat(50));
console.log(`🏁 ${AGENT_NAME} — Battle Over!`);
console.log(`   Won: ${result.won}`);
console.log(`   Reason: ${result.reason}`);
console.log(`   Turns: ${result.totalTurns}`);
console.log(`   Gas: ${result.gasUsed}`);
console.log('='.repeat(50));
