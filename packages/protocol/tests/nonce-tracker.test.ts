import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { InternalNonceTracker } from '../src/nonce-tracker';
import type { Address, PublicClient } from 'viem';

const ALICE = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address;
const BOB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Address;

/**
 * Creates a mock PublicClient that returns the given nonce for getTransactionCount
 * and optionally a tx for getTransaction.
 */
function mockClient(rpcNonce: number, txResult?: any): PublicClient {
  return {
    getTransactionCount: mock(() => Promise.resolve(rpcNonce)),
    getTransaction: mock(() => txResult ? Promise.resolve(txResult) : Promise.reject(new Error('not found'))),
  } as unknown as PublicClient;
}

describe('InternalNonceTracker', () => {
  let tracker: InternalNonceTracker;

  beforeEach(() => {
    // Reset singleton for test isolation
    // @ts-expect-error: accessing private static for testing
    InternalNonceTracker.instance = undefined;
    tracker = InternalNonceTracker.getInstance();
  });

  test('singleton pattern returns same instance', () => {
    const a = InternalNonceTracker.getInstance();
    const b = InternalNonceTracker.getInstance();
    expect(a).toBe(b);
  });

  test('first call returns RPC nonce when no internal state', async () => {
    const client = mockClient(5);
    const nonce = await tracker.getNextNonce(ALICE, client);
    expect(nonce).toBe(5);
  });

  test('subsequent call increments beyond RPC nonce', async () => {
    const client = mockClient(5);
    const n1 = await tracker.getNextNonce(ALICE, client);
    expect(n1).toBe(5);

    // RPC still reports 5 (pending tx not confirmed), but tracker should return 6
    const n2 = await tracker.getNextNonce(ALICE, client);
    expect(n2).toBe(6);
  });

  test('uses RPC nonce when it jumps ahead of internal', async () => {
    const client5 = mockClient(5);
    await tracker.getNextNonce(ALICE, client5);

    // RPC catches up to 10 (e.g., external txs confirmed)
    const client10 = mockClient(10);
    const nonce = await tracker.getNextNonce(ALICE, client10);
    expect(nonce).toBe(10);
  });

  test('tracks addresses independently', async () => {
    const clientAlice = mockClient(3);
    const clientBob = mockClient(100);

    const nonceAlice = await tracker.getNextNonce(ALICE, clientAlice);
    const nonceBob = await tracker.getNextNonce(BOB, clientBob);

    expect(nonceAlice).toBe(3);
    expect(nonceBob).toBe(100);
  });

  test('reset forces re-sync with RPC on next call', async () => {
    const client = mockClient(5);
    const n1 = await tracker.getNextNonce(ALICE, client);
    const n2 = await tracker.getNextNonce(ALICE, client); // internal = 6

    tracker.reset(ALICE);
    
    // After reset, should use RPC nonce again (5), not continue from 6
    const n3 = await tracker.getNextNonce(ALICE, client);
    expect(n3).toBe(5);
  });

  test('setNonce manually overrides internal counter', async () => {
    const client = mockClient(5);
    
    tracker.setNonce(ALICE, 20);
    const nonce = await tracker.getNextNonce(ALICE, client);
    // max(RPC=5, internal=20+1=21) = 21
    expect(nonce).toBe(21);
  });

  test('resync after RESYNC_THRESHOLD_MS', async () => {
    const client = mockClient(5);
    await tracker.getNextNonce(ALICE, client);
    await tracker.getNextNonce(ALICE, client); // internal = 6

    // Simulate time passing beyond threshold
    // @ts-expect-error: accessing private map for testing
    tracker.lastUpdate.set(ALICE, Date.now() - InternalNonceTracker.RESYNC_THRESHOLD_MS - 1);

    // After stale timeout, should force reset → use RPC nonce
    const nonce = await tracker.getNextNonce(ALICE, client);
    expect(nonce).toBe(5); // reset clears internal, so max(5, -1+1=0) = 5
  });

  test('verifyEcho returns true when tx is found', async () => {
    // Override ECHO_TIMEOUT to 0 for test speed
    const origTimeout = InternalNonceTracker.ECHO_TIMEOUT_MS;
    // @ts-expect-error: readonly override for testing
    InternalNonceTracker.ECHO_TIMEOUT_MS = 0;

    const client = mockClient(5, { hash: '0xabc' });
    const result = await tracker.verifyEcho(ALICE, '0xabc', client);
    expect(result).toBe(true);

    // @ts-expect-error: restore
    InternalNonceTracker.ECHO_TIMEOUT_MS = origTimeout;
  });

  test('verifyEcho returns false and resets when tx not found', async () => {
    const origTimeout = InternalNonceTracker.ECHO_TIMEOUT_MS;
    // @ts-expect-error: readonly override for testing
    InternalNonceTracker.ECHO_TIMEOUT_MS = 0;

    const client = mockClient(5);
    // Set a nonce so we can verify reset happens
    tracker.setNonce(ALICE, 10);

    const result = await tracker.verifyEcho(ALICE, '0xdeadbeef', client);
    expect(result).toBe(false);

    // After failed echo, internal state should be reset
    const nonce = await tracker.getNextNonce(ALICE, client);
    expect(nonce).toBe(5); // re-synced from RPC, not 11

    // @ts-expect-error: restore
    InternalNonceTracker.ECHO_TIMEOUT_MS = origTimeout;
  });

  test('sequential rapid nonces produce strictly increasing values', async () => {
    const client = mockClient(0);
    const nonces: number[] = [];

    for (let i = 0; i < 10; i++) {
      nonces.push(await tracker.getNextNonce(ALICE, client));
    }

    // Should be strictly increasing: 0, 1, 2, ..., 9
    for (let i = 1; i < nonces.length; i++) {
      expect(nonces[i]).toBeGreaterThan(nonces[i - 1]);
    }
    expect(nonces[0]).toBe(0);
    expect(nonces[9]).toBe(9);
  });

  test('constants have sensible values', () => {
    expect(InternalNonceTracker.RESYNC_THRESHOLD_MS).toBe(60_000);
    expect(InternalNonceTracker.ECHO_TIMEOUT_MS).toBe(5_000);
  });
});
