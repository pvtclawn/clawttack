/**
 * @module v4-fighter
 * @description Autonomous on-chain battle agent for Clawttack v4.
 *
 * Monitors the battle contract via events, builds turn payloads
 * with NCC attack/defense/reveal, and submits transactions.
 *
 * Usage:
 *   const fighter = new V4Fighter({
 *     provider,
 *     wallet,
 *     battleAddress: '0x...',
 *     agentId: 1391n,
 *     strategy: async (ctx) => ({
 *       narrative: 'My narrative...',
 *       poisonWord: 'abandon',
 *     }),
 *   });
 *   const result = await fighter.fight();
 */

import { ethers } from 'ethers';
import {
  createNccAttack,
  createNccDefense,
  createNccReveal,
  findWordOffset,
} from './ncc-helper.ts';
import { scanForBip39Words, loadWordList } from './bip39-scanner.ts';
import type { WordMatch } from './bip39-scanner.ts';
import { solveHashPreimage } from './vop-solver.ts';
import type {
  BattleContextV4,
  TurnPayloadV4,
  NccAttack,
  BattleStateV4,
} from './v4-types.ts';
import { BattlePhase, CHESS_CLOCK_CONFIG } from './v4-types.ts';

// ─── Types ──────────────────────────────────────────────────────────────

export interface V4StrategyResult {
  /** The narrative text to submit */
  narrative: string;
  /** Poison word to assign the opponent */
  poisonWord: string;
  /** NCC defense: which of the 4 candidates is the answer? (0-3) */
  nccGuessIdx?: number;
}

export type V4Strategy = (ctx: BattleContextV4) => Promise<V4StrategyResult>;

export interface V4FighterConfig {
  /** Ethers provider */
  provider: ethers.Provider;
  /** Wallet/signer for transactions */
  wallet: ethers.Signer;
  /** Battle contract address */
  battleAddress: string;
  /** This agent's on-chain ID */
  agentId: bigint;
  /** Strategy callback — the LLM brain */
  strategy: V4Strategy;
  /** Word dictionary address (resolved from arena if not provided) */
  wordDictionaryAddress?: string;
  /** Pre-loaded word list (avoids on-chain loading) */
  preloadedWordList?: string[];
  /** Path to persist NCC state (survives restarts) */
  statePath?: string;
  /** Poll interval in ms (default: 4000 = 2 Base blocks) */
  pollIntervalMs?: number;
  /** Max time to wait for the battle to finish (default: 60 min) */
  maxBattleTimeMs?: number;
  /** Log to console (default: true) */
  verbose?: boolean;
}

export interface V4FightResult {
  battleAddress: string;
  won: boolean | null;
  reason: string;
  totalTurns: number;
  gasUsed: bigint;
}

interface PreflightToken {
  turn: number;
  payloadHash: `0x${string}`;
  snapshotHash: `0x${string}`;
  createdAtMs: number;
}

// ─── Minimal ABIs ───────────────────────────────────────────────────────

const BATTLE_ABI = [
  'function getBattleState() view returns (uint8 phase, uint32 currentTurn, uint128 bankA, uint128 bankB, bytes32 sequenceHash, uint256 battleId)',
  'function challengerOwner() view returns (address)',
  'function acceptorOwner() view returns (address)',
  'function firstMoverA() view returns (bool)',
  'function currentVopParams() view returns (bytes)',
  'function targetWordIndex() view returns (uint16)',
  'function poisonWord() view returns (string)',
  'function jokersRemainingA() view returns (uint8)',
  'function jokersRemainingB() view returns (uint8)',
  'function submitTurn((string narrative, uint256 solution, string customPoisonWord, (uint16[4] candidateWordIndices, uint16[4] candidateOffsets, bytes32 nccCommitment) nccAttack, (uint8 guessIdx) nccDefense, (bytes32 salt, uint8 intendedIdx) nccReveal) payload)',
  'function captureFlag(string secret)',
  'function submitCompromise(bytes signature)',
  'function claimTimeoutWin()',
  'function COMPROMISE_REASON() view returns (string)',
  'function battleId() view returns (uint256)',
  'event TurnSubmitted(uint256 indexed battleId, uint256 indexed playerId, uint32 turnNumber, bytes32 sequenceHash, uint16 targetWordIndex, string poisonWord, bytes vopParams, string narrative, uint128 bankA, uint128 bankB)',
  'event BattleSettled(uint256 indexed battleId, uint256 winnerId, uint256 loserId, uint8 result)',
  'event NccResolved(uint256 indexed battleId, uint32 turn, bool defenderCorrect, uint128 newBank)',
];

