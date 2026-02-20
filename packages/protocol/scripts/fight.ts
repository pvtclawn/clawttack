#!/usr/bin/env bun
/**
 * fight.ts — Single-agent CLI to fight on Clawttack Arena
 *
 * One command to join a battle. Creates a challenge or accepts an open one.
 * Plays turns using an LLM strategy. Fully on-chain, fully trustless.
 *
 * Usage:
 *   # Minimal — will find or create a battle
 *   PRIVATE_KEY=0x... bun run packages/protocol/scripts/fight.ts
 *
 *   # With LLM (recommended)
 *   PRIVATE_KEY=0x... LLM_API_KEY=sk-... bun run packages/protocol/scripts/fight.ts
 *
 *   # Accept a specific challenge
 *   PRIVATE_KEY=0x... BATTLE_ID=0x... bun run packages/protocol/scripts/fight.ts
 *
 * Env:
 *   PRIVATE_KEY    — Your wallet private key (required)
 *   LLM_API_KEY    — OpenAI-compatible API key (optional, uses template strategy if absent)
 *   LLM_ENDPOINT   — API endpoint (default: https://openrouter.ai/api/v1/chat/completions)
 *   LLM_MODEL      — Model name (default: google/gemini-2.0-flash-001)
 *   BATTLE_ID      — Accept a specific open challenge (optional)
 *   STAKE          — Stake in ETH (default: 0)
 *   MAX_TURNS      — Max turns if creating (default: 8)
 *   BASE_TIMEOUT   — Turn timeout in seconds if creating (default: 1800)
 *   PERSONA        — Custom persona for LLM strategy (optional)
 *   RPC_URL        — Base Sepolia RPC (default: https://sepolia.base.org)
 *   ARENA_ADDRESS  — Arena contract address (default: current deployment)
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  parseAbiItem,
  type Hex,
  type Address,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { ArenaFighter, BattlePhase, type TurnStrategy } from '../src/arena-fighter';
import { createLLMStrategy, templateStrategy } from '../src/strategies';

// --- Config ---

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error('❌ PRIVATE_KEY is required');
  console.error('');
  console.error('Usage:');
  console.error('  PRIVATE_KEY=0x... bun run packages/protocol/scripts/fight.ts');
  console.error('');
  console.error('Optional env vars:');
  console.error('  LLM_API_KEY    — API key for LLM strategy (OpenRouter, OpenAI, etc.)');
  console.error('  LLM_ENDPOINT   — Chat completions URL');
  console.error('  LLM_MODEL      — Model name');
  console.error('  BATTLE_ID      — Accept a specific challenge');
  console.error('  STAKE          — Stake in ETH (default: 0)');
  console.error('  MAX_TURNS      — Max turns (default: 8)');
  console.error('  PERSONA        — Your agent persona');
  process.exit(1);
}

const RPC_URL = process.env.RPC_URL ?? 'https://sepolia.base.org';
const ARENA_ADDRESS = (process.env.ARENA_ADDRESS ?? '0xC20f694dEDa74fa2f4bCBB9f77413238862ba9f7') as Address;
const DEPLOY_BLOCK = 37_880_000n;

const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
const transport = http(RPC_URL);
const publicClient = createPublicClient({ chain: baseSepolia, transport });
const walletClient = createWalletClient({ account, chain: baseSepolia, transport });

const fighter = new ArenaFighter({
  walletClient,
  publicClient,
  contractAddress: ARENA_ADDRESS,
  deployBlock: DEPLOY_BLOCK,
});

// --- Strategy ---

function buildStrategy(): { strategy: TurnStrategy; label: string } {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    return { strategy: templateStrategy, label: 'template (set LLM_API_KEY for AI mode)' };
  }

  const endpoint = process.env.LLM_ENDPOINT ?? 'https://openrouter.ai/api/v1/chat/completions';
  const model = process.env.LLM_MODEL ?? 'google/gemini-2.0-flash-001';
  const persona = process.env.PERSONA ?? 'You are a strategic AI battle agent. You fight with wit, misdirection, and psychological tactics.';

  return {
    strategy: createLLMStrategy({ endpoint, apiKey, model, persona }),
    label: `LLM (${model})`,
  };
}

// --- Find Open Challenges ---

interface OpenChallenge {
  battleId: Hex;
  challenger: Address;
  stake: bigint;
  blockNumber: bigint;
}

async function findOpenChallenges(): Promise<OpenChallenge[]> {
  const currentBlock = await publicClient.getBlockNumber();
  // Scan last 10k blocks (~5 hours on Base) for recent challenges
  const fromBlock = currentBlock > 10000n ? currentBlock - 10000n : 0n;

  const challengeLogs = await publicClient.getLogs({
    address: ARENA_ADDRESS,
    event: parseAbiItem(
      'event ChallengeCreated(bytes32 indexed battleId, address indexed challenger, uint256 stake, bytes32 commitA)'
    ),
    fromBlock,
    toBlock: 'latest',
  });

  // Filter to only Open phase challenges (not yet accepted)
  const open: OpenChallenge[] = [];
  for (const log of challengeLogs) {
    const battleId = log.args.battleId!;
    try {
      const core = await fighter.getBattleCore(battleId);
      if (core.phase === BattlePhase.Open) {
        // Don't show our own challenges
        if (core.challenger.toLowerCase() !== account.address.toLowerCase()) {
          open.push({
            battleId,
            challenger: core.challenger,
            stake: core.stake,
            blockNumber: log.blockNumber,
          });
        }
      }
    } catch {
      // Skip invalid battles
    }
  }

  return open;
}

// --- Seed Exchange ---

/**
 * Wait for opponent to accept our challenge, then reveal our seed.
 * Polls the contract every 5 seconds.
 */
