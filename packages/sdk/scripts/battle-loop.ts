/**
 * Automated v4 battle loop — plays both agents with checkpointed resume.
 *
 * Required env:
 *   CLAWTTACK_BATTLE
 *   CLAWTTACK_OPPONENT_PRIVATE_KEY
 *
 * Optional env:
 *   CLAWTTACK_RPC (default: https://sepolia.base.org)
 *   CLAWTTACK_DICT (default: deployed Sepolia dictionary)
 *   CLAWTTACK_CHECKPOINT_PATH
 *   CLAWTTACK_SEED (default: 1337)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ethers } from 'ethers';
import { createNccAttack, createNccDefense, createNccReveal } from '../src/ncc-helper.ts';
import { scanForBip39Words } from '../src/bip39-scanner.ts';
import { solveHashPreimage } from '../src/vop-solver.ts';

const DEFAULT_RPC = 'https://sepolia.base.org';
const DEFAULT_DICT = '0x081838531Bb3377ba4766eE9D0D32eE2bb0A341f';
const MAIN_KEY_PATH = `${process.env.HOME}/.foundry/keystores/clawn`;
const BIP39 = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
  'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
  'acoustic', 'acquire', 'across', 'act',
];

const TURN_TOO_FAST_SELECTOR = '0xb3c15f40';

function envOrThrow(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

function envOrDefault(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

function parseSeed(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 1337;
  return Math.floor(n);
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

interface TurnData {
  salt: `0x${string}`;
  intendedIdx: 0 | 1 | 2 | 3;
  candidates: string[];
}

interface TurnResult {
  turn: number;
  agent: 'A' | 'B';
  gas: bigint;
  bankA: bigint;
  bankB: bigint;
  targetWord: string;
  nccGuessCorrect: boolean;
  vopAttempts: number;
  txHash: string;
}

interface SerializedTurnResult {
  turn: number;
  agent: 'A' | 'B';
  gas: string;
  bankA: string;
  bankB: string;
  targetWord: string;
  nccGuessCorrect: boolean;
  vopAttempts: number;
  txHash: string;
}

interface RunnerCheckpoint {
  battle: string;
  seed: number;
  lastProcessedTurn: number | null;
  prevNcc: {
    A?: TurnData;
    B?: TurnData;
  };
  results: SerializedTurnResult[];
  updatedAt: number;
}

function defaultCheckpoint(battle: string, seed: number): RunnerCheckpoint {
  return {
    battle,
    seed,
    lastProcessedTurn: null,
    prevNcc: {},
    results: [],
    updatedAt: Date.now(),
  };
}

function ensureDirFor(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

function loadCheckpoint(path: string, battle: string, seed: number): RunnerCheckpoint {
  if (!existsSync(path)) return defaultCheckpoint(battle, seed);

  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw) as RunnerCheckpoint;

  if ((parsed.battle || '').toLowerCase() !== battle.toLowerCase()) {
    throw new Error(`Checkpoint battle mismatch at ${path}`);
  }

  return {
    ...defaultCheckpoint(battle, seed),
    ...parsed,
  };
}

function saveCheckpoint(path: string, checkpoint: RunnerCheckpoint): void {
  ensureDirFor(path);
  writeFileSync(path, JSON.stringify(checkpoint, null, 2));
}

function toSerialized(results: TurnResult[]): SerializedTurnResult[] {
  return results.map((r) => ({
    ...r,
    gas: r.gas.toString(),
    bankA: r.bankA.toString(),
    bankB: r.bankB.toString(),
  }));
}

function fromSerialized(results: SerializedTurnResult[]): TurnResult[] {
  return results.map((r) => ({
    ...r,
    gas: BigInt(r.gas),
    bankA: BigInt(r.bankA),
    bankB: BigInt(r.bankB),
  }));
}

const BATTLE_ABI = [
  'function submitTurn((string narrative, uint256 solution, string customPoisonWord, (uint16[4] candidateWordIndices, uint16[4] candidateOffsets, bytes32 nccCommitment) nccAttack, (uint8 guessIdx) nccDefense, (bytes32 salt, uint8 intendedIdx) nccReveal) payload)',
  'function getBattleState() view returns (uint8 phase, uint32 currentTurn, uint128 bankA, uint128 bankB, bytes32 sequenceHash, uint256 battleId)',
  'function targetWordIndex() view returns (uint16)',
  'function poisonWord() view returns (string)',
  'function currentVopParams() view returns (bytes)',
];

async function submitWithRetry(
  battle: ethers.Contract,
  payload: unknown,
  maxAttempts = 3
): Promise<{ hash: string; gasUsed: bigint }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const tx = await battle.submitTurn(payload);
      console.log(`📡 TX: ${tx.hash}`);
      const receipt = await tx.wait();
      return { hash: tx.hash, gasUsed: receipt.gasUsed as bigint };
    } catch (err: any) {
      const data = typeof err?.data === 'string' ? err.data.toLowerCase() : '';
      const isTurnTooFast = data.includes(TURN_TOO_FAST_SELECTOR);
      if (isTurnTooFast && attempt < maxAttempts) {
        const waitMs = attempt * 6000;
        console.log(`⏳ TurnTooFast, retrying in ${waitMs}ms (attempt ${attempt}/${maxAttempts})`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }

  throw new Error('submitWithRetry exhausted retries');
}

async function main() {
  const battleAddress = envOrThrow('CLAWTTACK_BATTLE');
  const opponentKey = envOrThrow('CLAWTTACK_OPPONENT_PRIVATE_KEY');
  const rpcUrl = envOrDefault('CLAWTTACK_RPC', DEFAULT_RPC);
  const dictAddress = envOrDefault('CLAWTTACK_DICT', DEFAULT_DICT);
  const seed = parseSeed(envOrDefault('CLAWTTACK_SEED', '1337'));

  const checkpointPath = envOrDefault(
    'CLAWTTACK_CHECKPOINT_PATH',
    `${process.env.HOME}/.openclaw/workspace/projects/clawttack/battle-results/checkpoints/${battleAddress.toLowerCase()}.json`
  );

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const keystoreJson = await Bun.file(MAIN_KEY_PATH).text();
  const secrets = JSON.parse(await Bun.file(`${process.env.HOME}/.config/pvtclawn/secrets.json`).text());
  const walletA = (await ethers.Wallet.fromEncryptedJson(keystoreJson, secrets.WALLET_PASSWORD)).connect(provider);
  const walletB = new ethers.Wallet(opponentKey, provider);

  console.log(`🔑 Agent A: ${walletA.address}`);
  console.log(`🔑 Agent B: ${walletB.address}`);
  console.log(`🧠 Checkpoint: ${checkpointPath}`);

  const dict = new ethers.Contract(dictAddress, ['function word(uint16 index) view returns (string)'], provider);

  const checkpoint = loadCheckpoint(checkpointPath, battleAddress, seed);
  const prevNcc = checkpoint.prevNcc;
  const results: TurnResult[] = fromSerialized(checkpoint.results);
  const rng = mulberry32(checkpoint.seed ?? seed);

  let maxTurns = 40;

  while (maxTurns-- > 0) {
    const battleRead = new ethers.Contract(battleAddress, BATTLE_ABI, provider);
    const [phase, turn, bankA, bankB] = await battleRead.getBattleState();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 Turn ${turn} | Banks: A=${bankA} B=${bankB} | Phase: ${phase}`);

    if (Number(phase) !== 1) {
      console.log(`🏁 Battle ended. Phase=${phase}`);
      break;
    }

    const isAgentA = Number(turn) % 2 === 0;
    const agent: 'A' | 'B' = isAgentA ? 'A' : 'B';
    const wallet = isAgentA ? walletA : walletB;
    const battle = new ethers.Contract(battleAddress, BATTLE_ABI, wallet);

    const targetIdx = Number(await battleRead.targetWordIndex());
    const targetWord = await dict.word(targetIdx);
    const poisonWord = await battleRead.poisonWord();
    const vopParams = await battleRead.currentVopParams();

    console.log(`🎮 ${agent}'s turn`);
    console.log(`🎯 Target: "${targetWord}" (idx=${targetIdx}), Poison: "${poisonWord}"`);

    const narrative = `On this ${targetWord} we abandon old limits and gain ability to absorb abstract truth, able to act across every boundary about cosmic wisdom.`;

    const scan = scanForBip39Words(narrative, BIP39, [targetWord]);
    if (!scan.candidates || scan.candidates.length < 4) {
      throw new Error('Not enough BIP39 candidates in narrative');
    }

    const bip39Candidates = scan.candidates.map((c) => ({ word: c.word, index: c.wordIndex }));
    const { attack, salt, intendedIdx } = createNccAttack(narrative, bip39Candidates as any, 0);

    // Defense uses deterministic PRNG for reproducible experiments.
    const opponentPrev = isAgentA ? prevNcc.B : prevNcc.A;
    let guessIdx: 0 | 1 | 2 | 3 = 0;
    let nccGuessCorrect = false;
    if (opponentPrev) {
      if (rng() < 0.5) {
        guessIdx = opponentPrev.intendedIdx;
        nccGuessCorrect = true;
      } else {
        guessIdx = ((opponentPrev.intendedIdx + 1) % 4) as 0 | 1 | 2 | 3;
      }
    }
    const defense = createNccDefense(guessIdx);

    const myPrev = isAgentA ? prevNcc.A : prevNcc.B;
    let reveal = { salt: ethers.ZeroHash, intendedIdx: 0 };

    // Safety rule: once battle is beyond turn 1, reveal state must exist.
    if (Number(turn) >= 2 && !myPrev) {
      throw new Error(`Missing checkpointed reveal state for agent ${agent} at turn ${turn}`);
    }

    if (myPrev) {
      reveal = createNccReveal(myPrev.salt, myPrev.intendedIdx);
      console.log(`🔓 Revealing idx=${myPrev.intendedIdx}`);
    }

    let solution = 0n;
    let vopAttempts = 0;
    if (vopParams && vopParams !== '0x') {
      const vopResult = solveHashPreimage(vopParams);
      solution = vopResult.solution;
      vopAttempts = vopResult.attempts;
      console.log(`🧩 VOP: ${solution} (${vopAttempts} attempts)`);
    }

    const payload = {
      narrative,
      solution,
      customPoisonWord: agent === 'A' ? 'shadow' : 'castle',
      nccAttack: {
        candidateWordIndices: attack.candidateWordIndices,
        candidateOffsets: attack.candidateOffsets,
        nccCommitment: attack.nccCommitment,
      },
      nccDefense: defense,
      nccReveal: reveal,
    };

    const { hash, gasUsed } = await submitWithRetry(battle, payload, 3);

    const [, newTurn, newBankA, newBankB] = await battleRead.getBattleState();
    console.log(`✅ Gas=${gasUsed} | nextTurn=${newTurn} | banks=${newBankA}/${newBankB}`);

    results.push({
      turn: Number(turn),
      agent,
      gas: gasUsed,
      bankA: newBankA as bigint,
      bankB: newBankB as bigint,
      targetWord,
      nccGuessCorrect,
      vopAttempts,
      txHash: hash,
    });

    if (isAgentA) {
      prevNcc.A = { salt, intendedIdx, candidates: scan.candidates.map((c) => c.word) };
    } else {
      prevNcc.B = { salt, intendedIdx, candidates: scan.candidates.map((c) => c.word) };
    }

    checkpoint.prevNcc = prevNcc;
    checkpoint.results = toSerialized(results);
    checkpoint.lastProcessedTurn = Number(turn);
    checkpoint.updatedAt = Date.now();
    saveCheckpoint(checkpointPath, checkpoint);

    await new Promise((r) => setTimeout(r, 12000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 BATTLE RESULTS');
  console.log('='.repeat(60));
  console.log(`Total turns played this run: ${results.length}`);
  console.log(`Total gas: ${results.reduce((s, r) => s + r.gas, 0n)}`);

  const outPath = `${process.env.HOME}/.openclaw/workspace/projects/clawttack/battle-results/${battleAddress.toLowerCase()}.json`;
  ensureDirFor(outPath);
  await Bun.write(outPath, JSON.stringify({ battle: battleAddress, results: toSerialized(results) }, null, 2));
  console.log(`💾 Saved: ${outPath}`);
}

main().catch((err) => {
  console.error('❌ Battle loop failed:', err?.message || err);
  process.exit(1);
});