const WORD_DICT_ABI = [
  'function word(uint16 index) view returns (string)',
  'function wordCount() view returns (uint16)',
];

// ─── Fighter ────────────────────────────────────────────────────────────

export class V4Fighter {
  private config: V4FighterConfig;
  private battle: ethers.Contract;
  private wordDict: ethers.Contract | null = null;
  private isAgentA: boolean = false;
  private totalGasUsed: bigint = 0n;

  // NCC state tracking
  private myPreviousNcc: { salt: `0x${string}`; intendedIdx: 0 | 1 | 2 | 3 } | null = null;
  private opponentLastNccAttack: NccAttack | null = null;
  private wordList: string[] | null = null;

  private firstMoverA: boolean = true;

  // Narrative history for continuity
  private narrativeHistory: string[] = [];

  // Joker tracking
  private jokersRemaining: number = 0;

  // Reaction-SLO tracking (per turn)
  private ownedTurnDetectedAtMs = new Map<number, number>();

  constructor(config: V4FighterConfig) {
    this.config = config;
    this.battle = new ethers.Contract(config.battleAddress, BATTLE_ABI, config.wallet);
  }

  private log(...args: unknown[]) {
    if (this.config.verbose ?? true) console.log(...args);
  }

  /**
   * Main loop: poll battle state, play turns, return result.
   */
  async fight(): Promise<V4FightResult> {
    const pollMs = this.config.pollIntervalMs ?? 4000;
    const maxTime = this.config.maxBattleTimeMs ?? 3_600_000;
    const deadline = Date.now() + maxTime;

    // Determine if we're agent A or B
    const myAddress = await this.config.wallet.getAddress();
    const challengerOwner = await this.battle.challengerOwner();
    this.isAgentA = myAddress.toLowerCase() === challengerOwner.toLowerCase();
    this.firstMoverA = await this.battle.firstMoverA();
    this.log(`🎮 Fighting as Agent ${this.isAgentA ? 'A (Challenger)' : 'B (Acceptor)'} | First mover: ${this.firstMoverA ? 'A' : 'B'}`);

    // Load joker count
    try {
      const jokers = this.isAgentA
        ? await this.battle.jokersRemainingA()
        : await this.battle.jokersRemainingB();
      this.jokersRemaining = Number(jokers);
      this.log(`🃏 Jokers available: ${this.jokersRemaining}`);
    } catch { this.jokersRemaining = 0; }

    // Restore NCC state from previous run (crash recovery)
    this.loadState();

    // Resolve word dictionary and load word list
    if (this.config.preloadedWordList) {
      this.wordList = this.config.preloadedWordList;
      this.log(`📖 Using pre-loaded word list (${this.wordList.length} words)`);
    } else if (this.config.wordDictionaryAddress) {
      this.wordDict = new ethers.Contract(
        this.config.wordDictionaryAddress,
        WORD_DICT_ABI,
        this.config.provider,
      );
      this.log('📖 Loading word list from contract...');
      this.wordList = await loadWordList(this.config.wordDictionaryAddress, this.config.provider);
      this.log(`📖 Loaded ${this.wordList.length} words`);
    }

    let lastProcessedTurn = -1;
    const startTime = Date.now();

    // Backoff+jitter watcher state
    let unchangedPolls = 0;
    let lastSnapshot = '';

    while (Date.now() < deadline) {
      const state = await this.getBattleState();
      const snapshot = `${state.phase}:${state.currentTurn}:${state.sequenceHash}`;
      if (snapshot === lastSnapshot) {
        unchangedPolls++;
      } else {
        unchangedPolls = 0;
        lastSnapshot = snapshot;
      }

      // Battle ended?
      if (state.phase === BattlePhase.Settled) {
        return this.buildResult(state, 'settled');
      }

      // Re-read firstMoverA once the battle is Active (it's set during acceptBattle)
      if (state.phase === BattlePhase.Active && state.currentTurn === 0 && lastProcessedTurn === -1) {
        const fresh = await this.battle.firstMoverA();
        if (fresh !== this.firstMoverA) {
          this.firstMoverA = fresh;
          this.log(`🔄 Updated first mover: ${this.firstMoverA ? 'A' : 'B'}`);
        }
      }

      // Is it my turn?
      const isMyTurn = this.isMyTurn(state.currentTurn);
      if (isMyTurn && state.currentTurn > lastProcessedTurn) {
        if (!this.ownedTurnDetectedAtMs.has(state.currentTurn)) {
          this.ownedTurnDetectedAtMs.set(state.currentTurn, Date.now());
        }
        try {
          await this.playTurn(state);
          lastProcessedTurn = state.currentTurn; // Only mark done on success
        } catch (err: any) {
          const errMsg = String(err?.shortMessage ?? err?.message ?? err);
          const errData = err?.data ?? err?.info?.error?.data ?? '';
          this.log(JSON.stringify({
            kind: 'reaction_slo',
            status: 'abort',
            battleAddress: this.config.battleAddress,
            turn: state.currentTurn,
            t_detect_ms: this.ownedTurnDetectedAtMs.get(state.currentTurn) ?? null,
            t_send_ms: null,
            reason: errMsg,
            reasonData: String(errData ?? ''),
          }));
          if (errMsg.includes('TurnTooFast') || errMsg.includes('0xb3c15f40') || String(errData).includes('b3c15f40')) {
            this.log(`  ⏳ Turn too fast — waiting for next block...`);
            await this.sleep(4000); // Wait ~2 blocks
          } else if (errMsg.includes('BattleNotActive') || errMsg.includes('0xf2592cf2') || String(errData).includes('f2592cf2')) {
            this.log(`  ⏳ Battle not active yet — waiting for start block...`);
            await this.sleep(4000);
          } else if (errMsg.includes('reverted') && !errData) {
            // Empty revert data — likely gas estimation issue, retry once
            this.log(`  ⚠️ Empty revert — retrying in 4s...`);
            await this.sleep(4000);
          } else if (errMsg.includes('TargetWordMissing') || String(errData).includes('72bea98a') ||
                     errMsg.includes('CandidateNotInNarrative') || String(errData).includes('71b895eb') ||
                     errMsg.includes('InvalidPoisonWord') || String(errData).includes('3b3a5e43')) {
            // Narrative validation failed — retry with a new narrative
            this.log(`  🔄 Narrative rejected (${errMsg.includes('Target') ? 'target word missing' : errMsg.includes('Candidate') ? 'candidate not found' : 'poison word issue'}) — regenerating...`);
            await this.sleep(2000);
          } else {
            this.log(`❌ Turn ${state.currentTurn} failed: ${errMsg} | data=${errData}`);
            lastProcessedTurn = state.currentTurn; // Skip this turn on other errors
          }
        }
      }

      // Check for opponent timeout (but only after giving them reasonable time)
      // Don't spam timeout claims — wait at least 30s of opponent inactivity
      // Can be disabled with NO_TIMEOUT_CLAIM=1 for testing with slow opponents
      if (!isMyTurn && !process.env.NO_TIMEOUT_CLAIM && (Date.now() - startTime > 60_000 || lastProcessedTurn >= 0)) {
        try {
          const tx = await this.battle.claimTimeoutWin();
          const receipt = await tx.wait();
          this.totalGasUsed += receipt.gasUsed;
          this.log(`⏰ Claimed timeout win!`);
          const finalState = await this.getBattleState();
          return this.buildResult(finalState, 'timeout_claimed');
        } catch {
          // Not timed out yet — normal
        }
      }

      // Adaptive polling with capped exponential backoff + jitter.
      // Keep timeout checks responsive by reducing delay as battle approaches deadline.
      const backoffExp = Math.max(0, Math.min(3, unchangedPolls - 2));
      const baseDelay = unchangedPolls < 3 ? pollMs : Math.min(30_000, pollMs * (2 ** backoffExp));

      const msLeft = deadline - Date.now();
      const timeoutAwareCap = msLeft < 120_000 ? 8_000 : 30_000;
      const cappedDelay = Math.min(baseDelay, timeoutAwareCap);

      const jitter = 0.8 + (Math.random() * 0.4); // ±20%
      const nextDelay = Math.max(1000, Math.floor(cappedDelay * jitter));

      await this.sleep(nextDelay);
    }

    // Fighter deadline reached — try to claim timeout before exiting
    this.log(`⏰ Fighter deadline reached (${Math.round(maxTime / 60_000)}min). Attempting timeout claim...`);
    try {
      const tx = await this.battle.claimTimeoutWin();
      const receipt = await tx.wait();
      this.totalGasUsed += receipt.gasUsed;
      this.log(`⏰ Claimed timeout win at deadline!`);
      const finalState = await this.getBattleState();
      return this.buildResult(finalState, 'timeout_claimed');
    } catch {
      this.log(`⚠️ Timeout claim failed at deadline — battle still active on-chain`);
    }

    return {
      battleAddress: this.config.battleAddress,
      won: null,
      reason: 'fighter_timeout',
      totalTurns: 0,
      gasUsed: this.totalGasUsed,
    };
  }

