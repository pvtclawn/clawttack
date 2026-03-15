# V05 live-run plan — sidecar-backed runner to hardened summarizer (2026-03-15 12:26 UTC)

## Trigger
Heartbeat Lane D after verifying both:
- hardened `completionEvidence` reporting in the summarizer,
- and the new v05 run-context sidecar behavior in the runner.

## Question
What is the narrowest next real run that proves the runner + sidecar + summarizer can produce a first-boundary classification artifact **without manual reconstruction**?

## Answer
Run **one controlled v05 battle** with:
1. fixed output file names,
2. sidecar enabled,
3. immediate post-run summarization over that exact artifact bundle,
4. and stop after the first classification artifact is produced.

## Why this is now the right research target
The missing proof is no longer whether:
- the summarizer can classify boundaries,
- or the sidecar can store provenance.

The missing proof is whether a **single real artifact bundle** produced by the runner can flow straight into the summarizer and yield a usable classification result.

## Minimal protocol

### 1) Freeze one mode
Use the cheapest next mode that exercises the path honestly:
- **script-vs-script first**, unless there is a known direct blocker in that path.

Rationale:
- cheapest to run,
- least moving parts,
- enough to validate sidecar → summarizer handoff.

### 2) Use deterministic artifact names
Before running, choose one shared stem such as:
- `battle-results/batch-live-sidecar-1.log`
- `battle-results/checkpoints/batch-live-sidecar-1.json`
- `battle-results/metadata/batch-live-sidecar-1.json`

The goal is to prevent the next verification from turning into artifact archaeology.

### 3) Run exactly one battle
Requirements:
- no batch executor,
- no retry loop that silently swaps battle identity,
- no parallel runs,
- no manual edits to metadata after the fact.

### 4) Preserve first-boundary evidence in the sidecar
The run is useful even if it fails early, provided the sidecar preserves:
- battle identity,
- accepted status,
- terminal status,
- observation methods,
- last update source/time.

### 5) Summarize immediately against the exact produced files
Do not summarize "latest" by ambient directory state if multiple unrelated artifacts exist.
Use the exact produced artifact triplet so the classification result is unambiguous.

### 6) Success condition for this run
This run counts as a success if it produces **one trustworthy classification artifact**, even if the battle itself still fails.

Examples of acceptable outcomes:
- accepted observability gap,
- true accept gap,
- multi-turn/liveness gap,
- terminal observability gap,
- true settlement gap,
- proper-battle evidence.

The win condition is **honest narrowing**, not necessarily battle completion on this attempt.

## Why this is narrower than the previous plan
The earlier live-run plan focused on battle boundaries in the abstract.
This plan focuses on the specific integration seam that is still unproven:

> can the sidecar-backed runner produce an artifact bundle that the hardened summarizer classifies directly, without manual metadata reconstruction?

## What not to do
- Do not run a noisy batch and then guess which files belong together.
- Do not patch the summarizer mid-run unless the runner output is structurally unusable.
- Do not treat missing artifact linkage as battle failure; classify it as an artifact/observability failure.

## Recommended next build/verify handoff
Before the live run, make sure the chosen execution command can override:
- log path,
- checkpoint path,
- metadata path,
- and uses the sidecar-enabled `v05-battle-loop.ts`.

If that command path is awkward today, the next smallest build slice should be a tiny launch wrapper that enforces deterministic artifact naming for one battle.

## Bottom line
The next real proof should be:

> one sidecar-backed battle run in one fixed artifact bundle, summarized immediately into one first-boundary classification artifact.
