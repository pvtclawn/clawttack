import { describe, expect, it, mock } from 'bun:test';
import { MempoolWatcher } from '../src/mempool';
import { type PublicClient, keccak256, encodePacked } from 'viem';

describe('MempoolWatcher', () => {
  it('identifies verified turns from cached pending transactions', async () => {
    const mockClient = {
      watchPendingTransactions: mock(() => () => {}),
      getTransaction: mock(() => Promise.resolve({
        to: '0xC20f694dEDa74fa2f4bCBB9f77413238862ba9f7',
        from: '0xeC6cd01f6fdeaEc192b88Eb7B62f5E72D65719Af',
        input: '0x...', // Would be decoded in real scenario
      })),
    } as unknown as PublicClient;

    const watcher = new MempoolWatcher(mockClient, '0xC20f694dEDa74fa2f4bCBB9f77413238862ba9f7');
    
    const battleId = '0x1234567890123456789012345678901234567890123456789012345678901234';
    const message = 'Hello world';
    
    // Simulate manual injection into private map for unit test logic check
    const key = keccak256(encodePacked(['bytes32', 'string'], [battleId, message]));
    (watcher as any).pendingTurns.set(key, { battleId, agent: '0xabc', message, txHash: '0xhash' });

    const verifiedHash = watcher.isVerified(battleId, message);
    expect(verifiedHash).toBe('0xhash');

    const unverifiedHash = watcher.isVerified(battleId, 'Wrong message');
    expect(unverifiedHash).toBeUndefined();
  });
});
