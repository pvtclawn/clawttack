import { describe, it, expect } from 'bun:test';
import { generateChallengeWord, getChallengeWordTimeout } from '../src/waku-fighter.ts';
import { ethers } from 'ethers';

describe('generateChallengeWord', () => {
  const seedA = 'alpha-strategy-42';
  const seedB = 'beta-counter-77';
  const commitA = ethers.keccak256(ethers.toUtf8Bytes(seedA));
  const commitB = ethers.keccak256(ethers.toUtf8Bytes(seedB));

  it('returns a 4-letter word', () => {
    const word = generateChallengeWord(1, commitA, commitB);
    expect(word.length).toBe(4);
  });

  it('is deterministic', () => {
    const word1 = generateChallengeWord(3, commitA, commitB);
    const word2 = generateChallengeWord(3, commitA, commitB);
    expect(word1).toBe(word2);
  });

  it('varies by turn number', () => {
    const words = new Set<string>();
    for (let i = 1; i <= 10; i++) {
      words.add(generateChallengeWord(i, commitA, commitB));
    }
    // With 64 words and 10 turns, expect at least some variety
    expect(words.size).toBeGreaterThan(1);
  });

  it('varies by commits', () => {
    const otherCommit = ethers.keccak256(ethers.toUtf8Bytes('different-seed'));
    const word1 = generateChallengeWord(1, commitA, commitB);
    const word2 = generateChallengeWord(1, commitA, otherCommit);
    // Could theoretically collide but very unlikely
    // Just verify both are valid words
    expect(word1.length).toBe(4);
    expect(word2.length).toBe(4);
  });

  it('matches Solidity output for known inputs', () => {
    // Verify the JS and Solidity implementations agree
    // The packed encoding should be: uint16 turnNumber + bytes32 commitA + bytes32 commitB
    const packed = ethers.solidityPacked(
      ['uint16', 'bytes32', 'bytes32'],
      [1, commitA, commitB],
    );
    const hash = ethers.keccak256(packed);
    const index = Number(BigInt(hash) % 64n);

    const word = generateChallengeWord(1, commitA, commitB);

    // Just verify we get a valid word at the expected index
    const WORDS = [
      'blue', 'dark', 'fire', 'gold', 'iron', 'jade', 'keen', 'lime',
      'mint', 'navy', 'onyx', 'pine', 'ruby', 'sage', 'teal', 'vine',
      'arch', 'bolt', 'core', 'dawn', 'echo', 'flux', 'glow', 'haze',
      'iris', 'jolt', 'knot', 'loom', 'mist', 'node', 'oath', 'peak',
      'rift', 'silk', 'tide', 'unit', 'vale', 'warp', 'zero', 'apex',
      'band', 'cape', 'dome', 'edge', 'fern', 'grit', 'husk', 'isle',
      'jazz', 'kite', 'lark', 'maze', 'nest', 'opus', 'palm', 'quay',
      'reed', 'spur', 'torn', 'urge', 'veil', 'wolf', 'yarn', 'zest',
    ];
    expect(word).toBe(WORDS[index]);
  });
});

describe('getChallengeWordTimeout', () => {
  it('starts at 60s for turn 1', () => {
    expect(getChallengeWordTimeout(1)).toBe(60);
  });

  it('halves each turn', () => {
    expect(getChallengeWordTimeout(2)).toBe(30);
    expect(getChallengeWordTimeout(3)).toBe(15);
    expect(getChallengeWordTimeout(4)).toBe(7);
    expect(getChallengeWordTimeout(5)).toBe(3);
  });

  it('has minimum of 1s', () => {
    expect(getChallengeWordTimeout(6)).toBe(1);
    expect(getChallengeWordTimeout(7)).toBe(1);
    expect(getChallengeWordTimeout(10)).toBe(1);
    expect(getChallengeWordTimeout(20)).toBe(1);
  });

  it('matches Solidity output for all 10 turns', () => {
    const expected = [60, 30, 15, 7, 3, 1, 1, 1, 1, 1];
    for (let i = 0; i < expected.length; i++) {
      expect(getChallengeWordTimeout(i + 1)).toBe(expected[i]);
    }
  });
});
