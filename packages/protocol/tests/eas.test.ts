import { describe, it, expect, beforeEach } from 'bun:test';
import { EASVerifier } from '../src/eas.ts';
import type { Address, Hex } from 'viem';

// Mock public client that returns controlled attestation data
function createMockClient(attestations: Record<string, any> = {}) {
  return {
    readContract: async ({ args }: any) => {
      const uid = args[0] as string;
      const att = attestations[uid];
      if (!att) throw new Error('Attestation not found');
      return [
        att.uid ?? uid,
        att.schema ?? '0x0000000000000000000000000000000000000000000000000000000000000001',
        att.time ?? 1700000000n,
        att.expirationTime ?? 0n,
        att.revocationTime ?? 0n,
        att.refUID ?? '0x0000000000000000000000000000000000000000000000000000000000000000',
        att.recipient ?? '0x0000000000000000000000000000000000000001',
        att.attester ?? '0x0000000000000000000000000000000000000002',
        att.revocable ?? true,
        att.data ?? '0x',
      ];
    },
  } as any;
}

const AUDITOR_A = '0x000000000000000000000000000000000000000A' as Address;
const AUDITOR_B = '0x000000000000000000000000000000000000000B' as Address;
const AUDITOR_C = '0x000000000000000000000000000000000000000C' as Address;
const SCHEMA_UID = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex;
const UID_1 = '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex;
const UID_2 = '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex;
const UID_3 = '0x3333333333333333333333333333333333333333333333333333333333333333' as Hex;
const LOGIC_HASH = '0xaabbccdd00000000000000000000000000000000000000000000000000000000' as Hex;

