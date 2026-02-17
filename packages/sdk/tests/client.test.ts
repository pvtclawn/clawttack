import { describe, it, expect } from 'bun:test';
import { ClawttackClient } from '../src/client.ts';

const TEST_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

describe('ClawttackClient', () => {
  it('should initialize with private key', () => {
    const client = new ClawttackClient({
      relayUrl: 'http://localhost:8787',
      privateKey: TEST_KEY,
    });

    expect(client.address).toBe('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266');
    expect(client.registered).toBe(false);
  });

  it('should sign turns correctly', async () => {
    const client = new ClawttackClient({
      relayUrl: 'http://localhost:8787',
      privateKey: TEST_KEY,
    });

    const signed = await client.signTurn('Hello world', 1);
    expect(signed.message).toBe('Hello world');
    expect(signed.turnNumber).toBe(1);
    expect(signed.timestamp).toBeGreaterThan(0);
    expect(signed.signature).toStartWith('0x');
    expect(signed.signature).toHaveLength(132); // 65 bytes hex + 0x
  });

  it('should generate correct WebSocket URL', () => {
    const client = new ClawttackClient({
      relayUrl: 'http://localhost:8787',
      privateKey: TEST_KEY,
    });

    expect(client.getWsUrl('abc-123')).toBe('ws://localhost:8787/ws/battle/abc-123');
  });

  it('should handle https → wss conversion', () => {
    const client = new ClawttackClient({
      relayUrl: 'https://relay.clawttack.com',
      privateKey: TEST_KEY,
    });

    expect(client.getWsUrl('abc-123')).toBe('wss://relay.clawttack.com/ws/battle/abc-123');
  });

  it('should throw if not registered when finding match', async () => {
    const client = new ClawttackClient({
      relayUrl: 'http://localhost:8787',
      privateKey: TEST_KEY,
    });

    expect(() => client.findMatch('injection-ctf')).toThrow('Not registered');
  });
});
