# Red-Team — v05 cool lower-tier labels (2026-03-15 02:35 UTC)

## Trigger
Lane F critique after:
- `projects/clawttack/docs/research/DECISION-GUIDANCE-V05-COOL-LOWER-TIER-LABELS-2026-03-15-0230.md`

## Main weaknesses identified

### 1. Render-only cooling can create a two-truths problem
The guidance says to keep internal tier codes unchanged while cooling only the displayed lower-tier labels in the governed block.

**Why this is dangerous:**
- maintainers may reason from internal tier codes while readers reason from display labels,
- if the two differ too much, debugging, auditing, and quoting become confusing,
- and the artifact can start feeling like it has a public truth and a private truth.

**Required mitigation:**
- keep the displayed label cool, but preserve a visible path back to the internal/raw tier for auditability.

---

### 2. Colder labels can become too vague
A label like `non-credit / exploratory` is cooler than `exploratory-high-value`, but it can also become generic enough to hide meaningful distinction.

**Why this is dangerous:**
- the system may solve “prestige leakage” by flattening too much nuance,
- which could make lower-tier states harder to interpret operationally.

**Required mitigation:**
- keep labels cool **and** legible,
- so they still distinguish limited vs exploratory without sounding like prizes.

---

### 3. The first visible word still matters
Even cooled labels can leak warmth depending on the lead term.

**Why this is dangerous:**
- skim-readers often anchor on the first noun/phrase,
- so a label that starts with a value-bearing word can still feel positive even if the full string is technically downgraded.

**Required mitigation:**
- lead with the downgrade (`non-credit`, `limited`, etc.),
- not with the more flattering concept.

---

### 4. Invalid-tier asymmetry may make the ladder feel arbitrary
The guidance suggests keeping `invalid-for-proper-battle` explicit while cooling the exploratory tiers.

**Why this is dangerous:**
- if one tier remains precise and the others become vague, the ladder can feel uneven,
- and readers may infer more confidence in the invalid bucket than in the exploratory buckets simply because the wording is sharper.

**Required mitigation:**
- keep the full ladder stylistically coherent even if severity differs.

---

### 5. Cooling labels alone will not stop cross-surface leakage
The governed block may show a cooled label while JSON exports, logs, or future UI badges show the warmer internal tier.

**Why this is dangerous:**
- prestige can leak back through another surface,
- and different renderers may accidentally reintroduce the warmer phrasing.

**Required mitigation:**
- verify label handling across the governed block and adjacent render surfaces,
- and keep explicit non-credit status in the governed block so the label never stands alone.

## Strongest critique summary
The cool-label approach is directionally right, but it will fail if:
1. internal and displayed labels become two competing truths,
2. cooled labels become too vague,
3. the first visible word still carries warmth,
4. the ladder becomes stylistically uneven,
5. or warmer phrasing leaks back through neighboring surfaces.

## Best next fixes called out
1. keep displayed labels cool but auditable,
2. lead with downgrade terms,
3. preserve clear distinction without prestige,
4. keep the ladder stylistically coherent,
5. verify cross-surface label consistency.

## What this critique does **not** say
- It does **not** argue against cooling labels.
- It does **not** say internal tier codes must be renamed immediately.
- It says the rendering patch must avoid replacing hype with vagueness or hidden divergence.

## On-chain classification
- No new tx justified for this challenge lane.
- This lane tightens the remaining visible-label boundary before the next artifact-path patch; it does not itself create a new gameplay artifact.
