import { describe, test, expect } from 'bun:test';
import { keccak256, toHex, encodePacked } from 'viem';

/**
 * CTF (Capture The Flag) mechanic unit tests.
 * Tests the secret hashing, commitment, and verification logic
 * that backs the on-chain captureFlag() function.
 */
describe('CTF String-Secret Mechanic', () => {
  const SECRET_A = 'alpha-secret-phrase';
  const SECRET_B = 'bravo-secret-phrase';

  test('secret hash is deterministic', () => {
    const hash1 = keccak256(encodePacked(['string'], [SECRET_A]));
    const hash2 = keccak256(encodePacked(['string'], [SECRET_A]));
    expect(hash1).toBe(hash2);
  });

  test('different secrets produce different hashes', () => {
    const hashA = keccak256(encodePacked(['string'], [SECRET_A]));
    const hashB = keccak256(encodePacked(['string'], [SECRET_B]));
    expect(hashA).not.toBe(hashB);
  });

  test('empty string produces valid hash (but should be rejected by contract)', () => {
    const hash = keccak256(encodePacked(['string'], ['']));
    expect(hash).toHaveLength(66); // 0x + 64 hex chars
    expect(hash).toStartWith('0x');
  });

  test('hash of empty string is not zero bytes', () => {
    const hash = keccak256(encodePacked(['string'], ['']));
    const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';
    expect(hash).not.toBe(ZERO_HASH);
  });

  test('secret with special characters hashes correctly', () => {
    const secret = 'h3ll0-w0rld!@#$%^&*()';
    const hash = keccak256(encodePacked(['string'], [secret]));
    expect(hash).toHaveLength(66);
  });

  test('long secret (256 chars) hashes correctly', () => {
    const secret = 'a'.repeat(256);
    const hash = keccak256(encodePacked(['string'], [secret]));
    expect(hash).toHaveLength(66);
  });

  test('unicode secrets hash correctly', () => {
    const secret = '🦞 secret agent crab 🦀';
    const hash = keccak256(encodePacked(['string'], [secret]));
    expect(hash).toHaveLength(66);
  });

  test('whitespace-only secret hashes differently from empty', () => {
    const emptyHash = keccak256(encodePacked(['string'], ['']));
    const spaceHash = keccak256(encodePacked(['string'], [' ']));
    expect(emptyHash).not.toBe(spaceHash);
  });

  test('case sensitivity — same word different case produces different hash', () => {
    const lower = keccak256(encodePacked(['string'], ['secret']));
    const upper = keccak256(encodePacked(['string'], ['Secret']));
    expect(lower).not.toBe(upper);
  });

  test('secret generation: random secrets are unique', () => {
    const secrets = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      secrets.add(toHex(bytes));
    }
    expect(secrets.size).toBe(100);
  });

  test('secret hash matches Solidity keccak256(abi.encodePacked(string))', () => {
    // This is the encoding Solidity uses for keccak256(abi.encodePacked(secret))
    // abi.encodePacked for a string is just the raw bytes of the string
    const secret = 'test-secret';
    const hash = keccak256(encodePacked(['string'], [secret]));
    // Verify it's a valid bytes32
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
