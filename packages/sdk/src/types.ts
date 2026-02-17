// packages/sdk/src/types.ts — Shared SDK types

export interface MatchResult {
  battleId: string;
  scenarioId: string;
  agents: Array<{ address: string; name: string }>;
}
