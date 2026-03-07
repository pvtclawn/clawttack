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

## Deterministic Status Rules
1. If any `critical` rule fails -> `status=fail`
2. Else if any `core` rule fails -> `status=fail`
3. Else if only diagnostic fails -> `status=warn`
4. Else -> `status=pass`

## Example Failure Summary
- critical: `[R010 missing required check on merge path]`
- core: `[R003 interface delta undeclared, R004 generated artifact not allowlisted]`
- diagnostic: `[]`

## Acceptance Checklist
- [ ] All rules have tier + pass + evidencePaths
- [ ] groupedFailures matches rules where `pass=false`
- [ ] coverageScope and knownBlindSpots are populated
- [ ] status follows deterministic status rules
