# CI PR Hygiene Predicate Report Schema (v0)

## Purpose
Machine-readable output for `ci/pr-hygiene` checks with tiered rule failures.

## Rule Tiers
- `critical`: hard merge blockers
- `core`: required compliance rules
- `diagnostic`: non-blocking, informational

## JSON Shape
```json
{
  "schemaVersion": "v0",
  "checkName": "ci/pr-hygiene",
  "status": "pass|fail|warn",
  "prHeadStatus": "pass|fail|warn",
  "mergeCandidateStatus": "pass|fail|warn",
  "mergeBaseSha": "<sha>",
  "headSha": "<sha>",
  "mergeCandidateSha": "<sha>",
  "runtimeContext": {
    "isShallowCheckout": false,
    "toolVersion": "<version>",
    "parserFingerprint": "<hash>",
    "generatedAt": "<iso8601>"
  },
  "coverageScope": ["metadata", "interface-delta", "generated-artifacts"],
  "knownBlindSpots": ["semantic-event-meaning-shifts"],
  "rules": [
    {
      "id": "R001",
      "name": "split-series metadata present",
      "tier": "core",
      "pass": true,
      "message": "...",
      "evidencePaths": [".github/PULL_REQUEST_TEMPLATE.md"]
    }
  ],
  "groupedFailures": {
    "critical": ["R010"],
    "core": ["R003", "R004"],
    "diagnostic": []
  },
  "waiver": {
    "used": false,
    "reason": null,
    "approvers": [],
    "followupIssue": null
  }
}
```

## Runtime Source-Pinning Requirements
1. `mergeBaseSha`, `headSha`, and `mergeCandidateSha` are mandatory.
2. Dual-state predicate evaluation is mandatory (`prHeadStatus` + `mergeCandidateStatus`).
3. `runtimeContext.isShallowCheckout` must be `false` for compliant runs.
4. `runtimeContext.toolVersion` and `runtimeContext.parserFingerprint` are mandatory for reproducibility.
5. Missing runtime/source fields => check is invalid and must fail.

## Deterministic Status Rules
1. If any required runtime/source field is missing or invalid -> `status=fail`
2. If `mergeCandidateStatus` != `prHeadStatus` -> `status=fail` (state mismatch guard)
3. Else if any `critical` rule fails -> `status=fail`
4. Else if any `core` rule fails -> `status=fail`
5. Else if only diagnostic fails -> `status=warn`
6. Else -> `status=pass`

## Example Failure Summary
- critical: `[R010 missing required check on merge path]`
- core: `[R003 interface delta undeclared, R004 generated artifact not allowlisted]`
- diagnostic: `[]`

## Acceptance Checklist
- [ ] Source pinning fields (`mergeBaseSha`, `headSha`, `mergeCandidateSha`) are populated
- [ ] Dual-state outputs (`prHeadStatus`, `mergeCandidateStatus`) are populated
- [ ] runtimeContext includes non-shallow checkout + version/fingerprint metadata
- [ ] All rules have tier + pass + evidencePaths
- [ ] groupedFailures matches rules where `pass=false`
- [ ] coverageScope and knownBlindSpots are populated
- [ ] status follows deterministic status rules
