import { describe, test, expect } from 'bun:test';

type Snapshot = `${number}:${number}:${string}`;

type ModelState = {
  payload: string;
  preflightHash: string | null;
  sendHash: string | null;
  snapshot: Snapshot;
  tokenCreatedAt: number | null;
  now: number;
  logs: string[];
};

const TTL_MS = 30_000;

function hash(s: string): string {
  // lightweight deterministic hash for model tests
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `h${h >>> 0}`;
}

function preflight(st: ModelState): void {
  st.preflightHash = hash(st.payload);
  st.tokenCreatedAt = st.now;
}

function attemptSend(st: ModelState): boolean {
  st.sendHash = hash(st.payload);
  if (st.preflightHash === null || st.tokenCreatedAt === null) {
    st.logs.push('PREFLIGHT_TOKEN_MISSING');
    return false;
  }
  if (st.now - st.tokenCreatedAt > TTL_MS) {
    st.logs.push('PREFLIGHT_TOKEN_EXPIRED');
    return false;
  }
  if (st.preflightHash !== st.sendHash) {
    st.logs.push('PREFLIGHT_HASH_MISMATCH');
    return false;
  }
  st.logs.push('SEND_OK');
  return true;
}

function mutatePayload(st: ModelState): void {
  st.payload += ' mutated';
}

function partialMutation(st: ModelState): void {
  // nested-like minimal change
  st.payload = st.payload.replace('about', 'above');
}

function advanceSnapshot(st: ModelState): void {
  const [phase, turn] = st.snapshot.split(':');
  st.snapshot = `${Number(phase)}:${Number(turn) + 1}:seq2`;
}

describe('preflight gateway invariants (stateful model)', () => {
  test('no send without preflight token', () => {
    const st: ModelState = {
      payload: 'appear abandon ability able about',
      preflightHash: null,
      sendHash: null,
      snapshot: '1:0:seq1',
      tokenCreatedAt: null,
      now: 0,
      logs: [],
    };

    expect(attemptSend(st)).toBe(false);
    expect(st.logs.at(-1)).toBe('PREFLIGHT_TOKEN_MISSING');
  });

  test('payload mutation after preflight always blocks send', () => {
    const st: ModelState = {
      payload: 'appear abandon ability able about',
      preflightHash: null,
      sendHash: null,
      snapshot: '1:0:seq1',
      tokenCreatedAt: null,
      now: 0,
      logs: [],
    };

    preflight(st);
    mutatePayload(st);

    expect(attemptSend(st)).toBe(false);
    expect(st.logs.at(-1)).toBe('PREFLIGHT_HASH_MISMATCH');
  });

  test('nested/partial mutation after preflight also blocks send', () => {
    const st: ModelState = {
      payload: 'appear abandon ability able about',
      preflightHash: null,
      sendHash: null,
      snapshot: '1:0:seq1',
      tokenCreatedAt: null,
      now: 0,
      logs: [],
    };

    preflight(st);
    partialMutation(st);

    expect(attemptSend(st)).toBe(false);
    expect(st.logs.at(-1)).toBe('PREFLIGHT_HASH_MISMATCH');
  });

  test('expired token blocks send', () => {
    const st: ModelState = {
      payload: 'appear abandon ability able about',
      preflightHash: null,
      sendHash: null,
      snapshot: '1:0:seq1',
      tokenCreatedAt: null,
      now: 0,
      logs: [],
    };

    preflight(st);
    st.now += TTL_MS + 1;

    expect(attemptSend(st)).toBe(false);
    expect(st.logs.at(-1)).toBe('PREFLIGHT_TOKEN_EXPIRED');
  });

  test('stateful random command sequences preserve core invariants', () => {
    const rand = (n: number) => Math.floor(Math.random() * n);

    for (let run = 0; run < 100; run++) {
      const st: ModelState = {
        payload: 'appear abandon ability able about',
        preflightHash: null,
        sendHash: null,
        snapshot: '1:0:seq1',
        tokenCreatedAt: null,
        now: 0,
        logs: [],
      };

      for (let step = 0; step < 30; step++) {
        switch (rand(6)) {
          case 0: preflight(st); break;
          case 1: mutatePayload(st); break;
          case 2: partialMutation(st); break;
          case 3: advanceSnapshot(st); break;
          case 4: st.now += rand(40_000); break;
          case 5: {
            const ok = attemptSend(st);
            if (ok) {
              expect(st.preflightHash).not.toBeNull();
              expect(st.tokenCreatedAt).not.toBeNull();
              expect(st.now - (st.tokenCreatedAt as number)).toBeLessThanOrEqual(TTL_MS);
              expect(st.preflightHash).toBe(st.sendHash);
            }
            break;
          }
        }
      }
    }
  });
});
