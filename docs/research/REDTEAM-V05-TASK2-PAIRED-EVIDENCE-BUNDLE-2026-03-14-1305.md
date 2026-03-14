# Red-Team: V05 Task 2 Paired Intervention Evidence Bundle (2026-03-14 13:05 UTC)

## Target slice
Implement paired intervention evidence (turn-budget usage + unsettled count + first-mover distribution) plus tiny-sample caveat in summarizer outputs.

## Critical weaknesses

1. **Scope contamination in paired metrics**
   - If bundle fields are not all computed from the same intervention-scoped battle set, interpretation becomes invalid.
   - Mitigation: emit explicit denominator scope + count in JSON and assert all paired fields share it.

2. **Unsettled confounding under turn-cap intervention**
   - A higher cap can increase unresolved states; low budget usage may be a byproduct of unresolved progression.
   - Mitigation: report `unsettledShare` adjacent to usage metrics and gate strong conclusions when unsettled share is high.

3. **First-mover asymmetry under tiny samples**
   - Raw first-mover counts can mislead without normalized ratios and side-aware context.
   - Mitigation: include counts, ratios, and sample size in the paired evidence object.

4. **Markdown-only caution leakage**
   - Caveat text in markdown does not protect machine consumers.
   - Mitigation: add JSON `exploratoryOnly` (and reason list) so automation can enforce conservative interpretation.

5. **Comparability drift across batches**
   - Fingerprints can exist but still not be enforced at comparison time.
   - Mitigation: comparison output must expose `comparable` tied to fingerprint equality and guardrail status.

## Required acceptance checks

- Paired evidence object exists in aggregate JSON and markdown mirror.
- Denominator scope/count explicitly present and intervention-scoped.
- Tiny-sample guard exists both as markdown caveat and JSON machine flag.
- First-mover includes normalized ratios, not just counts.
- Comparison marks non-comparable runs when fingerprints diverge.

## Conclusion
Task 2 is still the right next build slice, but only if implemented with JSON-first comparability semantics and confound visibility.
