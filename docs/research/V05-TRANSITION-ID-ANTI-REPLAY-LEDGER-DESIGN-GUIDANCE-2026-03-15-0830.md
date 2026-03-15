# V05 transition-id anti-replay ledger design guidance — 2026-03-15 08:30 UTC

## Research question
What is the minimal deterministic design for transition-id anti-replay in bounded epoch-transition enforcement (scoped uniqueness, one-time consumption, fail-closed replay semantics)?

## Signal summary
External signal was noisy/general, but stable patterns converge:
- replay defense needs **single-use identifiers** (nonce/idempotency style),
- uniqueness must be **context-scoped** (operation payload + version),
- ambiguous/duplicate consumption must fail closed.

## Decision
**Use a scoped one-time transition ledger with deterministic key derivation and payload binding.**

## Minimal deterministic design

### 1) Transition ledger key
Derive a stable key from:
- `ruleVersion`
- `modeProfileHash`
- `fromEpoch`
- `toEpoch`
- `anchorEpochTransitionId`

`ledgerKey = sha256(canonical_json(fields_above))`

### 2) Payload binding hash
Bind key use to transition payload shape:
- `anchorTransitionCarryoverDigest`
- `anchorEpochTransitionWindowSize`
- `anchorTransitionWithinBound`

`payloadHash = sha256(canonical_json(payload_subset))`

### 3) One-time consumption semantics
Ledger record states:
- `reserved` (optional short lease)
- `consumed` (final)

Validation:
1. if ledgerKey unseen -> accept and consume,
2. if seen with same payloadHash and status consumed -> treat as deterministic replay attempt => fail-closed (no side effects),
3. if seen with different payloadHash -> fail-closed as tamper/replay.

### 4) Fail-closed trigger semantics
- same key replay:
  - `hard-invalid:anchor-transition-id-replay:duplicate`
- same key, payload mismatch:
  - `hard-invalid:anchor-transition-id-replay:payload-mismatch`

## Why this is minimal + sufficient now
- Adds one small deterministic guardrail without full state-machine redesign.
- Blocks transition-id reuse across contexts and payload mutation attacks.
- Keeps artifact reasoning auditable (key + payload hash + reason code).

## Suggested acceptance criteria (next implementation/verify)
- Fixture A: first-seen ledgerKey -> no replay trigger.
- Fixture B: repeated same ledgerKey + same payloadHash -> duplicate replay trigger.
- Fixture C: repeated same ledgerKey + different payloadHash -> payload-mismatch trigger.
- Markdown/json both surface ledger replay reason and consumed key id/hash.

## Posting decision
No external post (internal anti-replay design hardening only).
