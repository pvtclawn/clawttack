#!/usr/bin/env bun
/**
 * scripts/test-timeout-win.ts — Test timeout win + Elo update
 * 
 * 1. Create rated battle (0.001 ETH stake)
 * 2. Play a few turns normally
 * 3. One player stops submitting
 * 4. Wait for timeout
 * 5. Other player claims timeout win
 * 6. Verify Elo changed
 */

import { createPublicClient, createWalletClient, http, type Hex, type Address } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const ARENA = '0x6045d9b8Ab1583AD4cEb600c0E8d515E9922d2eB' as Address;
const WORDS = '0xa5bAC96F55e46563D0B0b57694E7Ac7Bc7DA25eC' as Address;
const RPC = 'https://sepolia.base.org';

const ARENA_ABI = [
  { type: 'function', name: 'agentsCount', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'agents', inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ name: 'owner', type: 'address' }, { name: 'eloRating', type: 'uint32' }, { name: 'totalWins', type: 'uint32' }, { name: 'totalLosses', type: 'uint32' }], stateMutability: 'view' },
  { type: 'function', name: 'createBattle', inputs: [{ name: 'challengerId', type: 'uint256' }, { name: 'config', type: 'tuple', components: [{ name: 'stake', type: 'uint256' }, { name: 'baseTimeoutBlocks', type: 'uint32' }, { name: 'warmupBlocks', type: 'uint32' }, { name: 'targetAgentId', type: 'uint256' }, { name: 'maxTurns', type: 'uint8' }, { name: 'maxJokers', type: 'uint8' }] }], outputs: [{ type: 'uint256' }], stateMutability: 'payable' },
  { type: 'function', name: 'battles', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'event', name: 'BattleCreated', inputs: [{ name: 'battleId', type: 'uint256', indexed: true }, { name: 'challengerId', type: 'uint256', indexed: true }, { name: 'stake', type: 'uint256' }, { name: 'baseTimeoutBlocks', type: 'uint32' }, { name: 'maxTurns', type: 'uint8' }] },
] as const;

