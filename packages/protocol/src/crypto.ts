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
  const messageHash = ethers.keccak256(ethers.toUtf8Bytes(turn.message));

  return ethers.solidityPackedKeccak256(
    ['bytes32', 'address', 'uint16', 'uint64', 'bytes32'],
    [
      ethers.zeroPadValue(ethers.toUtf8Bytes(turn.battleId.slice(0, 32).padEnd(32, '\0')), 32),
      turn.agentAddress,
      turn.turnNumber,
      turn.timestamp,
      messageHash,
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
