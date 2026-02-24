#!/usr/bin/env bun
/**
 * scripts/test-joker.ts — Test joker mechanic (narrative > 256 chars)
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
] as const;

const BATTLE_ABI = [
  { type: 'function', name: 'acceptBattle', inputs: [{ name: 'acceptorId', type: 'uint256' }], outputs: [], stateMutability: 'payable' },
  { type: 'function', name: 'submitTurn', inputs: [{ name: 'payload', type: 'tuple', components: [{ name: 'solution', type: 'uint256' }, { name: 'narrative', type: 'string' }, { name: 'nextVopParams', type: 'bytes' }, { name: 'poisonWordIndex', type: 'uint16' }] }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'getBattleState', inputs: [], outputs: [{ type: 'uint8' }, { type: 'uint32' }, { type: 'uint64' }, { type: 'bytes32' }, { type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'targetWordIndex', inputs: [], outputs: [{ type: 'uint16' }], stateMutability: 'view' },
  { type: 'function', name: 'firstMoverA', inputs: [], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  { type: 'function', name: 'jokersRemainingA', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
  { type: 'function', name: 'jokersRemainingB', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
] as const;

const WORD_ABI = [
  { type: 'function', name: 'word', inputs: [{ name: 'index', type: 'uint16' }], outputs: [{ type: 'string' }], stateMutability: 'view' },
] as const;

async function loadKey(name: string, pw: string): Promise<Hex> {
  const proc = Bun.spawn([`${process.env.HOME}/.foundry/bin/cast`, 'wallet', 'decrypt-keystore', name, '--unsafe-password', pw], { stdout: 'pipe', stderr: 'pipe' });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  return out.match(/0x[0-9a-fA-F]{64}/)![0] as Hex;
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
  const cnt = await pub.readContract({ address: ARENA, abi: ARENA_ABI, functionName: 'agentsCount' }) as bigint;
  for (let i = 1n; i <= cnt; i++) {
    const [owner] = await pub.readContract({ address: ARENA, abi: ARENA_ABI, functionName: 'agents', args: [i] }) as [string, number, number, number];
    if (owner.toLowerCase() === clawnAcc.address.toLowerCase()) clawnId = i;
    if (owner.toLowerCase() === jrAcc.address.toLowerCase()) jrId = i;
    if (clawnId && jrId) break;
  }
  console.log(`Clawn: #${clawnId}, ClawnJr: #${jrId}\n🃏 JOKER TEST\n`);

  const createTx = await clawnW.writeContract({
    address: ARENA, abi: ARENA_ABI, functionName: 'createBattle',
    args: [clawnId, { stake: 0n, baseTimeoutBlocks: 150, warmupBlocks: 15, targetAgentId: 0n, maxTurns: 12, maxJokers: 2 }],
    chain: baseSepolia, account: clawnAcc,
  });
  const receipt = await pub.waitForTransactionReceipt({ hash: createTx });
  const createdLog = receipt.logs.find(l => l.topics[0]?.startsWith('0xe43e00'));
  const battleId = BigInt(createdLog?.topics[1] ?? '0');
  await new Promise(r => setTimeout(r, 3000));
  const battleAddr = await pub.readContract({ address: ARENA, abi: ARENA_ABI, functionName: 'battles', args: [battleId] }) as Address;
  console.log(`Battle #${battleId}: ${battleAddr}`);

  await jrW.writeContract({ address: battleAddr, abi: BATTLE_ABI, functionName: 'acceptBattle', args: [jrId], value: 0n, chain: baseSepolia, account: jrAcc }).then(tx => pub.waitForTransactionReceipt({ hash: tx }));
  console.log('Accepted. Warmup (35s)...');
  await new Promise(r => setTimeout(r, 35_000));

  const jA0 = await pub.readContract({ address: battleAddr, abi: BATTLE_ABI, functionName: 'jokersRemainingA' });
  const jB0 = await pub.readContract({ address: battleAddr, abi: BATTLE_ABI, functionName: 'jokersRemainingB' });
  console.log(`Initial jokers: A=${jA0}, B=${jB0}`);

  const firstMoverA = await pub.readContract({ address: battleAddr, abi: BATTLE_ABI, functionName: 'firstMoverA' }) as boolean;
  const nextVopParams = ('0x' + '00'.repeat(64)) as Hex;

  for (let t = 0; t < 4; t++) {
    const [phase] = await pub.readContract({ address: battleAddr, abi: BATTLE_ABI, functionName: 'getBattleState' }) as [number];
    if (phase !== 1) { console.log(`Battle ended at turn ${t}`); break; }

    const isClawn = firstMoverA ? (t % 2 === 0) : (t % 2 === 1);
    const wallet = isClawn ? clawnW : jrW;
    const account = isClawn ? clawnAcc : jrAcc;
    const player = isClawn ? 'Clawn' : 'ClawnJr';

    const targetIdx = await pub.readContract({ address: battleAddr, abi: BATTLE_ABI, functionName: 'targetWordIndex' }) as number;
    const word = await pub.readContract({ address: WORDS, abi: WORD_ABI, functionName: 'word', args: [targetIdx] }) as string;

    // Turn 1 and 3: use JOKER (long narrative > 256 chars)
    const useJoker = (t === 1 || t === 3);
    let narrative: string;
    
    if (useJoker) {
      narrative = `In the grand library of the ancient citadel a scholar studied the meaning of ${word} and found it held many secrets that transformed the understanding of every reader who encountered its wisdom throughout the ages of civilization and knowledge and beauty and wonder and mysteries that filled the halls with echoes of forgotten tales from distant lands`;
      // Pad to ensure > 256
      while (narrative.length <= 256) narrative += ' and more tales were told';
      console.log(`\nTurn ${t}: ${player} 🃏 JOKER (${narrative.length} chars) target="${word}"`);
    } else {
      narrative = `In the grand library of the ancient citadel a scholar studied the meaning of ${word} and found it held secrets that transformed the understanding of every reader who encountered its wisdom throughout the ages of civilization and knowledge`;
      console.log(`\nTurn ${t}: ${player} normal (${narrative.length} chars) target="${word}"`);
    }

    try {
      const tx = await wallet.writeContract({
        address: battleAddr, abi: BATTLE_ABI, functionName: 'submitTurn',
        args: [{ solution: 0n, narrative, nextVopParams, poisonWordIndex: (t * 100 + 200) % 2048 }],
        chain: baseSepolia, account,
      });
      const r = await pub.waitForTransactionReceipt({ hash: tx });
      console.log(`  ✅ (gas: ${r.gasUsed})`);

      const jA = await pub.readContract({ address: battleAddr, abi: BATTLE_ABI, functionName: 'jokersRemainingA' });
      const jB = await pub.readContract({ address: battleAddr, abi: BATTLE_ABI, functionName: 'jokersRemainingB' });
      console.log(`  Jokers: A=${jA}, B=${jB}`);
    } catch (err: any) {
      console.log(`  ❌ ${err.shortMessage?.slice(0, 200) ?? err.message?.slice(0, 200)}`);
    }
  }

  console.log('\n📊 Joker test complete!');
}

main().catch(console.error);
