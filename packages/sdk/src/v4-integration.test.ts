/**
 * @module v4-integration
 * @description Integration test: exercises the full SDK v4 stack in a single flow.
 *
 * Simulates: narrative generation → BIP39 scan → NCC attack/defense/reveal →
 * VOP solve → strategy prompt → response parsing. No on-chain calls.
 */

import { describe, expect, test } from 'bun:test';
import { ethers } from 'ethers';
import { createNccAttack, createNccDefense, createNccReveal, verifyCommitment, findWordOffset } from './ncc-helper.ts';
import type { BIP39Word } from './ncc-helper.ts';
import { scanForBip39Words, BIP39_TEST_WORDS } from './bip39-scanner.ts';
import { solveHashPreimage } from './vop-solver.ts';
import { createV4Strategy } from './v4-strategy-template.ts';
import type { BattleContextV4 } from './v4-types.ts';

describe('v4 SDK integration', () => {
  const wordList = BIP39_TEST_WORDS;

  test('full turn flow: scan → attack → defense → reveal → verify', () => {
    // Agent A writes a narrative
    const narrativeA = 'the ancient hero must abandon all ability and be able to learn about the world, seeking to access hidden knowledge and achieve great acoustic wonders';

    // 1. Scan for BIP39 words
    const scan = scanForBip39Words(narrativeA, wordList);
    expect(scan.matches.length).toBeGreaterThanOrEqual(4);
    expect(scan.candidates).not.toBeNull();
    expect(scan.candidates!.length).toBe(4);

    // 2. Build NCC attack
    const salt = ethers.hexlify(ethers.randomBytes(32)) as `0x${string}`;
    const intendedIdx = 2 as 0 | 1 | 2 | 3;
    const candidates = scan.candidates!;
    const bip39Candidates: [BIP39Word, BIP39Word, BIP39Word, BIP39Word] = [
      { word: candidates[0].word, index: candidates[0].wordIndex },
      { word: candidates[1].word, index: candidates[1].wordIndex },
      { word: candidates[2].word, index: candidates[2].wordIndex },
      { word: candidates[3].word, index: candidates[3].wordIndex },
    ];

    const { attack, salt: attackSalt, intendedIdx: attackIdx } = createNccAttack(
      narrativeA,
      bip39Candidates,
      intendedIdx,
    );

    expect(attack.nccCommitment).toBeDefined();
    expect(attack.candidateWordIndices.length).toBe(4);
    expect(attack.candidateOffsets.length).toBe(4);

    // 3. Agent B defends (guesses correctly)
    const defense = createNccDefense(intendedIdx);
    expect(defense.guessIdx).toBe(2);

    // 4. Agent A reveals
    const reveal = createNccReveal(attackSalt, intendedIdx);
    expect(reveal.salt).toBe(attackSalt);
    expect(reveal.intendedIdx).toBe(intendedIdx);

    // 5. Verify commitment matches
    const isValid = verifyCommitment(attack.nccCommitment, attackSalt, intendedIdx);
    expect(isValid).toBe(true);

    // 6. Verify wrong commitment fails
    const wrongValid = verifyCommitment(attack.nccCommitment, attackSalt, 0 as 0 | 1 | 2 | 3);
    if (intendedIdx !== 0) {
      expect(wrongValid).toBe(false);
    }
  });

  test('VOP solve + NCC in sequence', () => {
    // Simulate turn flow: solve VOP, then build NCC

    // 1. Generate VOP params (simulating contract's generateParams)
    const randomness = 42n;
    const vopSalt = ethers.zeroPadValue(ethers.toBeHex(randomness), 32);
    const leadingZeros = Number((randomness % 4n) + 8n); // 8 + (42 % 4) = 10
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const vopParams = abiCoder.encode(['bytes32', 'uint8'], [vopSalt, leadingZeros]);

    // 2. Solve VOP
    const vopResult = solveHashPreimage(vopParams);
    expect(vopResult.solution).toBeGreaterThanOrEqual(0n);

    // 3. Verify solution
    const encoded = abiCoder.encode(['bytes32', 'uint256'], [vopSalt, vopResult.solution]);
    const hash = ethers.keccak256(encoded);
    const hashBN = BigInt(hash);
    expect(hashBN >> (256n - BigInt(leadingZeros))).toBe(0n);

    // 4. Build NCC attack
    const narrative = 'the mighty hero must abandon all ability and act with acoustic precision to achieve glory above the abstract realm';
    const scan2 = scanForBip39Words(narrative, wordList);
    expect(scan2.candidates).not.toBeNull();

    const bip39C: [BIP39Word, BIP39Word, BIP39Word, BIP39Word] = scan2.candidates!.map(c => ({
      word: c.word,
      index: c.wordIndex,
    })) as any;

    const { attack } = createNccAttack(narrative, bip39C, 1);

    // Both VOP and NCC are ready for submission
    expect(vopResult.solution).toBeGreaterThanOrEqual(0n);
    expect(attack.nccCommitment).toBeDefined();
  });

  test('strategy produces valid output for battle context', async () => {
    const strategy = createV4Strategy({
      llmCall: async (_prompt) => {
        // Mock LLM: produces a valid narrative with BIP39 words
        return `NARRATIVE: the hero must abandon the quest to absorb the abstract truth and achieve acoustic mastery across the vast realm of ancient knowledge and hidden access
POISON: dragon
NCC_GUESS: 1`;
      },
      wordList,
    });

    const ctx: BattleContextV4 = {
      turnNumber: 3,
      isAgentA: true,
      myBank: 300n,
      opponentBank: 280n,
      targetWord: 'abandon',
      poisonWord: 'ability',
      vopParams: '0x00' as `0x${string}`,
      opponentNarrative: 'The dragon soared above the clouds seeking to acquire new territory.',
      opponentNccAttack: {
        candidateWordIndices: [4, 17, 18, 19] as [number, number, number, number],
        candidateOffsets: [20, 40, 55, 70] as [number, number, number, number],
        nccCommitment: '0x1234' as `0x${string}`,
      },
      myPreviousNccAttack: null,
      sequenceHash: '0x5678' as `0x${string}`,
    };

    const result = await strategy(ctx);

    // Verify output
    expect(result.narrative.length).toBeGreaterThanOrEqual(64);
    expect(result.narrative.toLowerCase()).toContain('abandon'); // must include target
    expect(result.narrative.toLowerCase()).not.toContain('ability'); // must NOT include poison
    expect(result.poisonWord).toBe('dragon');
    expect(result.nccGuessIdx).toBe(1);

    // Verify the narrative has enough BIP39 words for NCC attack
    const scan = scanForBip39Words(result.narrative, wordList, ['abandon', 'ability']);
    expect(scan.matches.length).toBeGreaterThanOrEqual(4);
  });

  test('multi-turn NCC state tracking', () => {
    // Simulate 4 turns of NCC commit-reveal state
    const salts: `0x${string}`[] = [];
    const intendedIdxs: (0 | 1 | 2 | 3)[] = [];
    const commitments: `0x${string}`[] = [];

    // 4 turns of attacks
    for (let turn = 0; turn < 4; turn++) {
      const idx = (turn % 4) as 0 | 1 | 2 | 3;

      intendedIdxs.push(idx);

      const narrative = 'the hero must abandon all ability and be able to learn about the world';
      const bip39Words: [BIP39Word, BIP39Word, BIP39Word, BIP39Word] = [
        { word: 'abandon', index: 0 },
        { word: 'ability', index: 1 },
        { word: 'able', index: 2 },
        { word: 'about', index: 3 },
      ];
      const { attack, salt: turnSalt } = createNccAttack(narrative, bip39Words, idx);
      salts.push(turnSalt);
      commitments.push(attack.nccCommitment);
    }

    // Verify all commitments are unique (different salts)
    const uniqueCommitments = new Set(commitments);
    expect(uniqueCommitments.size).toBe(4);

    // Verify each can be independently verified
    for (let i = 0; i < 4; i++) {
      expect(verifyCommitment(commitments[i], salts[i], intendedIdxs[i])).toBe(true);
      // Wrong idx should fail
      const wrongIdx = ((intendedIdxs[i] + 1) % 4) as 0 | 1 | 2 | 3;
      expect(verifyCommitment(commitments[i], salts[i], wrongIdx)).toBe(false);
    }
  });
});