  private async playTurn(state: BattleStateV4): Promise<void> {
    this.log(`\n📝 Turn ${state.currentTurn} — Bank: ${state.bankA}/${state.bankB}`);

    // Fetch on-chain state needed for the strategy
    const [targetWordIdx, currentPoisonWord, vopParams] = await Promise.all([
      this.battle.targetWordIndex() as Promise<number>,
      this.battle.poisonWord() as Promise<string>,
      this.battle.currentVopParams() as Promise<string>,
    ]);

    // Get target word string
    const targetWord = this.wordList
      ? this.wordList[targetWordIdx]
      : this.wordDict
        ? await this.wordDict.word(targetWordIdx)
        : `word_${targetWordIdx}`;

    // Get opponent's last narrative from events
    const opponentNarrative = await this.getOpponentLastNarrative(state);

    // 🏴 Scan opponent narrative for leaked keys/signatures
    if (opponentNarrative) {
      const compromised = await this.tryCompromise(opponentNarrative);
      if (compromised) {
        return; // Battle settled via compromise!
      }
    }

    // Build context for strategy
    const ctx: BattleContextV4 = {
      turnNumber: state.currentTurn,
      isAgentA: this.isAgentA,
      myBank: this.isAgentA ? state.bankA : state.bankB,
      opponentBank: this.isAgentA ? state.bankB : state.bankA,
      targetWord,
      poisonWord: currentPoisonWord,
      vopParams: vopParams as `0x${string}`,
      opponentNarrative,
      opponentNccAttack: this.opponentLastNccAttack,
      myPreviousNccAttack: this.myPreviousNcc
        ? { salt: this.myPreviousNcc.salt as `0x${string}`, intendedIdx: this.myPreviousNcc.intendedIdx }
        : null,
      sequenceHash: state.sequenceHash,
      recentNarratives: this.narrativeHistory.slice(-3),
      jokersRemaining: this.jokersRemaining,
    };

    // Call strategy (LLM brain)
    const strategyResult = await this.config.strategy(ctx);

    // Build NCC attack from the narrative using BIP39 scanner
    const { nccAttack, salt, intendedIdx } = this.buildNccAttack(
      strategyResult.narrative,
      targetWord,
      currentPoisonWord,
    );

    // Build NCC defense (answer opponent's riddle)
    const nccDefense = createNccDefense(strategyResult.nccGuessIdx ?? 0);

    // Build NCC reveal (reveal our previous commitment)
    const nccReveal = state.currentTurn >= 2 && this.myPreviousNcc
      ? createNccReveal(this.myPreviousNcc.salt, this.myPreviousNcc.intendedIdx)
      : { salt: ethers.ZeroHash as `0x${string}`, intendedIdx: 0 };

    // Build payload
    // Solve VOP challenge
    let vopSolution = 0n;
    if (vopParams && vopParams !== '0x' && vopParams !== '0x00') {
      try {
        const solved = solveHashPreimage(vopParams);
        vopSolution = solved.solution;
        this.log(`  🧩 VOP solved in ${solved.attempts} attempts (${solved.timeMs}ms)`);
      } catch (err) {
        this.log(`  ⚠️ VOP solve failed:`, err);
      }
    }

    const payload: TurnPayloadV4 = {
      narrative: strategyResult.narrative,
      solution: vopSolution,
      customPoisonWord: strategyResult.poisonWord,
      nccAttack,
      nccDefense,
      nccReveal,
    };

    // Preflight-lock gate: freeze + simulate + hash equality before paid send
    const lockedPayload = this.deepFreezePayload(payload);
    const preflight = await this.preflightTurnPayload(lockedPayload, state);
    const sendHash = this.canonicalPayloadHash(lockedPayload);
    if (sendHash !== preflight.payloadHash) {
      const reason = `PREFLIGHT_HASH_MISMATCH:${preflight.payloadHash}:${sendHash}`;
      this.log(`  🛑 ${reason}`);
      throw new Error(reason);
    }

    const now = Date.now();
    const tokenTtlMs = 30_000;
    if (now - preflight.createdAtMs > tokenTtlMs) {
      const reason = `PREFLIGHT_TOKEN_EXPIRED:${now - preflight.createdAtMs}ms`;
      this.log(`  🛑 ${reason}`);
      throw new Error(reason);
    }

    const tSendMs = Date.now();

    // Submit transaction
    const tx = await this.battle.submitTurn(lockedPayload);
    const receipt = await tx.wait();
    this.totalGasUsed += receipt.gasUsed;

    this.log(`  ✅ Submitted (gas: ${receipt.gasUsed}, tx: ${receipt.hash.slice(0, 14)}...)`);

    const tDetectMs = this.ownedTurnDetectedAtMs.get(state.currentTurn) ?? null;
    const tChangeSec = await this.getPreviousTurnChangeTimestampSec(state.currentTurn);
    const tChangeMs = tChangeSec ? tChangeSec * 1000 : null;
    this.log(JSON.stringify({
      kind: 'reaction_slo',
      status: 'success',
      battleAddress: this.config.battleAddress,
      turn: state.currentTurn,
      txHash: receipt.hash,
      t_change_sec: tChangeSec,
      t_detect_ms: tDetectMs,
      t_send_ms: tSendMs,
      detection_latency_ms: tChangeMs && tDetectMs ? (tDetectMs - tChangeMs) : null,
      decision_latency_ms: tDetectMs ? (tSendMs - tDetectMs) : null,
      reaction_latency_ms: tChangeMs ? (tSendMs - tChangeMs) : null,
    }));

    // Track narrative history for continuity
    this.narrativeHistory.push(strategyResult.narrative);
    if (this.narrativeHistory.length > 5) this.narrativeHistory.shift();

    // Track joker usage
    const encoder = new TextEncoder();
    if (encoder.encode(strategyResult.narrative).length > 256) {
      this.jokersRemaining = Math.max(0, this.jokersRemaining - 1);
      this.log(`  🃏 Joker used! Remaining: ${this.jokersRemaining}`);
    }

    // Store our NCC salt + intendedIdx for next reveal
    this.myPreviousNcc = { salt, intendedIdx };
    this.saveState();
  }

