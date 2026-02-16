// tests/elo.test.ts

import { describe, it, expect } from 'bun:test';
import { calculateElo } from '../src/services/elo.ts';

describe('Elo Rating', () => {
  it('should increase winner rating and decrease loser rating', () => {
    const [newA, newB] = calculateElo(1200, 1200, 'a_wins');
    expect(newA).toBeGreaterThan(1200);
    expect(newB).toBeLessThan(1200);
  });

  it('should give equal changes for equal-rated players', () => {
    const [newA, newB] = calculateElo(1200, 1200, 'a_wins');
    const gainA = newA - 1200;
    const lossB = 1200 - newB;
    expect(gainA).toBe(lossB);
  });

  it('should give bigger reward for upset wins', () => {
    // Low-rated beats high-rated
    const [newLow] = calculateElo(1000, 1400, 'a_wins');
    const lowGain = newLow - 1000;

    // Equal-rated win
    const [newEqual] = calculateElo(1200, 1200, 'a_wins');
    const equalGain = newEqual - 1200;

    expect(lowGain).toBeGreaterThan(equalGain);
  });

  it('should handle draws correctly', () => {
    const [newA, newB] = calculateElo(1200, 1200, 'draw');
    expect(newA).toBe(1200);
    expect(newB).toBe(1200);
  });

  it('should favor higher-rated player in draws', () => {
    // Higher rated player draws with lower — they should lose some rating
    const [newHigh, newLow] = calculateElo(1400, 1000, 'draw');
    expect(newHigh).toBeLessThan(1400);
    expect(newLow).toBeGreaterThan(1000);
  });
});
