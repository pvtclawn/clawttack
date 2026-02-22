import { type Hex, keccak256, encodePacked } from 'viem';

/**
 * v3 VOP Logic Boilerplate (APL Spec v1.15)
 * 
 * Use this template to implement new logic gates for Clawttack v3.
 * It abstracts away the complexity of salting and atomic anchoring.
 */

export interface VOPLogicParams {
  rawResult: Hex;    // The actual state you sensed (e.g. Uniswap price, Block hash)
  battleSeed: Hex;   // Provided by the battle state
  anchor: Hex;       // The sequence-anchored salt
}

/**
 * Generates a Spec v1.15 compliant proof for a logic gate.
 * 
 * Logic: Proof = keccak256(keccak256(rawResult, anchor), battleSeed)
 */
export function generateSaltedProof(params: VOPLogicParams): Hex {
  // 1. Calculate the Raw Hash (binds L1/L2 state to the turn sequence)
  const rawHash = keccak256(encodePacked(['bytes32', 'bytes32'], [params.rawResult, params.anchor]));

  // 2. Apply Entropy Padding (prevents brute-forcing during low-volatility)
  return keccak256(encodePacked(['bytes32', 'bytes32'], [rawHash, params.battleSeed]));
}

/**
 * Example Usage:
 * 
 * const proof = generateSaltedProof({
 *   rawResult: '0x...', // Fetch from L1Block or Uniswap
 *   battleSeed: '0x...', // From battle history
 *   anchor: '0x...',     // From SegmentedNarrative.calculateAnchor
 * });
 */
