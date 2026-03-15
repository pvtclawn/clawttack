# 161 — v05 verdict-tier reason priority and anti-spin next slices (2026-03-15)

## Trigger
Lane A planning after:
- `projects/clawttack/docs/research/DECISION-GUIDANCE-V05-BOUNDED-LOWER-TIER-TEMPLATES-2026-03-15-0130.md`
- `projects/clawttack/docs/research/REDTEAM-V05-BOUNDED-LOWER-TIER-TEMPLATES-2026-03-15-0135.md`

## Problem statement
The bounded lower-tier template direction is correct, but it can still fail if:
- `top_reason` selection is optimized for optics,
- the immediate summary block reintroduces hype after a compliant first sentence,
- lower-tier lead phrases still sound too flattering,
- human-readable reason normalization softens severity,
- or quoted fragments detach too easily from the caveat.

## Planned tasks

### Task 1 (P0): reason-priority ordering for lower-tier verdicts
Encode explicit priority ordering so the summary sentence selects the most claim-limiting reason rather than the gentlest available one.

#### Candidate ordering principles
- hard invalid trigger beats ordinary proper-battle reason
- source-of-move ambiguity beats non-terminal gameplay caveat
- severe transcript-quality failure beats generic exploratory wording
- execution ambiguity beats softer completeness gaps

#### Acceptance criteria
- `top_reason` / `top_invalid_trigger` is deterministically chosen,
- lower-tier verdict text cannot foreground a mild caveat while burying a harsher one,
- reason selection is visibly derived from structured fields.

---

### Task 2 (P0): anti-spin immediate summary block rules
Constrain not only the verdict sentence, but the immediate surrounding summary block so lower tiers cannot regain hype through adjacent prose.

#### Rules to encode
- no promotional adjectives below `proper-battle`
- lower-tier block must remain non-credit throughout
- at least one caveat/trigger must remain adjacent to the verdict sentence
- first clause must be safe even when quoted alone

#### Acceptance criteria
- lower-tier summary block stays procedural and non-promotional,
- a quoted fragment from the first clause does not sound like near-success,
- caveat adjacency is preserved in artifact output.

---

### Task 3 (P1 gate): readable + raw reason pairing in artifacts
Expose human-readable reason text without hiding the raw structured reason that produced it.

#### Acceptance criteria
- artifacts show both readable and raw reason forms where helpful,
- severity is not diluted in normalization,
- auditors can trace the verdict sentence back to the raw reason codes.

## Priority order
1. **Task 1 first** — reason choice is the biggest remaining loophole.
2. **Task 2 second** — closes the adjacent-prose spin channel.
3. **Task 3 third** — improves auditability after the selection logic exists.

## Strongest honest framing
The next patch should not make lower-tier verdicts prettier.
It should make them **harder to cosmetically soften**.

## Explicit caveat
This roadmap does not claim bounded lower-tier templates are implemented.
It narrows the next build slice so the artifact path first chooses claim-limiting reasons deterministically and keeps the immediate summary block non-promotional.

## Next Task
- Lane B: implement Task 1 only — encode deterministic reason-priority ordering for lower-tier verdict selection before adding anti-spin summary-block rules.
