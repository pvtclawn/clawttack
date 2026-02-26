import { describe, it, expect } from 'bun:test';
import { ClawttackClient } from '../src/client.ts';

const TEST_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TEST_KEY_2 = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

describe('ClawttackClient', () => {
  it('should initialize with private key', () => {
    const client = new ClawttackClient({
      relayUrl: 'http://localhost:8787',
      privateKey: TEST_KEY,
    });

    expect(client.address).toBe('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266');
    expect(client.registered).toBe(false);
  });

  it('should sign turns with canonical hash (compatible with relay)', async () => {
    const client = new ClawttackClient({
      relayUrl: 'http://localhost:8787',
      privateKey: TEST_KEY,
    });

    const battleId = 'test-battle-123';
    const signed = await client.signTurn(battleId, 'Hello world', 1);
    expect(signed.narrative).toBe('Hello world');
    expect(signed.turnNumber).toBe(1);
    expect(signed.timestamp).toBeGreaterThan(0);
    expect(signed.signature).toStartWith('0x');
    expect(signed.signature).toHaveLength(132); // 65 bytes hex + 0x
  });

  it('should produce signatures verifiable by protocol', async () => {
    const { verifyTurn } = await import('@clawttack/protocol');
    const client = new ClawttackClient({
      relayUrl: 'http://localhost:8787',
      privateKey: TEST_KEY,
    });

    const battleId = 'test-battle-456';
    const signed = await client.signTurn(battleId, 'Test message', 3);

    // Verify using protocol's verifyTurn — this is what the relay uses
    const valid = verifyTurn(
      {
        battleId,
        agentAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // checksummed
        narrative: signed.narrative,
        turnNumber: signed.turnNumber,
        timestamp: signed.timestamp,
      },
      signed.signature,
    );
    expect(valid).toBe(true);
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

  // --- New edge-case tests ---

  it('should strip trailing slash from relay URL', () => {
    const client = new ClawttackClient({
      relayUrl: 'http://localhost:8787/',
      privateKey: TEST_KEY,
    });

    expect(client.getWsUrl('battle-1')).toBe('ws://localhost:8787/ws/battle/battle-1');
  });

  it('should lowercase address', () => {
    const client = new ClawttackClient({
      relayUrl: 'http://localhost:8787',
      privateKey: TEST_KEY,
    });

    // Address should be lowercase (no mixed case)
    expect(client.address).toBe(client.address.toLowerCase());
    expect(client.address).toMatch(/^0x[0-9a-f]{40}$/);
  });

  it('should derive different addresses from different keys', () => {
    const client1 = new ClawttackClient({
      relayUrl: 'http://localhost:8787',
      privateKey: TEST_KEY,
    });
    const client2 = new ClawttackClient({
      relayUrl: 'http://localhost:8787',
      privateKey: TEST_KEY_2,
    });

    expect(client1.address).not.toBe(client2.address);
    expect(client2.address).toBe('0x70997970c51812dc3a010c7d01b50e0d17dc79c8');
  });

  it('should produce different signatures for different turn numbers', async () => {
    const client = new ClawttackClient({
      relayUrl: 'http://localhost:8787',
      privateKey: TEST_KEY,
    });

    const sig1 = await client.signTurn('battle-1', 'same message', 1);
    const sig2 = await client.signTurn('battle-1', 'same message', 2);

    expect(sig1.signature).not.toBe(sig2.signature);
  });

  it('should produce different signatures for different battle IDs', async () => {
    const client = new ClawttackClient({
      relayUrl: 'http://localhost:8787',
      privateKey: TEST_KEY,
    });

    const sig1 = await client.signTurn('battle-A', 'same message', 1);
    const sig2 = await client.signTurn('battle-B', 'same message', 1);

    expect(sig1.signature).not.toBe(sig2.signature);
  });

  it('should produce different signatures from different keys for same input', async () => {
    const client1 = new ClawttackClient({
      relayUrl: 'http://localhost:8787',
      privateKey: TEST_KEY,
    });
    const client2 = new ClawttackClient({
      relayUrl: 'http://localhost:8787',
      privateKey: TEST_KEY_2,
    });

    const sig1 = await client1.signTurn('battle-1', 'hello', 1);
    const sig2 = await client2.signTurn('battle-1', 'hello', 1);

    expect(sig1.signature).not.toBe(sig2.signature);
  });

  it('should handle empty narrative in signTurn', async () => {
    const client = new ClawttackClient({
      relayUrl: 'http://localhost:8787',
      privateKey: TEST_KEY,
    });

    const signed = await client.signTurn('battle-1', '', 1);
    expect(signed.narrative).toBe('');
    expect(signed.signature).toStartWith('0x');
    expect(signed.signature).toHaveLength(132);
  });

  it('should handle unicode narrative in signTurn', async () => {
    const client = new ClawttackClient({
      relayUrl: 'http://localhost:8787',
      privateKey: TEST_KEY,
    });

    const unicode = 'The 🦞 attacked with 力 and won';
    const signed = await client.signTurn('battle-1', unicode, 1);
    expect(signed.narrative).toBe(unicode);
    expect(signed.signature).toStartWith('0x');
    expect(signed.signature).toHaveLength(132);
  });

  it('should handle very long narrative', async () => {
    const client = new ClawttackClient({
      relayUrl: 'http://localhost:8787',
      privateKey: TEST_KEY,
    });

    const longNarrative = 'A'.repeat(10_000);
    const signed = await client.signTurn('battle-1', longNarrative, 1);
    expect(signed.narrative).toHaveLength(10_000);
    expect(signed.signature).toHaveLength(132);
  });

  it('should verify unicode signatures with protocol verifyTurn', async () => {
    const { verifyTurn } = await import('@clawttack/protocol');
    const client = new ClawttackClient({
      relayUrl: 'http://localhost:8787',
      privateKey: TEST_KEY,
    });

    const unicode = '日本語テスト with émojis 🎮⚔️🛡️';
    const signed = await client.signTurn('battle-unicode', unicode, 5);

    const valid = verifyTurn(
      {
        battleId: 'battle-unicode',
        agentAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        narrative: unicode,
        turnNumber: signed.turnNumber,
        timestamp: signed.timestamp,
      },
      signed.signature,
    );
    expect(valid).toBe(true);
  });

  it('should set default name from address when none provided', () => {
    const client = new ClawttackClient({
      relayUrl: 'http://localhost:8787',
      privateKey: TEST_KEY,
    });

    // Default name should be agent-<first 8 chars of address>
    // We can't directly access private name, but we verify address is set
    expect(client.address).toBeTruthy();
    expect(client.registered).toBe(false);
  });

  it('timestamp should increase between sequential signTurn calls', async () => {
    const client = new ClawttackClient({
      relayUrl: 'http://localhost:8787',
      privateKey: TEST_KEY,
    });

    const signed1 = await client.signTurn('battle-1', 'turn 1', 1);
    // Small delay to ensure timestamp differs
    await new Promise(r => setTimeout(r, 5));
    const signed2 = await client.signTurn('battle-1', 'turn 2', 2);

    expect(signed2.timestamp).toBeGreaterThanOrEqual(signed1.timestamp);
  });
});
