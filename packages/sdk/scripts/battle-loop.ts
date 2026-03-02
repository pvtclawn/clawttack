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
import { generateNarrative, defendNcc } from './llm-strategy.ts';
import { createClozeAttack, solveCloze } from '../src/cloze-helper.ts';

const DEFAULT_RPC = 'https://sepolia.base.org';
const DEFAULT_DICT = '0x1A73B5dc7e056426e20642C3866CD14Ac74E8bF3'; // v4.1 Cloze arena dict
const MAIN_KEY_PATH = `${process.env.HOME}/.foundry/keystores/clawn`;
const BIP39 = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
  'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
  'acoustic', 'acquire', 'across', 'act',
];

const TURN_TOO_FAST_SELECTOR = '0xb3c15f40';
const BATTLE_NOT_ACTIVE_SELECTOR = '0xf2592cf2';
const MIN_SUBMIT_GAS = 1_300_000n;
const ESTIMATE_PADDING_BPS = 13_500n; // 1.35x baseline

function extractErrorData(err: any): string {
  const candidates = [err?.data, err?.error?.data, err?.info?.error?.data];
  for (const c of candidates) {
    if (typeof c === 'string' && c.startsWith('0x')) return c.toLowerCase();
  }
  return '';
}

function isStatusZeroRevert(err: any): boolean {
  return Number(err?.receipt?.status ?? 1) === 0;
}

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
  lastSubmitBlock: number | null;
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
    lastSubmitBlock: null,
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
  'function startBlock() view returns (uint32)',
  'function firstMoverA() view returns (bool)',
  'function config() view returns (uint256 stake, uint32 warmupBlocks, uint256 targetAgentId, uint8 maxJokers, bool clozeEnabled)',
];

