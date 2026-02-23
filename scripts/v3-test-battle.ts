#!/usr/bin/env bun
/**
 * v3-test-battle.ts — Run a test battle between PrivateClawn and PrivateClawnJr
 * 
 * Usage: bun scripts/v3-test-battle.ts
 */
import { createPublicClient, createWalletClient, http, type Hex, type Address } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { ArenaClient } from '../packages/protocol/src/arena-client';
import { BattleClient } from '../packages/protocol/src/battle-client';

// Load deployment addresses
const ARENA_ADDRESS = '0x771e0f0d30b56f5f83e2b9d452ca4b995a38f22e' as Address;
const WORD_DICT_ADDRESS = '0xe675b676b31adf0eaa408c43830382168ab21d38' as Address;

// Load keystores via foundry cast
async function getPrivateKey(account: string): Promise<Hex> {
  const password = JSON.parse(
    await Bun.file('/home/clawn/.config/pvtclawn/secrets.json').text()
  ).WALLET_PASSWORD;
  
  const proc = Bun.spawn([
    '/home/clawn/.foundry/bin/cast', 'wallet', 'private-key',
    '--account', account, '--password', password
  ], { stdout: 'pipe', stderr: 'pipe' });
  
  const output = await new Response(proc.stdout).text();
  return output.trim() as Hex;
}