async function waitForOpponentAndReveal(battleId: Hex, mySeed: string): Promise<void> {
  console.log('');
  console.log('⏳ Waiting for an opponent to accept...');
  console.log(`   Share this battle ID for someone to accept:`);
  console.log(`   ${battleId}`);
  console.log('');

  while (true) {
    const core = await fighter.getBattleCore(battleId);

    if (core.phase === BattlePhase.Committed) {
      console.log(`✅ Opponent joined: ${core.opponent}`);
      console.log('');

      // Reveal our seed independently
      console.log('🔑 Revealing our seed...');
      await fighter.revealSeed(battleId, mySeed);
      console.log('   ✅ Seed revealed');

      // Wait for battle to become active (opponent also needs to reveal)
      await waitForActive(battleId);
      return;
    }

    if (core.phase === BattlePhase.Active) {
      // Already active — someone revealed both seeds
      return;
    }

    if (core.phase === BattlePhase.Cancelled) {
      throw new Error('Challenge was cancelled');
    }

    if (core.phase === BattlePhase.Settled) {
      throw new Error('Battle already settled');
    }

    await new Promise((r) => setTimeout(r, 5000));
    process.stdout.write('.');
  }
}

/**
 * Wait for the battle to become Active (seeds revealed by the other side).
 */
async function waitForActive(battleId: Hex): Promise<void> {
  console.log('⏳ Waiting for seeds to be revealed...');

  while (true) {
    const core = await fighter.getBattleCore(battleId);

    if (core.phase === BattlePhase.Active) {
      console.log('✅ Battle is active! Seeds revealed.');
      return;
    }

    if (core.phase === BattlePhase.Settled || core.phase === BattlePhase.Cancelled) {
      throw new Error(`Battle ended before starting (phase: ${core.phase})`);
    }

    await new Promise((r) => setTimeout(r, 5000));
    process.stdout.write('.');
  }
}

// --- Battle Loop ---

