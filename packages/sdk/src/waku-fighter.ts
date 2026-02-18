// packages/sdk/src/waku-fighter.ts — Auto-play battle fighter for Waku P2P
//
// Like Fighter but for serverless P2P battles via Waku.
// No relay needed — agents find each other via battle ID,
// register with signed proofs, and fight directly.
//
// Usage:
//   const fighter = new WakuFighter({
//     nwakuRestUrl: 'http://localhost:8003',
//     privateKey: '0x...',
//     name: 'MyAgent',
//     strategy: async (ctx) => `My response to turn ${ctx.turnNumber}`,
//   });
//   const result = await fighter.fight('my-battle-id');

import { ethers } from 'ethers';
import { canonicalTurnHash } from '@clawttack/protocol';
import type { TurnMessage } from '@clawttack/protocol';
import { WakuTransport, signRegistration } from './waku-transport.ts';
import type { WakuTransportConfig } from './waku-transport.ts';
import type { BattleStartData, BattleEndData, YourTurnData } from './transport.ts';

export interface WakuFighterConfig {
  /** nwaku REST API URL */
  nwakuRestUrl: string;
  /** Agent's private key */
  privateKey: string;
  /** Display name */
  name: string;
  /** Strategy callback — decides what to say each turn */
  strategy: WakuStrategy;
  /** Turn timeout in ms (default: 60s) */
  turnTimeoutMs?: number;
  /** Overall battle timeout in ms (default: 5 min) */
  battleTimeoutMs?: number;
  /** Max turns (default: 20) */
  maxTurns?: number;
  /** Log to console (default: true) */
  verbose?: boolean;
  /** Additional WakuTransport config overrides */
  transportConfig?: Partial<WakuTransportConfig>;
  /** Shared transport instance (optional — avoids creating separate Waku nodes) */
  transport?: WakuTransport;
  /** ChallengeWordBattle config — enables challenge word generation per turn */
  challengeWord?: ChallengeWordConfig;
}

export interface WakuBattleContext {
  battleId: string;
  role: string;
  turnNumber: number;
  opponentMessage?: string;
  maxTurns: number;
  opponentAddress?: string;
  /** Challenge word that MUST appear in the response (ChallengeWordBattle) */
  challengeWord?: string;
  /** Seconds allowed for this turn (decreasing timer) */
  turnTimeoutSeconds?: number;
}

/** Strategy function: given context, return a message */
export type WakuStrategy = (ctx: WakuBattleContext) => Promise<string> | string;

/** Configuration for ChallengeWordBattle mode */
export interface ChallengeWordConfig {
  /** Commit from agent A (bytes32 hex) */
  commitA: string;
  /** Commit from agent B (bytes32 hex) */
  commitB: string;
  /** Whether to use decreasing timer (default: true) */
  decreasingTimer?: boolean;
}

/**
 * Word list matching ChallengeWordBattle.sol — MUST stay in sync.
 * 64 four-letter words, deterministic index via keccak256.
 */
const CHALLENGE_WORDS = [
  'blue', 'dark', 'fire', 'gold', 'iron', 'jade', 'keen', 'lime',
  'mint', 'navy', 'onyx', 'pine', 'ruby', 'sage', 'teal', 'vine',
  'arch', 'bolt', 'core', 'dawn', 'echo', 'flux', 'glow', 'haze',
  'iris', 'jolt', 'knot', 'loom', 'mist', 'node', 'oath', 'peak',
  'rift', 'silk', 'tide', 'unit', 'vale', 'warp', 'zero', 'apex',
  'band', 'cape', 'dome', 'edge', 'fern', 'grit', 'husk', 'isle',
  'jazz', 'kite', 'lark', 'maze', 'nest', 'opus', 'palm', 'quay',
  'reed', 'spur', 'torn', 'urge', 'veil', 'wolf', 'yarn', 'zest',
] as const;

/**
 * Generate the challenge word for a given turn — mirrors Solidity logic exactly.
 * keccak256(abi.encodePacked(turnNumber, commitA, commitB)) % 64
 */
export function generateChallengeWord(
  turnNumber: number,
  commitA: string,
  commitB: string,
): string {
  // abi.encodePacked(uint16, bytes32, bytes32) = 2 + 32 + 32 = 66 bytes
  const packed = ethers.solidityPacked(
    ['uint16', 'bytes32', 'bytes32'],
    [turnNumber, commitA, commitB],
  );
  const hash = ethers.keccak256(packed);
  const index = Number(BigInt(hash) % BigInt(CHALLENGE_WORDS.length));
  return CHALLENGE_WORDS[index]!;
}

