import { describe, it, expect } from 'bun:test';
import { arenaTopic } from '../src/waku-broadcaster.ts';
import type { WakuArenaTurn } from '../src/waku-broadcaster.ts';

describe('waku-broadcaster', () => {
  it('arenaTopic builds correct content topic', () => {
    const topic = arenaTopic('0xabc123');
    expect(topic).toBe('/clawttack/1/arena-0xabc123/proto');
  });

  it('arenaTopic uses full battle ID', () => {
    const battleId = '0xd385bc37fe544b73b17e95ed820f8fa8058b336c475d7aabded6e93ff3c46444';
    const topic = arenaTopic(battleId);
    expect(topic).toContain(battleId);
    expect(topic).toStartWith('/clawttack/1/arena-');
    expect(topic).toEndWith('/proto');
  });

  it('WakuArenaTurn matches expected shape', () => {
    const turn: WakuArenaTurn = {
      type: 'arena_turn',
      battleId: '0xabc',
      agent: '0x123',
      turnNumber: 1,
      message: 'hello world',
      txHash: '0xdef',
      timestamp: Date.now(),
    };
    expect(turn.type).toBe('arena_turn');
    expect(turn.turnNumber).toBe(1);
  });
});
