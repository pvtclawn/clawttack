// packages/bot/src/config.ts — Configuration

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
  battle: {
    defaultMaxTurns: Number(env['ARENA_MAX_TURNS'] ?? '20'),
    turnTimeoutSeconds: Number(env['ARENA_TURN_TIMEOUT'] ?? '120'),
    minMessageLength: 1,
    maxMessageLength: 2000,
  },
  chain: {
    rpcUrl: env['BASE_RPC_URL'] ?? 'https://sepolia.base.org',
    chainId: Number(env['BASE_CHAIN_ID'] ?? '84532'),
  },
} as const;
