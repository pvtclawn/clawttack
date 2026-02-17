// packages/relay/src/settler.ts — Optional auto-settlement for relay operator
//
// When configured with a private key + RPC, the relay can automatically
// settle battles on-chain after they end. This is OPTIONAL — the relay
// is still untrusted infrastructure. Settlement can also be done externally.

import { ethers } from 'ethers';
import { exportBattleLog, verifyBattleLog } from '@clawttack/protocol';
import type { RelayBattle } from '@clawttack/protocol';
import * as fs from 'fs';

export interface SettlerConfig {
  rpcUrl: string;
  keystorePath: string;
  keystorePassword: string;
  registryAddress: string;
  scenarioAddresses: Record<string, string>; // scenarioId → contract address
  battleLogDir?: string;  // Where to save battle log JSON
  webPublicDir?: string;  // Where to copy for web serving
  onSettled?: (battleId: string, txHash: string) => void;
  onError?: (battleId: string, error: Error) => void;
}

export class Settler {
  private signer: ethers.Signer | null = null;
  private signerAddress = '';
  private provider: ethers.JsonRpcProvider;
  private config: SettlerConfig;
  private settling = new Set<string>(); // Prevent double-settlement

  constructor(config: SettlerConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
  }

  /** Initialize wallet from keystore (call once at startup) */
  async init(): Promise<string> {
    const keystoreJson = fs.readFileSync(this.config.keystorePath, 'utf-8');
    const wallet = await ethers.Wallet.fromEncryptedJson(keystoreJson, this.config.keystorePassword);
    this.signer = wallet.connect(this.provider);
    this.signerAddress = wallet.address;
    return this.signerAddress;
  }

  /** Settle a completed battle on-chain */
  async settle(battle: RelayBattle): Promise<string | null> {
    if (!this.signer) throw new Error('Settler not initialized — call init() first');
    if (battle.state !== 'ended' || !battle.outcome) return null;
    if (this.settling.has(battle.id)) return null; // Already settling

    this.settling.add(battle.id);

    try {
      // 1. Export and verify battle log
      const log = exportBattleLog(battle);
      const verification = verifyBattleLog(log);
      if (!verification.valid) {
        throw new Error(`Battle log verification failed: ${verification.errors.join(', ')}`);
      }

      const logJson = JSON.stringify(log, null, 2);
      const logHash = ethers.keccak256(ethers.toUtf8Bytes(logJson));

      // 2. Save battle log
      if (this.config.battleLogDir) {
        fs.mkdirSync(this.config.battleLogDir, { recursive: true });
        fs.writeFileSync(`${this.config.battleLogDir}/${battle.id}.json`, logJson);
      }

      // 3. Copy to web public dir (keyed by battleIdBytes hash)
      const battleIdBytes = ethers.keccak256(ethers.toUtf8Bytes(battle.id));
      if (this.config.webPublicDir) {
        fs.mkdirSync(this.config.webPublicDir, { recursive: true });
        fs.writeFileSync(`${this.config.webPublicDir}/${battleIdBytes}.json`, logJson);
      }

      // 4. Settle on-chain
      const scenarioAddr = this.config.scenarioAddresses[battle.scenarioId];
      if (!scenarioAddr) {
        throw new Error(`Unknown scenario: ${battle.scenarioId}`);
      }

      const registryAbi = [
        'function createBattle(bytes32 battleId, address scenario, address[] agentAddresses, bytes setupData) external payable',
        'function settle(bytes32 battleId, bytes32 turnLogCid, bytes reveal) external',
      ];
      const registry = new ethers.Contract(this.config.registryAddress, registryAbi, this.signer);

      const scenarioAbi = [
        'function setups(bytes32) external view returns (bytes32 secretHash, address defender, address attacker, bool settled)',
      ];
      const scenario = new ethers.Contract(scenarioAddr, scenarioAbi, this.provider);

      // Check if battle already on-chain
      const setup = await (scenario.getFunction('setups'))(battleIdBytes);
      const exists = setup.secretHash !== ethers.ZeroHash;

      if (exists) {
        console.log(`  ⚔️ Battle ${battle.id} already on-chain, skipping`);
        return null;
      }

      // Build setup data based on scenario
      const agentAddresses = battle.agents.map(a => a.address);
      let setupData: string;
      let reveal: string;

      if (battle.scenarioId === 'injection-ctf') {
        // InjectionCTF needs secretHash, defender, attacker
        const attacker = battle.agents.find(a => battle.roles[a.address] === 'attacker');
        const defender = battle.agents.find(a => battle.roles[a.address] === 'defender');
        if (!attacker || !defender) throw new Error('Missing attacker/defender roles');

        // Secret is in scenarioData if available, otherwise use commitment
        const secret = (battle.scenarioData?.['secret'] as string) ?? '';
        const secretHash = secret
          ? ethers.keccak256(ethers.toUtf8Bytes(secret))
          : battle.commitment;

        setupData = ethers.AbiCoder.defaultAbiCoder().encode(
          ['bytes32', 'address', 'address'],
          [secretHash, defender.address, attacker.address],
        );

        // Check if attacker found the secret
        const secretLower = secret.toLowerCase();
        const attackerFoundIt = secret && battle.turns
          .filter(t => t.role === 'attacker')
          .some(t => t.message.toLowerCase().includes(secretLower));

        reveal = ethers.AbiCoder.defaultAbiCoder().encode(
          ['string', 'bool'],
          [secret, attackerFoundIt],
        );
      } else {
        // Generic: empty setup + reveal
        setupData = '0x';
        reveal = '0x';
      }

      // Create battle on-chain
      console.log(`  ⛓️  Creating battle ${battle.id} on-chain...`);
      const createFunc = registry.getFunction('createBattle');
      const createTx = await createFunc(battleIdBytes, scenarioAddr, agentAddresses, setupData);
      await (createTx as ethers.TransactionResponse).wait();

      // Wait for nonce sync
      await new Promise(r => setTimeout(r, 2000));

      // Settle
      console.log(`  ⛓️  Settling battle ${battle.id}...`);
      const nonce = await this.provider.getTransactionCount(this.signerAddress);
      const settleFunc = registry.getFunction('settle');
      const settleTx = await settleFunc(battleIdBytes, logHash, reveal, { gasLimit: 300_000n, nonce });
      const receipt = await (settleTx as ethers.TransactionResponse).wait();
      const txHash = (settleTx as ethers.TransactionResponse).hash;

      console.log(`  ✅ Battle ${battle.id} settled! Gas: ${receipt?.gasUsed.toString()} tx: ${txHash}`);

      this.config.onSettled?.(battle.id, txHash);
      return txHash;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`  ❌ Settlement failed for ${battle.id}:`, error.message);
      this.config.onError?.(battle.id, error);
      return null;
    } finally {
      this.settling.delete(battle.id);
    }
  }
}
