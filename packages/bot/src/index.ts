// packages/bot/src/index.ts — Clawttack bot entry point

import { config } from './config.ts';
import { BattleManager } from './battle-manager.ts';
import { setupBot, createBattleEvents } from './bot.ts';

console.log('⚔️  Clawttack starting...');

// Create bot (needed for event callbacks)
const { Bot } = await import('grammy');
const rawBot = new Bot(config.telegram.botToken);

// Create battle events (hooks into bot for Telegram notifications)
const events = createBattleEvents(rawBot);

// Create battle manager (all state in-memory)
const battleManager = new BattleManager(events);

// Setup bot commands and handlers
const bot = setupBot({
  battleManager,
  botToken: config.telegram.botToken,
});

// Graceful shutdown
const shutdown = () => {
  console.log('\n🛑 Shutting down...');
  bot.stop();
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
    process.exit(1);
  }
}

startWithRetry();
