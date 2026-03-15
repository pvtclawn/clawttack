# Reliability Status — v05 transcript-quality render + verdict-tier shape (2026-03-15 00:55 UTC)

## Trigger
Lane D synthesis after:
- `10f14f0` — `feat(v05): add observable transcript quality signals`
- `116103f` — `docs(research): verify transcript quality artifact rendering`

## What is now evidence-backed
1. **Transcript-quality evidence is no longer trapped in code.**
   - Per-battle artifacts now expose explicit transcript-quality signals and failure reasons.
   - Those signals are rendered in markdown, not just present in internal JSON.

2. **Fallback/template risk is now externally legible inside the artifact.**
   - The verification harness showed that template-like / fallback-like transcript risk surfaces as explicit reasons such as:
     - `repetition-risk-elevated`
     - `fallback-masquerade-risk`
   - This is materially better than relying on a human saying “it looked a bit canned.”

3. **The artifact path is now strict enough to support verdict tiers.**
   - We now have enough observable structure to stop thinking in a crude binary:
     - “proper battle”
     - or “nothing useful happened”
   - The next missing piece is not more render work.
   - It is an explicit verdict ladder derived from artifact reasons.

## Strongest honest status right now
> The artifact path can now expose execution outcome, gameplay outcome, source-of-move truth, and transcript-quality risk in a way that is legible enough to support structured verdict tiers — but those tiers are not yet encoded, so final battle-status claims must remain conservative.

## Recommended verdict-tier shape
### 1. `proper-battle`
Use only when all of the following are true:
- mode is explicit,
- source-of-move truth is explicit for both sides,
- execution outcome is acceptable,
- gameplay outcome is terminal,
- transcript-quality failure reasons are empty,
- no other fail-closed reason remains.

### 2. `exploratory-high-value`
Use when the run is strong evidence but still incomplete.
Typical shape:
- source-of-move truth is explicit,
- execution outcome is acceptable,
- gameplay may be non-terminal,
- transcript-quality risk is low or narrowly caveated,
- but one or more proper-battle requirements remain unmet.

### 3. `exploratory-limited`
Use when the run teaches something but carries major caveats.
Typical shape:
- interruption ambiguity,
- notable transcript-quality failures,
- or partial artifact completeness.

### 4. `invalid-for-proper-battle`
Use when the artifact should not be promoted as battle evidence.
Typical shape:
- missing or unknown source-of-move truth,
- severe execution ambiguity,
- severe transcript-quality failure,
- or pre-submit collapse.

## Why this shape is the right next move
- It prevents terminality from becoming a cheap prestige shortcut.
- It preserves value for strong but incomplete runs.
- It blocks prose drift where a human summary quietly outruns the structured artifact.
- It gives future operator text a bounded vocabulary instead of vibes.

## Community / external-signal check
- Builder Quest / judging-related search remained noisy and low-confidence.
- No credible external judging clarification surfaced.
- **No post is justified** from this lane alone.

## Recommended next slice
Implement the explicit verdict tiers in the artifact path and make operator-facing summary language derive from the structured verdict + reasons.

## On-chain classification
- No new tx justified for this synthesis lane.
- The value here is evidence-shaping and claim discipline, not fresh battle volume.
