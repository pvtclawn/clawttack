#!/usr/bin/env bun
/**
 * scripts/test-poison-boundary.ts — Verify the P0 poison boundary fix on-chain
 * 
 * Tests that:
 * 1. A narrative containing poison word as SUBSTRING of another word → ACCEPTED
 * 2. A narrative containing poison word as STANDALONE word → REJECTED
 * 
 * Usage: WALLET_PASSWORD=xxx bun scripts/test-poison-boundary.ts
 */

import { createPublicClient, createWalletClient, http, type Hex, type Address, encodeFunctionData, decodeFunctionResult } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const ARENA_ADDRESS = '0x6045d9b8Ab1583AD4cEb600c0E8d515E9922d2eB' as Address;
const WORD_DICTIONARY = '0xa5bAC96F55e46563D0B0b57694E7Ac7Bc7DA25eC' as Address;
const RPC_URL = 'https://sepolia.base.org';

const ARENA_ABI = [
  { name: 'createBattle', type: 'function', stateMutability: 'payable',
    inputs: [{ name: 'challengerId', type: 'uint256' }, { name: 'config', type: 'tuple', components: [
      { name: 'stake', type: 'uint256' }, { name: 'baseTimeoutBlocks', type: 'uint32' },
      { name: 'warmupBlocks', type: 'uint32' }, { name: 'targetAgentId', type: 'uint256' },
      { name: 'maxTurns', type: 'uint8' }, { name: 'maxJokers', type: 'uint8' }
    ]}],
    outputs: [{ name: 'battleAddress', type: 'address' }] },
  { name: 'battlesCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
] as const;

const BATTLE_ABI = [
  { name: 'acceptBattle', type: 'function', stateMutability: 'payable', inputs: [{ name: '_acceptorId', type: 'uint256' }], outputs: [] },
  { name: 'targetWordIndex', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint16' }] },
  { name: 'poisonWordIndex', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint16' }] },
  { name: 'currentTurn', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint32' }] },
  { name: 'firstMoverA', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
  { name: 'wouldNarrativePass', type: 'function', stateMutability: 'view',
    inputs: [
      { name: 'narrative', type: 'string' }, { name: '_targetWordIndex', type: 'uint16' },
      { name: '_poisonWordIndex', type: 'uint16' }, { name: 'isTurnZero', type: 'bool' }
    ],
    outputs: [
      { name: 'passesTarget', type: 'bool' }, { name: 'passesPoison', type: 'bool' },
      { name: 'passesLength', type: 'bool' }, { name: 'passesAscii', type: 'bool' }
    ] },
  { name: 'submitTurn', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'payload', type: 'tuple', components: [
      { name: 'solution', type: 'uint256' }, { name: 'narrative', type: 'string' },
      { name: 'nextVopParams', type: 'bytes' }, { name: 'poisonWordIndex', type: 'uint16' }
    ]}], outputs: [] },
] as const;

const WORD_ABI = [
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

async function main() {
  const password = process.env.WALLET_PASSWORD;
  if (!password) throw new Error('WALLET_PASSWORD required');

  const [clawnKey, clawnjrKey] = await Promise.all([
    loadKeystoreKey('clawn', password),
    loadKeystoreKey('clawnjr', password),
  ]);

  const clawnAccount = privateKeyToAccount(clawnKey);
  const clawnjrAccount = privateKeyToAccount(clawnjrKey);

  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
  const clawnWallet = createWalletClient({ account: clawnAccount, chain: baseSepolia, transport: http(RPC_URL) });
  const clawnjrWallet = createWalletClient({ account: clawnjrAccount, chain: baseSepolia, transport: http(RPC_URL) });

  const CLAWN_AGENT_ID = 1n;
  const CLAWNJR_AGENT_ID = 2n;

  console.log('=== POISON BOUNDARY FIX VERIFICATION ===\n');

  // 1. Create a battle
  console.log('1. Creating battle...');
  const config = {
    stake: 0n,
    baseTimeoutBlocks: 150,
    warmupBlocks: 15,
    targetAgentId: CLAWNJR_AGENT_ID,
    maxTurns: 12,
    maxJokers: 0,
  };

  const battleTx = await clawnWallet.writeContract({
    address: ARENA_ADDRESS,
    abi: ARENA_ABI,
    functionName: 'createBattle',
    args: [CLAWN_AGENT_ID, config],
    value: 0n,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: battleTx });

  // Wait for indexing to catch up
  console.log('   Waiting for indexing (5s)...');
  await new Promise(r => setTimeout(r, 5000));

  // Get battle count AFTER tx
  const battleCount = await publicClient.readContract({
    address: ARENA_ADDRESS,
    abi: ARENA_ABI,
    functionName: 'battlesCount',
  });
  console.log(`   Battle #${battleCount} created. TX: ${battleTx}`);

  // Read battle address from Arena.battles(battleCount)
  const battleAddress = await publicClient.readContract({
    address: ARENA_ADDRESS,
    abi: [{ name: 'battles', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] }] as const,
    functionName: 'battles',
    args: [battleCount],
  }) as Address;
  console.log(`   Battle address: ${battleAddress}`);

  // 2. Accept battle
  console.log('2. Accepting battle...');
  const acceptTx = await clawnjrWallet.writeContract({
    address: battleAddress,
    abi: BATTLE_ABI,
    functionName: 'acceptBattle',
    args: [CLAWNJR_AGENT_ID],
    value: 0n,
  });
  await publicClient.waitForTransactionReceipt({ hash: acceptTx });
  console.log('   Accepted.');

  // Wait a bit for indexing
  await new Promise(r => setTimeout(r, 4000));

  // 3. Get target word for Turn 0 — read at latest block to avoid stale data
  const latestBlock = await publicClient.getBlockNumber();
  const targetIdx = await publicClient.readContract({ 
    address: battleAddress, abi: BATTLE_ABI, functionName: 'targetWordIndex',
    blockNumber: latestBlock,
  });
  const targetWord = await publicClient.readContract({ address: WORD_DICTIONARY, abi: WORD_ABI, functionName: 'word', args: [targetIdx] });
  const firstMoverA = await publicClient.readContract({ address: battleAddress, abi: BATTLE_ABI, functionName: 'firstMoverA' });
  console.log(`\n   Target word: "${targetWord}" (index ${targetIdx})`);
  console.log(`   First mover: ${firstMoverA ? 'Clawn (A)' : 'ClawnJr (B)'}`);

  // 4. Wait for warmup (15 blocks × 2s = 30s, add buffer)
  console.log('\n3. Waiting for warmup period (45s)...');
  await new Promise(r => setTimeout(r, 45000));

  // 5. TEST: Narrative with poison as substring (should PASS with fix)
  // Pick a short poison word — use index 0 which is likely "abandon" (3+ chars)
  // Actually, let's use the target word itself as something we embed as substring
  // For the real test: we need Turn 1+ to have poison. Turn 0 has no poison.
  
  // Submit Turn 0 (no poison on turn 0)
  const firstMoverWallet = firstMoverA ? clawnWallet : clawnjrWallet;
  const secondMoverWallet = firstMoverA ? clawnjrWallet : clawnWallet;

  const narrative0 = `The study of ${targetWord} reveals deep patterns in the fabric of language and meaning that scholars have explored through centuries of careful analysis and research work.`;
  console.log(`\n4. Turn 0 (no poison): submitting narrative with "${targetWord}"...`);

  // Set poison to a VERY common short word — we pick "an" (BIP39 index ~63)
  // First find the index of "an" or similar short word
  let poisonIdx = 63; // approximate; let's verify
  const poisonWord = await publicClient.readContract({ address: WORD_DICTIONARY, abi: WORD_ABI, functionName: 'word', args: [poisonIdx] });
  console.log(`   Setting next poison word: "${poisonWord}" (index ${poisonIdx})`);

  const nextVopParams = '0x' + '00'.repeat(32) + '00'.repeat(31) + '01' as Hex; // 64 bytes

  const turnTx0 = await firstMoverWallet.writeContract({
    address: battleAddress,
    abi: BATTLE_ABI,
    functionName: 'submitTurn',
    args: [{ narrative: narrative0, solution: 0n, nextVopParams, poisonWordIndex: poisonIdx }],
  });
  const r0 = await publicClient.waitForTransactionReceipt({ hash: turnTx0 });
  console.log(`   Turn 0 ${r0.status === 'success' ? '✅' : '❌'} gas: ${r0.gasUsed}`);

  // 6. Turn 1 — now poison is active. Get new target at latest block.
  const latestBlock1 = await publicClient.getBlockNumber();
  const targetIdx1 = await publicClient.readContract({ address: battleAddress, abi: BATTLE_ABI, functionName: 'targetWordIndex', blockNumber: latestBlock1 });
  const targetWord1 = await publicClient.readContract({ address: WORD_DICTIONARY, abi: WORD_ABI, functionName: 'word', args: [targetIdx1] });
  const poisonIdx1 = await publicClient.readContract({ address: battleAddress, abi: BATTLE_ABI, functionName: 'poisonWordIndex', blockNumber: latestBlock1 });
  const poisonWord1 = await publicClient.readContract({ address: WORD_DICTIONARY, abi: WORD_ABI, functionName: 'word', args: [poisonIdx1] });
  console.log(`\n5. Turn 1 — target: "${targetWord1}", poison: "${poisonWord1}"`);

  // TEST A: Narrative containing poison as SUBSTRING of longer words (should PASS)
  // E.g., if poison is "ant", use "pleasant" / "elephant"
  const narrativeSubstring = `The meaning of ${targetWord1} was explored through pl${poisonWord1}iful and abund${poisonWord1}ly detailed manuscripts that covered every aspect of the subject with remarkable depth and scholarly precision.`;
  
  console.log(`\n   TEST A: Poison "${poisonWord1}" as SUBSTRING in other words`);
  console.log(`   Narrative: "${narrativeSubstring.slice(0, 80)}..."`);

  // Use wouldNarrativePass to check first
  const [passT_A, passP_A, passL_A, passASCII_A] = await publicClient.readContract({
    address: battleAddress,
    abi: BATTLE_ABI,
    functionName: 'wouldNarrativePass',
    args: [narrativeSubstring, targetIdx1, poisonIdx1, false],
  });
  console.log(`   wouldPass: target=${passT_A} poison=${passP_A} length=${passL_A} ascii=${passASCII_A}`);

  if (passP_A) {
    console.log(`   ✅ PASS: Poison "${poisonWord1}" as substring correctly ignored (boundary fix works!)`);
  } else {
    console.log(`   ❌ FAIL: Poison "${poisonWord1}" as substring was DETECTED (fix may not be active)`);
  }

  // TEST B: Narrative containing poison as STANDALONE word (should FAIL)
  const narrativeStandalone = `The meaning of ${targetWord1} was explored through ${poisonWord1} detailed manuscripts that covered every aspect of the subject with remarkable depth and scholarly precision throughout the ages.`;
  
  console.log(`\n   TEST B: Poison "${poisonWord1}" as STANDALONE word`);
  console.log(`   Narrative: "${narrativeStandalone.slice(0, 80)}..."`);

  const [passT_B, passP_B, passL_B, passASCII_B] = await publicClient.readContract({
    address: battleAddress,
    abi: BATTLE_ABI,
    functionName: 'wouldNarrativePass',
    args: [narrativeStandalone, targetIdx1, poisonIdx1, false],
  });
  console.log(`   wouldPass: target=${passT_B} poison=${passP_B} length=${passL_B} ascii=${passASCII_B}`);

  if (!passP_B) {
    console.log(`   ✅ PASS: Poison "${poisonWord1}" as standalone correctly DETECTED`);
  } else {
    console.log(`   ❌ FAIL: Poison "${poisonWord1}" as standalone was MISSED`);
  }

  // Submit Turn 1 with the substring narrative (should succeed)
  if (passT_A && passP_A && passL_A && passASCII_A) {
    console.log(`\n6. Submitting Turn 1 with substring narrative (should succeed)...`);
    try {
      const turnTx1 = await secondMoverWallet.writeContract({
        address: battleAddress,
        abi: BATTLE_ABI,
        functionName: 'submitTurn',
        args: [{ narrative: narrativeSubstring, solution: 0n, nextVopParams, poisonWordIndex: 0 }],
      });
      const r1 = await publicClient.waitForTransactionReceipt({ hash: turnTx1 });
      console.log(`   Turn 1 ${r1.status === 'success' ? '✅' : '❌'} gas: ${r1.gasUsed}`);
      if (r1.status === 'success') {
        console.log('\n🎉 POISON BOUNDARY FIX VERIFIED ON-CHAIN!');
      }
    } catch (e: any) {
      console.log(`   ❌ Turn 1 failed: ${e.message?.slice(0, 200)}`);
    }
  } else {
    console.log(`\n⚠️ Skipping Turn 1 submission — wouldPass check failed`);
  }

  console.log('\n=== TEST COMPLETE ===');
}

main().catch(console.error);
