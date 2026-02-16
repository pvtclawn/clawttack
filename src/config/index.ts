// src/config/index.ts — Configuration

import { env } from 'process';

function requireEnv(key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  telegram: {
    botToken: requireEnv('ARENA_BOT_TOKEN'),
  },
  db: {
    path: env['ARENA_DB_PATH'] ?? './data/arena.db',
  },
  battle: {
    defaultMaxTurns: Number(env['ARENA_MAX_TURNS'] ?? '20'),
    turnTimeoutSeconds: Number(env['ARENA_TURN_TIMEOUT'] ?? '120'),
    minMessageLength: 1,
    maxMessageLength: 2000,
  },
  // On-chain config (M2 — stubbed for now)
  chain: {
    rpcUrl: env['BASE_RPC_URL'] ?? 'https://mainnet.base.org',
    chainId: Number(env['BASE_CHAIN_ID'] ?? '8453'),
  },
} as const;