async function main() {
  console.log('🏟️  Clawttack V3 Test Battle\n');

  // Setup clients
  const transport = http('https://sepolia.base.org');
  const publicClient = createPublicClient({ chain: baseSepolia, transport });

  const [clawnKey, clawnjrKey] = await Promise.all([
    getPrivateKey('clawn'),
    getPrivateKey('clawnjr')
  ]);

  const clawnAccount = privateKeyToAccount(clawnKey);
  const clawnjrAccount = privateKeyToAccount(clawnjrKey);

  console.log(`⚔️  Challenger: ${clawnAccount.address} (Agent #1)`);
  console.log(`🛡️  Acceptor:   ${clawnjrAccount.address} (Agent #2)\n`);

  const clawnWallet = createWalletClient({ account: clawnAccount, chain: baseSepolia, transport });
  const clawnjrWallet = createWalletClient({ account: clawnjrAccount, chain: baseSepolia, transport });

  // Create Arena clients
  const arenaClawn = new ArenaClient({
    publicClient, walletClient: clawnWallet, contractAddress: ARENA_ADDRESS
  });

  // 1. Create Battle
  console.log('📦 Creating battle (0 stake, 15 turns, 150 block timeout)...');
  const { battleId, battleAddress, txHash } = await arenaClawn.createBattle(1n, {
    stake: 0n,
    maxTurns: 15,
    maxJokers: 2,
    baseTimeoutBlocks: 150,
    warmupBlocks: 5,
    targetAgentId: 2n
  });
  console.log(`✅ Battle #${battleId} created at ${battleAddress}`);
  console.log(`   Tx: ${txHash}\n`);

  // 2. Accept Battle
  const clawnjrBattle = new BattleClient({
    publicClient, walletClient: clawnjrWallet, battleAddress
  });

  console.log('🤝 ClawnJr accepting battle...');
  const acceptTx = await clawnjrBattle.acceptBattle(2n, 0n);
  console.log(`✅ Accepted! Tx: ${acceptTx}\n`);

  // Wait for confirmation
  await publicClient.waitForTransactionReceipt({ hash: acceptTx });

  // 3. Check state
  const clawnBattle = new BattleClient({
    publicClient, walletClient: clawnWallet, battleAddress
  });

  const state = await clawnBattle.getState();
  console.log(`📊 Battle State: Phase=${state.phase}, Turn=${state.currentTurn}`);
  
  const firstMover = await clawnBattle.whoseTurn();
  console.log(`🎯 First mover: ${firstMover}`);
  const clawnGoesFirst = firstMover.toLowerCase() === clawnAccount.address.toLowerCase();
  console.log(`   ${clawnGoesFirst ? 'PrivateClawn' : 'ClawnJr'} goes first!\n`);

  // 4. Read the target word
  const targetIdx = await publicClient.readContract({
    address: battleAddress, abi: [{
      type: 'function', name: 'targetWordIndex', 
      inputs: [], outputs: [{ type: 'uint16' }], stateMutability: 'view'
    }] as const, functionName: 'targetWordIndex'
  });
  console.log(`📝 Target word index: ${targetIdx}`);

  // Read the word from dictionary
  const targetWord = await publicClient.readContract({
    address: WORD_DICT_ADDRESS, abi: [{
      type: 'function', name: 'word',
      inputs: [{ type: 'uint16' }], outputs: [{ type: 'string' }], stateMutability: 'view'
    }] as const, functionName: 'word', args: [targetIdx]
  });
  console.log(`📝 Target word: "${targetWord}"`);

  // Read VOP info
  const currentVop = await publicClient.readContract({
    address: battleAddress, abi: [{
      type: 'function', name: 'currentVop',
      inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view'
    }] as const, functionName: 'currentVop'
  });
  console.log(`🧩 Current VOP: ${currentVop}`);

  const vopParams = await publicClient.readContract({
    address: battleAddress, abi: [{
      type: 'function', name: 'currentVopParams',
      inputs: [], outputs: [{ type: 'bytes' }], stateMutability: 'view'
    }] as const, functionName: 'currentVopParams'
  });
  console.log(`🧩 VOP Params: ${vopParams}\n`);

  // 5. Wait for warmup period
  const startBlock = await publicClient.readContract({
    address: battleAddress, abi: [{
      type: 'function', name: 'startBlock',
      inputs: [], outputs: [{ type: 'uint32' }], stateMutability: 'view'
    }] as const, functionName: 'startBlock'
  });
  
  let currentBlock = await publicClient.getBlockNumber();
  console.log(`⏳ Warmup: start=${startBlock}, current=${currentBlock}`);
  
  while (currentBlock < BigInt(startBlock)) {
    await new Promise(r => setTimeout(r, 2000));
    currentBlock = await publicClient.getBlockNumber();
    process.stdout.write(`  Block ${currentBlock}/${startBlock}\r`);
  }
  console.log(`\n✅ Warmup complete!\n`);

  // 6. Solve the VOP puzzle (HashPreimageVOP)
  // VOP params: (bytes32 salt, uint8 leadingZeroBits)
  // We need to find `solution` where keccak256(DOMAIN_TYPE, salt, solution) has N leading zero bits
  const { keccak256, encodePacked, encodeAbiParameters, decodeAbiParameters } = await import('viem');
  
  let solution = 0n;
  if (vopParams !== '0x') {
    const [salt, zeroBits] = decodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'uint8' }],
      vopParams
    );
    console.log(`🔐 VOP Puzzle: find preimage with ${zeroBits} leading zero bits (salt: ${(salt as string).slice(0, 10)}...)`);

    // Brute-force the solution
    const DOMAIN_TYPE = 'CLAWTTACK_VOP_HASH';
    while (true) {
      const hash = keccak256(encodeAbiParameters(
        [{ type: 'string' }, { type: 'bytes32' }, { type: 'uint256' }],
        [DOMAIN_TYPE, salt as Hex, solution]
      ));
      const hashNum = BigInt(hash);
      if (hashNum >> BigInt(256 - Number(zeroBits)) === 0n) {
        console.log(`✅ Solution found: ${solution} (after ${solution} attempts)`);
        break;
      }
      solution++;
      if (solution % 10000n === 0n) process.stdout.write(`  Tried ${solution}...\r`);
    }
  } else {
    console.log(`🔐 VOP Params empty (Turn 0), using solution 0`);
  }

  // 7. Submit first turn
  const firstBattle = clawnGoesFirst ? clawnBattle : clawnjrBattle;
  const firstPlayerId = clawnGoesFirst ? 'PrivateClawn' : 'ClawnJr';
  
  const nextVopParams = encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'uint8' }],
    [keccak256(encodePacked(['string'], ['initial salt'])), 8]
  );
  
  const narrative = `The ${targetWord} shimmers in the digital void as the first move is cast in this epic battle of wits.`;
  console.log(`\n⚔️  ${firstPlayerId} submitting turn 0...`);
  console.log(`   Narrative: "${narrative}"`);
  
  const turnTx = await firstBattle.submitTurn({
    solution,
    narrative,
    nextVopParams,
    poisonWordIndex: 42 // Random word as poison for opponent
  });
  console.log(`✅ Turn submitted! Tx: ${turnTx}`);

  // Wait and check
  await publicClient.waitForTransactionReceipt({ hash: turnTx });
  const newState = await clawnBattle.getState();
  console.log(`\n📊 After Turn 0: Phase=${newState.phase}, Turn=${newState.currentTurn}`);
  console.log(`   Sequence Hash: ${newState.lastHash}`);

  console.log('\n🎉 Test battle initialized successfully!');
  console.log(`   Battle: ${battleAddress}`);
  console.log(`   Status: Turn ${newState.currentTurn} complete, waiting for opponent`);
  console.log(`   Explorer: https://sepolia.basescan.org/address/${battleAddress}`);
}

main().catch(console.error);
