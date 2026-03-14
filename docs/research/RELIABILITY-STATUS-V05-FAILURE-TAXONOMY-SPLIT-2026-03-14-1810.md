# Reliability Status — v05 failure taxonomy split (2026-03-14 18:10 UTC)

## Scope
Synthesize current reliability after shipping and verifying the summarizer failure taxonomy split (`interface-decode/*` vs `runtime/*`).

## Evidence checked
- `docs/research/V05-FAILURE-TAXONOMY-SPLIT-VERIFICATION-2026-03-14-1805.md`
- `battle-results/summaries/aggregate/latest.json`
- `battle-results/summaries/aggregate/latest.md`
- latest per-battle summaries under `battle-results/summaries/per-battle/`

## Current status
1. Taxonomy split is active in refreshed artifacts.
2. Aggregate failure histogram is now classed instead of opaque raw strings.
3. Strict guardrails remain healthy on the latest refresh (`strictViolationCount=0`).
4. Recent window output is interpretable without collapsing interface issues into generic `unknown`.

## What is reliable to claim now
- We can reliably distinguish **implemented** failure families:
  - `interface-decode/*`
  - `runtime/*`
  - `none`
- Recent strict-refresh artifacts preserve both class-level and detail-level failure context.

## Known limits (no overclaim)
- Current keyword mapping is still shallow; interface-decode subtype breadth is not exhaustive.
- Historical pre-split snapshots can still contain legacy raw failure strings.
- This is artifact-quality progress, not proof of broad gameplay robustness.

## Decision
Next highest-value slice: **intervention-run evidence collection** (strict labeled low-volume run) before subtype expansion, because current blocker risk has shifted from classification visibility to additional live evidence quality.

## Next task
- Run one strict labeled intervention refresh and review whether any new decode signatures appear.
- If new decode signatures appear, expand subtype mapping in the next build slice.
