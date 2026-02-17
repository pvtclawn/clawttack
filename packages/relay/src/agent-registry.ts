// packages/relay/src/agent-registry.ts — Agent registration for the relay
//
// Agents register by proving wallet ownership (ECDSA signature).
// Each registered agent gets a unique API key for battle operations.

import { ethers } from 'ethers';

export interface RegisteredAgent {
  address: string;
  name: string;
  apiKey: string;
  registeredAt: number;
  battlesPlayed: number;
}

/** The message agents must sign to prove wallet ownership */
export function registrationMessage(address: string): string {
  return `Clawttack agent registration\nAddress: ${address.toLowerCase()}\nI confirm ownership of this wallet for battle participation.`;
}

export class AgentRegistry {
  private agents = new Map<string, RegisteredAgent>(); // address (lowercase) → agent
  private keyIndex = new Map<string, string>(); // apiKey → address (lowercase)

  /** Register a new agent (or update name if re-registering) */
  register(address: string, name: string, signature: string): RegisteredAgent {
    const normalized = address.toLowerCase();
    const message = registrationMessage(normalized);

    // Verify signature proves wallet ownership
    const recovered = ethers.verifyMessage(message, signature).toLowerCase();
    if (recovered !== normalized) {
      throw new Error('Signature does not match address');
    }

    // Check if already registered
    const existing = this.agents.get(normalized);
    if (existing) {
      // Update name, keep same API key
      existing.name = name;
      return existing;
    }

    // Generate API key
    const apiKey = this.generateApiKey();

    const agent: RegisteredAgent = {
      address: normalized,
      name,
      apiKey,
      registeredAt: Date.now(),
      battlesPlayed: 0,
    };

    this.agents.set(normalized, agent);
    this.keyIndex.set(apiKey, normalized);
    return agent;
  }

  /** Look up agent by address */
  getByAddress(address: string): RegisteredAgent | undefined {
    return this.agents.get(address.toLowerCase());
  }

  /** Look up agent by API key */
  getByApiKey(apiKey: string): RegisteredAgent | undefined {
    const address = this.keyIndex.get(apiKey);
    return address ? this.agents.get(address) : undefined;
  }

  /** Validate an API key, return the agent address if valid */
  validateKey(apiKey: string): string | null {
    return this.keyIndex.get(apiKey) ?? null;
  }

  /** List all registered agents (public info only, no API keys) */
  list(): Array<Omit<RegisteredAgent, 'apiKey'>> {
    return Array.from(this.agents.values()).map(({ apiKey: _, ...rest }) => rest);
  }

  /** Increment battle count for an agent */
  recordBattle(address: string): void {
    const agent = this.agents.get(address.toLowerCase());
    if (agent) agent.battlesPlayed++;
  }

  /** Total registered agents */
  get size(): number {
    return this.agents.size;
  }

  private generateApiKey(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
