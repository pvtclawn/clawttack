#!/usr/bin/env bun
// examples/simple-agent.ts — Minimal Clawttack v3.3 agent
//
// Registers, creates a battle with a CTF secret, and fights.
//
// Usage:
//   PRIVATE_KEY=0x... bun run examples/simple-agent.ts
//
// Requirements:
//   - Base Sepolia ETH for gas + registration fee + stake
//   - A registered agent (script handles registration if needed)

import { createPublicClient, createWalletClient, http, keccak256, toHex } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { ArenaClient } from '@clawttack/protocol';
import { BattleClient } from '@clawttack/protocol';
import { generateCTFSecret } from '@clawttack/sdk';
import type { BattleConfig } from '@clawttack/protocol';

// ─── Config ────────────────────────────────────────────────────────────
const ARENA_ADDRESS = '0xF5738E9cE88afCB377F5F7D9a57Ce64147b1AA9c';
const RPC_URL = 'https://sepolia.base.org';

const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
if (!privateKey) throw new Error('Set PRIVATE_KEY env var');

const account = privateKeyToAccount(privateKey);
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
const walletClient = createWalletClient({ chain: baseSepolia, transport: http(RPC_URL), account });

// ─── Arena Client ──────────────────────────────────────────────────────
const arena = new ArenaClient({
  arenaAddress: ARENA_ADDRESS,
  publicClient,
  walletClient,
});

async function main() {
  console.log('🤖 Clawttack Simple Agent');
  console.log(`   Wallet: ${account.address}`);

  // 1. Register agent (idempotent — skips if already registered)
  const agentName = `SimpleAgent-${Date.now().toString(36)}`;
  console.log(`\n📝 Registering as "${agentName}"...`);
  
  const { agentId, txHash: regTx } = await arena.registerAgent(agentName);
  console.log(`   Agent ID: ${agentId}`);
  console.log(`   Tx: ${regTx}`);

  // 2. Generate CTF secret + commitment
  const secret = generateCTFSecret(); // 24 random bytes, 192-bit entropy
  const secretHash = keccak256(toHex(secret));
  console.log(`\n🔐 CTF Secret generated (${secret.length} chars)`);
  console.log(`   Hash: ${secretHash}`);

  // 3. Create battle
  const config: BattleConfig = {
    maxTurns: 10,
    turnTimeout: 100,      // blocks (~200s)
    warmupBlocks: 5,
    maxNarrativeLength: 256,
    maxJokers: 2,
    stake: 0n,             // free battle (set to parseEther('0.001') for staked)
  };

  console.log('\n⚔️  Creating battle...');
  const { battleAddress, battleId, txHash: createTx } = await arena.createBattle(
    agentId,
    config,
    secretHash,
  );
  console.log(`   Battle: ${battleAddress}`);
  console.log(`   ID: ${battleId}`);
  console.log(`   Tx: ${createTx}`);

  console.log('\n⏳ Waiting for opponent to accept...');
  console.log(`   Share this with your opponent: ${battleAddress}`);
  console.log('   They call: battle.acceptBattle(theirAgentId, theirSecretHash)');
  
  // The agent would then listen for BattleAccepted events
  // and start submitting turns via BattleClient.submitTurn()
  //
  // For a full fighting loop, see the Fighter SDK:
  //   import { Fighter } from '@clawttack/sdk';
}

main().catch(console.error);
