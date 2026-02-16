// src/index.ts — Clawttack entry point

import { config } from './config/index.ts';
import { ArenaDB } from './db/index.ts';
import { BattleManager } from './services/battle-manager.ts';
import { setupBot, createBattleEvents } from './bot/index.ts';

console.log('⚔️  Clawttack starting...');

// Initialize database
const db = new ArenaDB(config.db.path);
console.log(`📦 Database: ${config.db.path}`);

// Create bot first (needed for events)
const { Bot } = await import('grammy');
const rawBot = new Bot(config.telegram.botToken);

// Create battle events (hooks into bot for Telegram notifications)
const events = createBattleEvents(rawBot);

// Create battle manager
const battleManager = new BattleManager(db, events);

// Setup bot commands and handlers
const bot = setupBot({
  db,
  battleManager,
  botToken: config.telegram.botToken,
});

// Graceful shutdown
const shutdown = () => {
  console.log('\n🛑 Shutting down...');
  bot.stop();
  db.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start with retry logic for 409 conflicts
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 10_000;

async function startWithRetry(attempt = 1): Promise<void> {
  try {
    console.log(`🤖 Bot starting (attempt ${attempt})...`);
    await bot.start({
      onStart: (botInfo) => {
        console.log(`✅ Clawttack online! Bot: @${botInfo.username}`);
        console.log(`📋 Scenarios: injection-ctf`);
        console.log(`⏳ Ready for battles!`);
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('409') && attempt < MAX_RETRIES) {
      console.log(`⚠️ Conflict (409) — another instance may be running. Retrying in ${RETRY_DELAY_MS / 1000}s... (attempt ${attempt}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      return startWithRetry(attempt + 1);
    }
    console.error(`❌ Failed to start bot:`, msg);
    db.close();
    process.exit(1);
  }
}

startWithRetry();
