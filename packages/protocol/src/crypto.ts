// src/services/crypto.ts — Cryptographic utilities for signed turns
//
// Uses ethers.js for ECDSA signing compatible with Solidity's ecrecover.
// This means on-chain contracts can verify the same signatures.

import { ethers } from 'ethers';
import type { TurnMessage } from './types.ts';

/**
 * Compute the canonical hash of a turn message.
 * Compatible with Solidity: keccak256(abi.encodePacked(battleId, agent, turnNumber, timestamp, messageHash))
 */
export function canonicalTurnHash(turn: TurnMessage): string {
  const narrativeHash = ethers.keccak256(ethers.toUtf8Bytes(turn.narrative));

  return ethers.solidityPackedKeccak256(
    ['bytes32', 'address', 'uint16', 'uint64', 'bytes32'],
    [
      ethers.zeroPadValue(ethers.toUtf8Bytes(turn.battleId.slice(0, 32).padEnd(32, '\0')), 32),
      turn.agentAddress,
      turn.turnNumber,
      turn.timestamp,
      narrativeHash,
    ],
  );
}

/**
 * Sign a turn message with a private key.
 * Returns the ECDSA signature (65 bytes, hex encoded).
 */
export async function signTurn(turn: TurnMessage, privateKey: string): Promise<string> {
  const wallet = new ethers.Wallet(privateKey);
  const hash = canonicalTurnHash(turn);

  // Sign the hash as an Ethereum signed message (EIP-191 prefix)
  return wallet.signMessage(ethers.getBytes(hash));
}

/**
 * Verify a signed turn message.
 * Returns the recovered signer address, or null if invalid.
 */
export function verifySigner(turn: TurnMessage, signature: string): string | null {
  try {
    const hash = canonicalTurnHash(turn);
    return ethers.verifyMessage(ethers.getBytes(hash), signature);
  } catch {
    return null;
  }
}

/**
 * Verify that a signed turn was actually signed by the claimed agent.
 */
export function verifyTurn(turn: TurnMessage, signature: string): boolean {
  const recovered = verifySigner(turn, signature);
  if (!recovered) return false;
  return recovered.toLowerCase() === turn.agentAddress.toLowerCase();
}

/**
 * Compute Merkle root of all turns (for on-chain batch verification).
 * Each leaf is the canonical turn hash.
 */
export function computeTurnsMerkleRoot(turns: TurnMessage[]): string {
  if (turns.length === 0) return ethers.ZeroHash;

  let hashes = turns.map(t => canonicalTurnHash(t));

  // Build Merkle tree (simple binary tree, pad with zero hash if odd)
  while (hashes.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < hashes.length; i += 2) {
      const left = hashes[i]!;
      const right = hashes[i + 1] ?? ethers.ZeroHash;
      // Sort to make tree order-independent (standard Merkle convention)
      const [a, b] = left < right ? [left, right] : [right, left];
      next.push(ethers.keccak256(ethers.concat([a, b])));
    }
    hashes = next;
  }

  return hashes[0]!;
}

// ─── CTF Secret Generation ─────────────────────────────────────────────────

const MIN_SECRET_LENGTH = 32;

/**
 * Generate a cryptographically random CTF secret and its keccak256 hash.
 * 
 * The secret is a 48-char hex string (24 random bytes) prefixed with a label.
 * Format: `ctf-<48 hex chars>` = 52 chars total, well above brute-force threshold.
 * 
 * ⚠️ The returned `secret` is security-sensitive — do not log or persist it
 * outside the agent's protected context (system prompt / encrypted storage).
 * 
 * @returns { secret, secretHash } — secret is plaintext, secretHash is bytes32 for on-chain commitment
 */
export function generateCTFSecret(): { secret: string; secretHash: `0x${string}` } {
  const randomBytes = crypto.getRandomValues(new Uint8Array(24));
  const hex = Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join('');
  const secret = `ctf-${hex}`;

  const secretHash = ethers.solidityPackedKeccak256(['string'], [secret]) as `0x${string}`;

  return { secret, secretHash };
}

/**
 * Compute the secretHash for a given plaintext secret.
 * Must match the on-chain `keccak256(abi.encodePacked(secret))` in captureFlag().
 * 
 * @throws if secret is shorter than MIN_SECRET_LENGTH (32 chars)
 */
export function hashCTFSecret(secret: string): `0x${string}` {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`CTF secret must be at least ${MIN_SECRET_LENGTH} characters (got ${secret.length}). Use generateCTFSecret() for safe defaults.`);
  }
  return ethers.solidityPackedKeccak256(['string'], [secret]) as `0x${string}`;
}
