#!/usr/bin/env bun
/**
 * Settlement Pipeline — Takes a completed relay battle and settles on-chain
 * 
 * Flow:
 * 1. Fetch battle log from relay
 * 2. Upload to IPFS (Pinata or local)
 * 3. Create battle on-chain (ClawttackRegistry.createBattle)
 * 4. Settle on-chain (ClawttackRegistry.settle)
 * 
 * Usage: bun run scripts/settle.ts --relay-url http://localhost:8787 --battle-id <id> --secret <secret>
 */

import { ethers } from 'ethers';
import * as fs from 'fs';
import { exportBattleLog, verifyBattleLog } from '../packages/protocol/src/index.ts';
import type { RelayBattle } from '../packages/protocol/src/index.ts';

// Parse args
const args = process.argv.slice(2);
function getArg(name: string, fallback?: string): string {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) {
    if (fallback !== undefined) return fallback;
    console.error(`Missing required argument: --${name}`);
    process.exit(1);
  }
  return args[idx + 1]!;
}

const relayUrl = getArg('relay-url', 'http://localhost:8787');
const battleId = getArg('battle-id');
const secret = getArg('secret');
const rpcUrl = getArg('rpc-url', 'https://sepolia.base.org');

// Contract addresses (Base Sepolia)
const REGISTRY_ADDR = '0xeee01a6846C896efb1a43442434F1A51BF87d3aA';
const INJECTION_CTF_ADDR = '0x3D160303816ed14F05EA8784Ef9e021a02B747C4';

// Load wallet
let walletPassword: string;
try {
  const secrets = JSON.parse(fs.readFileSync('/home/clawn/.openclaw/workspace/.vault/secrets.json', 'utf-8'));
  walletPassword = secrets.WALLET_PASSWORD;
} catch {
  console.error('❌ Cannot load wallet password from .vault/secrets.json');
  process.exit(1);
}

// Minimal ABI for the calls we need
const REGISTRY_ABI = [
  'function createBattle(bytes32 battleId, address scenario, address[] agentAddresses, bytes setupData) external payable',
  'function settle(bytes32 battleId, bytes32 turnLogCid, bytes reveal) external',
  'event BattleCreated(bytes32 indexed battleId, address indexed scenario, address[] agents, uint256 entryFee, bytes32 commitment)',
  'event BattleSettled(bytes32 indexed battleId, address indexed winner, bytes32 turnLogCid)',
];

const SCENARIO_ABI = [
  'function setups(bytes32) external view returns (bytes32 secretHash, address defender, address attacker, bool settled)',
];

