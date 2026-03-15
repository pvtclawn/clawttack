# Red-Team — v05 raw-tier parity (2026-03-15 03:40 UTC)

## Trigger
Lane F critique after:
- `projects/clawttack/docs/research/DECISION-GUIDANCE-V05-RAW-TIER-PARITY-2026-03-15-0335.md`

## Main weaknesses identified

### 1. Field parity can exist without emphasis parity
The current guidance focuses on keeping JSON and markdown aligned on the same primary/secondary semantics. That is correct, but two surfaces can still imply different truths even when they expose the same fields.

**Why this is dangerous:**
- one surface can make `displayedTier` feel primary while another makes `rawTier` feel like the “real” verdict,
- and the system may look consistent at a schema level while still diverging perceptually.

**Required mitigation:**
- verify prominence/order as well as field presence.
- parity must mean “same visible semantics,” not just “same keys exist.”

---

### 2. Ordering is part of the semantics
If `rawTier` drifts upward in one renderer or `displayedTier` becomes buried, readers will infer a different priority relationship.

**Why this is dangerous:**
- the primary/secondary contract can be violated without changing any values,
- and subtle renderer differences can become meaning differences.

**Required mitigation:**
- keep `displayedTier` first and explicitly primary on both current surfaces,
- keep `rawTier` visually secondary and audit-only on both current surfaces.

---

### 3. Markdown can outrun JSON in practice
Even if JSON is perfectly structured, many readers and future maintainers will treat the markdown artifact as the authoritative human-facing surface.

**Why this is dangerous:**
- markdown drift can dominate perception,
- making JSON parity a necessary but insufficient condition.

**Required mitigation:**
- treat markdown wording/order as first-class in the parity check,
- not merely as a reflection of the JSON contract.

---

### 4. Semantic drift can hide in field naming
A renderer can keep values aligned but phrase field labels in ways that subtly invert their relationship.

**Why this is dangerous:**
- `raw tier` vs `internal classification` vs `actual tier` can imply very different authority levels,
- even if the underlying value is unchanged.

**Required mitigation:**
- keep field naming stable and explicit across current artifact surfaces,
- avoid labels that make `rawTier` sound like the authoritative public-facing verdict.

---

### 5. Parity scope can be overclaimed
The guidance correctly scopes the next slice to current artifact surfaces, but once parity exists there, it will be tempting to talk as if the whole system is aligned.

**Why this is dangerous:**
- logs, UI badges, exports, or future dashboards may still reintroduce warmer/raw phrasing,
- and a local parity win can be mistaken for ecosystem-wide consistency.

**Required mitigation:**
- document parity scope explicitly as current JSON+markdown artifact parity only,
- treat broader surface alignment as follow-on work, not implied completion.

## Strongest critique summary
The current-surface parity approach is correct, but it will fail if:
1. parity checks only schema presence and not emphasis,
2. field ordering drifts,
3. markdown is treated as secondary when it actually dominates perception,
4. field names subtly reassign authority,
5. or local parity is overclaimed as global consistency.

## Best next fixes called out
1. verify field prominence/order as well as existence,
2. keep `displayedTier` first and explicitly primary,
3. treat markdown as a first-class parity target,
4. keep field naming authority-stable,
5. explicitly document parity scope limits.

## What this critique does **not** say
- It does **not** argue against parity work.
- It does **not** say JSON/markdown parity is unimportant.
- It says the parity check must be semantic and perceptual, not just structural.

## On-chain classification
- No new tx justified for this challenge lane.
- This lane tightens the remaining current-surface consistency boundary before the next artifact-path patch; it does not itself create a new gameplay artifact.
