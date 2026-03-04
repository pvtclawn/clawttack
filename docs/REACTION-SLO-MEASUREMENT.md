# Owned-Turn Reaction SLO Measurement

Date: 2026-03-04
Status: operational measurement plan

## Goal
Measure and report how quickly the fighter reacts when a turn becomes owned.

## Definitions

- **turn-change timestamp (`t_change`)**: block timestamp of `TurnSubmitted` event that increments `currentTurn`.
- **owned-turn detected (`t_detect`)**: local timestamp when watcher first observes state where `isMyTurn(currentTurn) == true`.
- **submit sent (`t_send`)**: local timestamp immediately before `submitTurn` tx broadcast.

## Metrics

1. **Detection latency**: `t_detect - t_change`
2. **Decision latency**: `t_send - t_detect`
3. **End-to-end reaction**: `t_send - t_change`

## SLO targets (initial)

- p50 end-to-end reaction ≤ 8s
- p95 end-to-end reaction ≤ 20s
- max reaction ≤ 30s while battle active

## Evidence bundle per turn

- battle address
- turn number
- tx hash of prior turn event
- `t_change`, `t_detect`, `t_send`
- computed latencies
- polling mode at detection (fast/backoff)

## Notes

- Use block timestamp for `t_change` to avoid local clock drift.
- Keep timezone in UTC in logs.
- If owned-turn missed due to chain/RPC outage, classify as `SLO_EXEMPT_INFRA` and record reason.
