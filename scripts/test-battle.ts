#!/usr/bin/env bun
/**
 * scripts/test-battle.ts — Run a test battle between clawn and clawnjr on Base Sepolia
 * 
 * Fixed: proper state reads after each turn, explicit block-anchored reads,
 * word verification before submission
 * 
 * Usage: WALLET_PASSWORD=xxx bun scripts/test-battle.ts
 */

import { createPublicClient, createWalletClient, http, type Hex, type Address } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { ArenaClient, BattleClient } from '../packages/protocol/src/index';
import { CLAWTTACK_BATTLE_ABI } from '../packages/protocol/src/abi';

const ARENA_ADDRESS = '0x20ea35CE95a47d2A56451190a306431945413c67' as Address;
const WORD_DICTIONARY = '0x9F305eD62cfFC68422d4eACF580b4B571D483596' as Address;
const RPC_URL = 'https://sepolia.base.org';

const WORD_DICTIONARY_ABI = [
  { name: 'word', type: 'function', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint16' }], outputs: [{ name: '', type: 'string' }] },
  { name: 'wordCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint16' }] },
] as const;

async function loadKeystoreKey(name: string, password: string): Promise<Hex> {
  const proc = Bun.spawn([
    `${process.env.HOME}/.foundry/bin/cast`, 'wallet', 'decrypt-keystore', name,
    '--unsafe-password', password
  ], { stdout: 'pipe', stderr: 'pipe' });
  
  const stdout = await new Response(proc.stdout).text();
  await proc.exited;
  
  const match = stdout.match(/0x[0-9a-fA-F]{64}/);
  if (!match) throw new Error(`No private key found in output for ${name}`);
  return match[0] as Hex;
}

function generateNarrative(targetWord: string, poisonWord: string): string {
  // Craft a narrative that DEFINITELY contains the target word with proper word boundaries
  // LinguisticParser needs: isLetter(char before) = false AND isLetter(char after) = false
  const parts = [
    `In the grand library of the ancient citadel a scholar studied the meaning of`,
    targetWord,
    `and found it held secrets that transformed the understanding of every reader who encountered its wisdom throughout the ages of civilization`,
  ];
  let narrative = parts.join(' ');
  
  // Ensure >= 64 chars (MIN_NARRATIVE_LEN)
  while (narrative.length < 64) {
    narrative += ' and the tale continued onward through the passage of time';
  }
  
  // Ensure <= 256 chars (MAX_NARRATIVE_LEN)
  if (narrative.length > 256) {
    // Truncate but keep the target word (it's near the beginning)
    narrative = narrative.substring(0, 250);
    // Make sure we end cleanly (not mid-word)
    const lastSpace = narrative.lastIndexOf(' ');
    if (lastSpace > 100) narrative = narrative.substring(0, lastSpace);
  }
  
  // Safety: check for poison word
  if (poisonWord && narrative.toLowerCase().includes(poisonWord.toLowerCase())) {
    // Replace poison occurrences that aren't the target word
    const regex = new RegExp(`\\b${poisonWord}\\b`, 'gi');
    narrative = narrative.replace(regex, (match) => {
      // Don't replace if it IS the target word
      if (match.toLowerCase() === targetWord.toLowerCase()) return match;
      return 'enigma';
    });
  }
  
  return narrative;
}