async function main() {
  console.log('⚖️  Clawttack Settlement Pipeline');
  console.log(`   Battle: ${battleId}`);
  console.log(`   Chain: ${rpcUrl}`);
  console.log('');

  // 1. Fetch battle from relay
  console.log('📡 Fetching battle from relay...');
  const battleRes = await fetch(`${relayUrl}/api/battles/${battleId}`);
  if (!battleRes.ok) {
    console.error(`❌ Battle not found: ${battleRes.status}`);
    process.exit(1);
  }
  const battle = await battleRes.json() as any;
  
  if (battle.state !== 'ended') {
    console.error(`❌ Battle not ended (state: ${battle.state})`);
    process.exit(1);
  }

  console.log(`   State: ${battle.state}`);
  console.log(`   Turns: ${battle.turns.length}`);
  console.log(`   Agents: ${battle.agents.map((a: any) => a.name).join(' vs ')}`);
  
  // Check if attacker found the secret
  const secretLower = secret.toLowerCase();
  const attackerTurns = battle.turns.filter((t: any) => t.role === 'attacker');
  const attackerFoundIt = attackerTurns.some((t: any) => 
    t.message.toLowerCase().includes(secretLower)
  );
  console.log(`   Attacker found secret: ${attackerFoundIt}`);
  console.log('');

  // 2. Verify battle log integrity
  console.log('🔍 Verifying battle log...');
  // Build a RelayBattle-compatible object for export
  const relayBattle: RelayBattle = {
    id: battle.id,
    scenarioId: battle.scenarioId,
    agents: battle.agents,
    turns: battle.turns,
    maxTurns: battle.maxTurns,
    commitment: battle.commitment,
    roles: Object.fromEntries(battle.agents.map((a: any) => [a.address, a.role])),
    state: battle.state,
    activeAgentIndex: 0,
    scenarioData: {},
    createdAt: battle.createdAt,
    startedAt: battle.startedAt,
    endedAt: battle.endedAt,
    outcome: battle.outcome,
  };

  const log = exportBattleLog(relayBattle);
  const verification = verifyBattleLog(log);
  
  console.log(`   Valid: ${verification.valid}`);
  console.log(`   Merkle root: ${verification.merkleRoot?.slice(0, 16)}...`);
  if (verification.errors.length > 0) {
    console.error(`   ❌ Errors: ${verification.errors.join(', ')}`);
    process.exit(1);
  }
  console.log('');

  // 3. Upload to IPFS (local for now — just hash it)
  console.log('📦 Computing IPFS CID...');
  const logJson = JSON.stringify(log, null, 2);
  const logHash = ethers.keccak256(ethers.toUtf8Bytes(logJson));
  console.log(`   Log hash (as CID placeholder): ${logHash.slice(0, 16)}...`);
  console.log(`   Log size: ${logJson.length} bytes`);
  
  // Save log to disk
  const logPath = `/home/clawn/.openclaw/workspace/projects/clawttack/data/battles/${battleId}.json`;
  fs.mkdirSync('/home/clawn/.openclaw/workspace/projects/clawttack/data/battles', { recursive: true });
  fs.writeFileSync(logPath, logJson);
  console.log(`   Saved: ${logPath}`);
  console.log('');

  // 4. Settle on-chain
  console.log('⛓️  Settling on-chain...');
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  // Load keystore wallet
  const keystorePath = `${process.env['HOME']}/.foundry/keystores/clawn`;
  const keystoreJson = fs.readFileSync(keystorePath, 'utf-8');
  const wallet = await ethers.Wallet.fromEncryptedJson(keystoreJson, walletPassword);
  const signer = wallet.connect(provider);
  
  console.log(`   Signer: ${signer.address}`);
  const balance = await provider.getBalance(signer.address);
  console.log(`   Balance: ${ethers.formatEther(balance)} ETH`);

  const registry = new ethers.Contract(REGISTRY_ADDR, REGISTRY_ABI, signer);

  // Convert battle ID to bytes32 (use keccak256 of UUID for deterministic bytes32)
  const battleIdBytes = ethers.keccak256(ethers.toUtf8Bytes(battleId));

  // Check if battle already exists on-chain via scenario setup
  const scenario = new ethers.Contract(INJECTION_CTF_ADDR, SCENARIO_ABI, provider);
  const setup = await scenario.setups(battleIdBytes);
  const battleExists = setup.secretHash !== ethers.ZeroHash;

  if (battleExists) {
    console.log('   Battle already exists on-chain, skipping creation');
  } else {
    console.log('   Creating battle on-chain...');
    
    const agentAddresses = battle.agents.map((a: any) => a.address);
    const secretHash = ethers.keccak256(ethers.toUtf8Bytes(secret));
    
    const attacker = battle.agents.find((a: any) => a.role === 'attacker')?.address;
    const defender = battle.agents.find((a: any) => a.role === 'defender')?.address;
    
    if (!attacker || !defender) {
      console.error('❌ Cannot determine attacker/defender from battle data');
      process.exit(1);
    }

    const setupData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'address', 'address'],
      [secretHash, defender, attacker],
    );

    const createTx = await registry.createBattle(
      battleIdBytes,
      INJECTION_CTF_ADDR,
      agentAddresses,
      setupData,
    );
    console.log(`   Create tx: ${createTx.hash}`);
    await createTx.wait();
    console.log('   ✅ Battle created on-chain');
  }

  // Settle
  console.log('   Settling...');
  const reveal = ethers.AbiCoder.defaultAbiCoder().encode(
    ['string', 'bool'],
    [secret, attackerFoundIt],
  );

  const settleTx = await registry.settle(battleIdBytes, logHash, reveal);
  console.log(`   Settle tx: ${settleTx.hash}`);
  const receipt = await settleTx.wait();
  console.log(`   ✅ Settled on-chain! Gas used: ${receipt?.gasUsed.toString()}`);
  
  // Determine winner
  const winner = attackerFoundIt 
    ? battle.agents.find((a: any) => a.role === 'attacker')?.name
    : battle.agents.find((a: any) => a.role === 'defender')?.name;
  console.log(`   🏆 Winner: ${winner}`);
  console.log(`   📋 Tx: https://sepolia.basescan.org/tx/${settleTx.hash}`);
}

main().catch((err) => {
  console.error('❌ Settlement failed:', err.message ?? err);
  process.exit(1);
});