const BATTLE_ABI = [
  { type: 'function', name: 'acceptBattle', inputs: [{ name: 'acceptorId', type: 'uint256' }], outputs: [], stateMutability: 'payable' },
  { type: 'function', name: 'submitTurn', inputs: [{ name: 'payload', type: 'tuple', components: [{ name: 'solution', type: 'uint256' }, { name: 'narrative', type: 'string' }, { name: 'nextVopParams', type: 'bytes' }, { name: 'poisonWordIndex', type: 'uint16' }] }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'getBattleState', inputs: [], outputs: [{ type: 'uint8' }, { type: 'uint32' }, { type: 'uint64' }, { type: 'bytes32' }, { type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'targetWordIndex', inputs: [], outputs: [{ type: 'uint16' }], stateMutability: 'view' },
  { type: 'function', name: 'poisonWordIndex', inputs: [], outputs: [{ type: 'uint16' }], stateMutability: 'view' },
  { type: 'function', name: 'firstMoverA', inputs: [], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  { type: 'function', name: 'claimTimeoutWin', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'config', inputs: [], outputs: [{ name: 'stake', type: 'uint256' }, { name: 'baseTimeoutBlocks', type: 'uint32' }, { name: 'warmupBlocks', type: 'uint32' }, { name: 'targetAgentId', type: 'uint256' }, { name: 'maxTurns', type: 'uint8' }, { name: 'maxJokers', type: 'uint8' }], stateMutability: 'view' },
] as const;

const WORD_ABI = [
  { type: 'function', name: 'word', inputs: [{ name: 'index', type: 'uint16' }], outputs: [{ type: 'string' }], stateMutability: 'view' },
] as const;

async function loadKey(name: string, password: string): Promise<Hex> {
  const proc = Bun.spawn([
    `${process.env.HOME}/.foundry/bin/cast`, 'wallet', 'decrypt-keystore', name,
    '--unsafe-password', password
  ], { stdout: 'pipe', stderr: 'pipe' });
  const stdout = await new Response(proc.stdout).text();
  await proc.exited;
  const match = stdout.match(/0x[0-9a-fA-F]{64}/);
  if (!match) throw new Error(`No key for ${name}`);
  return match[0] as Hex;
}

async function main() {
  const pw = process.env.WALLET_PASSWORD!;
  const clawnAcc = privateKeyToAccount(await loadKey('clawn', pw));
  const jrAcc = privateKeyToAccount(await loadKey('clawnjr', pw));

  const pub = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
  const clawnW = createWalletClient({ account: clawnAcc, chain: baseSepolia, transport: http(RPC) });
  const jrW = createWalletClient({ account: jrAcc, chain: baseSepolia, transport: http(RPC) });

  // Find agents
  let clawnId = 0n, jrId = 0n;
  const count = await pub.readContract({ address: ARENA, abi: ARENA_ABI, functionName: 'agentsCount' }) as bigint;
  for (let i = 1n; i <= count; i++) {
    const [owner] = await pub.readContract({ address: ARENA, abi: ARENA_ABI, functionName: 'agents', args: [i] }) as [string, number, number, number];
    if (owner.toLowerCase() === clawnAcc.address.toLowerCase()) clawnId = i;
    if (owner.toLowerCase() === jrAcc.address.toLowerCase()) jrId = i;
    if (clawnId && jrId) break;
  }
  console.log(`Clawn: #${clawnId}, ClawnJr: #${jrId}`);

  // Pre-battle Elo
  const [, eloPre1, w1, l1] = await pub.readContract({ address: ARENA, abi: ARENA_ABI, functionName: 'agents', args: [clawnId] }) as [string, number, number, number];
  const [, eloPre2, w2, l2] = await pub.readContract({ address: ARENA, abi: ARENA_ABI, functionName: 'agents', args: [jrId] }) as [string, number, number, number];
  console.log(`\nPre-battle Elo:`);
  console.log(`  Clawn:   ${eloPre1} (W=${w1}, L=${l1})`);
  console.log(`  ClawnJr: ${eloPre2} (W=${w2}, L=${l2})`);

  // Create RATED battle with SHORT timeout (25 blocks = ~50s)
  const STAKE = 1000000000000000n; // 0.001 ETH
  const TIMEOUT_BLOCKS = 25; // MIN_TIMEOUT = 25 in v3.1

  console.log(`\n⏱️ TIMEOUT WIN TEST`);
  console.log(`  Stake: ${Number(STAKE)/1e18} ETH each`);
  console.log(`  Timeout: ${TIMEOUT_BLOCKS} blocks (~${TIMEOUT_BLOCKS * 2}s)`);

  const createTx = await clawnW.writeContract({
    address: ARENA, abi: ARENA_ABI, functionName: 'createBattle',
    args: [clawnId, { stake: STAKE, baseTimeoutBlocks: TIMEOUT_BLOCKS, warmupBlocks: 15, targetAgentId: 0n, maxTurns: 12, maxJokers: 2 }],
    chain: baseSepolia, account: clawnAcc, value: STAKE,
  });
  const receipt = await pub.waitForTransactionReceipt({ hash: createTx });
  const createdLog = receipt.logs.find(l => l.topics[0] === '0xe43e00c8f34fe66a7db9a53ad863760ecb108f215b0037f6b021c2690ed575a0');
  const battleId = BigInt(createdLog?.topics[1] ?? '0');
  
  await new Promise(r => setTimeout(r, 3000));
  const battleAddr = await pub.readContract({ address: ARENA, abi: ARENA_ABI, functionName: 'battles', args: [battleId] }) as Address;
  console.log(`  Battle #${battleId}: ${battleAddr}`);

  // ClawnJr accepts
  const acceptTx = await jrW.writeContract({
    address: battleAddr, abi: BATTLE_ABI, functionName: 'acceptBattle',
    args: [jrId], value: STAKE, chain: baseSepolia, account: jrAcc,
  });
  await pub.waitForTransactionReceipt({ hash: acceptTx });
  console.log(`  Accepted. Waiting for warmup (35s)...`);
  await new Promise(r => setTimeout(r, 35_000));

  const firstMoverA = await pub.readContract({ address: battleAddr, abi: BATTLE_ABI, functionName: 'firstMoverA' }) as boolean;
  console.log(`  First mover: ${firstMoverA ? 'Clawn' : 'ClawnJr'}`);

  // Play 2 turns normally, then STOP
  for (let t = 0; t < 2; t++) {
    const [phase] = await pub.readContract({ address: battleAddr, abi: BATTLE_ABI, functionName: 'getBattleState' }) as [number, number, bigint, string, bigint];
    if (phase !== 1) break;

    const isClawn = firstMoverA ? (t % 2 === 0) : (t % 2 === 1);
    const wallet = isClawn ? clawnW : jrW;
    const account = isClawn ? clawnAcc : jrAcc;

    const targetIdx = await pub.readContract({ address: battleAddr, abi: BATTLE_ABI, functionName: 'targetWordIndex' }) as number;
    const targetWord = await pub.readContract({ address: WORDS, abi: WORD_ABI, functionName: 'word', args: [targetIdx] }) as string;

    // Use the same template as test-battle.ts (contains "ancient" — risky but known working)
    const narrative = `In the grand library of the ancient citadel a scholar studied the meaning of ${targetWord} and found that understanding reveals itself through patience and careful observation of all things around us every single day without fail or hesitation even in difficult times and complex situations`;
    
    console.log(`\n  Turn ${t}: ${isClawn ? 'Clawn' : 'ClawnJr'} | target="${targetWord}" (#${targetIdx}) | len=${narrative.length}`);
    console.log(`  Contains target: ${narrative.includes(targetWord)}`);
    
    const nextVopParams = ('0x' + '00'.repeat(64)) as Hex;
    const nextPoison = ((t * 137 + 500) % 2048);

    try {
      const tx = await wallet.writeContract({
        address: battleAddr, abi: BATTLE_ABI, functionName: 'submitTurn',
        args: [{ solution: 0n, narrative, nextVopParams, poisonWordIndex: nextPoison }],
        chain: baseSepolia, account,
      });
      const txR = await pub.waitForTransactionReceipt({ hash: tx });
      console.log(`  ✅ Turn ${t} submitted (gas: ${txR.gasUsed})`);
    } catch (err: any) {
      console.log(`  ❌ Turn ${t} failed: ${err.shortMessage?.slice(0, 150) ?? err.message?.slice(0, 150)}`);
      // If turn fails, we still want to test timeout - just skip remaining turns
      break;
    }
  }

  // Now it's Turn 2 — one player's turn. They WON'T submit.
  const [, curTurn, lastBlock] = await pub.readContract({ address: battleAddr, abi: BATTLE_ABI, functionName: 'getBattleState' }) as [number, number, bigint, string, bigint];
  const isClawnTurn = firstMoverA ? (curTurn % 2 === 0) : (curTurn % 2 === 1);
  const waitingPlayer = isClawnTurn ? 'ClawnJr' : 'Clawn'; // The OTHER player will claim timeout
  const claimerWallet = isClawnTurn ? jrW : clawnW;
  const claimerAccount = isClawnTurn ? jrAcc : clawnAcc;

  console.log(`\n  ⏳ Turn ${curTurn}: ${isClawnTurn ? 'Clawn' : 'ClawnJr'} should play but won't.`);
  console.log(`  ${waitingPlayer} will claim timeout after ${TIMEOUT_BLOCKS} blocks (~${TIMEOUT_BLOCKS * 2}s)`);
  console.log(`  Last action block: ${lastBlock}`);

  // Wait for timeout
  const waitTime = (TIMEOUT_BLOCKS * 2 + 10) * 1000; // blocks * 2s + buffer
  console.log(`  Waiting ${waitTime/1000}s for timeout...`);
  await new Promise(r => setTimeout(r, waitTime));

  // Check current block
  const currentBlock = await pub.getBlockNumber();
  console.log(`  Current block: ${currentBlock}, last action: ${lastBlock}`);
  console.log(`  Blocks elapsed: ${currentBlock - lastBlock}, timeout threshold: ${TIMEOUT_BLOCKS}`);

  // Claim timeout!
  console.log(`\n  🏆 ${waitingPlayer} claiming timeout win...`);
  try {
    const claimTx = await claimerWallet.writeContract({
      address: battleAddr, abi: BATTLE_ABI, functionName: 'claimTimeoutWin',
      chain: baseSepolia, account: claimerAccount,
    });
    const claimReceipt = await pub.waitForTransactionReceipt({ hash: claimTx });
    console.log(`  ✅ Timeout claimed! Gas: ${claimReceipt.gasUsed}`);
    console.log(`  Tx: ${claimTx}`);
  } catch (err: any) {
    console.log(`  ❌ Claim failed: ${err.message?.slice(0, 300)}`);
  }

  // Final state
  const [finalPhase, finalTurn] = await pub.readContract({ address: battleAddr, abi: BATTLE_ABI, functionName: 'getBattleState' }) as [number, number, bigint, string, bigint];
  console.log(`\n📊 Final: phase=${finalPhase}, turns=${finalTurn}`);

  // Check Elo changes
  const [, eloPost1, pw1, pl1] = await pub.readContract({ address: ARENA, abi: ARENA_ABI, functionName: 'agents', args: [clawnId] }) as [string, number, number, number];
  const [, eloPost2, pw2, pl2] = await pub.readContract({ address: ARENA, abi: ARENA_ABI, functionName: 'agents', args: [jrId] }) as [string, number, number, number];
  console.log(`\nPost-battle Elo:`);
  console.log(`  Clawn:   ${eloPost1} (W=${pw1}, L=${pl1}) ${eloPost1 !== eloPre1 ? `← CHANGED from ${eloPre1}!` : ''}`);
  console.log(`  ClawnJr: ${eloPost2} (W=${pw2}, L=${pl2}) ${eloPost2 !== eloPre2 ? `← CHANGED from ${eloPre2}!` : ''}`);

  // Check battle balance (should be 0 — winner took everything)
  const battleBal = await pub.getBalance({ address: battleAddr });
  console.log(`\n  Battle balance: ${Number(battleBal) / 1e18} ETH`);
  
  if (eloPost1 !== eloPre1 || eloPost2 !== eloPre2) {
    console.log(`\n🎉 ELO SYSTEM WORKS! Ratings changed after timeout win.`);
  } else {
    console.log(`\n⚠️ Elo unchanged — investigate why.`);
  }
}

main().catch(console.error);
