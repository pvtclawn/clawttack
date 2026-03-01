import { describe, expect, test } from 'bun:test';
import { ethers } from 'ethers';
import { solveHashPreimage, solveVOP } from './vop-solver.ts';

describe('vop-solver', () => {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  describe('solveHashPreimage', () => {
    test('solves 8 leading zero bits', () => {
      const salt = ethers.hexlify(ethers.randomBytes(32));
      const params = abiCoder.encode(['bytes32', 'uint8'], [salt, 8]);

      const result = solveHashPreimage(params);

      expect(result.solution).toBeGreaterThanOrEqual(0n);
      expect(result.attempts).toBeGreaterThan(0);
      expect(result.attempts).toBeLessThan(10000); // 2^8 = 256 expected

      // Verify solution
      const encoded = abiCoder.encode(['bytes32', 'uint256'], [salt, result.solution]);
      const hash = ethers.keccak256(encoded);
      const hashBN = BigInt(hash);
      expect(hashBN >> 248n).toBe(0n); // top 8 bits = 0
    });

    test('solves 10 leading zero bits', () => {
      const salt = ethers.hexlify(ethers.randomBytes(32));
      const params = abiCoder.encode(['bytes32', 'uint8'], [salt, 10]);

      const result = solveHashPreimage(params);

      expect(result.solution).toBeGreaterThanOrEqual(0n);
      expect(result.attempts).toBeLessThan(50000); // 2^10 = 1024 expected

      // Verify solution
      const encoded = abiCoder.encode(['bytes32', 'uint256'], [salt, result.solution]);
      const hash = ethers.keccak256(encoded);
      const hashBN = BigInt(hash);
      expect(hashBN >> 246n).toBe(0n); // top 10 bits = 0
    });

    test('handles empty params (turn 0)', () => {
      const result = solveHashPreimage('0x');
      expect(result.solution).toBe(0n);
      expect(result.attempts).toBe(0);
    });

    test('handles null params', () => {
      const result = solveHashPreimage('');
      expect(result.solution).toBe(0n);
      expect(result.attempts).toBe(0);
    });

    test('matches on-chain verification', () => {
      // Simulate what generateParams(randomness) produces
      const randomness = 12345n;
      const salt = ethers.zeroPadValue(ethers.toBeHex(randomness), 32);
      const leadingZeros = Number((randomness % 4n) + 8n); // 8 + (12345 % 4) = 8 + 1 = 9

      const params = abiCoder.encode(['bytes32', 'uint8'], [salt, leadingZeros]);
      const result = solveHashPreimage(params);

      // Verify: hash >> (256 - leadingZeros) == 0
      const encoded = abiCoder.encode(['bytes32', 'uint256'], [salt, result.solution]);
      const hash = ethers.keccak256(encoded);
      const hashBN = BigInt(hash);
      const shiftAmount = 256n - BigInt(leadingZeros);
      expect(hashBN >> shiftAmount).toBe(0n);
    });

    test('reports timing', () => {
      const salt = ethers.hexlify(ethers.randomBytes(32));
      const params = abiCoder.encode(['bytes32', 'uint8'], [salt, 8]);

      const result = solveHashPreimage(params);
      expect(result.timeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('solveVOP', () => {
    test('dispatches to hash-preimage', () => {
      const salt = ethers.hexlify(ethers.randomBytes(32));
      const params = abiCoder.encode(['bytes32', 'uint8'], [salt, 8]);

      const result = solveVOP('hash-preimage', params);
      expect(result.solution).toBeGreaterThanOrEqual(0n);
    });

    test('returns 0 for unsupported VOPs', () => {
      const result = solveVOP('l1-metadata', '0x');
      expect(result.solution).toBe(0n);
    });
  });
});
