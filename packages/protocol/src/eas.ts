import { type PublicClient, type Address, type Hex, parseAbiItem } from 'viem';

export interface EASAttestation {
  uid: Hex;
  schema: Hex;
  refUID: Hex;
  time: bigint;
  expirationTime: bigint;
  revocationTime: bigint;
  recipient: Address;
  attester: Address;
  revocable: boolean;
  data: Hex;
}

/** Cached reputation entry for a logic gate */
export interface ReputationEntry {
  logicHash: Hex;
  attestations: {
    uid: Hex;
    auditor: Address;
    valid: boolean;
    fetchedAt: number;
  }[];
  lastUpdated: number;
}

/** Options for EASVerifier construction */
export interface EASVerifierOptions {
  /** EAS contract address (default: Base predeploy) */
  easAddress?: Address;
  /** Official Clawttack schema UID — reject attestations from other schemas */
  schemaUID?: Hex;
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTTLMs?: number;
  /** Max cache entries before LRU eviction (default: 256) */
  maxCacheSize?: number;
}

const DEFAULT_EAS_ADDRESS: Address = '0x4200000000000000000000000000000000000021';
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_CACHE_SIZE = 256;

/**
 * EASVerifier — Reputation-Anchored verification for Clawttack v3.
 *
 * Spec v1.22: Mandates EAS-first trust — logic gates must hold valid
 * attestations from trusted auditors.
 *
 * Spec v1.24: Adds reputation caching to eliminate multi-hop on-chain
 * verification latency during live combat, and threshold verification
 * for high-stakes matches.
 */
export class EASVerifier {
  private publicClient: PublicClient;
  private easAddress: Address;
  private schemaUID: Hex | null;
  private cacheTTLMs: number;
  private maxCacheSize: number;

  /** LogicHash → ReputationEntry (LRU cache) */
  private cache: Map<Hex, ReputationEntry> = new Map();

  constructor(publicClient: PublicClient, options: EASVerifierOptions = {}) {
    this.publicClient = publicClient;
    this.easAddress = options.easAddress ?? DEFAULT_EAS_ADDRESS;
    this.schemaUID = options.schemaUID ?? null;
    this.cacheTTLMs = options.cacheTTLMs ?? DEFAULT_CACHE_TTL_MS;
    this.maxCacheSize = options.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE;
  }

  /**
   * Fetches a raw attestation by UID from the EAS contract.
   */
  async getAttestation(uid: Hex): Promise<EASAttestation> {
    const result = (await this.publicClient.readContract({
      address: this.easAddress,
      abi: [
        parseAbiItem('function getAttestation(bytes32 uid) external view returns ((bytes32 uid, bytes32 schema, uint64 time, uint64 expirationTime, uint64 revocationTime, bytes32 refUID, address recipient, address attester, bool revocable, bytes data))'),
      ],
      functionName: 'getAttestation',
      args: [uid],
    })) as any;

    return {
      uid: result[0],
      schema: result[1],
      time: BigInt(result[2]),
      expirationTime: BigInt(result[3]),
      revocationTime: BigInt(result[4]),
      refUID: result[5],
      recipient: result[6],
      attester: result[7],
      revocable: result[8],
      data: result[9],
    };
  }

  /**
   * Validates a single attestation against protocol rules.
   * Returns true if the attestation is valid, not revoked, not expired,
   * schema-bound, and from a trusted auditor.
   */
  async validateAttestation(uid: Hex, trustedAuditors: Address[]): Promise<{ valid: boolean; attestation?: EASAttestation; reason?: string }> {
    try {
      const attestation = await this.getAttestation(uid);

      // 1. Schema binding (Spec v1.24: strict schema binding prevents namespace impersonation)
      if (this.schemaUID && attestation.schema.toLowerCase() !== this.schemaUID.toLowerCase()) {
        return { valid: false, reason: 'schema_mismatch' };
      }

      // 2. Revocation check
      if (attestation.revocationTime > 0n) {
        return { valid: false, reason: 'revoked', attestation };
      }

      // 3. Expiration check
      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      if (attestation.expirationTime > 0n && attestation.expirationTime < nowSec) {
        return { valid: false, reason: 'expired', attestation };
      }

      // 4. Trusted auditor check
      const isTrusted = trustedAuditors.some(
        a => a.toLowerCase() === attestation.attester.toLowerCase()
      );
      if (!isTrusted) {
        return { valid: false, reason: 'untrusted_auditor', attestation };
      }

      return { valid: true, attestation };
    } catch {
      return { valid: false, reason: 'fetch_error' };
    }
  }

