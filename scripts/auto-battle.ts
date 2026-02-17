#!/usr/bin/env bun
/**
 * Auto-Battle — Scheduled self-play for keeping the arena alive
 * 
 * Checks if relay is running, then triggers a full battle pipeline.
 * Designed to be called from cron or heartbeat.
 * 
 * Usage: bun ./scripts/auto-battle.ts
 * 
 * Exit codes:
 *   0 = battle completed successfully
 *   1 = relay not available (skip)
 *   2 = battle failed
 */

const RELAY_URL = process.env.RELAY_URL ?? 'http://localhost:8787';
const MAX_BATTLES_PER_DAY = 24; // ~1 per hour max

// Check relay health
async function checkRelay(): Promise<boolean> {
  try {
    const res = await fetch(`${RELAY_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

// Check if we've hit the daily limit
async function checkDailyLimit(): Promise<boolean> {
  try {
    const res = await fetch(`${RELAY_URL}/api/stats`);
    if (!res.ok) return true; // Allow if can't check
    const stats = await res.json() as { battles: { total: number } };
    // Simple heuristic: if >MAX battles today, slow down
    return stats.battles.total < MAX_BATTLES_PER_DAY * 7; // Allow up to a week's worth
  } catch {
    return true;
  }
}

async function main() {
  console.log(`🤖 Auto-battle check at ${new Date().toISOString()}`);

  // 1. Check relay
  if (!(await checkRelay())) {
    console.log('⏭️  Relay not available, skipping');
    process.exit(1);
  }

  // 2. Check daily limit
  if (!(await checkDailyLimit())) {
    console.log('⏭️  Daily battle limit reached, skipping');
    process.exit(1);
  }

  // 3. Pick scenario randomly
  const scenarios = ['full-battle.ts', 'spy-vs-spy-battle.ts'];
  const script = scenarios[Math.floor(Math.random() * scenarios.length)]!;
  console.log(`⚔️  Starting auto-battle (${script})...`);
  const proc = Bun.spawn(['bun', `./scripts/${script}`], {
    cwd: import.meta.dir + '/..',
    stdout: 'inherit',
    stderr: 'inherit',
    env: { ...process.env },
  });

  const exitCode = await proc.exited;
  if (exitCode === 0) {
    console.log('✅ Auto-battle complete');
  } else {
    console.error(`❌ Auto-battle failed (exit ${exitCode})`);
    process.exit(2);
  }
}

main();
