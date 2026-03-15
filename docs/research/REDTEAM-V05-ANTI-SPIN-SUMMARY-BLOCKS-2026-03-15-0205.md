# Red-Team — v05 anti-spin summary blocks (2026-03-15 02:05 UTC)

## Trigger
Lane F critique after:
- `projects/clawttack/docs/research/DECISION-GUIDANCE-V05-ANTI-SPIN-SUMMARY-BLOCKS-2026-03-15-0200.md`

## Main weaknesses identified

### 1. Spin can simply migrate outside the immediate summary block
The guidance constrains the immediate summary block, which is good — but if the rest of the artifact remains rhetorically warm, the system can still overclaim one paragraph later.

**Why this is dangerous:**
- the formal verdict block may stay compliant while the surrounding artifact reintroduces optimism,
- readers may remember the nearby warm framing more than the constrained block itself.

**Required mitigation:**
- define where the anti-spin boundary applies,
- and explicitly separate post-block interpretation from verdict rendering.

---

### 2. Tier names themselves still carry emotional weight
Even with non-promotional sentences, labels like `exploratory-high-value` still feel status-bearing.

**Why this is dangerous:**
- a cool sentence can be undermined by a warm tier label,
- especially when people skim headings and badges rather than reading full text.

**Required mitigation:**
- keep displayed lower-tier labels subdued in the immediate verdict area,
- or pair them with explicit non-credit wording every time they appear prominently.

---

### 3. Human-readable reason rendering can still sand off severity
The guidance rightly requires an adjacent caveat, but the readable form of that caveat can still become too gentle.

**Why this is dangerous:**
- `source-of-move-unknown:A` can be softened into something like “source detail pending,”
- which turns a hard boundary into a mild suggestion.

**Required mitigation:**
- preserve both raw and readable reasons,
- and keep the readable form severity-aligned with the raw code.

---

### 4. “Exploratory evidence only” may still be slightly too warm as a lead phrase
It is much better than overt hype, but still not maximally cold.

**Why this is dangerous:**
- if quoted alone, it can still sound like near-credit rather than explicit downgrade,
- especially for readers primed to search for positive signals.

**Required mitigation:**
- consider whether an even colder lead phrase should be used in the rendered block,
- or ensure the non-credit clause is visually inseparable from the lead phrase.

---

### 5. Block scope must be machine-clear, not only conceptually clear
If the “immediate summary block” is only a documentation concept, later implementations may interpret it differently.

**Why this is dangerous:**
- anti-spin rules may apply inconsistently across markdown/json/renderers,
- and future maintainers may accidentally place softening prose inside the governed region.

**Required mitigation:**
- define the exact fields/lines covered by the anti-spin rule,
- so the boundary is implementation-visible, not merely human-intended.

## Strongest critique summary
The anti-spin summary-block approach is directionally right, but it will fail if:
1. spin can migrate just beyond the constrained block,
2. lower-tier labels remain emotionally warm,
3. readable reasons soften severity,
4. lead phrases remain too flattering when quoted,
5. or the governed block boundary is not implementation-clear.

## Best next fixes called out
1. define exact block scope,
2. keep lower-tier displayed labels cool,
3. preserve readable + raw reason pairing,
4. keep the non-credit clause visually inseparable from the lead phrase,
5. explicitly separate verdict rendering from later interpretation.

## What this critique does **not** say
- It does **not** argue against anti-spin blocks.
- It does **not** say the system should return to freeform judgment.
- It says the boundary must be explicit enough that hype cannot simply step one line to the right.

## On-chain classification
- No new tx justified for this challenge lane.
- This lane tightens the final rhetorical boundary before the next artifact-path patch; it does not itself create a new gameplay artifact.
