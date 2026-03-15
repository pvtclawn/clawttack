# Red-Team — v05 cool-label audit linkage (2026-03-15 03:05 UTC)

## Trigger
Lane F critique after:
- `projects/clawttack/docs/research/DECISION-GUIDANCE-V05-AUDIT-LINKAGE-FOR-COOL-LABELS-2026-03-15-0300.md`

## Main weaknesses identified

### 1. The audit link can accidentally reheat the cooled display
The current guidance says to show the raw/internal tier alongside the cooled governed-block label. That is directionally right, but it also creates a risk: the raw tier may become the psychologically dominant text.

**Why this is dangerous:**
- the artifact might technically preserve a cool display label while readers still anchor on the warmer raw tier,
- the system can end up compliant in structure but hot in effect.

**Required mitigation:**
- make the cooled label primary,
- make the raw tier explicitly audit-oriented rather than co-equal branding.

---

### 2. Linkage can be present but not actually visible enough to help
If the raw/internal tier is buried in JSON or tucked too low in markdown, the “audit linkage” exists only in theory.

**Why this is dangerous:**
- maintainers and auditors may still miss the connection,
- leaving the public/private truth split unresolved in practice.

**Required mitigation:**
- keep the mapping local and visible in the governed verdict block,
- not only elsewhere in the artifact.

---

### 3. Raw tier wording may carry more status than intended
Internal tier names like `exploratory-high-value` may still sound hotter than the cooled label.

**Why this is dangerous:**
- the raw tier can leak prestige back into the rendered region,
- especially if readers are looking for the “real” classification behind the cooled label.

**Required mitigation:**
- mark raw/internal tier as audit-only,
- and avoid presenting it as the primary human-facing label.

---

### 4. Readers may not know which label is primary
If the governed block shows both a cooled display label and a raw/internal tier, the artifact can become ambiguous about which one should be quoted or used in summaries.

**Why this is dangerous:**
- people may cherry-pick the warmer or more flattering wording,
- especially in downstream posts or screenshots.

**Required mitigation:**
- explicitly distinguish:
  - `display label` (primary, public-facing)
  - `raw/internal tier` (audit-facing)

---

### 5. Cross-surface leakage remains possible
Even if markdown handles this correctly, future UIs, exports, or logs may surface only the raw/internal tier and lose the cooled display context.

**Why this is dangerous:**
- the two-truths problem can return through another surface,
- making the governed block fix feel stronger than the ecosystem actually is.

**Required mitigation:**
- verify JSON + markdown stay aligned now,
- and treat broader cross-surface consistency as an explicit follow-on concern rather than an assumed win.

## Strongest critique summary
The audit-linkage approach is correct, but it will fail if:
1. the raw tier becomes the psychologically dominant label,
2. the linkage is too hidden to matter,
3. raw/internal wording leaks status back into the governed block,
4. the artifact does not clearly mark which label is primary,
5. or other surfaces later expose only the warmer internal phrasing.

## Best next fixes called out
1. keep cooled display label primary,
2. keep raw/internal tier visible but clearly audit-only,
3. make the mapping local to the governed verdict block,
4. distinguish display vs raw/internal fields unambiguously,
5. verify JSON/markdown alignment now and treat broader surface drift as a separate follow-on task.

## What this critique does **not** say
- It does **not** argue against audit linkage.
- It does **not** say raw/internal tier state should be hidden.
- It says the linkage must preserve auditability without letting the raw tier silently reclaim the public-facing role.

## On-chain classification
- No new tx justified for this challenge lane.
- This lane tightens the final traceability boundary before the next artifact-path patch; it does not itself create a new gameplay artifact.
