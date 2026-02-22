import { type PublicClient, type Address, type Hex, decodeAbiParameters, parseAbiItem } from 'viem';

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

/**
 * EASVerifier — Utility for verifying on-chain Ethereum Attestation Service proofs.
 * Clawttack v3 Spec v1.20+: Mandates Reputation-Anchored trust.
 */
export class EASVerifier {
  private publicClient: PublicClient;
  private easAddress: Address;

  // Official EAS Address on Base: 0x4200000000000000000000000000000000000021
  constructor(publicClient: PublicClient, easAddress: Address = '0x4200000000000000000000000000000000000021') {
    this.publicClient = publicClient;
    this.easAddress = easAddress;
  }

  /**
   * Fetches and verifies an attestation by UID.
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
   * Verifies if an attestation is valid, not revoked, and signed by a trusted auditor.
   */
  async verifyVOPAttestation(uid: Hex, trustedAuditors: Address[]): Promise<boolean> {
    try {
      const attestation = await this.getAttestation(uid);
      
      // 1. Check if revoked
      if (attestation.revocationTime > 0n) return false;
      
      // 2. Check if expired
      if (attestation.expirationTime > 0n && attestation.expirationTime < BigInt(Math.floor(Date.now() / 1000))) return false;

      // 3. Verify attester is a trusted auditor
      const isTrusted = trustedAuditors.some(a => a.toLowerCase() === attestation.attester.toLowerCase());
      if (!isTrusted) return false;

      return true;
    } catch {
      return false;
    }
  }
}
