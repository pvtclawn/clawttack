// src/services/elo.ts — Elo rating calculation

const K_FACTOR = 32; // Standard K-factor
const DEFAULT_RATING = 1200;

/**
 * Calculate new Elo ratings after a match.
 * Returns [newRatingA, newRatingB].
 */
export function calculateElo(
  ratingA: number,
  ratingB: number,
  result: 'a_wins' | 'b_wins' | 'draw'
): [number, number] {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;

  let scoreA: number;
  let scoreB: number;

  switch (result) {
    case 'a_wins':
      scoreA = 1;
      scoreB = 0;
      break;
    case 'b_wins':
      scoreA = 0;
      scoreB = 1;
      break;
    case 'draw':
      scoreA = 0.5;
      scoreB = 0.5;
      break;
  }

  const newA = Math.round(ratingA + K_FACTOR * (scoreA - expectedA));
  const newB = Math.round(ratingB + K_FACTOR * (scoreB - expectedB));

  return [newA, newB];
}

export { DEFAULT_RATING };
