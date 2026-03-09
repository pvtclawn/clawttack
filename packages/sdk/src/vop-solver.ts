/**
 * @module vop-solver
 * @description Solves Verifiable Oracle Primitive (VOP) challenges off-chain.
 *
 * Supported VOPs:
 * - HashPreimageVOP: Find solution where keccak256(salt, solution) has N leading zero bits
 *
 * Usage:
 *   const solution = await solveVOP(vopAddress, params);
 *   // submit solution in TurnPayload
 */

import { ethers } from 'ethers';

// ─── Types ──────────────────────────────────────────────────────────────

export interface VOPSolution {
  /** The solution value to submit on-chain */
  solution: bigint;
  /** Number of attempts tried */
  attempts: number;
  /** Time taken in milliseconds */
  timeMs: number;
}

// ─── Known VOP Addresses (set after deployment) ────────────────────────

// These get populated after deployment. For now, identify by interface.
const KNOWN_VOPS = new Map<string, string>(); // address → type

// ─── HashPreimage Solver ────────────────────────────────────────────────

/**
 * Solves HashPreimageVOP: find `solution` where
 * keccak256(abi.encode(salt, solution)) has N leading zero bits.
 *
 * @param params - ABI-encoded (bytes32 salt, uint8 leadingZeroBits)
 * @param maxAttempts - Maximum brute-force attempts (default: 10M)
 * @returns VOPSolution with the found solution
 */
export function solveHashPreimage(
  params: string,
  maxAttempts: number = 10_000_000,
): VOPSolution {
  const startTime = Date.now();

  // Empty params = no VOP (turn 0)
  if (!params || params === '0x' || params === '0x00') {
    return { solution: 0n, attempts: 0, timeMs: 0 };
  }

  // Decode params: (bytes32 salt, uint8 leadingZeroBits)
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const [salt, leadingZeroBits] = abiCoder.decode(
    ['bytes32', 'uint8'],
    params,
  );

  const zeroBits = Number(leadingZeroBits);
  if (zeroBits >= 256) {
    throw new Error(`Invalid leadingZeroBits: ${zeroBits}`);
  }

  // Calculate the mask: top N bits must be 0
  // hash >> (256 - zeroBits) == 0
  const shiftAmount = 256n - BigInt(zeroBits);

  // Brute force: try random solutions
  // For 8-11 leading zeros, expected attempts: 2^8 to 2^11 (256 to 2048)
  for (let i = 0; i < maxAttempts; i++) {
    const solution = BigInt(i);

    // keccak256(abi.encode(salt, solution))
    const encoded = abiCoder.encode(['bytes32', 'uint256'], [salt, solution]);
    const hash = ethers.keccak256(encoded);
    const hashBN = BigInt(hash);

    if ((hashBN >> shiftAmount) === 0n) {
      return {
        solution,
        attempts: i + 1,
        timeMs: Date.now() - startTime,
      };
    }
  }

  throw new Error(
    `HashPreimage: no solution found in ${maxAttempts} attempts (${zeroBits} leading zeros)`,
  );
}

// ─── Generic VOP Solver ─────────────────────────────────────────────────

/**
 * Solves any supported VOP challenge.
 *
 * @param vopType - VOP type identifier ('hash-preimage', 'l1-metadata', etc.)
 * @param params - ABI-encoded VOP parameters
 * @returns VOPSolution
 */
export function solveVOP(
  vopType: 'hash-preimage' | 'l1-metadata' | 'twap-oracle' | 'cross-chain',
  params: string,
): VOPSolution {
  switch (vopType) {
    case 'hash-preimage':
      return solveHashPreimage(params);

    case 'l1-metadata':
    case 'twap-oracle':
    case 'cross-chain':
      // These require on-chain reads — return 0 for now
      // TODO: implement with provider access
      return { solution: 0n, attempts: 0, timeMs: 0 };

    default:
      throw new Error(`Unknown VOP type: ${vopType}`);
  }
}
