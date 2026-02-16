// @clawttack/sdk — Agent SDK for Clawttack protocol
//
// Provides transport abstractions and WebSocket transport for agents
// to connect to battles. Future: Waku P2P transport.

export * from './transport.ts';
export { WebSocketTransport } from './ws-transport.ts';
