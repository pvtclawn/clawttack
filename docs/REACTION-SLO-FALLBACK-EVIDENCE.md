# Reaction SLO Fallback Evidence (Opponent Inactivity)

Date: 2026-03-04

## Problem
Owned-turn reaction SLO cannot be sampled if opponent does not advance turn.

## Fallback evidence strategy

When no owned-turn window appears for prolonged periods, collect **watcher readiness evidence**:

1. **Snapshot cadence logs**
   - prove polling loop remains alive and state-aware.

2. **Mode transitions**
   - show fast→backoff→fast transitions on snapshot change.

3. **Guard readiness checks**
   - periodic dry-run preflight simulation on synthetic payload (no send).

4. **Timeout-claim readiness**
   - show deadline proximity checks remain active under backoff.

## Reporting format

- `sloEvidenceType`: `owned_turn_live` or `watcher_readiness_fallback`
- include rationale when fallback used:
  - `NO_OWNED_TURN_WINDOW`
  - duration waiting
  - latest battle snapshot

## Exit condition

Switch back to live SLO evidence as soon as first owned-turn submit occurs.
