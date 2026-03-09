import { describe, expect, test } from 'bun:test';
import { createStrategy } from './strategy-template.ts';
import type { BattleContext } from './types.ts';
import { BIP39_TEST_WORDS } from './bip39-scanner.ts';

describe('strategy-template', () => {
  const mockCtx: BattleContext = {
    turnNumber: 2,
    isAgentA: true,
    myBank: 350n,
    opponentBank: 380n,
    targetWord: 'abandon',
    poisonWord: 'ability',
    vopParams: '0x00' as `0x${string}`,
    opponentNarrative: 'The dragon soared above the mountains, seeking to acquire new territory across the vast expanse, while the villagers could only absorb the terrifying sight in silence.',
    opponentNccAttack: {
      candidateWordIndices: [4, 10, 17, 18] as [number, number, number, number],
      candidateOffsets: [25, 62, 80, 95] as [number, number, number, number],
      nccCommitment: '0x1234' as `0x${string}`,
    },
    myPreviousNccAttack: {
      salt: '0xabcd' as `0x${string}`,
      intendedIdx: 2,
    },
    sequenceHash: '0x5678' as `0x${string}`,
  };

  test('creates strategy that returns valid result', async () => {
    const strategy = createStrategy({
      llmCall: async (_prompt) => {
        return `NARRATIVE: The ancient hero must abandon all hope and learn to absorb the abstract truth across the vast realm of acoustic wonders and acid rain.
POISON: dragon
NCC_GUESS: 2`;
      },
      wordList: BIP39_TEST_WORDS,
    });

    const result = await strategy(mockCtx);

    expect(result.narrative).toContain('abandon');
    expect(result.poisonWord).toBe('dragon');
    expect(result.nccGuessIdx).toBe(2);
  });

  test('handles unstructured LLM response', async () => {
    const strategy = createStrategy({
      llmCall: async () => {
        return 'The brave warrior must abandon the quest and seek ability beyond the abstract mountain to absorb ancient knowledge and learn to act with purpose.';
      },
      wordList: BIP39_TEST_WORDS,
    });

    const result = await strategy(mockCtx);

    // Should use whole response as narrative
    expect(result.narrative.length).toBeGreaterThanOrEqual(64);
    expect(result.poisonWord).toBe('abandon'); // default
    expect(result.nccGuessIdx).toBe(0); // default
  });

  test('pads short narratives to minimum length', async () => {
    const strategy = createStrategy({
      llmCall: async () => 'NARRATIVE: short\nPOISON: test\nNCC_GUESS: 1',
      wordList: BIP39_TEST_WORDS,
    });

    const result = await strategy(mockCtx);
    expect(result.narrative.length).toBeGreaterThanOrEqual(64);
  });

  test('clamps NCC guess to valid range', async () => {
    const strategy = createStrategy({
      llmCall: async () => 'NARRATIVE: ' + 'x'.repeat(64) + '\nPOISON: test\nNCC_GUESS: 5',
      wordList: BIP39_TEST_WORDS,
    });

    const result = await strategy(mockCtx);
    expect(result.nccGuessIdx).toBe(0); // invalid 5 → default 0
  });

  test('prompt includes all context', async () => {
    let capturedPrompt = '';
    const strategy = createStrategy({
      llmCall: async (prompt) => {
        capturedPrompt = prompt;
        return 'NARRATIVE: ' + 'x'.repeat(64) + '\nPOISON: test\nNCC_GUESS: 1';
      },
      wordList: BIP39_TEST_WORDS,
    });

    await strategy(mockCtx);

    expect(capturedPrompt).toContain('abandon'); // target word
    expect(capturedPrompt).toContain('ability'); // poison word
    expect(capturedPrompt).toContain('Turn: 2');
    expect(capturedPrompt).toContain('Agent A');
    expect(capturedPrompt).toContain('350'); // bank
    expect(capturedPrompt).toContain('dragon soared'); // opponent narrative
    expect(capturedPrompt).toContain('NCC DEFENSE'); // defense task
    expect(capturedPrompt).toContain('PROMPT INJECTION'); // attack guidance
  });
});