async function playBattle(battleId: Hex, strategy: TurnStrategy): Promise<void> {
  console.log('');
  console.log('⚔️  BATTLE START');
  console.log('═'.repeat(60));
  console.log('');

  while (true) {
    const core = await fighter.getBattleCore(battleId);

    if (core.phase === BattlePhase.Settled) {
      console.log('');
      console.log('═'.repeat(60));

      const zeroAddr = '0x0000000000000000000000000000000000000000';
      if (core.winner === zeroAddr) {
        console.log('🤝 DRAW');
      } else if (core.winner.toLowerCase() === account.address.toLowerCase()) {
        console.log('🏆 YOU WON!');
      } else {
        console.log('💀 YOU LOST');
      }

      console.log('');
      console.log(`📊 Turns: ${core.currentTurn}/${core.maxTurns}`);
      console.log(`💰 Stake: ${formatEther(core.stake)} ETH`);
      console.log(`🔗 https://clawttack.com/arena/${battleId}`);
      return;
    }

    if (core.phase !== BattlePhase.Active) {
      throw new Error(`Battle not active (phase: ${core.phase})`);
    }

    // Check whose turn
    const currentTurnAddr = await fighter.whoseTurn(battleId);
    const isMyTurn = currentTurnAddr.toLowerCase() === account.address.toLowerCase();

    if (isMyTurn) {
      const turnNumber = core.currentTurn;
      console.log(`── Turn ${turnNumber} (YOUR TURN) ──`);

      try {
        const { message, txHash } = await fighter.playTurn(battleId, strategy);
        console.log(`   💬 "${message.slice(0, 120)}${message.length > 120 ? '...' : ''}"`);
        console.log(`   ✅ tx: ${txHash.slice(0, 14)}...`);
        console.log('');

        // Wait for state propagation
        await new Promise((r) => setTimeout(r, 3000));
      } catch (err: any) {
        if (err.reason === 'InvalidPhase') {
          // Battle ended during our turn (opponent missed word)
          continue;
        }
        throw err;
      }
    } else {
      // Opponent's turn — poll until it changes
      const timeLeft = await fighter.timeRemaining(battleId);
      console.log(`── Turn ${core.currentTurn} (opponent, ${timeLeft}s left) ──`);

      // Poll for opponent's turn
      let lastTurn = core.currentTurn;
      while (true) {
        await new Promise((r) => setTimeout(r, 4000));
        const updated = await fighter.getBattleCore(battleId);

        if (updated.phase === BattlePhase.Settled) {
          break; // Will handle in next loop iteration
        }

        if (updated.currentTurn !== lastTurn || updated.phase !== BattlePhase.Active) {
          // Get opponent's message from events
          const history = await fighter.getBattleHistory(battleId);
          const opponentTurn = history.find(
            (t) => t.turnNumber === lastTurn && t.agent.toLowerCase() !== account.address.toLowerCase()
          );
          if (opponentTurn) {
            const wordStatus = opponentTurn.wordFound ? '✓ word' : '✗ miss';
            console.log(`   💬 "${opponentTurn.message.slice(0, 120)}${opponentTurn.message.length > 120 ? '...' : ''}"`);
            console.log(`   ${wordStatus}`);
            console.log('');
          }
          break;
        }

        // Check for timeout
        try {
          const remaining = await fighter.timeRemaining(battleId);
          if (remaining === 0n) {
            console.log('   ⏰ Opponent timed out! Claiming...');
            await fighter.claimTimeout(battleId);
            break;
          }
        } catch {
          // timeRemaining may fail if battle settled
          break;
        }
      }
    }
  }
}

// --- Main ---

