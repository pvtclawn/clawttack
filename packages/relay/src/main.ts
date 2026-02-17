// packages/relay/src/main.ts — Relay server entry point
//
// Start with: RELAY_PORT=8787 bun run packages/relay/src/main.ts
//
// Environment variables:
//   RELAY_PORT         — Listen port (default: 8787)
//   RELAY_HOST         — Listen host (default: 0.0.0.0)
//   RELAY_API_KEY      — API key for battle creation (optional)
//   TURN_TIMEOUT_SEC   — Turn timeout in seconds (default: 60)

import { RelayServer } from './server.ts';
import { startRelayServer } from './http.ts';

const PORT = Number(process.env['RELAY_PORT'] ?? '8787');
const HOST = process.env['RELAY_HOST'] ?? '0.0.0.0';
const API_KEY = process.env['RELAY_API_KEY'];
const TURN_TIMEOUT_SEC = Number(process.env['TURN_TIMEOUT_SEC'] ?? '60');

const relay = new RelayServer({
  turnTimeoutMs: TURN_TIMEOUT_SEC * 1000,
  onBattleEnd: async (battle) => {
    console.log(`⚔️  Battle ${battle.id} ended:`, {
      turns: battle.turns.length,
      outcome: battle.outcome,
    });
    // TODO: IPFS upload + on-chain settlement
  },
});

startRelayServer(relay, {
  port: PORT,
  host: HOST,
  apiKey: API_KEY,
});

// Log startup config
console.log(`   API key: ${API_KEY ? 'configured' : 'none (open access)'}`);
console.log(`   Turn timeout: ${TURN_TIMEOUT_SEC}s`);

// Periodic cleanup of ended battles
setInterval(() => {
  const cleaned = relay.cleanup(2 * 60 * 60 * 1000);
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} ended battle(s)`);
  }
}, 30 * 60 * 1000);
