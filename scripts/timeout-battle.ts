#!/usr/bin/env bun
/**
 * scripts/timeout-battle.ts — Test timeout victory
 * Clawn plays, ClawnJr deliberately doesn't respond → Clawn claims timeout
 */

import { createPublicClient, createWalletClient, http, type Hex, type Address } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { ArenaClient, BattleClient } from '../packages/protocol/src/index';
import { CLAWTTACK_BATTLE_ABI } from '../packages/protocol/src/abi';

const ARENA_ADDRESS = '0x6045d9b8Ab1583AD4cEb600c0E8d515E9922d2eB' as Address;
const WORD_DICTIONARY = '0xa5bAC96F55e46563D0B0b57694E7Ac7Bc7DA25eC' as Address;
const RPC_URL = 'https://sepolia.base.org';

const WORD_DICTIONARY_ABI = [
  { name: 'word', type: 'function', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint16' }], outputs: [{ name: '', type: 'string' }] },
] as const;

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

function generateNarrative(targetWord: string): string {
  return `In the grand library of the ancient citadel a scholar studied the meaning of ${targetWord} and found it held secrets that transformed the understanding of every reader who encountered its wisdom throughout the ages of civilization`;
}

async function main() {
  const password = process.env.WALLET_PASSWORD;
  if (!password) throw new Error('Set WALLET_PASSWORD env var');

  console.log('🔑 Loading keystores...');
  const clawnKey = await loadKeystoreKey('clawn', password);
  const clawnjrKey = await loadKeystoreKey('clawnjr', password);
  const clawnAccount = privateKeyToAccount(clawnKey);
  const clawnjrAccount = privateKeyToAccount(clawnjrKey);

  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
  const clawnWallet = createWalletClient({ account: clawnAccount, chain: baseSepolia, transport: http(RPC_URL) });
  const clawnjrWallet = createWalletClient({ account: clawnjrAccount, chain: baseSepolia, transport: http(RPC_URL) });

  const arena = new ArenaClient({ publicClient, walletClient: clawnWallet, contractAddress: ARENA_ADDRESS });
  const arenaJr = new ArenaClient({ publicClient, walletClient: clawnjrWallet, contractAddress: ARENA_ADDRESS });

  // Register (idempotent check attempt)
  console.log('\n📝 Registering agents...');
  let clawnId: bigint, clawnjrId: bigint;
  try { clawnId = await arena.registerAgent(); console.log(`  ✅ Clawn: ${clawnId}`); }
  catch { clawnId = 1n; console.log('  ⚠️ Clawn already registered'); }
  try { clawnjrId = await arenaJr.registerAgent(); console.log(`  ✅ ClawnJr: ${clawnjrId}`); }
  catch { clawnjrId = 2n; console.log('  ⚠️ ClawnJr already registered'); }

  // Create battle with SHORT timeout (25 blocks = ~50s on Base)
  console.log('\n⚔️ Creating battle with short timeout...');
  const { battleId, battleAddress, txHash } = await arena.createBattle(clawnId, {
    stake: 0n,
    maxTurns: 12,
    maxJokers: 1,
    baseTimeoutBlocks: 25,  // MIN_TIMEOUT = 25 blocks (~50s)
    warmupBlocks: 15,
    targetAgentId: 0n,
  });
  console.log(`  ✅ Battle #${battleId}: ${battleAddress}`);

  // ClawnJr accepts
  const battleJr = new BattleClient({ publicClient, walletClient: clawnjrWallet, battleAddress });
  const acceptTx = await battleJr.acceptBattle(clawnjrId, 0n);
  await publicClient.waitForTransactionReceipt({ hash: acceptTx });
  console.log('  ✅ ClawnJr accepted');

  // Wait for warmup
  console.log('  ⏳ Waiting for warmup (15 blocks)...');
  await new Promise(r => setTimeout(r, 35_000));

  const battle = arena.attach(battleAddress);
  const state = await battle.getState();
  console.log(`\n📊 State: phase=${state.phase}, turn=${state.currentTurn}`);

  const firstMover = await battle.whoseTurn();
  const isClawnFirst = firstMover.toLowerCase() === clawnAccount.address.toLowerCase();
  console.log(`  First mover: ${isClawnFirst ? 'Clawn' : 'ClawnJr'}`);

  // If ClawnJr goes first, they need to play turn 0
  if (!isClawnFirst) {
    console.log('\n⚔️ ClawnJr plays turn 0 (then stops)...');
    const targetIdx = await publicClient.readContract({ address: battleAddress, abi: CLAWTTACK_BATTLE_ABI, functionName: 'targetWordIndex' }) as number;
    const targetWord = await publicClient.readContract({ address: WORD_DICTIONARY, abi: WORD_DICTIONARY_ABI, functionName: 'word', args: [targetIdx] }) as string;
    const narrative = generateNarrative(targetWord);
    const nextVopParams = ('0x' + '00'.repeat(64)) as Hex;
    
    const tx = await battleJr.submitTurn({ solution: 0n, narrative, nextVopParams, poisonWordIndex: 42 });
    await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log('  ✅ ClawnJr played turn 0');
    await new Promise(r => setTimeout(r, 4000)); // Wait for state propagation
  }

  // Clawn plays their turn
  console.log('\n⚔️ Clawn plays turn...');
  const latestBlock = await publicClient.getBlockNumber();
  const targetIdx = await publicClient.readContract({ address: battleAddress, abi: CLAWTTACK_BATTLE_ABI, functionName: 'targetWordIndex', blockNumber: latestBlock }) as number;
  const targetWord = await publicClient.readContract({ address: WORD_DICTIONARY, abi: WORD_DICTIONARY_ABI, functionName: 'word', args: [targetIdx] }) as string;
  const narrative = generateNarrative(targetWord);
  const nextVopParams = ('0x' + '00'.repeat(64)) as Hex;
  
  const turnTx = await battle.submitTurn({ solution: 0n, narrative, nextVopParams, poisonWordIndex: 100 });
  await publicClient.waitForTransactionReceipt({ hash: turnTx });
  console.log('  ✅ Clawn played');

  // Now ClawnJr does NOT play. Wait for timeout.
  const deadlineBlock = (await battle.getState()).deadlineBlock;
  const currentBlock = await publicClient.getBlockNumber();
  const blocksToWait = Number(deadlineBlock - currentBlock);
  const waitMs = Math.max(blocksToWait * 2000 + 10000, 15000); // Extra buffer for block timing
  console.log(`\n⏰ ClawnJr is NOT playing. Waiting for timeout... (~${Math.round(waitMs/1000)}s, ${blocksToWait} blocks)`);
  await new Promise(r => setTimeout(r, waitMs));

  // Clawn claims timeout (with retry)
  console.log('\n🏆 Clawn claiming timeout victory...');
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const claimTx = await battle.claimTimeoutWin();
      const receipt = await publicClient.waitForTransactionReceipt({ hash: claimTx });
      console.log(`  ✅ Timeout claimed! tx: ${claimTx}`);
      
      const finalState = await battle.getState();
      console.log(`  Final: phase=${finalState.phase} (${['Open','Active','Settled','Cancelled'][finalState.phase]})`);
      break;
    } catch (e: any) {
      const msg = e.message?.substring(0, 100) || '';
      if (msg.includes('DeadlineNotExpired')) {
        console.log(`  ⏳ Attempt ${attempt + 1}: deadline not yet expired, waiting 5s...`);
        await new Promise(r => setTimeout(r, 5000));
      } else {
        console.log(`  ❌ Claim failed: ${msg}`);
        break;
      }
    }
  }

  // Check Elo after
  console.log('\n📊 Agent stats after timeout battle:');
  const ARENA_ABI = [
    { type: 'function', name: 'agents', inputs: [{ name: 'id', type: 'uint256' }], outputs: [
      { name: 'owner', type: 'address' }, { name: 'eloRating', type: 'uint32' },
      { name: 'totalWins', type: 'uint32' }, { name: 'totalLosses', type: 'uint32' }
    ], stateMutability: 'view' },
  ];
  for (const id of [clawnId, clawnjrId]) {
    const [owner, elo, wins, losses] = await publicClient.readContract({ address: ARENA_ADDRESS, abi: ARENA_ABI, functionName: 'agents', args: [id] }) as any;
    console.log(`  Agent #${id}: elo=${elo} W:${wins} L:${losses}`);
  }
}

main().catch(e => { console.error('💀 Fatal:', e.message); process.exit(1); });
