# Synthesis Submission — Claim Audit Checklist

Use before publishing any short/long submission draft.

## 1) Claim tagging
- [ ] Every substantive claim is marked as `MEASURED` or `EXTERNAL`.
- [ ] No untagged performance/security/usability claims remain.

## 2) Proof linkage (for `MEASURED` claims)
- [ ] Each measured claim links to at least one verifiable proof:
  - commit hash and/or
  - artifact path and/or
  - tx hash.
- [ ] Linked proofs are current (not stale vs latest branch state).

## 3) External claim discipline
- [ ] External claims use qualified language (`reported`, `suggests`, `hypothesis`).
- [ ] No hard numeric improvement claims are copied from external sources.

## 4) Caveat preservation
- [ ] Evidence-quality status is included in summary (`success|degraded_success|insufficient_evidence`).
- [ ] Caveat count/notes are present where applicable.
- [ ] No positive headline when caveat policy would block it.

## 5) Minimum metric bundle present
- [ ] Reliability metrics included.
- [ ] Efficiency metrics included.
- [ ] Comparability verdict included (`comparable` or `non_comparable`) with reason codes.

## 6) Short-form quality gates (when short version is included)
- [ ] Short block includes at least one direct proof pointer (commit/artifact/tx).
- [ ] Short block includes explicit status token (`success|degraded_success|insufficient_evidence|non_comparable`).
- [ ] Short mechanism lines contain no future-tense roadmap wording (`will`, `plan`, `soon`).

## 7) Long-form mixed-certainty tagging gates (when long version is included)
- [ ] Mixed-certainty sections use inline `MEASURED|EXTERNAL` tags on claim-bearing lines.
- [ ] Untagged-claim scan completed (no untagged substantive claim-bearing lines remain).
- [ ] Every critical proof block includes `Caveat: none` or a caveat ID.

## 8) Final sign-off
- [ ] Re-ran pre-submit command bundle and reviewed output.
- [ ] Draft passes all checklist items.
