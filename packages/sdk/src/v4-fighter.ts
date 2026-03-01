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

// ─── Minimal ABIs ───────────────────────────────────────────────────────

const BATTLE_ABI = [
  'function getBattleState() view returns (uint8 phase, uint32 currentTurn, uint128 bankA, uint128 bankB, bytes32 sequenceHash, uint256 battleId)',
  'function challengerOwner() view returns (address)',
  'function acceptorOwner() view returns (address)',
  'function currentVopParams() view returns (bytes)',
  'function targetWordIndex() view returns (uint16)',
  'function poisonWord() view returns (string)',
  'function submitTurn((string narrative, uint256 solution, string customPoisonWord, (uint16[4] candidateWordIndices, uint16[4] candidateOffsets, bytes32 nccCommitment) nccAttack, (uint8 guessIdx) nccDefense, (bytes32 salt, uint8 intendedIdx) nccReveal) payload)',
  'function captureFlag(string secret)',
  'function claimTimeoutWin()',
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
  private myPreviousNcc: { salt: string; intendedIdx: number } | null = null;
  private opponentLastNccAttack: NccAttack | null = null;

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
    this.log(`🎮 Fighting as Agent ${this.isAgentA ? 'A' : 'B'} at ${this.config.battleAddress.slice(0, 10)}...`);

    // Resolve word dictionary
    if (this.config.wordDictionaryAddress) {
      this.wordDict = new ethers.Contract(
        this.config.wordDictionaryAddress,
        WORD_DICT_ABI,
        this.config.provider,
      );
    }

    let lastProcessedTurn = -1;

    while (Date.now() < deadline) {
      const state = await this.getBattleState();

      // Battle ended?
      if (state.phase === BattlePhase.Settled) {
        return this.buildResult(state, 'settled');
      }

      // Is it my turn?
      const isMyTurn = this.isMyTurn(state.currentTurn);
      if (isMyTurn && state.currentTurn > lastProcessedTurn) {
        lastProcessedTurn = state.currentTurn;

        // Check if we can claim timeout
        // (opponent might have timed out before our turn)

        try {
          await this.playTurn(state);
        } catch (err) {
          this.log(`❌ Turn ${state.currentTurn} failed:`, err);
          // Don't give up — opponent might time out
        }
      }

      // Check for opponent timeout
      if (!isMyTurn) {
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

      await this.sleep(pollMs);
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
    const targetWord = this.wordDict
      ? await this.wordDict.word(targetWordIdx)
      : `word_${targetWordIdx}`;

    // Get opponent's last narrative from events
    const opponentNarrative = await this.getOpponentLastNarrative(state);

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
    };

    // Call strategy (LLM brain)
    const strategyResult = await this.config.strategy(ctx);

    // Build NCC attack from the narrative
    const nccAttack = this.buildNccAttack(strategyResult.narrative);

    // Build NCC defense (answer opponent's riddle)
    const nccDefense = createNccDefense(strategyResult.nccGuessIdx ?? 0);

    // Build NCC reveal (reveal our previous commitment)
    const nccReveal = state.currentTurn >= 2 && this.myPreviousNcc
      ? createNccReveal(this.myPreviousNcc.salt as `0x${string}`, this.myPreviousNcc.intendedIdx as 0 | 1 | 2 | 3)
      : { salt: ethers.ZeroHash, intendedIdx: 0 };

    // Build payload
    const payload: TurnPayloadV4 = {
      narrative: strategyResult.narrative,
      solution: 0n, // TODO: VOP solver
      customPoisonWord: strategyResult.poisonWord,
      nccAttack,
      nccDefense,
      nccReveal,
    };

    // Submit transaction
    const tx = await this.battle.submitTurn(payload);
    const receipt = await tx.wait();
    this.totalGasUsed += receipt.gasUsed;

    this.log(`  ✅ Submitted (gas: ${receipt.gasUsed}, tx: ${receipt.hash.slice(0, 14)}...)`);

    // Store our NCC for next reveal
    this.myPreviousNcc = {
      salt: nccAttack.nccCommitment, // We need to store the actual salt, not commitment
      intendedIdx: 0, // TODO: track from createNccAttack
    };
  }

  private buildNccAttack(narrative: string): NccAttack {
    // Find BIP39 words in the narrative and build attack
    // For now, use a simple fallback — real implementation needs word dictionary lookup
    // The SDK's createNccAttack handles this when given proper BIP39 words

    // TODO: scan narrative for BIP39 words using word dictionary
    // For now, return a placeholder that the strategy should provide
    const salt = ethers.hexlify(ethers.randomBytes(32)) as `0x${string}`;
    const intendedIdx = 0 as 0 | 1 | 2 | 3;

    // This is a simplified version — real implementation needs:
    // 1. Scan narrative for BIP39 words
    // 2. Pick 4 candidates
    // 3. Pick which one is the riddle answer
    // 4. Find byte offsets
    return createNccAttack(
      ['abandon', 'ability', 'able', 'about'] as any, // placeholder
      narrative,
      intendedIdx,
      salt,
    );
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
    // Turn 0: first mover. Turn 1: second mover. Alternating.
    // First mover is determined by the contract (firstMoverA field)
    // For simplicity, assume A goes first on even turns
    const expectedA = currentTurn % 2 === 0;
    return this.isAgentA === expectedA;
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
    // Determine if we won by checking final bank states
    const myBank = this.isAgentA ? state.bankA : state.bankB;
    const oppBank = this.isAgentA ? state.bankB : state.bankA;
    const won = myBank > oppBank ? true : myBank < oppBank ? false : null;

    return {
      battleAddress: this.config.battleAddress,
      won,
      reason,
      totalTurns: state.currentTurn,
      gasUsed: this.totalGasUsed,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
