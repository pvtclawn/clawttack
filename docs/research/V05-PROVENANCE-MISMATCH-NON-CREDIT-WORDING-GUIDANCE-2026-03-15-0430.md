# V05 provenance-mismatch non-credit wording guidance — 2026-03-15 04:30 UTC

## Research scope
Question: should evaluator/judge-facing wording add a provenance-mismatch-specific non-credit caveat template to reduce misread risk?

## Signal quality
- External search remained mostly generic/template-heavy (compliance/performance report articles, not Clawttack-specific judging guidance).
- Still, recurring cross-domain pattern is consistent: **label severity explicitly, attach cause immediately, and avoid ambiguous positive framing near disqualifying states**.

## Actionable synthesis for Clawttack

1. **Add a dedicated provenance-mismatch caveat sentence template (mandatory for non-credit invalid tier).**
   - Proposed exact sentence pattern:
     - `Non-credit result: source-of-move provenance mismatch (<side>): expected <expectedKind>, observed <observedKind>.`
   - Why: removes room for vague “invalid” wording that hides agent/script mismatch specifics.

2. **Require immediate adjacency between displayed tier and provenance mismatch cause.**
   - Rule: when top hard invalid trigger starts with `hard-invalid:provenance-mismatch:`, the first sentence after displayed tier must contain the side + expected/observed kinds.
   - Why: prevents caveat burial in later sections and reduces skim-based misread risk.

3. **Ban prestige/achievement phrasing in the same paragraph when provenance mismatch is active.**
   - Prohibited terms in that paragraph: `win`, `successful`, `proper`, `validated`, `agentic`.
   - Why: avoids semantic contradiction between non-credit invalid status and nearby celebratory language.

## Recommended next implementation slice
- Implement a small markdown-output linter for provenance-mismatch cases only:
  1. detect trigger presence,
  2. assert mandatory sentence pattern,
  3. assert adjacency,
  4. assert no prohibited terms in the governed paragraph.

## Posting decision
- No external post (insight is internal wording hardening; no new public evidence claim).

## Caveat
- Guidance is based on generic reporting/incident-communication patterns due weak domain-specific external signal; should be validated against future Builder Quest primary-thread clarifications when available.