/**
 * Get turn timeout in seconds — mirrors Solidity logic exactly.
 * Halving timer: starts at 60s, halves each turn, minimum 1s.
 * 60 → 30 → 15 → 7 → 3 → 1 → 1...
 */
export function getChallengeWordTimeout(turnNumber: number): number {
  let timeout = 60;
  for (let i = 1; i < turnNumber; i++) {
    timeout = Math.floor(timeout / 2);
    if (timeout < 1) return 1;
  }
  return timeout;
}

export interface WakuFightResult {
  battleId: string;
  won: boolean | null; // null = draw/unknown
  role: string;
  totalTurns: number;
  reason: string;
  agentAddress: string;
  opponentAddress: string;
}

export class WakuFighter {
  private wallet: ethers.Wallet;
  private config: WakuFighterConfig;

  constructor(config: WakuFighterConfig) {
    this.config = config;
    this.wallet = new ethers.Wallet(config.privateKey);
  }

  get address(): string {
    return this.wallet.address.toLowerCase();
  }

  /** Sign a turn message using canonical hash (protocol-compatible) */
  private async signTurn(
    battleId: string,
    message: string,
    turnNumber: number,
  ): Promise<{ message: string; turnNumber: number; timestamp: number; signature: string }> {
    const timestamp = Date.now();
    const turnMessage: TurnMessage = {
      battleId,
      agentAddress: this.wallet.address,
      message,
      turnNumber,
      timestamp,
    };
    const hash = canonicalTurnHash(turnMessage);
    const signature = await this.wallet.signMessage(ethers.getBytes(hash));
    return { message, turnNumber, timestamp, signature };
  }

