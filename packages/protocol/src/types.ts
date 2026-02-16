// src/types/relay.ts — WebSocket relay protocol types
//
// Every message between agent ↔ relay is typed and signed.
// The relay is UNTRUSTED — it cannot modify signed content.

/** Message from agent → relay */
export interface AgentMessage {
  type: 'register' | 'turn' | 'forfeit';
  battleId: string;
  agentAddress: string; // Ethereum address (checksummed)
  payload: string; // The actual message content
  turnNumber: number; // Sequential, starts at 1
  timestamp: number; // Unix ms
  signature: string; // ECDSA signature over the canonical message hash
}

/** Message from relay → agent */
export interface RelayMessage {
  type:
    | 'battle_joined' // Successfully joined the battle WS
    | 'battle_started' // Battle is starting, here are your role instructions
    | 'your_turn' // It's your turn to respond
    | 'turn_received' // Your turn was accepted
    | 'opponent_turn' // Opponent's signed turn (for verification)
    | 'battle_ended' // Battle is over
    | 'error'; // Something went wrong
  battleId: string;
  data: Record<string, unknown>;
}

/** Battle state tracked by relay */
export interface RelayBattle {
  id: string;
  scenarioId: string;
  agents: RelayAgent[];
  state: 'waiting' | 'active' | 'ended';
  activeAgentIndex: number; // Whose turn (0 or 1)
  turns: SignedTurn[];
  maxTurns: number;
  commitment: string; // Scenario commitment hash
  scenarioData: Record<string, unknown>; // Private scenario state
  roles: Record<string, string>; // agentAddress → role
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  outcome?: BattleOutcome;
  ipfsCid?: string; // Set after upload
}

export interface RelayAgent {
  address: string; // Ethereum address
  name: string;
  connected: boolean;
}

/** A turn with its cryptographic signature */
export interface SignedTurn {
  agentAddress: string;
  message: string;
  turnNumber: number;
  timestamp: number;
  signature: string;
  role: string;
}

/** Battle outcome for settlement */
export interface BattleOutcome {
  winnerAddress: string | null;
  loserAddress: string | null;
  reason: string;
  verified: boolean;
}

/** The canonical message that gets signed by agents */
export interface TurnMessage {
  battleId: string;
  agentAddress: string;
  message: string;
  turnNumber: number;
  timestamp: number;
}

/** IPFS battle log — the full record uploaded after battle ends */
export interface BattleLog {
  version: 1;
  battleId: string;
  scenarioId: string;
  commitment: string;
  agents: Array<{
    address: string;
    name: string;
    role: string;
  }>;
  turns: SignedTurn[];
  outcome: BattleOutcome;
  reveal?: string; // Scenario-specific reveal data (e.g., the secret phrase)
  startedAt: number;
  endedAt: number;
}
