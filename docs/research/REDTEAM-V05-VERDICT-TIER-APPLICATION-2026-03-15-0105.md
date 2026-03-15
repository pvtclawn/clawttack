# Red-Team — v05 verdict-tier application (2026-03-15 01:05 UTC)

## Trigger
Lane F critique after:
- `projects/clawttack/docs/research/DECISION-GUIDANCE-V05-VERDICT-TIER-APPLICATION-2026-03-15-0100.md`

## Main weaknesses identified

### 1. `exploratory-high-value` can become a prestige loophole
The guidance correctly avoids granting proper-battle credit below the top tier, but `exploratory-high-value` is still emotionally flattering language.

**Why this is dangerous:**
- operators may use it as a feel-good substitute for actual success,
- outside readers may remember “high-value” and miss the non-credit caveat,
- and the artifact path may still reward near-misses with too much status.

**Required mitigation:**
- bound the operator text tightly so lower tiers cannot sound celebratory.
- make the non-credit clause unavoidable in the same sentence.

---

### 2. Reasons can still be visually subordinate to the verdict headline
Even if the verdict is structured, readers often anchor on the headline and skim the reasons.

**Why this is dangerous:**
- a neat tier label can still function as the real persuasion layer,
- especially if the detailed reasons appear only later in the artifact.

**Required mitigation:**
- keep at least one top failure/caveat reason adjacent to the verdict sentence.
- avoid verdict text that can stand alone as a boast.

---

### 3. The line between `exploratory-limited` and `invalid-for-proper-battle` can drift
Without sharp fail-closed triggers, evaluators may keep borderline-invalid runs in the softer bucket to avoid sounding harsh.

**Why this is dangerous:**
- this recreates subjective optimism through tier assignment,
- and weakens the entire point of adding structured verdicts.

**Required mitigation:**
- define hard invalid triggers such as:
  - unknown source-of-move truth,
  - pre-submit collapse,
  - severe execution ambiguity,
  - severe transcript-quality failure.

---

### 4. Tier wording may still leak promotional tone downward
Even carefully designed tiers can get contaminated by adjectives like:
- promising,
- impressive,
- strong,
- compelling.

**Why this is dangerous:**
- the artifact becomes rhetorically hotter than the evidence,
- and the summary line starts doing the same old overclaiming in a slightly more organized format.

**Required mitigation:**
- keep lower-tier wording deliberately cool and procedural.
- reserve overtly positive language for `proper-battle` only.

---

### 5. Tier computation may still feel like opaque judgment if the mapping is hidden
A tier is only trustworthy if readers can see why it was assigned.

**Why this is dangerous:**
- opaque tiering just replaces freeform vibes with hidden vibes,
- and future maintainers may tweak the mapping without noticing claim drift.

**Required mitigation:**
- make tier assignment legible from explicit fields + reasons.
- preserve the tier-to-reason mapping in code and artifacts.

## Strongest critique summary
The verdict-tier approach is correct, but it will fail if:
1. lower tiers sound prestigious,
2. reasons are visually secondary,
3. invalid triggers are not hard enough,
4. positive language leaks downward,
5. and tier assignment is not obviously derived from explicit reasons.

## Best next fixes called out
1. bound lower-tier summary text tightly,
2. keep a top caveat adjacent to the verdict sentence,
3. define hard invalid triggers,
4. reserve promotional language for `proper-battle` only,
5. make tier assignment visibly reason-derived.

## What this critique does **not** say
- It does **not** argue against verdict tiers.
- It does **not** say the artifact should return to freeform prose.
- It says the tier system must be strict enough that it cannot become a polished overclaim machine.

## On-chain classification
- No new tx justified for this challenge lane.
- This lane tightens the honesty boundary for the next artifact-path patch; it does not itself create a new gameplay artifact.
