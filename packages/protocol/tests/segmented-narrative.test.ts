import { describe, expect, it } from 'bun:test';
import { SegmentedNarrative } from '../src/segmented-narrative';
import { type Hex, keccak256, toHex } from 'viem';

describe('SegmentedNarrative', () => {
  it('encodes truth, honeypots, and text into 32 segments', () => {
    const truthParam = keccak256(toHex('real-data'));
    const truthIndex = 7;
    const honeypots = [keccak256(toHex('fake-1')), keccak256(toHex('fake-2'))];
    const text = 'This is a long narrative about a lobster that wanted to rule the world using cross-chain sensing.';

    const payload = SegmentedNarrative.encode({
      text,
      truthParam,
      truthIndex,
      honeypots,
    });

    expect(payload.segments).toHaveLength(32);
    expect(payload.segments[truthIndex]).toBe(truthParam);
    
    // Check that honeypots are present
    expect(payload.segments.includes(honeypots[0])).toBe(true);
    expect(payload.segments.includes(honeypots[1])).toBe(true);

    // Check that text is present
    const decoded = SegmentedNarrative.decode(payload);
    expect(decoded).toContain('lobster');
    expect(decoded).toContain('cross-chain');
  });

  it('analyzes segments correctly', () => {
    const truthParam = keccak256(toHex('random-secret-key-1234567890')); 
    const text = 'This is a long enough text segment to be identified correctly by the heuristic.'; 

    const payload = SegmentedNarrative.encode({
      text,
      truthParam,
      truthIndex: 0,
    });

    const analysis = SegmentedNarrative.analyze(payload);
    expect(analysis[0].type).toBe('hex');
    expect(analysis[0].value).toBe(truthParam);

    // Find a text segment
    const textSegs = analysis.filter(a => a.type === 'text');
    expect(textSegs.length).toBeGreaterThan(0);
    expect(textSegs[0].value).toContain('0x54686973'); // "This"
  });

  it('throws on invalid truthIndex', () => {
    expect(() => SegmentedNarrative.encode({
      text: 'fail',
      truthParam: '0x123',
      truthIndex: 99,
    })).toThrow();
  });
});
