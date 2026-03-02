import { describe, test, expect } from 'bun:test';
import {
  createClozeAttack,
  solveCloze,
  verifyClozeAttack,
  type ClozeAttack,
} from '../src/cloze-helper';

describe('createClozeAttack', () => {
  const candidates = ['abandon', 'ability', 'absorb', 'above'];

  test('replaces target word with [BLANK]', () => {
    const narrative = 'The knight decided to abandon his quest when the dragon appeared';
    const attack = createClozeAttack(narrative, 'abandon', candidates);
    
    expect(attack.narrative).toBe('The knight decided to [BLANK] his quest when the dragon appeared');
    expect(attack.original).toBe(narrative);
    expect(attack.answerWord).toBe('abandon');
    expect(attack.answerIdx).toBe(0);
  });

  test('handles word at start', () => {
    const narrative = 'Ability is everything in battle';
    const attack = createClozeAttack(narrative, 'Ability', ['Ability', 'absorb', 'above', 'abandon']);
    
    expect(attack.narrative).toBe('[BLANK] is everything in battle');
    expect(attack.blankOffset).toBe(0);
  });

  test('handles word at end', () => {
    const narrative = 'The warrior chose to absorb';
    const attack = createClozeAttack(narrative, 'absorb', candidates);
    
    expect(attack.narrative).toBe('The warrior chose to [BLANK]');
    expect(attack.answerIdx).toBe(2);
  });

  test('throws if target not in candidates', () => {
    expect(() => {
      createClozeAttack('some narrative', 'missing', candidates);
    }).toThrow('not in candidates');
  });

  test('throws if target not found in narrative', () => {
    expect(() => {
      createClozeAttack('some narrative without the word', 'abandon', candidates);
    }).toThrow('not found in narrative');
  });

  test('blankOffset is correct byte position', () => {
    const narrative = 'Go above and beyond';
    const attack = createClozeAttack(narrative, 'above', candidates);
    
    expect(attack.blankOffset).toBe(3); // "Go " = 3 bytes
    expect(attack.narrative).toBe('Go [BLANK] and beyond');
  });
});

describe('solveCloze', () => {
  const candidates = ['abandon', 'ability', 'absorb', 'above'];

  test('returns random guess without LLM', async () => {
    const defense = await solveCloze(
      'The knight [BLANK]ed his quest',
      candidates,
    );
    
    expect(defense.guessIdx).toBeGreaterThanOrEqual(0);
    expect(defense.guessIdx).toBeLessThan(4);
    expect(defense.confidence).toBe(0.25);
    expect(defense.reasoning).toContain('No LLM');
  });

  test('returns random guess without [BLANK]', async () => {
    const defense = await solveCloze(
      'No blank marker here',
      candidates,
    );
    
    expect(defense.confidence).toBe(0.25);
    expect(defense.reasoning).toContain('No [BLANK]');
  });

  test('uses LLM solver when provided', async () => {
    const mockLlm = async (_prompt: string) => '0'; // always guesses 0
    
    const defense = await solveCloze(
      'The knight [BLANK]ed his quest',
      candidates,
      mockLlm,
    );
    
    expect(defense.guessIdx).toBe(0);
    expect(defense.confidence).toBe(0.75);
  });

  test('falls back to random on LLM failure', async () => {
    const failingLlm = async () => { throw new Error('timeout'); };
    
    const defense = await solveCloze(
      'The knight [BLANK]ed his quest',
      candidates,
      failingLlm,
    );
    
    expect(defense.confidence).toBe(0.25);
    expect(defense.reasoning).toContain('failed');
  });

  test('parses LLM response with extra text', async () => {
    const verboseLlm = async () => '2 - absorb fits best';
    
    const defense = await solveCloze(
      'The shield could [BLANK] the impact',
      candidates,
      verboseLlm,
    );
    
    expect(defense.guessIdx).toBe(2);
  });
});

describe('verifyClozeAttack', () => {
  const candidates = ['abandon', 'ability', 'absorb', 'above'];

  test('valid attack passes verification', () => {
    const attack: ClozeAttack = {
      narrative: 'The knight [BLANK]ed his quest',
      original: 'The knight abandoned his quest',
      blankOffset: 11,
      answerWord: 'abandon',
      answerIdx: 0,
    };
    
    expect(verifyClozeAttack(attack, candidates)).toBe(true);
  });

  test('rejects multiple blanks', () => {
    const attack: ClozeAttack = {
      narrative: '[BLANK] and [BLANK]',
      original: 'abandon and ability',
      blankOffset: 0,
      answerWord: 'abandon',
      answerIdx: 0,
    };
    
    expect(verifyClozeAttack(attack, candidates)).toBe(false);
  });

  test('rejects answer not in candidates', () => {
    const attack: ClozeAttack = {
      narrative: 'The [BLANK] was fierce',
      original: 'The battle was fierce',
      blankOffset: 4,
      answerWord: 'battle',
      answerIdx: 0,
    };
    
    expect(verifyClozeAttack(attack, ['abandon', 'ability', 'absorb', 'above'])).toBe(false);
  });

  test('rejects no blank', () => {
    const attack: ClozeAttack = {
      narrative: 'No blank here at all',
      original: 'No blank here at all',
      blankOffset: 0,
      answerWord: 'abandon',
      answerIdx: 0,
    };
    
    expect(verifyClozeAttack(attack, candidates)).toBe(false);
  });
});
