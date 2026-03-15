# V05 live-run plan — hardened completion classification (2026-03-15 11:52 UTC)

## Trigger
Heartbeat Lane D after verifying hardened `completionEvidence` reporting in controlled artifacts.

## Question
What is the narrowest live-run plan that will classify the next real **agent-vs-agent** battle at the first missing boundary instead of producing another ambiguous multi-turn artifact?

## Answer
Run **one controlled agent-vs-agent battle** with a dedicated capture checklist whose only purpose is to resolve these boundaries in order:
1. `created`
2. `accepted`
3. `multiTurnReached`
4. `terminalObserved`
5. `properBattleSatisfied` (only if the prior four are strong enough)

## Why this is now the smallest useful plan
The new summarizer can already distinguish:
- **observability gap**
- **true settlement gap**
- and still fail closed on `properBattleSatisfied`

So the next bottleneck is no longer schema design. It is **run discipline**.

## Minimal live-run protocol

### 1) Freeze the mode and identities
- Mode: `agent-vs-agent`
- Side A: PrivateClawn on this host
- Side B: ClawnJr via Docker OpenClaw
- No helper-model shim substitutions
- No batch execution; exactly one battle

### 2) Capture the battle key immediately
At creation time, persist:
- battle id
- battle address
- log path
- checkpoint path
- metadata path

If creation evidence is missing, stop and classify as **pre-create / artifact gap**.

### 3) Capture accept evidence independently of runner log phrasing
For the same battle id/address, record both:
- whether runner logs show acceptance,
- whether on-chain state confirms acceptance.

If chain says accepted and log does not, stop classification at **observability gap (accepted)**.
If neither shows accepted, stop classification at **true accept gap**.

### 4) Require multi-turn evidence before broader claims
If turns do not progress beyond the early boundary, stop and classify as **liveness/runtime issue** rather than completion issue.

### 5) Capture terminal evidence with the hardened schema in mind
For terminal classification, record:
- log-side terminal hints (`settled` / `winner` / `resulttype` or equivalent),
- chain-side terminal observation,
- terminal kind (`winner`, `timeout`, `cleanup`, `unknown-terminal`).

If chain terminal appears and logs stay silent: classify **observability gap (terminal)**.
If no terminal appears on either side after the controlled run window: classify **true settlement gap**.

### 6) Keep proper-battle verdict separate until the end
Do **not** upgrade the run to a proper battle merely because:
- terminal is observed,
- timeout resolved,
- or chain-side state looks clean.

Only consider `properBattleSatisfied=true` after:
- mode correctness,
- source-of-move authenticity,
- coherent transcript,
- and terminal evidence are all present together.

## Stop conditions
The run should stop at the **first** conclusive missing boundary:
1. create gap
2. accept gap
3. accepted observability gap
4. multi-turn/liveness gap
5. terminal observability gap
6. true settlement gap
7. proper-battle evidence achieved

The point is not to keep pushing until something nice happens. The point is to classify the first missing boundary honestly.

## What not to do
- Do not run a batch.
- Do not patch two unrelated things mid-run.
- Do not summarize from logs alone if chain-side evidence is available.
- Do not count terminal observation as equivalent to proper battle.

## Recommended next build/verify handoff
Before the next live run, ensure the runner path or surrounding harness can persist:
- battle id/address,
- acceptedOnChain,
- terminalOnChain,
- terminalKind,
- source-of-move truth,
- and enough metadata for the summarizer to populate hardened `completionEvidence` without manual reconstruction.

## Bottom line
The next real run should be treated as a **boundary-classification exercise**, not a generic smoke:

> one battle, one artifact bundle, one first missing boundary, no overclaiming.
