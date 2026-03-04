// packages/relay/src/main.ts — Relay server entry point
//
// Start with: RELAY_PORT=8787 bun run packages/relay/src/main.ts
//
// Environment variables:
//   RELAY_PORT           — Listen port (default: 8787)
//   RELAY_HOST           — Listen host (default: 0.0.0.0)
//   RELAY_API_KEY        — API key for battle creation (optional)
//   TURN_TIMEOUT_SEC     — Turn timeout in seconds (default: 60)
//   AUTO_SETTLE          — Enable auto-settlement (true/false, default: false)
//   KEYSTORE_PATH        — Path to Foundry keystore file
//   KEYSTORE_PASSWORD    — Keystore password
//   RPC_URL              — Base Sepolia RPC URL
//   REGISTRY_ADDRESS     — ClawttackRegistry contract address
//   BATTLE_LOG_DIR       — Directory to save battle logs
//   WEB_PUBLIC_DIR       — Directory to copy logs for debug artifacts (non-UI by default)

import { RelayServer } from './server.ts';
import { startRelayServer } from './http.ts';
import { Settler } from './settler.ts';
import { AgentRegistry } from './agent-registry.ts';
import { Matchmaker } from './matchmaker.ts';
import { BattlePersistence } from './persistence.ts';

const PORT = Number(process.env['RELAY_PORT'] ?? '8787');
const HOST = process.env['RELAY_HOST'] ?? '0.0.0.0';
const API_KEY = process.env['RELAY_API_KEY'];
const TURN_TIMEOUT_SEC = Number(process.env['TURN_TIMEOUT_SEC'] ?? '60');
const AUTO_SETTLE = process.env['AUTO_SETTLE'] === 'true';

// Default paths relative to project root
const PROJECT_ROOT = new URL('../../..', import.meta.url).pathname.replace(/\/$/, '');
const DEFAULT_BATTLE_LOG_DIR = `${PROJECT_ROOT}/data/battles`;
const DEFAULT_WEB_PUBLIC_DIR = `${PROJECT_ROOT}/data/debug-battles`;

// Scenario address mapping
const SCENARIO_ADDRESSES: Record<string, string> = {
  'injection-ctf': '0x3D160303816ed14F05EA8784Ef9e021a02B747C4',
  'prisoners-dilemma': '0xa5313FB027eBD60dE2856bA134A689bbd30a6CC9',
};

async function initSettler(): Promise<Settler | null> {
  if (!AUTO_SETTLE) return null;

  const keystorePath = process.env['KEYSTORE_PATH'] ?? `${process.env['HOME']}/.foundry/keystores/clawn`;
  const keystorePassword = process.env['KEYSTORE_PASSWORD'];
  const rpcUrl = process.env['RPC_URL'] ?? 'https://sepolia.base.org';
  const registryAddress = process.env['REGISTRY_ADDRESS'] ?? '0xeee01a6846C896efb1a43442434F1A51BF87d3aA';

  if (!keystorePassword) {
    console.error('⚠️  AUTO_SETTLE=true but KEYSTORE_PASSWORD not set. Auto-settlement disabled.');
    return null;
  }

  const settler = new Settler({
    rpcUrl,
    keystorePath,
    keystorePassword,
    registryAddress,
    scenarioAddresses: SCENARIO_ADDRESSES,
    battleLogDir: process.env['BATTLE_LOG_DIR'] ?? DEFAULT_BATTLE_LOG_DIR,
    webPublicDir: process.env['WEB_PUBLIC_DIR'] ?? DEFAULT_WEB_PUBLIC_DIR,
    onSettled: (battleId, txHash) => {
      console.log(`  📢 Settlement confirmed: ${battleId} → ${txHash}`);
    },
    onError: (battleId, error) => {
      console.error(`  ⚠️ Settlement error for ${battleId}: ${error.message}`);
    },
  });

  try {
    const address = await settler.init();
    console.log(`   Auto-settle: enabled (${address})`);
    return settler;
  } catch (err) {
    console.error(`⚠️  Failed to init settler: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

async function main() {
  const settler = await initSettler();

  const persistence = new BattlePersistence({
    dataDir: process.env['BATTLE_LOG_DIR'] ?? DEFAULT_BATTLE_LOG_DIR,
    webPublicDir: process.env['WEB_PUBLIC_DIR'] ?? DEFAULT_WEB_PUBLIC_DIR,
  });

  const relay = new RelayServer({
    turnTimeoutMs: TURN_TIMEOUT_SEC * 1000,
    onBattleEnd: async (battle) => {
      console.log(`⚔️  Battle ${battle.id} ended:`, {
        turns: battle.turns.length,
        outcome: battle.outcome,
      });

      // Persist battle log to disk
      try {
        const filePath = persistence.save(battle);
        console.log(`  💾 Saved: ${filePath}`);
      } catch (err) {
        console.error(`  ⚠️ Failed to save battle log:`, err);
      }

      if (settler) {
        const txHash = await settler.settle(battle);
        if (txHash) {
          console.log(`  🔗 https://sepolia.basescan.org/tx/${txHash}`);
        }
      }
    },
  });

  const agentRegistry = new AgentRegistry();
  const matchmaker = new Matchmaker(relay, {
    onMatch: (match) => {
      console.log(`  🎲 Matched: ${match.agents.map(a => a.name).join(' vs ')} → ${match.battleId}`);
    },
  });

  startRelayServer(relay, {
    port: PORT,
    host: HOST,
    apiKey: API_KEY,
    agentRegistry,
    matchmaker,
  });

  // Log startup config
  console.log(`   API key: ${API_KEY ? 'configured' : 'none (open access)'}`);
  console.log(`   Turn timeout: ${TURN_TIMEOUT_SEC}s`);
  console.log(`   Agent registration: enabled`);
  console.log(`   Battle persistence: ${persistence.count} saved battles`);
  if (!settler) console.log(`   Auto-settle: disabled`);

  // Periodic cleanup of ended battles
  setInterval(() => {
    const cleaned = relay.cleanup(2 * 60 * 60 * 1000);
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} ended battle(s)`);
    }
  }, 30 * 60 * 1000);
}

main().catch((err) => {
  console.error('❌ Relay startup failed:', err);
  process.exit(1);
});
