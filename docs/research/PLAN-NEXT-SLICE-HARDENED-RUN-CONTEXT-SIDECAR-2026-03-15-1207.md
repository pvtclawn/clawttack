# Plan — next smallest hardened run-context sidecar slice (2026-03-15 12:07 UTC)

## Context
Recent lanes established:
1. the next real agent-vs-agent run should be classified at the first missing boundary,
2. hardened `completionEvidence` reporting is already implemented and verified,
3. the smallest remaining ambiguity reducer is a per-battle sidecar,
4. but a naive sidecar can create false confidence through drift, stale booleans, and wrong battle binding.

## Candidate tasks

### Task 1 — Hardened run-context sidecar as observation ledger (smallest)
**Scope:** harness/runner metadata emission only.

**Change:** implement a per-battle sidecar that behaves like an observation ledger, not a truth cache:
- immutable `battleId` + `battleAddress` once bound,
- `lastUpdatedAt`,
- `lastUpdateSource`,
- tri-state milestone fields (`acceptedOnChain`, `terminalOnChain`: `observed|absent|indeterminate`),
- observation method/error fields,
- `terminalKind`,
- optional derived `firstMissingBoundary` but not as the sole evidence source.

**Acceptance criteria:**
1. one controlled run writes the sidecar at create-time and preserves it on early exit,
2. sidecar identity mismatches against log/checkpoint artifacts fail closed,
3. stale or missing updates surface as `indeterminate`, not `false`,
4. sidecar contains enough metadata for the summarizer to populate hardened `completionEvidence` without manual reconstruction,
5. no field shape implies the sidecar itself is canonical truth.

### Task 2 — Summarizer mismatch warnings for sidecar/raw divergence
**Scope:** reporting polish.

**Change:** teach summarizer to emit explicit warnings when sidecar identity or milestone claims disagree with logs/checkpoints.

**Why not first:** valuable, but downstream of having the hardened sidecar shape.

### Task 3 — Live harness boundary-stop integration
**Scope:** runner control flow.

**Change:** stop the run automatically at the first classified missing boundary.

**Why not first:** useful later, but larger than the minimal metadata slice.

## Chosen next task
**Implement Task 1 first: hardened run-context sidecar as observation ledger.**

## Why this first
- smallest mergeable slice,
- directly incorporates the sidecar red-team critique,
- reduces ambiguity before the next real battle,
- provides structured inputs for later mismatch warnings and boundary-stop automation.

## Next Task
Patch the live harness/runner to emit a hardened per-battle run-context sidecar with immutable identity binding, tri-state observation fields, last-update metadata, observation methods/errors, and `terminalKind`, while preserving enough raw pointers for fail-closed comparison against logs/checkpoints.
