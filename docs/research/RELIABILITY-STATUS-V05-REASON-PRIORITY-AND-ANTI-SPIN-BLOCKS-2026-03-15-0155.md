# Reliability Status — v05 reason priority + anti-spin summary blocks (2026-03-15 01:55 UTC)

## Trigger
Lane D synthesis after:
- `670cf5f` — `feat(v05): prioritize claim-limiting verdict reasons`
- `889aa8e` — `docs(research): verify claim-limiting reason priority`

## What is now evidence-backed
1. **Claim-limiting reason selection is no longer arbitrary.**
   - Per-battle artifacts now expose deterministic top reason fields:
     - `topProperBattleReason`
     - `topHardInvalidTrigger`
     - `topClaimLimitingReason`
     - `topClaimLimitingReasonSource`
   - Render verification proved the selected top reason appears directly in the markdown classification block.

2. **The system now prefers harsher claim-limiting reasons in tested conflicts.**
   - In the verification case, source-of-move ambiguity correctly outranked interruption/gameplay caveats.
   - That materially reduces the “pick the nicest caveat” failure mode.

3. **The next remaining leak is narrative framing around the verdict, not reason selection itself.**
   - The artifact can now tell us which caveat should lead.
   - What it still cannot prevent is nearby prose that cosmetically warms up a downgraded verdict.

## Strongest honest status right now
> The artifact path now deterministically selects and exposes the most claim-limiting reason in tested cases, but the immediate summary block is still unconstrained enough to leak optimism unless anti-spin rules land next.

## External-signal check
Search results were generic rubric-design material rather than battle-specific guidance, but the repeated useful theme was:
- adjacent categories need clear separation,
- criteria should be explicit,
- and evaluation language should make distinctions obvious rather than fuzzy.

That weakly supports the current internal conclusion:
- the next patch should distinguish lower-tier summary blocks sharply enough that they cannot sound like near-success.

## Narrowest anti-spin summary-block rules that should land next
1. **Immediate summary block must stay non-promotional below `proper-battle`**
   - not just the first sentence.
   - no positive adjectives like “strong,” “promising,” “compelling,” “impressive.”

2. **First clause must be quote-safe**
   - if quoted alone, it must still sound clearly non-credit and non-celebratory.

3. **One selected caveat/trigger must remain adjacent to the verdict sentence**
   - sourced from `topClaimLimitingReason` or `topHardInvalidTrigger`.

4. **No follow-up sentence in the immediate summary block may soften the verdict**
   - no “despite this,” “still useful overall,” “encouraging result,” etc.
   - richer interpretation can exist elsewhere, but not in the immediate verdict block.

## Why this is the right next threshold
- The harder problem of reason selection is now partially solved.
- The remaining problem is rhetorical leakage.
- That means the next patch should focus on constraining the local summary block instead of expanding the tier system further.

## Recommended next slice
Implement anti-spin summary-block rules for lower tiers using the already-selected top claim-limiting reason as the required adjacent caveat.

## On-chain classification
- No new tx justified for this synthesis lane.
- The value here is tightening the last major wording leak before live battle-credit language resumes.
