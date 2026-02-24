import { describe, test, expect } from 'bun:test';
import {
  validateNarrative,
  generateTemplateNarrative,
  createLLMNarrativeGenerator,
  type NarrativeContext,
} from '../src/llm-narrative';

describe('validateNarrative', () => {
  test('accepts valid narrative with target word', () => {
    const narrative =
      'The ancient scholar discovered that seven was the key to understanding the mystical patterns woven into the fabric of reality itself';
    const result = validateNarrative(narrative, 'seven', 'among', false);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('rejects narrative missing target word', () => {
    const narrative =
      'The ancient scholar discovered something fascinating about the mysterious patterns woven into the fabric of reality itself and beyond';
    const result = validateNarrative(narrative, 'seven', 'among', false);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Target word'))).toBe(true);
  });

  test('rejects narrative containing poison word as standalone', () => {
    const narrative =
      'The scholar found seven clues among the ruins that revealed the hidden truth about the lost civilization and its forgotten wisdom';
    const result = validateNarrative(narrative, 'seven', 'among', false);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Poison word'))).toBe(true);
  });

  test('accepts poison word as substring (boundary check)', () => {
    // "among" inside "plamongiful" — no word boundaries
    const narrative =
      'The number seven echoed through the famousamong corridors as the plamongiful bells rang out across the valley of forgotten dreams and lost';
    const result = validateNarrative(narrative, 'seven', 'among', false);
    expect(result.valid).toBe(true);
  });

  test('skips poison check on first turn', () => {
    const narrative =
      'The scholar found seven clues among the ruins that revealed the hidden truth about the lost civilization and its forgotten wisdom';
    const result = validateNarrative(narrative, 'seven', 'among', true);
    expect(result.valid).toBe(true); // first turn = no poison check
  });

  test('rejects too-short narrative', () => {
    const narrative = 'The seven seas.';
    const result = validateNarrative(narrative, 'seven', '', false);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Too short'))).toBe(true);
  });

  test('rejects too-long narrative', () => {
    const narrative = 'The word seven '.repeat(30); // way over 256
    const result = validateNarrative(narrative, 'seven', '', false);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Too long'))).toBe(true);
  });

  test('rejects non-ASCII characters', () => {
    const narrative =
      'The mystical number seven appeared in the café where scholars gathered to discuss the hidden patterns of the universe and beyond infinity';
    const result = validateNarrative(narrative, 'seven', '', false);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Non-ASCII'))).toBe(true);
  });

  test('target word at start of narrative', () => {
    const narrative =
      'Seven was the number that echoed through the corridors of the ancient citadel bringing clarity to all who heard its resonance';
    const result = validateNarrative(narrative, 'seven', '', false);
    // "Seven" at start — boundary check: no char before = OK
    expect(result.valid).toBe(true);
  });

  test('target word at end of narrative', () => {
    const narrative =
      'The explorers mapped uncharted territories finding connections between disparate fields of knowledge revealing the power of seven';
    const result = validateNarrative(narrative, 'seven', '', false);
    expect(result.valid).toBe(true);
  });

  test('target word embedded in another word fails', () => {
    const narrative =
      'The eleventh hour brought seventy scholars who discovered patterns hidden within the fabric of reality that no textbook described before';
    const result = validateNarrative(narrative, 'seven', '', false);
    // "seven" appears inside "seventy" — no word boundary at end
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Target word'))).toBe(true);
  });

  test('poison word with punctuation boundary detected', () => {
    const narrative =
      'The number seven resonated clearly. Among, the scholars noted, was the key concept connecting all their research and findings here';
    const result = validateNarrative(narrative, 'seven', 'among', false);
    // "Among," — comma is not a letter, so boundary check passes = poison detected
    expect(result.valid).toBe(false);
  });

  test('empty poison word is safe', () => {
    const narrative =
      'The concept of seven emerged clearly as the explorers mapped uncharted territories finding connections between disparate fields';
    const result = validateNarrative(narrative, 'seven', '', false);
    expect(result.valid).toBe(true);
  });
});

describe('generateTemplateNarrative', () => {
  test('generates narrative containing target word', () => {
    const narrative = generateTemplateNarrative('seven', 'among');
    expect(narrative.toLowerCase()).toContain('seven');
  });

  test('generates narrative within length bounds', () => {
    const narrative = generateTemplateNarrative('seven', 'among');
    expect(narrative.length).toBeGreaterThanOrEqual(64);
    expect(narrative.length).toBeLessThanOrEqual(256);
  });

  test('generated narrative passes validation', () => {
    const words = ['seven', 'busy', 'bright', 'castle', 'dragon'];
    for (const word of words) {
      const narrative = generateTemplateNarrative(word, 'unrelated');
      const result = validateNarrative(narrative, word, 'unrelated', false);
      expect(result.valid).toBe(true);
    }
  });

  test('avoids poison word in template', () => {
    // Use a template that might naturally contain the poison
    const narrative = generateTemplateNarrative('scholar', 'ancient');
    // "ancient" might appear in templates — verify it's been replaced
    const result = validateNarrative(narrative, 'scholar', 'ancient', false);
    expect(result.valid).toBe(true);
  });

  test('different target words produce different narratives', () => {
    const n1 = generateTemplateNarrative('seven', '');
    const n2 = generateTemplateNarrative('castle', '');
    expect(n1).not.toBe(n2);
  });
});

describe('createLLMNarrativeGenerator', () => {
  test('falls back to template on invalid endpoint', async () => {
    const generate = createLLMNarrativeGenerator({
      endpoint: 'http://localhost:1/v1/chat/completions',
      apiKey: 'fake',
      model: 'test',
      maxRetries: 0,
    });

    const result = await generate({
      targetWord: 'seven',
      poisonWord: 'among',
      turnNumber: 1,
      maxTurns: 12,
    });

    expect(result.source).toBe('template');
    expect(result.narrative.toLowerCase()).toContain('seven');

    const validation = validateNarrative(result.narrative, 'seven', 'among', false);
    expect(validation.valid).toBe(true);
  });

  test('config creates callable function', () => {
    const generate = createLLMNarrativeGenerator({
      endpoint: 'https://example.com/v1/chat/completions',
      apiKey: 'test',
      model: 'test-model',
    });
    expect(typeof generate).toBe('function');
  });
});
