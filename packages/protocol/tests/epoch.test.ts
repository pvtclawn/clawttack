// tests/epoch.test.ts — Epoch Anchoring Tests (Subtask 11.AE)

import { describe, it, expect, beforeEach } from 'bun:test';
import { Epoch, type EpochSnapshot } from '../src/epoch';
import { IntegrityError, ReorgDetectedError } from '../src/errors';

// Mock PublicClient
function createMockClient(options: {
  blockNumber?: bigint;
  blockHash?: string;
  timestamp?: bigint;
  reorgHash?: string; // If set, getBlock by number returns different hash
} = {}) {
  const num = options.blockNumber ?? 1000n;
  const hash = options.blockHash ?? '0xaaaa';
  const ts = options.timestamp ?? 1700000000n;
  const reorgHash = options.reorgHash;

  return {
    getBlock: async (params: any) => {
      if (params.blockTag === 'latest') {
        return { number: num, hash, timestamp: ts };
      }
      if (params.blockNumber !== undefined) {
        // Simulate reorg: return different hash for same height
        return {
          number: params.blockNumber,
          hash: reorgHash ?? hash,
          timestamp: ts,
        };
      }
      return { number: num, hash, timestamp: ts };
    },
    readContract: async (params: any) => {
      // Verify blockNumber is injected
      if (params.blockNumber === undefined) {
        throw new Error('readContract called without blockNumber');
      }
      return 'mock_result';
    },
  } as any;
}

describe('Epoch', () => {
  describe('create', () => {
    it('should create an epoch anchored to the latest block', async () => {
      const client = createMockClient({ blockNumber: 500n, blockHash: '0xbeef' });
      const epoch = await Epoch.create(client);

      expect(epoch.blockNumber).toBe(500n);
      expect(epoch.blockHash).toBe('0xbeef');
      expect(epoch.ageMs).toBeLessThan(100);
      expect(epoch.isStale).toBe(false);
    });

    it('should create an epoch with confirmations', async () => {
      const client = createMockClient({ blockNumber: 500n, blockHash: '0xbeef' });
      const epoch = await Epoch.create(client, { confirmations: 3 });

      // Should anchor to block 497, not 500
      expect(epoch.blockNumber).toBe(497n);
    });

    it('should reject confirmations exceeding chain height', async () => {
      const client = createMockClient({ blockNumber: 2n });

      await expect(Epoch.create(client, { confirmations: 5 }))
        .rejects
        .toThrow(IntegrityError);
    });
  });

  describe('freshness', () => {
    it('should report fresh epoch as not stale', async () => {
      const client = createMockClient();
      const epoch = await Epoch.create(client, { maxAgeMs: 60_000 });

      expect(epoch.isStale).toBe(false);
      expect(() => epoch.assertFresh()).not.toThrow();
    });

    it('should detect stale epoch', async () => {
      const client = createMockClient();
      // Create with 1ms max age — will be stale almost immediately
      const epoch = await Epoch.create(client, { maxAgeMs: 1 });

      // Wait just a tiny bit
      await new Promise(r => setTimeout(r, 5));

      expect(epoch.isStale).toBe(true);
      expect(() => epoch.assertFresh()).toThrow(IntegrityError);
    });
  });

  describe('canonicality', () => {
    it('should pass for canonical blocks', async () => {
      const client = createMockClient({ blockNumber: 100n, blockHash: '0xdead' });
      const epoch = await Epoch.create(client);

      // assertCanonical re-fetches the block — same hash = canonical
      await expect(epoch.assertCanonical()).resolves.toBeUndefined();
    });

    it('should detect reorgs (hash change at same height)', async () => {
      const client = createMockClient({
        blockNumber: 100n,
        blockHash: '0xdead',
        reorgHash: '0xbeef', // Different hash on re-fetch
      });
      const epoch = await Epoch.create(client);

      await expect(epoch.assertCanonical()).rejects.toThrow(ReorgDetectedError);
    });
  });

  describe('assertValid', () => {
    it('should pass for fresh + canonical', async () => {
      const client = createMockClient({ blockNumber: 100n, blockHash: '0xok' });
      const epoch = await Epoch.create(client, { maxAgeMs: 60_000 });

      await expect(epoch.assertValid()).resolves.toBeUndefined();
    });

    it('should fail for stale', async () => {
      const client = createMockClient();
      const epoch = await Epoch.create(client, { maxAgeMs: 1 });
      await new Promise(r => setTimeout(r, 5));

      // assertValid checks freshness first
      await expect(epoch.assertValid()).rejects.toThrow(IntegrityError);
    });
  });

  describe('readContract', () => {
    it('should inject blockNumber into contract reads', async () => {
      const client = createMockClient({ blockNumber: 42n });
      const epoch = await Epoch.create(client);

      const result = await epoch.readContract({
        address: '0x1234' as any,
        abi: [],
        functionName: 'test',
      });

      expect(result).toBe('mock_result');
    });
  });

  describe('toAnchor', () => {
    it('should produce TurnParams-compatible anchoring data', async () => {
      const client = createMockClient({
        blockNumber: 200n,
        blockHash: '0xanchor',
      });
      const epoch = await Epoch.create(client);
      const seqHash = '0xseq123' as `0x${string}`;

      const anchor = epoch.toAnchor(seqHash);

      expect(anchor.anchoredBlockNumber).toBe(200n);
      expect(anchor.anchoredBlockHash).toBe('0xanchor');
      expect(anchor.expectedSequenceHash).toBe('0xseq123');
    });
  });

  describe('snapshot immutability', () => {
    it('should have a stable snapshot regardless of chain progress', async () => {
      let currentBlock = 100n;
      const client = {
        getBlock: async (params: any) => {
          if (params.blockTag === 'latest') {
            return { number: currentBlock, hash: '0xfixed', timestamp: 1700000000n };
          }
          return { number: params.blockNumber ?? currentBlock, hash: '0xfixed', timestamp: 1700000000n };
        },
        readContract: async () => 'ok',
      } as any;

      const epoch = await Epoch.create(client);
      expect(epoch.blockNumber).toBe(100n);

      // Chain advances
      currentBlock = 200n;

      // Epoch is still pinned at 100
      expect(epoch.blockNumber).toBe(100n);
    });
  });
});
