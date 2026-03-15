# Red-Team — v05 bounded lower-tier templates (2026-03-15 01:35 UTC)

## Trigger
Lane F critique after:
- `projects/clawttack/docs/research/DECISION-GUIDANCE-V05-BOUNDED-LOWER-TIER-TEMPLATES-2026-03-15-0130.md`

## Main weaknesses identified

### 1. `top_reason` selection can still be optimized for optics
The guidance says the summary sentence must include `<top_reason>` from structured artifact reasons. That is good, but the system can still cheat if it selects the gentlest reason instead of the most decision-relevant one.

**Why this is dangerous:**
- the verdict sentence can stay formally compliant while still minimizing the real caveat,
- and a harsh artifact can be made to sound almost acceptable by foregrounding a softer reason.

**Required mitigation:**
- define explicit reason-priority ordering for each lower tier,
- prefer the most claim-limiting reason, not the most cosmetically pleasant one.

---

### 2. Strict verdict sentences can be undermined by adjacent prose
Even if the verdict sentence is bounded, a follow-up sentence can immediately reintroduce heat:
- “still a very interesting run,”
- “promising despite the caveat,”
- “good evidence overall.”

**Why this is dangerous:**
- the artifact may technically obey the template while functionally reintroducing overclaim,
- readers may remember the nearby spin more than the bounded sentence itself.

**Required mitigation:**
- make the immediate summary block non-promotional for lower tiers,
- not just the first sentence.

---

### 3. `exploratory evidence only` still carries soft prestige
This phrase is much better than "strong" or "compelling," but it still risks sounding a bit approving if the adjacent caveat is weak or generic.

**Why this is dangerous:**
- lower tiers may still feel like near-success badges,
- especially if the chosen caveat is mild.

**Required mitigation:**
- keep the caveat specific and claim-limiting,
- and ensure lower-tier language remains procedural rather than aspirational.

---

### 4. Human-readable reason normalization can soften the true issue
Structured reasons are machine-friendly, but they still need human-readable rendering. That translation layer can unintentionally sand off sharp edges.

**Why this is dangerous:**
- `hard-invalid:severe-transcript-quality-failure` could become something mushy like “quality concern,”
- which weakens the whole point of explicit reason-derived boundaries.

**Required mitigation:**
- normalize reasons into readable language without diluting severity,
- and keep the raw reason available in the artifact for auditability.

---

### 5. Quoted fragments can still detach from caveats
Even with a same-sentence caveat, users or future posts may quote only the front half of a verdict.

**Why this is dangerous:**
- the shorter and more flattering the lead phrase, the easier it is to quote out of context,
- especially for `exploratory-high-value`.

**Required mitigation:**
- keep the leading clause itself cool and non-celebratory,
- so even partial quoting does not create fake prestige.

## Strongest critique summary
The bounded lower-tier template approach is correct, but it will fail if:
1. reason priority is not fixed,
2. surrounding prose can still add hype,
3. lower-tier lead phrases still sound too flattering,
4. reason normalization softens severity,
5. or quoted fragments can detach from the caveat too easily.

## Best next fixes called out
1. add explicit reason-priority ordering,
2. make the immediate summary block non-promotional for lower tiers,
3. keep lower-tier leading clauses cool and procedural,
4. preserve both readable and raw reasons,
5. ensure the first clause is safe even when quoted alone.

## What this critique does **not** say
- It does **not** argue against bounded templates.
- It does **not** say the system should go back to freeform wording.
- It says the bounded templates need stricter reason selection and anti-spin rules to actually constrain claims.

## On-chain classification
- No new tx justified for this challenge lane.
- This lane tightens the final language boundary before the next artifact-path patch; it does not itself create a new gameplay artifact.