async function submitWithRetry(
  battle: ethers.Contract,
  payload: unknown,
  maxAttempts = 3
): Promise<{ hash: string; gasUsed: bigint; blockNumber: number }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const estimated = await battle.submitTurn.estimateGas(payload);
      const padded = (estimated * ESTIMATE_PADDING_BPS) / 10_000n;
      const bumpBps = 10_000n + BigInt((attempt - 1) * 2_500); // +25% each retry
      const attemptGas = (padded * bumpBps) / 10_000n;
      const gasLimit = attemptGas > MIN_SUBMIT_GAS ? attemptGas : MIN_SUBMIT_GAS;

      console.log(`⛽ submit gas estimate=${estimated} padded=${gasLimit} attempt=${attempt}/${maxAttempts}`);

      const tx = await battle.submitTurn(payload, { gasLimit });
      console.log(`📡 TX: ${tx.hash}`);
      const receipt = await tx.wait();

      if (Number(receipt.status) !== 1) {
        throw Object.assign(new Error('status=0 execution revert'), { receipt });
      }

      return { hash: tx.hash, gasUsed: receipt.gasUsed as bigint, blockNumber: Number(receipt.blockNumber) };
    } catch (err: any) {
      const data = extractErrorData(err);
      const isTurnTooFast = data.includes(TURN_TOO_FAST_SELECTOR);
      const isBattleNotActive = data.includes(BATTLE_NOT_ACTIVE_SELECTOR);
      const status0 = isStatusZeroRevert(err);

      if ((isTurnTooFast || isBattleNotActive) && attempt < maxAttempts) {
        const waitMs = isBattleNotActive ? attempt * 8000 : attempt * 6000;
        const reason = isBattleNotActive ? 'BattleNotActive(warmup/phase)' : 'TurnTooFast';
        console.log(`⏳ ${reason}, retrying in ${waitMs}ms (attempt ${attempt}/${maxAttempts})`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      if (status0 && attempt < maxAttempts) {
        const waitMs = attempt * 5000;
        console.log(`⏳ status=0 execution revert; retrying with gas bump in ${waitMs}ms (attempt ${attempt}/${maxAttempts})`);
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
  const strategyA = envOrDefault('CLAWTTACK_STRATEGY_A', 'default') as 'default' | 'aggressive' | 'defensive';
  const strategyB = envOrDefault('CLAWTTACK_STRATEGY_B', 'default') as 'default' | 'aggressive' | 'defensive';

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

  let maxTurns = parseInt(envOrDefault('CLAWTTACK_MAX_TURNS', '80'), 10);

  while (maxTurns-- > 0) {
    const battleRead = new ethers.Contract(battleAddress, BATTLE_ABI, provider);
    const [phase, turn, bankA, bankB] = await battleRead.getBattleState();
    const firstMoverA: boolean = await battleRead.firstMoverA();

    // Detect cloze-enabled battle (once per loop start)
    let clozeEnabled = false;
    try {
      const cfg = await battleRead.config();
      clozeEnabled = cfg.clozeEnabled ?? false;
    } catch { /* pre-cloze contract — ignore */ }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 Turn ${turn} | Banks: A=${bankA} B=${bankB} | Phase: ${phase}${clozeEnabled ? ' | 🧩 CLOZE' : ''}`);

    if (Number(phase) !== 1) {
      console.log(`🏁 Battle ended. Phase=${phase}`);
      break;
    }

    const startBlock = Number(await battleRead.startBlock());
    const currentBlock = await provider.getBlockNumber();
    const minTurnIntervalBlocks = 5; // v4 H9 default used for current live tests
    const requiredBlock = Number(turn) === 0 ? startBlock + minTurnIntervalBlocks : startBlock;

    if (currentBlock < requiredBlock) {
      const waitBlocks = requiredBlock - currentBlock;
      const waitMs = Math.max(4000, waitBlocks * 2200);
      console.log(`⏳ Battle not ready: block ${currentBlock}/${requiredBlock}. Waiting ~${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    if (checkpoint.lastSubmitBlock !== null && currentBlock < checkpoint.lastSubmitBlock + minTurnIntervalBlocks) {
      const waitBlocks = checkpoint.lastSubmitBlock + minTurnIntervalBlocks - currentBlock;
      const waitMs = Math.max(4000, waitBlocks * 2200);
      console.log(`⏳ Waiting for min interval: block ${currentBlock}/${checkpoint.lastSubmitBlock + minTurnIntervalBlocks}. Waiting ~${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    const isAgentA = firstMoverA ? (Number(turn) % 2 === 0) : (Number(turn) % 2 === 1);
    const agent: 'A' | 'B' = isAgentA ? 'A' : 'B';
    const wallet = isAgentA ? walletA : walletB;
    const battle = new ethers.Contract(battleAddress, BATTLE_ABI, wallet);

    const targetIdx = Number(await battleRead.targetWordIndex());
    const targetWord = await dict.word(targetIdx);
    const poisonWord = await battleRead.poisonWord();
    const vopParams = await battleRead.currentVopParams();

    console.log(`🎮 ${agent}'s turn`);
    console.log(`🎯 Target: "${targetWord}" (idx=${targetIdx}), Poison: "${poisonWord}"`);

    const strategy = isAgentA ? strategyA : strategyB;
    console.log(`📋 Strategy: ${strategy}`);

    // Narrative varies by strategy
    let narrative: string;
    // Track opponent's last narrative for LLM context
    const opponentLastNarrative = checkpoint.opponentLastNarrative ?? null;

    if (strategy === 'llm') {
      // REAL LLM: Generate narrative via Gemini
      const agentName = isAgentA ? 'PrivateClawn' : 'PrivateClawnJr';
      // Pre-generate BIP39 candidates for the LLM to include
      const baseCandidates = BIP39.filter(w => w !== targetWord && w !== poisonWord).slice(0, 4);
      narrative = await generateNarrative({
        targetWord,
        poisonWord,
        opponentNarrative: opponentLastNarrative,
        candidates: baseCandidates.map((w, i) => ({ word: w, index: i })),
        turnNumber: Number(turn),
        agentName,
        isFirstTurn: Number(turn) === 0,
      });
      console.log(`  🤖 LLM narrative: "${narrative.slice(0, 80)}..."`);
    } else if (strategy === 'aggressive') {
      // Longer narrative with more BIP39 words — higher NCC attack surface (must stay ≤256 bytes)
      narrative = `On this ${targetWord} we abandon old limits and gain ability to absorb abstract truth, able to act across every boundary about cosmic wisdom. The erosion reveals hidden abandon paths toward ability and abstract gains.`;
    } else if (strategy === 'defensive') {
      // Minimal narrative — fewer BIP39 candidates, less attack surface
      narrative = `On this ${targetWord} we abandon old limits and gain ability to absorb abstract truth, able to act about cosmic wisdom.`;
    } else {
      narrative = `On this ${targetWord} we abandon old limits and gain ability to absorb abstract truth, able to act across every boundary about cosmic wisdom.`;
    }

    const scan = scanForBip39Words(narrative, BIP39, [targetWord]);
    // If not enough candidates, pad with known BIP39 words
    if (!scan.candidates || scan.candidates.length < 4) {
      const missing = 4 - (scan.candidates?.length ?? 0);
      const padding = BIP39.filter(w => 
        w !== targetWord && 
        (!poisonWord || w !== poisonWord) && 
        !narrative.toLowerCase().includes(w)
      ).slice(0, missing);
      narrative += ' ' + padding.join(' ');
      // Re-scan after padding
      const rescan = scanForBip39Words(narrative, BIP39, [targetWord]);
      if (!rescan.candidates || rescan.candidates.length < 4) {
        // Last resort: use template fallback
        narrative = `On this ${targetWord} we abandon old limits and gain ability to absorb abstract truth, able to act across every boundary about cosmic wisdom.`;
        const fallbackScan = scanForBip39Words(narrative, BIP39, [targetWord]);
        scan.candidates = fallbackScan.candidates;
      } else {
        scan.candidates = rescan.candidates;
      }
    }

    const bip39Candidates = scan.candidates.map((c) => ({ word: c.word, index: c.wordIndex }));
    const nccIntendedIdx = (Math.floor(rng() * 4)) as 0 | 1 | 2 | 3;
    const { attack, salt, intendedIdx } = createNccAttack(narrative, bip39Candidates as any, nccIntendedIdx);

    // ── CLOZE: blank the NCC answer word in narrative ──
    let finalNarrative = narrative;
    if (clozeEnabled) {
      const answerWord = scan.candidates[nccIntendedIdx]?.word;
      if (answerWord && narrative.toLowerCase().includes(answerWord.toLowerCase())) {
        try {
          const cloze = createClozeAttack(
            narrative,
            answerWord,
            scan.candidates.map(c => c.word),
          );
          finalNarrative = cloze.narrative;
          console.log(`  🧩 Cloze: blanked "${answerWord}" → [BLANK] at offset ${cloze.blankOffset}`);
        } catch (e: any) {
          console.log(`  ⚠️ Cloze attack failed (${e.message}), using original narrative`);
        }
      } else {
        console.log(`  ⚠️ Cloze: answer word "${answerWord}" not in narrative, skipping blank`);
      }
    }

    // Defense uses deterministic PRNG for reproducible experiments.
    const opponentPrev = isAgentA ? prevNcc.B : prevNcc.A;
    // Defense strategy varies
    let guessIdx: 0 | 1 | 2 | 3 = 0;
    let nccGuessCorrect = false;
    if (opponentPrev) {
      if (clozeEnabled && opponentLastNarrative?.includes('[BLANK]') && strategy === 'llm') {
        // CLOZE DEFENSE: use LLM to fill [BLANK]
        const oppCandidates = opponentPrev.candidates ?? [];
        if (oppCandidates.length >= 4) {
          const clozeResult = await solveCloze(
            opponentLastNarrative,
            oppCandidates.slice(0, 4),
            async (prompt: string) => {
              const { callLLM: llm } = await import('./llm-strategy.ts');
              return llm(prompt, 10);
            },
          );
          guessIdx = clozeResult.guessIdx as 0 | 1 | 2 | 3;
          nccGuessCorrect = guessIdx === opponentPrev.intendedIdx;
          console.log(`  🧩 Cloze defense: picked ${guessIdx} (${oppCandidates[guessIdx]}), confidence=${clozeResult.confidence}, correct=${nccGuessCorrect}`);
        }
      } else if (strategy === 'llm') {
        // REAL LLM: Read opponent's narrative and comprehend to pick NCC answer
        if (opponentLastNarrative) {
          const oppCandidates = (opponentPrev.candidates ?? []).map((w: string, i: number) => ({ word: w, index: i }));
          if (oppCandidates.length >= 4) {
            guessIdx = await defendNcc(opponentLastNarrative, oppCandidates);
            nccGuessCorrect = guessIdx === opponentPrev.intendedIdx;
            console.log(`  🧠 LLM defense: picked ${guessIdx} (${oppCandidates[guessIdx]?.word}), correct=${nccGuessCorrect}`);
          }
        }
      } else if (strategy === 'blind-script') {
        // TRUE SCRIPT: random guess from {0,1,2,3} — NO access to opponent's intendedIdx
        // This simulates a real separate-process script that cannot read NCC commitment
        guessIdx = (Math.floor(rng() * 4)) as 0 | 1 | 2 | 3;
        nccGuessCorrect = guessIdx === opponentPrev.intendedIdx;
        console.log(`  🎲 Blind guess: ${guessIdx} (correct=${nccGuessCorrect})`);
      } else if (strategy === 'aggressive') {
        // Always try to guess correctly (75% chance)
        if (rng() < 0.75) {
          guessIdx = opponentPrev.intendedIdx;
          nccGuessCorrect = true;
        } else {
          guessIdx = ((opponentPrev.intendedIdx + 1) % 4) as 0 | 1 | 2 | 3;
        }
      } else if (strategy === 'defensive') {
        // Always guess 0 — baseline scripted behavior
        guessIdx = 0;
        nccGuessCorrect = opponentPrev.intendedIdx === 0;
      } else {
        // Default: 50% correct
        if (rng() < 0.5) {
          guessIdx = opponentPrev.intendedIdx;
          nccGuessCorrect = true;
        } else {
          guessIdx = ((opponentPrev.intendedIdx + 1) % 4) as 0 | 1 | 2 | 3;
        }
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
      narrative: finalNarrative,
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

    const { hash, gasUsed, blockNumber } = await submitWithRetry(battle, payload, 3);

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
    checkpoint.opponentLastNarrative = narrative; // Save for opponent's LLM context
    checkpoint.results = toSerialized(results);
    checkpoint.lastProcessedTurn = Number(turn);
    checkpoint.lastSubmitBlock = blockNumber;
    checkpoint.updatedAt = Date.now();
    saveCheckpoint(checkpointPath, checkpoint);

    // No sleep needed — contract enforces turn order, tx.wait() handles confirmation
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
