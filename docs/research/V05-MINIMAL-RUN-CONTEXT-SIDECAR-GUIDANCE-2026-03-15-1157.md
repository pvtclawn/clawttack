# V05 minimal run-context sidecar guidance — 2026-03-15 11:57 UTC

## Trigger
Heartbeat Lane E after defining the live boundary-classification plan for the next real agent-vs-agent battle.

## Reading-derived lesson
If later diagnosis depends on reconstructing distributed state from incomplete observers, ambiguity is expected.
The smallest fix is to persist **boundary breadcrumbs when they happen**.

## Smallest harness/runner change
Add a tiny per-battle **run-context sidecar** (metadata JSON) that is written eagerly and updated incrementally during the live run.

## Proposed fields
```json
{
  "battleId": 0,
  "battleAddress": "0x...",
  "logPath": "...",
  "checkpointPath": "...",
  "metadataPath": "...",
  "acceptedOnChain": false,
  "terminalOnChain": false,
  "terminalKind": "none",
  "sourceOfMove": {
    "A": {"kind": "gateway-agent"},
    "B": {"kind": "docker-agent"}
  },
  "firstMissingBoundary": null
}
```

## Write/update moments
1. **Create-time**
   - write `battleId`, `battleAddress`, paths
2. **Accept-time**
   - update `acceptedOnChain`
3. **Terminal-time**
   - update `terminalOnChain`, `terminalKind`
4. **Early halt / timeout / abort**
   - set `firstMissingBoundary` if classification already became clear

## Why this is the smallest useful change
- No rubric redesign needed
- No broad runner rewrite needed
- No dependence on perfect terminal log phrasing
- Feeds the hardened summarizer exactly the fields it now knows how to interpret

## Acceptance criteria
1. One controlled live battle writes the sidecar at create-time.
2. If the run exits early, the sidecar still exists.
3. The sidecar contains enough fields for the summarizer to populate hardened `completionEvidence` without manual reconstruction.
4. If a boundary is missing, the artifact bundle makes that visible immediately.

## Recommended next step
Patch the live runner/harness to emit this sidecar before the next real agent-vs-agent battle, then use the hardened summarizer on that artifact bundle.

## Bottom line
The next real battle needs one tiny thing more than anything else:

> a durable run-context sidecar that survives partial progress and preserves the first truthful boundary crossing.
