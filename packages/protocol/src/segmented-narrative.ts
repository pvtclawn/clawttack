// packages/protocol/src/segmented-narrative.ts — Structured Adversarial Context Relay (ACR)
//
// Clawttack v3 replaces the free-text narrative with a segmented array of 32 segments.
// Each segment is 32 bytes (bytes32). This forces the agent to structure their
// story and allows the contract to verify logic parameters with O(N) gas efficiency.
//
// One segment MUST contain the hex logic parameter for the next turn.
// The other 31 segments can contain narrative text, honeypots, or injections.

import { type Hex, hexToBytes, bytesToHex, toHex, keccak256, encodePacked } from 'viem';

export interface SegmentedPayload {
  segments: Hex[]; // Exactly 32 hex strings (each 32 bytes / 66 chars with 0x)
}

/**
 * Manages the construction and parsing of segmented battle narratives.
 */
export class SegmentedNarrative {
  public static readonly MAX_SEGMENTS = 32;
  public static readonly SEGMENT_SIZE = 32; // bytes

  /**
   * Calculates the deterministic truth slot index for a given turn.
   * v3 Pivot: Salts the index with lastTurnHash to prevent pre-computation/sniping.
   */
  static calculateTruthIndex(battleSeed: Hex, lastTurnHash: Hex): number {
    const hash = keccak256(encodePacked(['bytes32', 'bytes32'], [battleSeed, lastTurnHash]));
    const hashValue = BigInt(hash);
    return Number(hashValue % BigInt(this.MAX_SEGMENTS));
  }

  /**
   * Encodes a natural language narrative and a logic parameter into segments.
   *
   * @param text - The full natural language narrative (psychological warfare).
   * @param truthParam - The real hex parameter Agent B must extract.
   * @param truthIndex - The index (0-31) where the truth will be hidden.
   * @param honeypots - Optional array of fake hex strings to confuse scripts.
   */
  static encode(params: {
    text: string;
    truthParam: Hex;
    truthIndex: number;
    honeypots?: Hex[];
  }): SegmentedPayload {
    const { text, truthParam, truthIndex, honeypots = [] } = params;

    if (truthIndex < 0 || truthIndex >= this.MAX_SEGMENTS) {
      throw new Error(`Invalid truthIndex: ${truthIndex}`);
    }

    const segments: Hex[] = new Array(this.MAX_SEGMENTS).fill('0x' + '0'.repeat(64));

    // 1. Insert the TRUTH
    segments[truthIndex] = truthParam;

    // 2. Insert HONEYPOTS into random available slots
    const availableSlots = Array.from({ length: this.MAX_SEGMENTS }, (_, i) => i)
      .filter(i => i !== truthIndex);
    
    for (const pot of honeypots) {
      if (availableSlots.length === 0) break;
      const randIdx = Math.floor(Math.random() * availableSlots.length);
      const slot = availableSlots.splice(randIdx, 1)[0]!;
      segments[slot] = pot;
    }

    // 3. Fill remaining slots with the NARRATIVE text
    // We split the text into 31-byte chunks (leaving 1 byte for null-term safety if needed,
    // though bytes32 doesn't require it, it keeps chunks readable).
    const textBytes = new TextEncoder().encode(text);
    let offset = 0;

    for (let i = 0; i < this.MAX_SEGMENTS; i++) {
      if (segments[i] !== ('0x' + '0'.repeat(64))) continue; // Skip slots already filled

      const chunk = textBytes.slice(offset, offset + this.SEGMENT_SIZE);
      if (chunk.length > 0) {
        // Pad chunk to 32 bytes
        const padded = new Uint8Array(this.SEGMENT_SIZE);
        padded.set(chunk);
        segments[i] = bytesToHex(padded);
        offset += this.SEGMENT_SIZE;
      }
    }

    return { segments };
  }

  /**
   * Decodes segments back into a single string for LLM parsing.
   * Replaces non-printable characters with spaces to keep it clean.
   */
  static decode(payload: SegmentedPayload): string {
    return payload.segments
      .map(seg => {
        const bytes = hexToBytes(seg);
        return new TextDecoder().decode(bytes).replace(/\0/g, '');
      })
      .join(' ');
  }

  /**
   * Helper to identify segments that look like hex parameters (hashes/addresses)
   * vs segments that look like text.
   */
  static analyze(payload: SegmentedPayload): { index: number; type: 'hex' | 'text'; value: Hex }[] {
    return payload.segments.map((seg, i) => {
      const bytes = hexToBytes(seg);
      // Heuristic: if > 50% of bytes are printable ASCII, it's text
      const printableCount = bytes.filter(b => b >= 32 && b <= 126).length;
      return {
        index: i,
        type: printableCount > (this.SEGMENT_SIZE / 2) ? 'text' : 'hex',
        value: seg,
      };
    });
  }
}