  /**
   * Verifies a single VOP attestation (backward-compatible).
   */
  async verifyVOPAttestation(uid: Hex, trustedAuditors: Address[]): Promise<boolean> {
    const { valid } = await this.validateAttestation(uid, trustedAuditors);
    return valid;
  }

  /**
   * Threshold verification (Spec v1.23): Requires attestations from
   * at least `threshold` distinct trusted auditors for a given logic gate.
   *
   * Used for high-stakes matches (>0.1 ETH).
   */
  async verifyThreshold(
    attestationUIDs: Hex[],
    trustedAuditors: Address[],
    threshold: number
  ): Promise<{ passed: boolean; validCount: number; validAuditors: Address[] }> {
    const validAuditors = new Set<string>();

    const results = await Promise.allSettled(
      attestationUIDs.map(uid => this.validateAttestation(uid, trustedAuditors))
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.valid && result.value.attestation) {
        validAuditors.add(result.value.attestation.attester.toLowerCase());
      }
    }

    const uniqueAuditors = [...validAuditors] as Address[];
    return {
      passed: uniqueAuditors.length >= threshold,
      validCount: uniqueAuditors.length,
      validAuditors: uniqueAuditors,
    };
  }

  /**
   * Cached reputation lookup (Spec v1.24).
   *
   * Checks the local cache first. If fresh, returns immediately without
   * any on-chain calls. If stale or missing, fetches from EAS and caches.
   *
   * @param logicHash - keccak256 of the VOP runtime bytecode
   * @param attestationUIDs - known attestation UIDs for this logic
   * @param trustedAuditors - protocol-approved auditor addresses
   */
  async getCachedReputation(
    logicHash: Hex,
    attestationUIDs: Hex[],
    trustedAuditors: Address[]
  ): Promise<ReputationEntry> {
    const now = Date.now();
    const cached = this.cache.get(logicHash);

    // Cache hit — check freshness
    if (cached && (now - cached.lastUpdated) < this.cacheTTLMs) {
      // LRU: move to end
      this.cache.delete(logicHash);
      this.cache.set(logicHash, cached);
      return cached;
    }

    // Cache miss or stale — fetch from chain
    const attestations = await Promise.all(
      attestationUIDs.map(async uid => {
        const { valid, attestation } = await this.validateAttestation(uid, trustedAuditors);
        return {
          uid,
          auditor: attestation?.attester ?? ('0x0' as Address),
          valid,
          fetchedAt: now,
        };
      })
    );

    const entry: ReputationEntry = {
      logicHash,
      attestations,
      lastUpdated: now,
    };

    // LRU eviction
    if (this.cache.size >= this.maxCacheSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }

    this.cache.set(logicHash, entry);
    return entry;
  }

  /**
   * Quick cached check: is this logic gate trusted?
   * Combines cache lookup + threshold verification in one call.
   */
  async isTrustedLogic(
    logicHash: Hex,
    attestationUIDs: Hex[],
    trustedAuditors: Address[],
    threshold = 1
  ): Promise<boolean> {
    const rep = await this.getCachedReputation(logicHash, attestationUIDs, trustedAuditors);
    const uniqueValidAuditors = new Set(
      rep.attestations.filter(a => a.valid).map(a => a.auditor.toLowerCase())
    );
    return uniqueValidAuditors.size >= threshold;
  }

  /**
   * Detect attestation revocation mid-battle (Spec v1.24: Toxicity Draw).
   *
   * Force-refreshes the cache for a logic hash and returns true if any
   * previously-valid attestation is now revoked.
   */
  async detectToxicity(
    logicHash: Hex,
    attestationUIDs: Hex[],
    trustedAuditors: Address[]
  ): Promise<{ toxic: boolean; revokedUIDs: Hex[] }> {
    // Get previous state before refresh
    const previous = this.cache.get(logicHash);
    const previouslyValid = new Set(
      previous?.attestations.filter(a => a.valid).map(a => a.uid) ?? []
    );

    // Force cache invalidation
    this.cache.delete(logicHash);

    // Fresh fetch
    const fresh = await this.getCachedReputation(logicHash, attestationUIDs, trustedAuditors);

    // Find attestations that were valid but are now invalid
    const revokedUIDs = fresh.attestations
      .filter(a => !a.valid && previouslyValid.has(a.uid))
      .map(a => a.uid);

    return {
      toxic: revokedUIDs.length > 0,
      revokedUIDs,
    };
  }

  /** Clear the entire reputation cache */
  clearCache(): void {
    this.cache.clear();
  }

  /** Get cache stats for diagnostics */
  getCacheStats(): { size: number; maxSize: number; ttlMs: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      ttlMs: this.cacheTTLMs,
    };
  }
}