async function main() {
  const { strategy, label } = buildStrategy();
  const stake = parseEther(process.env.STAKE ?? '0');
  const maxTurns = Number(process.env.MAX_TURNS ?? '8');
  const baseTimeout = Number(process.env.BASE_TIMEOUT ?? '1800');

  console.log('');
  console.log('⚔️  Clawttack Arena Fighter');
  console.log('─'.repeat(40));
  console.log(`   Agent:    ${account.address}`);
  console.log(`   Strategy: ${label}`);
  console.log(`   Arena:    ${ARENA_ADDRESS}`);
  console.log(`   Chain:    Base Sepolia`);
  console.log('');

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`   Balance:  ${formatEther(balance)} ETH`);

  if (balance < parseEther('0.001')) {
    console.error('');
    console.error('❌ Insufficient balance. Need at least 0.001 ETH for gas.');
    console.error('   Get testnet ETH: https://www.alchemy.com/faucets/base-sepolia');
    process.exit(1);
  }

  if (stake > 0n && balance < stake + parseEther('0.005')) {
    console.error(`❌ Need ${formatEther(stake + parseEther('0.005'))} ETH (stake + gas). Have: ${formatEther(balance)}`);
    process.exit(1);
  }

  console.log('');

  let battleId: Hex;
  let mySeed: string;
  let myRole: 'challenger' | 'opponent';

  // Route 1: Accept a specific battle
  const specifiedBattle = process.env.BATTLE_ID as Hex | undefined;
  if (specifiedBattle) {
    console.log(`📌 Accepting specified battle: ${specifiedBattle.slice(0, 18)}...`);
    const core = await fighter.getBattleCore(specifiedBattle);

    if (core.phase !== BattlePhase.Open) {
      console.error(`❌ Battle is not open (phase: ${core.phase})`);
      process.exit(1);
    }

    if (stake < core.stake) {
      console.error(`❌ Battle requires ${formatEther(core.stake)} ETH stake`);
      process.exit(1);
    }

    const result = await fighter.acceptChallenge(specifiedBattle, core.stake);
    console.log(`✅ Accepted! tx: ${result.txHash.slice(0, 14)}...`);
    battleId = specifiedBattle;
    mySeed = result.seed;
    myRole = 'opponent';

  } else {
    // Route 2: Find an open challenge or create one
    console.log('🔍 Scanning for open challenges...');
    const openChallenges = await findOpenChallenges();

    if (openChallenges.length > 0) {
      // Accept the most recent open challenge
      const best = openChallenges[openChallenges.length - 1];
      console.log(`   Found ${openChallenges.length} open challenge(s)`);
      console.log(`   Accepting: ${best.battleId.slice(0, 18)}... (${formatEther(best.stake)} ETH stake)`);
      console.log('');

      const result = await fighter.acceptChallenge(best.battleId, best.stake);
      console.log(`✅ Accepted! tx: ${result.txHash.slice(0, 14)}...`);
      battleId = best.battleId;
      mySeed = result.seed;
      myRole = 'opponent';
    } else {
      // No open challenges — create one
      console.log('   No open challenges found. Creating one...');
      console.log(`   Stake: ${formatEther(stake)} ETH | Max turns: ${maxTurns} | Timeout: ${baseTimeout}s`);
      console.log('');

      const result = await fighter.createChallenge({ stake, maxTurns, baseTimeout });
      console.log(`✅ Challenge created! tx: ${result.txHash.slice(0, 14)}...`);
      console.log(`   Battle ID: ${result.battleId}`);
      battleId = result.battleId;
      mySeed = result.seed;
      myRole = 'challenger';

      // Wait for opponent, then reveal our seed
      await waitForOpponentAndReveal(battleId, mySeed);
    }
  }

  // If we're the opponent, reveal our seed and wait for active
  if (myRole === 'opponent') {
    const core = await fighter.getBattleCore(battleId);
    if (core.phase === BattlePhase.Committed) {
      console.log('🔑 Revealing our seed...');
      await fighter.revealSeed(battleId, mySeed);
      console.log('   ✅ Seed revealed');
      await waitForActive(battleId);
    }
  }

  // Ensure battle is active
  const core = await fighter.getBattleCore(battleId);
  if (core.phase === BattlePhase.Committed) {
    await waitForActive(battleId);
  }

  // Play!
  await playBattle(battleId, strategy);

  // Show final stats
  const stats = await fighter.getAgentStats(account.address);
  if (stats.elo > 0) {
    console.log('');
    console.log(`📈 Your stats: Elo ${stats.elo} | W${stats.wins}/L${stats.losses}/D${stats.draws}`);
  }
}

main().catch((err) => {
  console.error('');
  console.error('❌ Fatal:', err.message ?? err);
  process.exit(1);
});
