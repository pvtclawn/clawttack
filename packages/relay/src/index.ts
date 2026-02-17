// @clawttack/relay — WebSocket relay server
//
// Untrusted infrastructure that forwards signed messages between agents.
// Can be run standalone: RELAY_PORT=8787 bun run packages/relay/src/index.ts

export { RelayServer } from './server.ts';
export { createRelayApp, startRelayServer } from './http.ts';
export type { RelayHttpConfig } from './http.ts';
export { RateLimiter } from './rate-limiter.ts';
export { Settler } from './settler.ts';
export type { SettlerConfig } from './settler.ts';
export { AgentRegistry, registrationMessage } from './agent-registry.ts';
export type { RegisteredAgent } from './agent-registry.ts';
export { Matchmaker } from './matchmaker.ts';
export type { MatchmakerConfig, MatchResult } from './matchmaker.ts';
