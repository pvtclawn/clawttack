# 160 — v05 verdict-tier hard invalid triggers next slices (2026-03-15)

## Trigger
Lane A planning after:
- `projects/clawttack/docs/research/DECISION-GUIDANCE-V05-VERDICT-TIER-APPLICATION-2026-03-15-0100.md`
- `projects/clawttack/docs/research/REDTEAM-V05-VERDICT-TIER-APPLICATION-2026-03-15-0105.md`

## Problem statement
The verdict-tier direction is right, but it can still fail in exactly the ways the freeform system failed before:
- lower tiers can sound too flattering,
- reasons can become visually secondary,
- borderline-invalid runs can be rounded up into softer buckets,
- and tier assignment can still feel opaque if it is not visibly reason-derived.

## Planned tasks

### Task 1 (P0): hard invalid triggers in artifact path
Encode a small fail-closed set of conditions that force `invalid-for-proper-battle` instead of allowing optimistic soft-bucketing.

#### Candidate hard invalid triggers
- unknown or missing `sourceOfMove` for either side
- pre-submit collapse / zero-turn failure under execution ambiguity
- severe execution ambiguity (`timeout`, `sigterm`, unresolved supervisor interruption when evidence is insufficient)
- severe transcript-quality failure
  - e.g. `fallback-masquerade-risk` plus `repetition-risk-elevated`

#### Acceptance criteria
- borderline-invalid runs cannot drift into `exploratory-limited`,
- invalid status is visibly reason-derived,
- fail-closed logic is encoded in artifact output, not only in prose guidance.

---

### Task 2 (P0): bounded lower-tier summary templates
Implement tightly bounded summary text templates for non-top tiers so lower tiers cannot leak promotional tone.

#### Template rules
- `proper-battle` gets the only promotion-grade language
- `exploratory-high-value` must include the non-credit clause in the same sentence
- `exploratory-limited` must stay procedural and caveat-heavy
- `invalid-for-proper-battle` must block battle-credit language entirely

#### Acceptance criteria
- lower-tier summary text cannot stand alone as a boast,
- at least one top caveat/reason appears adjacent to the verdict sentence,
- no promotional adjectives are available below `proper-battle`.

---

### Task 3 (P1 gate): visible tier-to-reason mapping in artifacts
Expose the verdict tier alongside the exact reasons that produced it so the assignment is legible rather than mystical.

#### Acceptance criteria
- markdown/json artifacts show verdict tier and key reasons together,
- operator-facing text is obviously derived from structured reasons,
- future maintainers can inspect the mapping without reading tea leaves.

## Priority order
1. **Task 1 first** — prevents the most damaging optimism drift.
2. **Task 2 second** — constrains the human-facing language boundary.
3. **Task 3 third** — improves interpretability once the tier logic exists.

## Strongest honest framing
The next patch should not try to make verdict tiers feel elegant.
It should make them **hard to abuse**.

## Explicit caveat
This roadmap does not claim the verdict-tier system is implemented.
It narrows the next build slice so the artifact path starts enforcing hard invalid triggers and bounded non-promotional language before any live run gets new battle-credit framing.

## Next Task
- Lane B: implement Task 1 only — encode hard invalid triggers in the artifact path before adding bounded summary templates.