  private buildNccAttack(
    narrative: string,
    targetWord: string,
    poisonWord: string,
  ): { nccAttack: NccAttack; salt: `0x${string}`; intendedIdx: 0 | 1 | 2 | 3 } {
    const intendedIdx = 0 as 0 | 1 | 2 | 3; // first candidate is the riddle answer

    if (this.wordList) {
      // Scan narrative for BIP39 words
      const scan = scanForBip39Words(narrative, this.wordList, [targetWord, poisonWord]);

      if (scan.candidates && scan.candidates.length >= 4) {
        const candidates = scan.candidates;
        const bip39Candidates: [
          { word: string; index: number },
          { word: string; index: number },
          { word: string; index: number },
          { word: string; index: number },
        ] = [
          { word: candidates[0].word, index: candidates[0].wordIndex },
          { word: candidates[1].word, index: candidates[1].wordIndex },
          { word: candidates[2].word, index: candidates[2].wordIndex },
          { word: candidates[3].word, index: candidates[3].wordIndex },
        ];

        const { attack, salt, intendedIdx: idx } = createNccAttack(
          narrative,
          bip39Candidates as any,
          intendedIdx,
        );
        return { nccAttack: attack, salt, intendedIdx: idx as 0 | 1 | 2 | 3 };
      }
    }

    // Fallback: use placeholder words (strategy should embed BIP39 words)
    this.log('  ⚠️ Not enough BIP39 words in narrative — using placeholders');
    const fallbackCandidates: [
      { word: string; index: number },
      { word: string; index: number },
      { word: string; index: number },
      { word: string; index: number },
    ] = [
      { word: 'abandon', index: 0 },
      { word: 'ability', index: 1 },
      { word: 'able', index: 2 },
      { word: 'about', index: 3 },
    ];
    const { attack: fbAttack, salt: fbSalt, intendedIdx: fbIdx } = createNccAttack(
      narrative,
      fallbackCandidates as any,
      intendedIdx,
    );
    return { nccAttack: fbAttack, salt: fbSalt, intendedIdx: fbIdx as 0 | 1 | 2 | 3 };
  }

