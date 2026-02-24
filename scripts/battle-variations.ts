#!/usr/bin/env bun
/**
 * scripts/battle-variations.ts — Run battle variations to test edge cases
 * 
 * Variation A: Poison word trap (set poison = "the" → common word, should trigger)
 * Variation B: Short timeout (25 blocks → ~50s, tight window)
 * Variation C: Joker usage (narrative > 256 chars)
 */

import { createPublicClient, createWalletClient, http, type Hex, type Address, encodeFunctionData } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const ARENA_ADDRESS = '0x6045d9b8Ab1583AD4cEb600c0E8d515E9922d2eB' as Address;
const WORD_DICTIONARY = '0xa5bAC96F55e46563D0B0b57694E7Ac7Bc7DA25eC' as Address;
const RPC_URL = 'https://sepolia.base.org';

const ARENA_ABI = [
  { type: 'function', name: 'registerAgent', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'payable' },
  { type: 'function', name: 'createBattle', inputs: [{ name: 'challengerId', type: 'uint256' }, { name: 'config', type: 'tuple', components: [{ name: 'stake', type: 'uint256' }, { name: 'baseTimeoutBlocks', type: 'uint32' }, { name: 'warmupBlocks', type: 'uint32' }, { name: 'targetAgentId', type: 'uint256' }, { name: 'maxTurns', type: 'uint8' }, { name: 'maxJokers', type: 'uint8' }] }], outputs: [{ type: 'uint256' }], stateMutability: 'payable' },
  { type: 'function', name: 'battles', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'battlesCount', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'agentsCount', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'event', name: 'BattleCreated', inputs: [{ name: 'battleId', type: 'uint256', indexed: true }, { name: 'challengerId', type: 'uint256', indexed: true }, { name: 'stake', type: 'uint256' }, { name: 'baseTimeoutBlocks', type: 'uint32' }, { name: 'maxTurns', type: 'uint8' }] },
] as const;