describe('EASVerifier', () => {
  describe('validateAttestation', () => {
    it('should validate a good attestation', async () => {
      const client = createMockClient({
        [UID_1]: { attester: AUDITOR_A, schema: SCHEMA_UID },
      });
      const verifier = new EASVerifier(client, { schemaUID: SCHEMA_UID });
      const result = await verifier.validateAttestation(UID_1, [AUDITOR_A]);
      expect(result.valid).toBe(true);
    });

    it('should reject revoked attestation', async () => {
      const client = createMockClient({
        [UID_1]: { attester: AUDITOR_A, revocationTime: 1700000001n },
      });
      const verifier = new EASVerifier(client);
      const result = await verifier.validateAttestation(UID_1, [AUDITOR_A]);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('revoked');
    });

    it('should reject expired attestation', async () => {
      const client = createMockClient({
        [UID_1]: { attester: AUDITOR_A, expirationTime: 1n }, // expired long ago
      });
      const verifier = new EASVerifier(client);
      const result = await verifier.validateAttestation(UID_1, [AUDITOR_A]);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('expired');
    });

    it('should reject untrusted auditor', async () => {
      const client = createMockClient({
        [UID_1]: { attester: AUDITOR_C },
      });
      const verifier = new EASVerifier(client);
      const result = await verifier.validateAttestation(UID_1, [AUDITOR_A, AUDITOR_B]);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('untrusted_auditor');
    });

    it('should reject schema mismatch when schemaUID is set', async () => {
      const client = createMockClient({
        [UID_1]: {
          attester: AUDITOR_A,
          schema: '0x9999999999999999999999999999999999999999999999999999999999999999',
        },
      });
      const verifier = new EASVerifier(client, { schemaUID: SCHEMA_UID });
      const result = await verifier.validateAttestation(UID_1, [AUDITOR_A]);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('schema_mismatch');
    });

    it('should handle fetch errors gracefully', async () => {
      const client = createMockClient({}); // UID_1 not in map → throws
      const verifier = new EASVerifier(client);
      const result = await verifier.validateAttestation(UID_1, [AUDITOR_A]);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('fetch_error');
    });
  });

  describe('verifyThreshold', () => {
    it('should pass with enough distinct auditors', async () => {
      const client = createMockClient({
        [UID_1]: { attester: AUDITOR_A },
        [UID_2]: { attester: AUDITOR_B },
      });
      const verifier = new EASVerifier(client);
      const result = await verifier.verifyThreshold(
        [UID_1, UID_2],
        [AUDITOR_A, AUDITOR_B],
        2
      );
      expect(result.passed).toBe(true);
      expect(result.validCount).toBe(2);
    });

    it('should fail when under threshold', async () => {
      const client = createMockClient({
        [UID_1]: { attester: AUDITOR_A },
      });
      const verifier = new EASVerifier(client);
      const result = await verifier.verifyThreshold([UID_1], [AUDITOR_A, AUDITOR_B], 2);
      expect(result.passed).toBe(false);
      expect(result.validCount).toBe(1);
    });

    it('should deduplicate same auditor with multiple attestations', async () => {
      const client = createMockClient({
        [UID_1]: { attester: AUDITOR_A },
        [UID_2]: { attester: AUDITOR_A }, // same auditor, different UID
      });
      const verifier = new EASVerifier(client);
      const result = await verifier.verifyThreshold(
        [UID_1, UID_2],
        [AUDITOR_A],
        2
      );
      expect(result.passed).toBe(false);
      expect(result.validCount).toBe(1); // deduplicated
    });
  });

  describe('reputation cache', () => {
    it('should cache and return without re-fetching', async () => {
      let fetchCount = 0;
      const client = {
        readContract: async ({ args }: any) => {
          fetchCount++;
          return [
            args[0], SCHEMA_UID, 1700000000n, 0n, 0n,
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            '0x0000000000000000000000000000000000000001',
            AUDITOR_A, true, '0x',
          ];
        },
      } as any;

      const verifier = new EASVerifier(client, { cacheTTLMs: 60_000 });

      // First call: fetches from chain
      await verifier.getCachedReputation(LOGIC_HASH, [UID_1], [AUDITOR_A]);
      expect(fetchCount).toBe(1);

      // Second call: should hit cache
      await verifier.getCachedReputation(LOGIC_HASH, [UID_1], [AUDITOR_A]);
      expect(fetchCount).toBe(1); // unchanged — cached
    });

    it('should evict oldest entry when max size reached', async () => {
      const client = createMockClient({
        [UID_1]: { attester: AUDITOR_A },
      });
      const verifier = new EASVerifier(client, { maxCacheSize: 2 });

      const hash1 = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex;
      const hash2 = '0x0000000000000000000000000000000000000000000000000000000000000002' as Hex;
      const hash3 = '0x0000000000000000000000000000000000000000000000000000000000000003' as Hex;

      await verifier.getCachedReputation(hash1, [UID_1], [AUDITOR_A]);
      await verifier.getCachedReputation(hash2, [UID_1], [AUDITOR_A]);
      expect(verifier.getCacheStats().size).toBe(2);

      // Adding a third should evict hash1 (oldest)
      await verifier.getCachedReputation(hash3, [UID_1], [AUDITOR_A]);
      expect(verifier.getCacheStats().size).toBe(2);
    });

    it('should report correct cache stats', () => {
      const client = createMockClient({});
      const verifier = new EASVerifier(client, { maxCacheSize: 128, cacheTTLMs: 30_000 });
      const stats = verifier.getCacheStats();
      expect(stats.maxSize).toBe(128);
      expect(stats.ttlMs).toBe(30_000);
      expect(stats.size).toBe(0);
    });
  });

  describe('isTrustedLogic', () => {
    it('should return true for trusted logic with valid attestation', async () => {
      const client = createMockClient({
        [UID_1]: { attester: AUDITOR_A },
      });
      const verifier = new EASVerifier(client);
      const trusted = await verifier.isTrustedLogic(LOGIC_HASH, [UID_1], [AUDITOR_A]);
      expect(trusted).toBe(true);
    });

    it('should enforce threshold parameter', async () => {
      const client = createMockClient({
        [UID_1]: { attester: AUDITOR_A },
      });
      const verifier = new EASVerifier(client);
      const trusted = await verifier.isTrustedLogic(LOGIC_HASH, [UID_1], [AUDITOR_A, AUDITOR_B], 2);
      expect(trusted).toBe(false); // only 1 valid auditor, need 2
    });
  });

  describe('detectToxicity', () => {
    it('should detect newly revoked attestation', async () => {
      let revoked = false;
      const client = {
        readContract: async ({ args }: any) => {
          return [
            args[0], SCHEMA_UID, 1700000000n, 0n,
            revoked ? 1700000001n : 0n, // revocationTime toggles
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            '0x0000000000000000000000000000000000000001',
            AUDITOR_A, true, '0x',
          ];
        },
      } as any;

      const verifier = new EASVerifier(client, { cacheTTLMs: 60_000 });

      // Prime cache with valid attestation
      await verifier.getCachedReputation(LOGIC_HASH, [UID_1], [AUDITOR_A]);

      // Now revoke it
      revoked = true;

      const result = await verifier.detectToxicity(LOGIC_HASH, [UID_1], [AUDITOR_A]);
      expect(result.toxic).toBe(true);
      expect(result.revokedUIDs).toEqual([UID_1]);
    });

    it('should report non-toxic when nothing changed', async () => {
      const client = createMockClient({
        [UID_1]: { attester: AUDITOR_A },
      });
      const verifier = new EASVerifier(client, { cacheTTLMs: 60_000 });

      await verifier.getCachedReputation(LOGIC_HASH, [UID_1], [AUDITOR_A]);
      const result = await verifier.detectToxicity(LOGIC_HASH, [UID_1], [AUDITOR_A]);
      expect(result.toxic).toBe(false);
      expect(result.revokedUIDs).toEqual([]);
    });
  });
});
