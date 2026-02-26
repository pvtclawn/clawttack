import { describe, test, expect } from 'bun:test';
import { generateCTFSecret, hashCTFSecret } from '../src/crypto.ts';
import { ethers } from 'ethers';

describe('CTF Secret Generation', () => {
  test('generateCTFSecret returns secret and hash', () => {
    const { secret, secretHash } = generateCTFSecret();
    expect(secret).toStartWith('ctf-');
    expect(secret.length).toBe(52); // 'ctf-' + 48 hex chars
    expect(secretHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test('generateCTFSecret produces unique secrets', () => {
    const a = generateCTFSecret();
    const b = generateCTFSecret();
    expect(a.secret).not.toBe(b.secret);
    expect(a.secretHash).not.toBe(b.secretHash);
  });

  test('generateCTFSecret hash matches manual keccak256', () => {
    const { secret, secretHash } = generateCTFSecret();
    const manualHash = ethers.solidityPackedKeccak256(['string'], [secret]);
    expect(secretHash).toBe(manualHash);
  });

  test('hashCTFSecret matches on-chain keccak256(abi.encodePacked(secret))', () => {
    const secret = 'ctf-abcdef1234567890abcdef1234567890abcdef12345678';
    const hash = hashCTFSecret(secret);
    const expected = ethers.solidityPackedKeccak256(['string'], [secret]);
    expect(hash).toBe(expected);
  });

  test('hashCTFSecret rejects short secrets', () => {
    expect(() => hashCTFSecret('short')).toThrow('at least 32 characters');
    expect(() => hashCTFSecret('a'.repeat(31))).toThrow('at least 32 characters');
  });

  test('hashCTFSecret accepts 32+ char secrets', () => {
    const hash = hashCTFSecret('a'.repeat(32));
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test('generateCTFSecret hash is consistent with hashCTFSecret', () => {
    const { secret, secretHash } = generateCTFSecret();
    expect(hashCTFSecret(secret)).toBe(secretHash);
  });
});
