// src/index.ts — Agent Arena entry point

import { config } from './config/index.ts';
import { ArenaDB } from './db/index.ts';
import { BattleManager } from './services/battle-manager.ts';
import { setupBot, createBattleEvents } from './bot/index.ts';

console.log('⚔️  Agent Arena starting...');

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

// Start!
console.log('🤖 Bot starting...');
bot.start({
  onStart: (botInfo) => {
    console.log(`✅ Agent Arena online! Bot: @${botInfo.username}`);
    console.log(`📋 Scenarios: injection-ctf`);
    console.log(`⏳ Ready for battles!`);
  },
});
