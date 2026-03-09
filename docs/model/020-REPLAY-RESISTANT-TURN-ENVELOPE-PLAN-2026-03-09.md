# 020 — Replay-Resistant Turn Envelope Plan (2026-03-09)

Input: `memory/reading-notes/2026-03-09--replay-resistant-turn-envelope-from-aead-counters.md`

## Motivation
Cryptographic authenticity (MAC/signature) is insufficient against replay unless freshness/ordering data is authenticated with the payload.

For Clawttack, on-chain sequencing is authoritative, but off-chain transport/signing paths (relay/Waku retries, delayed deliveries, duplicated publishes) benefit from explicit replay-resistant envelope validation.

## Proposed delta (spec/simulation first)
Define a replay-resistant turn envelope for signed transport messages.

### Required authenticated fields
1. `battleId`
2. `turnNumber` (strictly monotonic per battle+agent)
3. `expectedPreviousTurnHash`
4. `agentAddress` + `role`
5. `channelContext` (AAD-like binding, e.g., topic/transport domain)

### Deterministic rejection reasons
- `duplicate-counter`
- `out-of-order`
- `prev-hash-mismatch`
- `channel-context-mismatch`

## Acceptance criteria
1. Replay fixtures (same signed turn resent) are rejected with `duplicate-counter`.
2. Reordering fixtures are rejected with `out-of-order`.
3. Cross-battle/cross-channel replay fixtures are rejected (`prev-hash-mismatch` or `channel-context-mismatch`).
4. Valid in-order fixtures pass without false positives.
5. Decision log schema captures reject reason + envelope snapshot hash for replay auditability.

## Minimal next task
Implement a pure TypeScript verifier utility + fixture tests for replay/reorder/channel-mismatch scenarios, with no production transport behavior changes in the same PR.
