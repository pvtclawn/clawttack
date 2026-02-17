import { describe, it, expect } from 'bun:test';
import { AgentRegistry, registrationMessage } from '../src/agent-registry.ts';
import { ethers } from 'ethers';

describe('AgentRegistry', () => {
  const wallet = new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');

  it('should generate correct challenge message', () => {
    const msg = registrationMessage(wallet.address);
    expect(msg).toContain(wallet.address.toLowerCase());
    expect(msg).toContain('Clawttack agent registration');
  });

  it('should register an agent with valid signature', async () => {
    const registry = new AgentRegistry();
    const message = registrationMessage(wallet.address);
    const signature = await wallet.signMessage(message);

    const agent = registry.register(wallet.address, 'TestAgent', signature);
    expect(agent.address).toBe(wallet.address.toLowerCase());
    expect(agent.name).toBe('TestAgent');
    expect(agent.apiKey).toHaveLength(64); // 32 bytes hex
    expect(agent.battlesPlayed).toBe(0);
    expect(registry.size).toBe(1);
  });

  it('should reject invalid signature', async () => {
    const registry = new AgentRegistry();
    const otherWallet = new ethers.Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
    const message = registrationMessage(wallet.address);
    // Sign with wrong wallet
    const signature = await otherWallet.signMessage(message);

    expect(() => registry.register(wallet.address, 'TestAgent', signature))
      .toThrow('Signature does not match address');
  });

  it('should update name on re-registration', async () => {
    const registry = new AgentRegistry();
    const message = registrationMessage(wallet.address);
    const signature = await wallet.signMessage(message);

    const first = registry.register(wallet.address, 'OldName', signature);
    const second = registry.register(wallet.address, 'NewName', signature);

    expect(second.name).toBe('NewName');
    expect(second.apiKey).toBe(first.apiKey); // Same API key
    expect(registry.size).toBe(1); // Still one agent
  });

  it('should look up by address and API key', async () => {
    const registry = new AgentRegistry();
    const message = registrationMessage(wallet.address);
    const signature = await wallet.signMessage(message);

    const agent = registry.register(wallet.address, 'TestAgent', signature);

    expect(registry.getByAddress(wallet.address)?.name).toBe('TestAgent');
    expect(registry.getByApiKey(agent.apiKey)?.name).toBe('TestAgent');
    expect(registry.validateKey(agent.apiKey)).toBe(wallet.address.toLowerCase());
    expect(registry.validateKey('invalid-key')).toBeNull();
  });

  it('should list agents without API keys', async () => {
    const registry = new AgentRegistry();
    const message = registrationMessage(wallet.address);
    const signature = await wallet.signMessage(message);

    registry.register(wallet.address, 'TestAgent', signature);
    const list = registry.list();

    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe('TestAgent');
    expect((list[0] as any).apiKey).toBeUndefined();
  });

  it('should track battle count', async () => {
    const registry = new AgentRegistry();
    const message = registrationMessage(wallet.address);
    const signature = await wallet.signMessage(message);

    registry.register(wallet.address, 'TestAgent', signature);
    registry.recordBattle(wallet.address);
    registry.recordBattle(wallet.address);

    expect(registry.getByAddress(wallet.address)?.battlesPlayed).toBe(2);
  });
});
