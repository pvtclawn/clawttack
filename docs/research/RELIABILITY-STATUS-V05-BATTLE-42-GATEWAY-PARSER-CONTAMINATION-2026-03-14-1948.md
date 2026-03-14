# Reliability Status — v05 battle #42 gateway parser contamination (2026-03-14 19:48)

## Scope
Synthesis-only follow-up to verification artifact:
- `docs/research/V05-RPC-FALLBACK-BATTLE-42-VERIFICATION-2026-03-14-1943.md`

## What is now reliably known
1. **RPC fallback wiring is functioning enough to preserve liveness through create/accept** in the tested path (battle #42 was created and accepted).
2. The observed failure is **not** currently a create/accept or pendingVOP ABI decode failure.
3. The observed failure is a **local parser-boundary fault**: `v05-battle-loop.ts` attempted `JSON.parse(raw)` on gateway output that included a non-JSON preamble line (`plugins...`) before the expected JSON payload.
4. Current summary taxonomy still classifies this under coarse runtime buckets, so parser contamination risk can be under-specified without explicit subtyping.

## Reliability claim (narrow, evidence-backed)
- We can claim **endpoint failover + early battle pipeline works in this window**, but **battle-loop gateway output parsing is not yet robust to stdout noise/preamble contamination**.

## Non-overclaim boundary
This does **not** prove:
- broad RPC resilience under multiple simultaneous endpoint failures,
- full parser robustness across all gateway output shapes,
- safe scale-up readiness for higher battle volume.

## Immediate priority decision
Prioritize a **parser-hardening patch** in `packages/sdk/scripts/v05-battle-loop.ts` before any scale-up:
- tolerate non-JSON preamble/noise,
- parse first valid JSON object/line deterministically,
- emit stage-labeled diagnostics when contamination is detected.

## Gate before scale-up
Require one strict post-patch live confirmation sample with:
- no gateway JSON parse contamination failure,
- strict guardrails still green,
- refreshed summary artifact attached.

## On-chain classification
- No additional on-chain action needed for this synthesis lane.
