// tests/rate-limiter.test.ts — Tests for rate limiter

import { describe, expect, test } from 'bun:test';
import { RateLimiter } from '../src/services/rate-limiter.ts';

describe('RateLimiter', () => {
  test('should allow requests within limit', () => {
    const limiter = new RateLimiter(5, 1); // 5 tokens, refill 1/sec
    expect(limiter.consume('agent-1')).toBe(true);
    expect(limiter.consume('agent-1')).toBe(true);
    expect(limiter.consume('agent-1')).toBe(true);
  });

  test('should reject requests over limit', () => {
    const limiter = new RateLimiter(2, 0.1); // 2 tokens, slow refill
    expect(limiter.consume('agent-1')).toBe(true);
    expect(limiter.consume('agent-1')).toBe(true);
    expect(limiter.consume('agent-1')).toBe(false); // exhausted
  });

  test('should track separate keys independently', () => {
    const limiter = new RateLimiter(1, 0.1);
    expect(limiter.consume('agent-1')).toBe(true);
    expect(limiter.consume('agent-1')).toBe(false);
    expect(limiter.consume('agent-2')).toBe(true); // different key
  });

  test('should clean up stale buckets', async () => {
    const limiter = new RateLimiter(5, 1);
    limiter.consume('old-agent');
    // Wait a tiny bit so the bucket ages
    await new Promise((r) => setTimeout(r, 10));
    const cleaned = limiter.cleanup(5); // 5ms max age
    expect(cleaned).toBe(1);
  });
});
