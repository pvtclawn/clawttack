/**
 * @module v4-types
 * @description TypeScript types for Clawttack v4 — chess clock + NCC
 *
 * Mirrors ClawttackTypesV4.sol for SDK integration.
 */

// ─── NCC Types ──────────────────────────────────────────────────────────

/** 4-candidate NCC attack submitted by the attacker each turn */
export interface NccAttack {
  /** 4 BIP39 word indices from the WordDictionary contract */
  candidateWordIndices: [number, number, number, number];
  /** Byte offsets where each candidate appears in the narrative */
  candidateOffsets: [number, number, number, number];
  /** keccak256(abi.encodePacked(salt, intendedIdx)) */
  nccCommitment: `0x${string}`;
}

/** Defender's NCC response — picks one of 4 candidates */
export interface NccDefense {
  /** 0-3: which candidate the defender thinks is correct */
  guessIdx: number;
}

/** Attacker's NCC reveal on their next turn */
export interface NccReveal {
  /** The random salt used in the commitment */
  salt: `0x${string}`;
  /** 0-3: which candidate was the intended answer */
  intendedIdx: number;
}

// ─── Turn Payload ───────────────────────────────────────────────────────

/** Everything an agent submits per turn (v4) */
export interface TurnPayloadV4 {
  /** The narrative text (max 256 bytes, or 1024 with joker) */
  narrative: string;
  /** VOP puzzle solution */
  solution: bigint;
  /** Poison word for opponent's next turn */
  customPoisonWord: string;
  /** NCC attack for opponent's next turn */
  nccAttack: NccAttack;
  /** NCC defense (answer to opponent's previous NCC). Only after turn 0. */
  nccDefense: NccDefense;
  /** NCC reveal (your previous NCC commitment). Only after turn 1. */
  nccReveal: NccReveal;
}

// ─── Battle State ───────────────────────────────────────────────────────

export enum BattlePhase {
  Open = 0,
  Active = 1,
  Settled = 2,
  Cancelled = 3,
}

export enum ResultType {
  None = 0,
  Compromise = 1,
  InvalidSolution = 2,
  PoisonViolation = 3,
  Timeout = 4,
  BankEmpty = 5,
  FlagCaptured = 6,
  NccRevealFailed = 7,
}

export interface BattleStateV4 {
  phase: BattlePhase;
  currentTurn: number;
  bankA: bigint;
  bankB: bigint;
  sequenceHash: `0x${string}`;
  battleId: bigint;
}

// ─── Chess Clock Config ─────────────────────────────────────────────────

/** Constants from ChessClockLib.sol (H9 optimal config) */
export const CHESS_CLOCK_CONFIG = {
  INITIAL_BANK: 400n,
  NCC_REFUND_PCT: 100n,
  NCC_FAIL_PENALTY: 20n,
  BANK_DECAY_BPS: 200n, // 2%
  MIN_TURN_INTERVAL: 5n,
  MAX_TURN_TIMEOUT: 80n,
} as const;

// ─── Events ─────────────────────────────────────────────────────────────

export interface TurnSubmittedEvent {
  battleId: bigint;
  playerId: bigint;
  turnNumber: number;
  sequenceHash: `0x${string}`;
  targetWord: number;
  poisonWord: string;
  nextVopParams: `0x${string}`;
  narrative: string;
  bankA: bigint;
  bankB: bigint;
}

export interface NccResolvedEvent {
  battleId: bigint;
  turn: number;
  defenderCorrect: boolean;
  newBank: bigint;
}

// ─── Battle Context (for strategy callbacks) ────────────────────────────

export interface BattleContextV4 {
  /** Current turn number */
  turnNumber: number;
  /** Am I agent A? */
  isAgentA: boolean;
  /** My remaining bank (blocks) */
  myBank: bigint;
  /** Opponent's remaining bank (blocks) */
  opponentBank: bigint;
  /** The word I must include in my narrative */
  targetWord: string;
  /** The word I must NOT include in my narrative */
  poisonWord: string;
  /** VOP puzzle parameters */
  vopParams: `0x${string}`;
  /** Opponent's last narrative (for NCC defense + CTF injection) */
  opponentNarrative: string;
  /** Opponent's NCC attack (4 candidates to choose from) */
  opponentNccAttack: NccAttack | null;
  /** My previous NCC attack (need to reveal) */
  myPreviousNccAttack: {
    salt: `0x${string}`;
    intendedIdx: number;
  } | null;
  /** Sequence hash (for commitment/verification) */
  sequenceHash: `0x${string}`;
  /** My recent narratives for continuity (last 3) */
  recentNarratives?: string[];
  /** My remaining jokers */
  jokersRemaining?: number;
}

// ─── Battle Config ──────────────────────────────────────────────────────

/** Mirrors BattleConfigV4 from ClawttackTypesV4.sol */
export interface BattleConfigV4 {
  /** ETH stake per side (in wei) */
  stake: bigint;
  /** Blocks before first turn allowed */
  warmupBlocks: number;
  /** 0 = open challenge, otherwise must match agent ID */
  targetAgentId: bigint;
  /** Max joker (1024-byte) turns per agent */
  maxJokers: number;
  /** Require [BLANK] in narratives for NCC comprehension test */
  clozeEnabled: boolean;
}
