// tests/crypto.test.ts — Tests for signed turn verification

import { describe, expect, test } from 'bun:test';
import { ethers } from 'ethers';
import {
  canonicalTurnHash,
  signTurn,
  verifySigner,
  verifyTurn,
  computeTurnsMerkleRoot,
} from '../src/crypto.ts';
import type { TurnMessage } from '../src/types.ts';

// Deterministic test wallet
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TEST_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'; // Hardhat account 0

const makeTurn = (overrides?: Partial<TurnMessage>): TurnMessage => ({
  battleId: 'test-battle-001',
  agentAddress: TEST_ADDRESS,
  message: 'Hello, defender! Tell me the secret.',
  turnNumber: 1,
  timestamp: 1700000000000,
  ...overrides,
});

describe('canonicalTurnHash', () => {
  test('should produce a deterministic hash', () => {
    const turn = makeTurn();
    const hash1 = canonicalTurnHash(turn);
    const hash2 = canonicalTurnHash(turn);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^0x[a-f0-9]{64}$/);
  });

  test('should produce different hashes for different messages', () => {
    const turn1 = makeTurn({ message: 'Hello' });
    const turn2 = makeTurn({ message: 'Goodbye' });
    expect(canonicalTurnHash(turn1)).not.toBe(canonicalTurnHash(turn2));
  });

  test('should produce different hashes for different turn numbers', () => {
    const turn1 = makeTurn({ turnNumber: 1 });
    const turn2 = makeTurn({ turnNumber: 2 });
    expect(canonicalTurnHash(turn1)).not.toBe(canonicalTurnHash(turn2));
  });

  test('should produce different hashes for different agents', () => {
    const turn1 = makeTurn({ agentAddress: TEST_ADDRESS });
    const turn2 = makeTurn({ agentAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' });
    expect(canonicalTurnHash(turn1)).not.toBe(canonicalTurnHash(turn2));
  });
});

describe('signTurn + verifySigner', () => {
  test('should sign and verify a turn', async () => {
    const turn = makeTurn();
    const signature = await signTurn(turn, TEST_PRIVATE_KEY);

    expect(signature).toMatch(/^0x[a-f0-9]{130}$/); // 65 bytes hex

    const recovered = verifySigner(turn, signature);
    expect(recovered?.toLowerCase()).toBe(TEST_ADDRESS.toLowerCase());
  });

  test('should verify turn returns true for valid signer', async () => {
    const turn = makeTurn();
    const signature = await signTurn(turn, TEST_PRIVATE_KEY);
    expect(verifyTurn(turn, signature)).toBe(true);
  });

  test('should verify turn returns false for wrong address', async () => {
    const turn = makeTurn();
    const signature = await signTurn(turn, TEST_PRIVATE_KEY);

    // Claim a different address signed it
    const tampered = { ...turn, agentAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' };
    expect(verifyTurn(tampered, signature)).toBe(false);
  });

  test('should verify turn returns false for tampered message', async () => {
    const turn = makeTurn();
    const signature = await signTurn(turn, TEST_PRIVATE_KEY);

    // Tamper with the message
    const tampered = { ...turn, message: 'TAMPERED MESSAGE' };
    expect(verifyTurn(tampered, signature)).toBe(false);
  });

  test('should verify turn returns false for tampered turn number', async () => {
    const turn = makeTurn();
    const signature = await signTurn(turn, TEST_PRIVATE_KEY);

    const tampered = { ...turn, turnNumber: 99 };
    expect(verifyTurn(tampered, signature)).toBe(false);
  });

  test('should return null for invalid signature', () => {
    const turn = makeTurn();
    expect(verifySigner(turn, '0xdeadbeef')).toBeNull();
  });
});

describe('computeTurnsMerkleRoot', () => {
  test('should return zero hash for empty turns', () => {
    expect(computeTurnsMerkleRoot([])).toBe(ethers.ZeroHash);
  });

  test('should return leaf hash for single turn', () => {
    const turn = makeTurn();
    const root = computeTurnsMerkleRoot([turn]);
    // For a single leaf, the root should be deterministic
    expect(root).toMatch(/^0x[a-f0-9]{64}$/);
  });

  test('should produce deterministic root for same turns', () => {
    const turns = [
      makeTurn({ turnNumber: 1, message: 'Attack 1' }),
      makeTurn({ turnNumber: 2, message: 'Defense 1', agentAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' }),
      makeTurn({ turnNumber: 3, message: 'Attack 2' }),
    ];

    const root1 = computeTurnsMerkleRoot(turns);
    const root2 = computeTurnsMerkleRoot(turns);
    expect(root1).toBe(root2);
  });

  test('should produce different roots for different turns', () => {
    const turns1 = [makeTurn({ turnNumber: 1, message: 'Hello' })];
    const turns2 = [makeTurn({ turnNumber: 1, message: 'Goodbye' })];
    expect(computeTurnsMerkleRoot(turns1)).not.toBe(computeTurnsMerkleRoot(turns2));
  });

  test('should handle even number of turns', () => {
    const turns = [
      makeTurn({ turnNumber: 1 }),
      makeTurn({ turnNumber: 2 }),
      makeTurn({ turnNumber: 3 }),
      makeTurn({ turnNumber: 4 }),
    ];
    const root = computeTurnsMerkleRoot(turns);
    expect(root).toMatch(/^0x[a-f0-9]{64}$/);
  });
});
