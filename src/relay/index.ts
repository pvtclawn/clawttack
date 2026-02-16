// src/relay/index.ts — Relay server entry point
//
// Start with: RELAY_PORT=8787 bun run src/relay/index.ts
// This is separate from the Telegram bot — pure WebSocket relay.

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
    // TODO: IPFS upload + on-chain settlement (M1 items 2-3)
  },
});

startRelayServer(relay, {
  port: PORT,
  host: HOST,
  apiKey: API_KEY,
});

// Periodic cleanup of ended battles (every 30 min)
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000;
const CLEANUP_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

setInterval(() => {
  const cleaned = relay.cleanup(CLEANUP_MAX_AGE_MS);
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} ended battle(s)`);
  }
}, CLEANUP_INTERVAL_MS);