const BATTLE_ABI = [
  { type: 'function', name: 'acceptBattle', inputs: [{ name: 'acceptorId', type: 'uint256' }], outputs: [], stateMutability: 'payable' },
  { type: 'function', name: 'submitTurn', inputs: [{ name: 'payload', type: 'tuple', components: [{ name: 'solution', type: 'uint256' }, { name: 'narrative', type: 'string' }, { name: 'nextVopParams', type: 'bytes' }, { name: 'poisonWordIndex', type: 'uint16' }] }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'getBattleState', inputs: [], outputs: [{ type: 'uint8' }, { type: 'uint32' }, { type: 'uint64' }, { type: 'bytes32' }, { type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'targetWordIndex', inputs: [], outputs: [{ type: 'uint16' }], stateMutability: 'view' },
  { type: 'function', name: 'poisonWordIndex', inputs: [], outputs: [{ type: 'uint16' }], stateMutability: 'view' },
  { type: 'function', name: 'firstMoverA', inputs: [], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  { type: 'function', name: 'challengerOwner', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'claimTimeoutWin', inputs: [], outputs: [], stateMutability: 'nonpayable' },
] as const;

const WORD_ABI = [
  { type: 'function', name: 'word', inputs: [{ name: 'index', type: 'uint16' }], outputs: [{ type: 'string' }], stateMutability: 'view' },
] as const;

async function loadKey(name: string, password: string): Promise<Hex> {
  const proc = Bun.spawn([`${process.env.HOME}/.foundry/bin/cast`, 'wallet', 'decrypt-keystore', name, '--unsafe-password', password], { stdout: 'pipe', stderr: 'pipe' });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  return out.match(/0x[0-9a-fA-F]{64}/)![0] as Hex;
}

function makeNarrative(targetWord: string, long = false): string {
  const base = `In the grand library of the ancient citadel a scholar studied the meaning of ${targetWord} and found it held secrets that transformed understanding`;
  if (long) {
    // Joker narrative: > 256 chars but <= 1024
    return base + ` through many ages of wisdom and discovery across the vast kingdoms where knowledge was prized above all earthly possessions and the pursuit of truth was the highest calling of every soul who walked the ancient corridors of learning and enlightenment`;
  }
  return base + ` of every reader who encountered its wisdom throughout the ages of civilization`;
}

async function main() {
  const password = process.env.WALLET_PASSWORD!;
  const clawnKey = await loadKey('clawn', password);
  const clawnjrKey = await loadKey('clawnjr', password);
  const clawn = privateKeyToAccount(clawnKey);
  const clawnjr = privateKeyToAccount(clawnjrKey);

  const pub = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
  const walletA = createWalletClient({ account: clawn, chain: baseSepolia, transport: http(RPC_URL) });
  const walletB = createWalletClient({ account: clawnjr, chain: baseSepolia, transport: http(RPC_URL) });

  // Register agents (with dedup — find existing by owner address)
  console.log('📝 Finding/registering agents...');
  let idA = 0n, idB = 0n;
  const AGENTS_ABI = [{ type: 'function', name: 'agents', inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ name: 'owner', type: 'address' }, { name: 'eloRating', type: 'uint32' }, { name: 'totalWins', type: 'uint32' }, { name: 'totalLosses', type: 'uint32' }], stateMutability: 'view' }] as const;
  const agentCount = await pub.readContract({ address: ARENA_ADDRESS, abi: ARENA_ABI, functionName: 'agentsCount' }) as bigint;
  for (let i = 1n; i <= agentCount; i++) {
    try {
      const profile = await pub.readContract({ address: ARENA_ADDRESS, abi: AGENTS_ABI, functionName: 'agents', args: [i] }) as [string, number, number, number];
      if (profile[0].toLowerCase() === clawn.address.toLowerCase()) idA = i;
      if (profile[0].toLowerCase() === clawnjr.address.toLowerCase()) idB = i;
      if (idA > 0n && idB > 0n) break;
    } catch {}
  }
  if (idA === 0n) {
    const tx = await walletA.writeContract({ address: ARENA_ADDRESS, abi: ARENA_ABI, functionName: 'registerAgent', chain: baseSepolia, account: clawn });
    await pub.waitForTransactionReceipt({ hash: tx });
    idA = (await pub.readContract({ address: ARENA_ADDRESS, abi: ARENA_ABI, functionName: 'agentsCount' })) as bigint;
  }
  if (idB === 0n) {
    const tx = await walletB.writeContract({ address: ARENA_ADDRESS, abi: ARENA_ABI, functionName: 'registerAgent', chain: baseSepolia, account: clawnjr });
    await pub.waitForTransactionReceipt({ hash: tx });
    idB = (await pub.readContract({ address: ARENA_ADDRESS, abi: ARENA_ABI, functionName: 'agentsCount' })) as bigint;
  }
  console.log(`  Clawn: #${idA}, ClawnJr: #${idB}`);

  // === VARIATION A: Poison word trap ===
  console.log('\n🧪 VARIATION A: Poison Word Trap');
  console.log('   Setting poison word to a very common word that might appear in template...');
  
  // Create battle
  const txA = await walletA.writeContract({ address: ARENA_ADDRESS, abi: ARENA_ABI, functionName: 'createBattle', args: [idA, { stake: 0n, baseTimeoutBlocks: 150, warmupBlocks: 15, targetAgentId: 0n, maxTurns: 12, maxJokers: 2 }], chain: baseSepolia, account: clawn });
  const receiptA = await pub.waitForTransactionReceipt({ hash: txA });
  
  // Parse BattleCreated event to get battleId (topics[1] is indexed battleId)
  const battleCreatedLog = receiptA.logs.find(l => l.topics[0] === '0xe43e00c8f34fe66a7db9a53ad863760ecb108f215b0037f6b021c2690ed575a0');
  const battleIdA = battleCreatedLog ? BigInt(battleCreatedLog.topics[1] ?? '0') : await pub.readContract({ address: ARENA_ADDRESS, abi: ARENA_ABI, functionName: 'battlesCount' }) as bigint;
  
  // Retry to get address
  let addrA: Address = '0x0000000000000000000000000000000000000000';
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 3000));
    addrA = await pub.readContract({ address: ARENA_ADDRESS, abi: ARENA_ABI, functionName: 'battles', args: [battleIdA] }) as Address;
    if (addrA !== '0x0000000000000000000000000000000000000000') break;
  }
  console.log(`  Battle #${battleIdA}: ${addrA}`);

  // Accept
  const txAccA = await walletB.writeContract({ address: addrA, abi: BATTLE_ABI, functionName: 'acceptBattle', args: [idB], value: 0n, chain: baseSepolia, account: clawnjr });
  await pub.waitForTransactionReceipt({ hash: txAccA });
  console.log('  Accepted. Waiting for warmup...');
  await new Promise(r => setTimeout(r, 35_000));

  // Play 2 turns normally, then set a trap poison word
  const vopParams = ('0x' + '00'.repeat(64)) as Hex;
  
  for (let turn = 0; turn < 4; turn++) {
    const [state, currentTurn] = await pub.readContract({ address: addrA, abi: BATTLE_ABI, functionName: 'getBattleState' }) as [number, number, bigint, Hex, bigint];
    if (state !== 1) { console.log(`  Battle ended at turn ${turn}`); break; }
    
    const player = turn % 2 === 0 ? walletA : walletB;
    const playerAcc = turn % 2 === 0 ? clawn : clawnjr;
    
    const targetIdx = await pub.readContract({ address: addrA, abi: BATTLE_ABI, functionName: 'targetWordIndex' }) as number;
    const targetWord = await pub.readContract({ address: WORD_DICTIONARY, abi: WORD_ABI, functionName: 'word', args: [targetIdx] }) as string;
    
    // Try to find a poison word that would appear in our template
    // "meaning", "scholar", "ancient" — try to find their index
    // For now, just use a word index that we know is in our template
    // Our template: "In the grand library of the ancient citadel a scholar studied the meaning of"
    // Words like "ancient", "grand", "library" might be in BIP39
    let poisonIdx = 59; // "ancient" = BIP39 index ~59
    
    const narrative = makeNarrative(targetWord);
    
    console.log(`  Turn ${turn}: target="${targetWord}", poison_set=${poisonIdx}, template has "ancient"=${narrative.includes('ancient')}`);
    
    try {
      const tx = await player.writeContract({
        address: addrA, abi: BATTLE_ABI, functionName: 'submitTurn',
        args: [{ solution: 0n, narrative, nextVopParams: vopParams, poisonWordIndex: poisonIdx }],
        chain: baseSepolia, account: playerAcc,
      });
      const r = await pub.waitForTransactionReceipt({ hash: tx });
      console.log(`  ✅ Turn ${turn} (gas: ${r.gasUsed})`);
    } catch (e: any) {
      console.log(`  ❌ Turn ${turn} FAILED: ${e.message?.substring(0, 150)}`);
      break;
    }
    await new Promise(r => setTimeout(r, 3000));
  }

  // Check if "ancient" is actually BIP39 index 59
  const word59 = await pub.readContract({ address: WORD_DICTIONARY, abi: WORD_ABI, functionName: 'word', args: [59] }) as string;
  console.log(`\n  📝 BIP39 word at index 59: "${word59}"`);
  console.log('  (Need to find if "ancient" or "library" or "grand" are in the BIP39 wordlist)');
  
  // Search for our template words in BIP39
  const templateWords = ['ancient', 'library', 'grand', 'citadel', 'scholar', 'meaning', 'wisdom'];
  for (const tw of templateWords) {
    // Linear search is expensive but it's testnet
    for (let i = 0; i < 2048; i++) {
      const w = await pub.readContract({ address: WORD_DICTIONARY, abi: WORD_ABI, functionName: 'word', args: [i] }) as string;
      if (w === tw) {
        console.log(`  🎯 "${tw}" IS in BIP39 at index ${i} — EXPLOITABLE as poison word!`);
        break;
      }
      if (i === 2047) {
        console.log(`  ✅ "${tw}" is NOT in BIP39 wordlist — safe in templates`);
      }
    }
  }

  console.log('\n✨ Variation tests complete!');
}

main().catch(e => { console.error('💀', e.message); process.exit(1); });