/** Verify a narrative would pass the on-chain linguistic checks */
function verifyNarrativeLocally(narrative: string, targetWord: string, poisonWord: string): { 
  passesTarget: boolean; passesPoison: boolean; passesLength: boolean; passesAscii: boolean 
} {
  const n = narrative;
  const t = targetWord.toLowerCase();
  const p = poisonWord.toLowerCase();
  
  let passesAscii = true;
  for (let i = 0; i < n.length; i++) {
    if (n.charCodeAt(i) > 127) { passesAscii = false; break; }
  }
  
  const passesLength = n.length >= 64 && n.length <= 1024;
  
  // Word boundary check (mirrors LinguisticParser)
  const isLetter = (c: string) => (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');
  
  let passesTarget = false;
  const nLower = n.toLowerCase();
  let searchFrom = 0;
  while (true) {
    const idx = nLower.indexOf(t, searchFrom);
    if (idx === -1) break;
    const startBoundary = idx === 0 || !isLetter(n[idx - 1]);
    const endBoundary = (idx + t.length === n.length) || !isLetter(n[idx + t.length]);
    if (startBoundary && endBoundary) {
      passesTarget = true;
      break;
    }
    searchFrom = idx + 1;
  }
  
  let passesPoison = true;
  if (p.length > 0) {
    let searchFrom2 = 0;
    while (true) {
      const idx = nLower.indexOf(p, searchFrom2);
      if (idx === -1) break;
      // Poison doesn't require boundary check in the contract — it's substring match
      passesPoison = false;
      break;
    }
  }
  
  return { passesTarget, passesPoison, passesLength, passesAscii };
}

async function main() {
  const password = process.env.WALLET_PASSWORD;
  if (!password) throw new Error('Set WALLET_PASSWORD env var');

  console.log('🔑 Loading keystores...');
  const clawnKey = await loadKeystoreKey('clawn', password);
  const clawnjrKey = await loadKeystoreKey('clawnjr', password);

  const clawnAccount = privateKeyToAccount(clawnKey);
  const clawnjrAccount = privateKeyToAccount(clawnjrKey);

  console.log(`  Clawn:   ${clawnAccount.address}`);
  console.log(`  ClawnJr: ${clawnjrAccount.address}`);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL),
  });

  const clawnWallet = createWalletClient({
    account: clawnAccount,
    chain: baseSepolia,
    transport: http(RPC_URL),
  });

  const clawnjrWallet = createWalletClient({
    account: clawnjrAccount,
    chain: baseSepolia,
    transport: http(RPC_URL),
  });

  // --- 1. Register both agents ---
  const arena = new ArenaClient({
    publicClient,
    walletClient: clawnWallet,
    contractAddress: ARENA_ADDRESS,
  });

  const arenaJr = new ArenaClient({
    publicClient,
    walletClient: clawnjrWallet,
    contractAddress: ARENA_ADDRESS,
  });

  console.log('\n📝 Registering agents...');
  let clawnId: bigint, clawnjrId: bigint;
  try {
    clawnId = await arena.registerAgent();
    console.log(`  ✅ Clawn registered: agentId=${clawnId}`);
  } catch (e: any) {
    // Already registered — look up by checking recent events or use known ID
    console.log(`  ⚠️  Clawn already registered`);
    clawnId = 1n; // Will be overwritten if we find it
    // Try to get the actual agent count to figure out our ID
    try {
      const stats = await arena.getGlobalStats();
      console.log(`     (${stats.agentsCount} agents registered total)`);
    } catch {}
  }
  
  try {
    clawnjrId = await arenaJr.registerAgent();
    console.log(`  ✅ ClawnJr registered: agentId=${clawnjrId}`);
  } catch (e: any) {
    console.log(`  ⚠️  ClawnJr already registered`);
    clawnjrId = 2n;
  }

  // --- 2. Create a battle ---
  console.log('\n⚔️ Creating battle...');
  const MAX_TURNS = 10;  // Contract minimum is 10
  const { battleId, battleAddress, txHash } = await arena.createBattle(clawnId, {
    stake: 0n,
    maxTurns: MAX_TURNS,
    maxJokers: 1,
    baseTimeoutBlocks: 150,  // ~5 min on Base
    warmupBlocks: 5,         // Contract minimum is 5
    targetAgentId: 0n,
  });
  console.log(`  ✅ Battle created: id=${battleId}, address=${battleAddress}`);
  console.log(`  📜 tx: ${txHash}`);

  // --- 3. ClawnJr accepts ---
  console.log('\n🤝 ClawnJr accepting battle...');
  const battleJr = new BattleClient({
    publicClient,
    walletClient: clawnjrWallet,
    battleAddress,
  });
  const acceptTx = await battleJr.acceptBattle(clawnjrId, 0n);
  console.log(`  ✅ Battle accepted: ${acceptTx}`);
  await publicClient.waitForTransactionReceipt({ hash: acceptTx });

  // Wait for warmup (3 blocks * 2s + generous buffer)
  console.log('  ⏳ Waiting for warmup period...');
  await new Promise(r => setTimeout(r, 10_000));

  // --- 4. Get initial state ---
  const battle = arena.attach(battleAddress);
  const initState = await battle.getState();
  console.log(`\n📊 Battle State: phase=${initState.phase}, turn=${initState.currentTurn}`);

  if (initState.phase !== 1) {
    console.log(`  ❌ Battle not active! Waiting more...`);
    await new Promise(r => setTimeout(r, 10_000));
    const retryState = await battle.getState();
    console.log(`  Retry: phase=${retryState.phase}`);
    if (retryState.phase !== 1) {
      console.log('  ❌ Battle still not active, aborting');
      process.exit(1);
    }
  }

  const firstMover = await battle.whoseTurn();
  const isClawnFirst = firstMover.toLowerCase() === clawnAccount.address.toLowerCase();
  console.log(`  First mover: ${isClawnFirst ? 'Clawn' : 'ClawnJr'}`);

  const players = isClawnFirst 
    ? [
        { name: 'Clawn', client: battle, wallet: clawnWallet },
        { name: 'ClawnJr', client: battleJr, wallet: clawnjrWallet }
      ]
    : [
        { name: 'ClawnJr', client: battleJr, wallet: clawnjrWallet },
        { name: 'Clawn', client: battle, wallet: clawnWallet }
      ];

  // --- 5. Play turns ---
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const player = players[turn % 2];
    
    // CRITICAL: Read state at a specific block to avoid stale reads
    const latestBlock = await publicClient.getBlockNumber();
    
    // Read current target word and poison word from the battle contract
    const [targetWordIdx, poisonWordIdx] = await Promise.all([
      publicClient.readContract({
        address: battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'targetWordIndex',
        blockNumber: latestBlock,
      }) as Promise<number>,
      publicClient.readContract({
        address: battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'poisonWordIndex',
        blockNumber: latestBlock,
      }) as Promise<number>,
    ]);

    const [targetWord, poisonWord] = await Promise.all([
      publicClient.readContract({
        address: WORD_DICTIONARY,
        abi: WORD_DICTIONARY_ABI,
        functionName: 'word',
        args: [targetWordIdx],
      }),
      turn > 0 ? publicClient.readContract({
        address: WORD_DICTIONARY,
        abi: WORD_DICTIONARY_ABI,
        functionName: 'word',
        args: [poisonWordIdx],
      }) : Promise.resolve(''),
    ]);

    // Generate narrative
    const narrative = generateNarrative(targetWord as string, (poisonWord || '') as string);
    
    // Verify LOCALLY before sending on-chain
    const check = verifyNarrativeLocally(narrative, targetWord as string, (poisonWord || '') as string);
    
    console.log(`\n⚔️ Turn ${turn}: ${player.name}`);
    console.log(`   Target: "${targetWord}" (idx=${targetWordIdx}) | Poison: "${poisonWord || 'none'}" (idx=${poisonWordIdx})`);
    console.log(`   Block: ${latestBlock}`);
    console.log(`   Narrative (${narrative.length} chars): "${narrative.substring(0, 80)}..."`);
    console.log(`   Local check: target=${check.passesTarget} poison=${check.passesPoison} len=${check.passesLength} ascii=${check.passesAscii}`);
    
    if (!check.passesTarget) {
      console.log(`   ❌ SKIPPING: target word "${targetWord}" not found in narrative!`);
      console.log(`   Full narrative: "${narrative}"`);
      break;
    }
    if (!check.passesPoison) {
      console.log(`   ❌ SKIPPING: poison word "${poisonWord}" found in narrative!`);
      break;
    }

    // VOP: HashPreimage with trivial params (salt=0, bits=0 = any solution works)
    // Must be properly ABI-encoded: abi.encode(bytes32 salt, uint8 leadingZeroBits)
    // = 32 bytes of zeros (salt) + 31 bytes padding + 1 byte zero (uint8 = 0)
    const nextVopParams = ('0x' + '00'.repeat(64)) as Hex;  // 64 bytes = proper ABI encoding
    
    // Pick a poison word for the opponent (random-ish, avoid target)
    let nextPoisonIndex = ((turn + 7) * 137 + 42) % 2048;
    if (nextPoisonIndex === targetWordIdx) nextPoisonIndex = (nextPoisonIndex + 1) % 2048;

    try {
      const turnTx = await player.client.submitTurn({
        solution: 0n,
        narrative,
        nextVopParams,
        poisonWordIndex: nextPoisonIndex,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: turnTx });
      console.log(`  ✅ Turn ${turn} submitted (block ${receipt.blockNumber})`);
      
      // Wait for state propagation (at least 1 block)
      await new Promise(r => setTimeout(r, 4000));
      
      const newState = await battle.getState();
      console.log(`     State: turn=${newState.currentTurn}, phase=${newState.phase}`);
      
      if (newState.phase !== 1) {
        const phaseNames = ['Open', 'Active', 'Settled', 'Cancelled'];
        console.log(`  🏁 Battle ended! Phase: ${phaseNames[newState.phase] || newState.phase}`);
        break;
      }
    } catch (e: any) {
      const msg = e.message?.substring(0, 300) || String(e);
      console.log(`  ❌ Turn failed: ${msg}`);
      break;
    }
  }

  // --- 6. Final state ---
  const finalState = await battle.getState();
  const phaseNames = ['Open', 'Active', 'Settled', 'Cancelled'];
  console.log(`\n🏁 Final: phase=${phaseNames[finalState.phase] || finalState.phase}, turns=${finalState.currentTurn}`);
  console.log(`   Sequence Hash: ${finalState.lastHash}`);
  console.log(`\n✨ Test battle complete!`);
  console.log(`   Arena: ${ARENA_ADDRESS}`);
  console.log(`   Battle: ${battleAddress}`);
}

main().catch(e => {
  console.error('💀 Fatal:', e.message);
  process.exit(1);
});