  /**
   * Fight a P2P battle over Waku.
   *
   * Both agents must call fight() with the same battleId.
   * First two agents to register start the battle automatically.
   */
  async fight(battleId: string): Promise<WakuFightResult> {
    const verbose = this.config.verbose ?? true;
    const maxTurns = this.config.maxTurns ?? 20;
    const battleTimeoutMs = this.config.battleTimeoutMs ?? 300_000;

    // Create or use shared transport
    const ownsTransport = !this.config.transport;
    const cwConfig = this.config.challengeWord;
    const transport = this.config.transport ?? new WakuTransport({
      nwakuRestUrl: this.config.nwakuRestUrl,
      turnTimeoutMs: this.config.turnTimeoutMs ?? 60_000,
      // ChallengeWordBattle: use decreasing timer for opponent timeout too
      ...(cwConfig?.decreasingTimer !== false && cwConfig
        ? { turnTimeoutFn: (turn: number) => getChallengeWordTimeout(turn) * 1000 }
        : {}),
      ...this.config.transportConfig,
    });

    if (verbose) console.log(`⏳ ${this.config.name}: connecting to Waku...`);
    const conn = await transport.connect(battleId);

    // Event-driven battle loop
    // IMPORTANT: Attach listeners BEFORE register() because register() may
    // immediately emit 'battleStarted' if the other agent already registered.
    const result = await Promise.race([
      new Promise<WakuFightResult>((resolve, reject) => {
        let role = '';
        let turnCount = 0;
        let opponentAddr = '';
        let battleActive = false;
        let cleanedUp = false;
        let pendingTurn: YourTurnData | null = null; // Buffer for turns before battleStarted

        conn.on('battleStarted', (data: BattleStartData) => {
          if (battleActive) return; // Ignore duplicates from re-broadcasts
          battleActive = true;
          role = data.role;
          opponentAddr = data.agents.find(a => a.address !== this.address)?.address ?? '';
          if (verbose) console.log(`🏟️  ${this.config.name}: battle started! Your turn: ${data.yourTurn}`);
          if (data.yourTurn) {
            playTurn(1, undefined);
          } else if (pendingTurn) {
            // Replay buffered turn that arrived before battleStarted
            if (verbose) console.log(`  ♻️  ${this.config.name}: replaying buffered turn ${pendingTurn.turnNumber}`);
            playTurn(pendingTurn.turnNumber, pendingTurn.opponentMessage);
            pendingTurn = null;
          }
        });

        conn.on('yourTurn', (data: YourTurnData) => {
          if (cleanedUp) return;
          if (!battleActive) {
            // Battle hasn't started yet — buffer the turn for replay
            pendingTurn = data;
            return;
          }
          if (data.turnNumber > maxTurns) {
            if (verbose) console.log(`🤝 ${this.config.name}: max turns reached — draw`);
            // Notify opponent via forfeit (signals battle over)
            // Notify opponent — forfeit to cleanly end the battle
            // (semantics: max_turns = draw, but forfeit triggers battleEnded)
            conn.forfeit().catch(() => {});
            cleanup();
            resolve({
              battleId, won: null, role, totalTurns: turnCount,
              reason: 'max_turns', agentAddress: this.address, opponentAddress: opponentAddr,
            });
            return;
          }
          playTurn(data.turnNumber, data.opponentMessage);
        });

        conn.on('battleEnded', (data: BattleEndData) => {
          if (cleanedUp) return;
          const won = data.outcome.winnerAddress === this.address ? true
            : data.outcome.loserAddress === this.address ? false : null;
          if (verbose) {
            const status = won === true ? '🏆 WON!' : won === false ? '💀 LOST' : '🤝 DRAW';
            console.log(`${status} ${this.config.name}: ${data.outcome.reason}`);
          }
          cleanup();
          resolve({
            battleId, won, role, totalTurns: data.totalTurns,
            reason: data.outcome.reason, agentAddress: this.address, opponentAddress: opponentAddr,
          });
        });

        conn.on('error', (msg: string) => {
          if (verbose) console.log(`⚠️  ${this.config.name}: ${msg}`);
        });

        conn.on('connectionChanged', (connected: boolean) => {
          if (!connected && !cleanedUp) {
            cleanup();
            reject(new Error(`${this.config.name}: Waku connection lost`));
          }
        });

        const playTurn = async (turnNumber: number, opponentMessage?: string) => {
          if (cleanedUp) return;
          try {
            // ChallengeWordBattle: compute challenge word + dynamic timeout
            let challengeWord: string | undefined;
            let turnTimeoutSeconds: number | undefined;
            let effectiveTimeoutMs = this.config.turnTimeoutMs ?? 30_000;

            if (cwConfig) {
              challengeWord = generateChallengeWord(turnNumber, cwConfig.commitA, cwConfig.commitB);
              if (cwConfig.decreasingTimer !== false) {
                turnTimeoutSeconds = getChallengeWordTimeout(turnNumber);
                effectiveTimeoutMs = turnTimeoutSeconds * 1000;
              }
              if (verbose) {
                console.log(`  🔑 Challenge word: "${challengeWord}" | ⏱️ ${turnTimeoutSeconds ?? '∞'}s`);
              }
            }

            const ctx: WakuBattleContext = {
              battleId, role, turnNumber, opponentMessage, maxTurns,
              opponentAddress: opponentAddr,
              challengeWord,
              turnTimeoutSeconds,
            };
            const message = await Promise.race([
              Promise.resolve(this.config.strategy(ctx)),
              new Promise<never>((_, rej) =>
                setTimeout(() => rej(new Error('Strategy timeout')), effectiveTimeoutMs),
              ),
            ]);

            // ChallengeWordBattle: verify the response contains the challenge word
            if (challengeWord && !message.toLowerCase().includes(challengeWord)) {
              console.error(`  ❌ ${this.config.name}: response missing challenge word "${challengeWord}" — forfeiting`);
              await conn.forfeit();
              return;
            }

            const signed = await this.signTurn(battleId, message, turnNumber);
            await conn.sendTurn(signed);
            turnCount = turnNumber;
            if (verbose) {
              console.log(`  📝 ${this.config.name} [T${turnNumber}]: "${message.slice(0, 60)}${message.length > 60 ? '...' : ''}"`);
            }
          } catch (err) {
            console.error(`  ❌ ${this.config.name} turn ${turnNumber} failed:`, err);
            await conn.forfeit();
          }
        };

        const cleanup = () => {
          if (cleanedUp) return;
          cleanedUp = true;
          // Only close the connection, not the shared transport
          // (transport.dispose() is caller's responsibility when shared)
          conn.close();
          if (ownsTransport) transport.dispose();
        };

        // Register AFTER listeners are attached (register may fire battleStarted immediately)
        (async () => {
          const regTimestamp = Date.now();
          const regSig = await signRegistration(this.wallet, battleId, regTimestamp);
          await conn.register(this.address, regSig, regTimestamp);
          if (verbose) console.log(`✅ ${this.config.name}: registered with signed proof`);
        })().catch(reject);
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => {
          conn.close();
          if (ownsTransport) transport.dispose();
          reject(new Error(`${this.config.name}: battle timeout (${battleTimeoutMs / 1000}s)`));
        }, battleTimeoutMs),
      ),
    ]);

    return result;
  }
}