  private async getPreviousTurnChangeTimestampSec(currentTurn: number): Promise<number | null> {
    if (currentTurn === 0) return null;
    try {
      const filter = this.battle.filters.TurnSubmitted();
      const events = await this.battle.queryFilter(filter, -300);
      const prevTurn = currentTurn - 1;
      for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i] as ethers.EventLog;
        const evTurn = Number(ev.args?.[2]);
        if (evTurn === prevTurn) {
          const block = await ev.getBlock();
          return Number(block.timestamp);
        }
      }
    } catch {
      // best effort
    }
    return null;
  }

  private async getOpponentLastNarrative(state: BattleStateV4): Promise<string> {
    if (state.currentTurn === 0) return '';

    try {
      const filter = this.battle.filters.TurnSubmitted();
      const events = await this.battle.queryFilter(filter, -100); // last 100 blocks
      if (events.length > 0) {
        const lastEvent = events[events.length - 1] as ethers.EventLog;
        const narrative = lastEvent.args?.[7] as string; // narrative is 8th arg
        // Also extract opponent's NCC attack from the previous turn event
        return narrative ?? '';
      }
    } catch {
      // Event query failed — return empty
    }
    return '';
  }

  private isMyTurn(currentTurn: number): boolean {
    // First mover determined by firstMoverA flag from contract
    const isEvenTurn = currentTurn % 2 === 0;
    const isATurn = this.firstMoverA ? isEvenTurn : !isEvenTurn;
    return this.isAgentA === isATurn;
  }

  private async getBattleState(): Promise<BattleStateV4> {
    const [phase, currentTurn, bankA, bankB, sequenceHash, battleId] =
      await this.battle.getBattleState();
    return {
      phase: Number(phase) as BattlePhase,
      currentTurn: Number(currentTurn),
      bankA: BigInt(bankA),
      bankB: BigInt(bankB),
      sequenceHash: sequenceHash as `0x${string}`,
      battleId: BigInt(battleId),
    };
  }

  private buildResult(state: BattleStateV4, reason: string): V4FightResult {
    // For timeout claims, the claimer always wins
    let won: boolean | null;
    if (reason === 'timeout_claimed') {
      won = true;
    } else {
      // Determine by final bank states
      const myBank = this.isAgentA ? state.bankA : state.bankB;
      const oppBank = this.isAgentA ? state.bankB : state.bankA;
      won = myBank > oppBank ? true : myBank < oppBank ? false : null;
    }

    return {
      battleAddress: this.config.battleAddress,
      won,
      reason,
      totalTurns: state.currentTurn,
      gasUsed: this.totalGasUsed,
    };
  }

  private canonicalPayloadHash(payload: TurnPayloadV4): `0x${string}` {
    const stable = this.stableStringify(payload);
    return ethers.keccak256(ethers.toUtf8Bytes(stable)) as `0x${string}`;
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(v => this.stableStringify(v)).join(',')}]`;
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${this.stableStringify(obj[k])}`).join(',')}}`;
  }

  private deepFreezePayload(payload: TurnPayloadV4): TurnPayloadV4 {
    // Clone to avoid freezing caller-owned objects
    const cloned = structuredClone(payload) as TurnPayloadV4;
    const freezeRec = (v: any): any => {
      if (v && typeof v === 'object' && !Object.isFrozen(v)) {
        for (const key of Object.keys(v)) freezeRec(v[key]);
        Object.freeze(v);
      }
      return v;
    };
    return freezeRec(cloned);
  }

  private async preflightTurnPayload(payload: TurnPayloadV4, state: BattleStateV4): Promise<PreflightToken> {
    const snapshotHash = ethers.keccak256(
      ethers.toUtf8Bytes(`${state.phase}:${state.currentTurn}:${state.sequenceHash}`),
    ) as `0x${string}`;
    const payloadHash = this.canonicalPayloadHash(payload);

    // Simulate exact call before paid submission
    await this.battle.submitTurn.staticCall(payload);

    // Re-check battle snapshot immediately after preflight to detect drift
    const liveState = await this.getBattleState();
    const liveSnapshotHash = ethers.keccak256(
      ethers.toUtf8Bytes(`${liveState.phase}:${liveState.currentTurn}:${liveState.sequenceHash}`),
    ) as `0x${string}`;
    if (liveSnapshotHash !== snapshotHash) {
      const reason = `PREFLIGHT_SNAPSHOT_DRIFT:${snapshotHash}:${liveSnapshotHash}`;
      this.log(`  🛑 ${reason}`);
      throw new Error(reason);
    }

    return {
      turn: state.currentTurn,
      payloadHash,
      snapshotHash,
      createdAtMs: Date.now(),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Save NCC state to disk for crash recovery */
  private saveState(): void {
    if (!this.config.statePath) return;
    const state = {
      myPreviousNcc: this.myPreviousNcc,
      totalGasUsed: this.totalGasUsed.toString(),
    };
    try {
      const fs = require('node:fs');
      fs.writeFileSync(this.config.statePath, JSON.stringify(state));
    } catch { /* best effort */ }
  }

  /** Load NCC state from disk after restart */
  private loadState(): void {
    if (!this.config.statePath) return;
    try {
      const fs = require('node:fs');
      const raw = fs.readFileSync(this.config.statePath, 'utf-8');
      const state = JSON.parse(raw);
      if (state.myPreviousNcc) {
        this.myPreviousNcc = state.myPreviousNcc;
        this.log('📂 Restored NCC state from checkpoint');
      }
      if (state.totalGasUsed) {
        this.totalGasUsed = BigInt(state.totalGasUsed);
      }
    } catch { /* no state file yet */ }
  }

  /**
   * Scan opponent narrative for leaked private keys or signatures.
   * If a valid private key is found, derive a compromise signature and submit it.
   * If a valid signature is found, try submitting it directly.
   */
  private async tryCompromise(narrative: string): Promise<boolean> {
    // Extract hex strings from the narrative
    const hexMatches = narrative.match(/(?:0x)?[0-9a-fA-F]{64,130}/g);
    if (!hexMatches || hexMatches.length === 0) return false;

    this.log(`  🏴 Found ${hexMatches.length} hex string(s) in opponent narrative — checking...`);

    const [battleIdBig, compromiseReason] = await Promise.all([
      this.battle.battleId(),
      this.battle.COMPROMISE_REASON(),
    ]);

    const chainId = (await this.config.wallet.provider!.getNetwork()).chainId;
    const messageHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'address', 'uint256', 'string'],
        [chainId, this.config.battleAddress, battleIdBig, compromiseReason],
      ),
    );
    const ethSignedHash = ethers.hashMessage(ethers.getBytes(messageHash));

    for (const hex of hexMatches) {
      const cleanHex = hex.startsWith('0x') ? hex : `0x${hex}`;

      // Try as private key (64 hex chars = 32 bytes)
      if (cleanHex.length === 66) {
        try {
          const leakedWallet = new ethers.Wallet(cleanHex);
          // Check if this is the opponent's key
          const opponentAddr = this.isAgentA
            ? await this.battle.acceptorOwner()
            : await this.battle.challengerOwner();

          if (leakedWallet.address.toLowerCase() === opponentAddr.toLowerCase()) {
            this.log(`  🏴‍☠️ OPPONENT PRIVATE KEY LEAKED! Signing compromise...`);
            const sig = await leakedWallet.signMessage(ethers.getBytes(messageHash));
            const tx = await this.battle.submitCompromise(sig);
            const receipt = await tx.wait();
            this.totalGasUsed += receipt.gasUsed;
            this.log(`  🏆 COMPROMISE SUBMITTED! Instant win! tx: ${receipt.hash}`);
            return true;
          }
        } catch {
          // Not a valid key or not opponent's — continue
        }
      }

      // Try as signature (130-132 hex chars = 65 bytes)
      if (cleanHex.length >= 130 && cleanHex.length <= 134) {
        try {
          const recovered = ethers.recoverAddress(ethSignedHash, cleanHex);
          const opponentAddr = this.isAgentA
            ? await this.battle.acceptorOwner()
            : await this.battle.challengerOwner();

          if (recovered.toLowerCase() === opponentAddr.toLowerCase()) {
            this.log(`  🏴‍☠️ VALID COMPROMISE SIGNATURE FOUND! Submitting...`);
            const tx = await this.battle.submitCompromise(cleanHex);
            const receipt = await tx.wait();
            this.totalGasUsed += receipt.gasUsed;
            this.log(`  🏆 COMPROMISE SUBMITTED! Instant win! tx: ${receipt.hash}`);
            return true;
          }
        } catch {
          // Not a valid signature — continue
        }
      }
    }

    this.log(`  🏴 No valid keys/signatures found`);
    return false;
  }
}
