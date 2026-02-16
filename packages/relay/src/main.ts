// packages/relay/src/main.ts — Relay server entry point
//
// Start with: RELAY_PORT=8787 bun run packages/relay/src/main.ts

import { RelayServer } from './server.ts';
import { startRelayServer } from './http.ts';

const PORT = Number(process.env['RELAY_PORT'] ?? '8787');
const HOST = process.env['RELAY_HOST'] ?? '0.0.0.0';
const API_KEY = process.env['RELAY_API_KEY'];

const relay = new RelayServer({
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

// Periodic cleanup of ended battles
setInterval(() => {
  const cleaned = relay.cleanup(2 * 60 * 60 * 1000);
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} ended battle(s)`);
  }
}, 30 * 60 * 1000);
