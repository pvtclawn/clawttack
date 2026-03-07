# PR Hygiene Policy (Mechanism-Critical Changes)

## Purpose
Keep security/mechanism PRs auditable, reproducible, and low-noise.

## Rules
1. **Interface Delta Declaration (required)**
   - PR must declare ABI/event/signature/script interface changes.
2. **Generated Artifact Control**
   - Generated files are allowed only when justified and tied to change scope.
3. **Split-Series Metadata (required when split-series=true)**
   - Must include `parentIssue` and `dependsOn` ordering.
4. **Noise Gate**
   - Unrelated lockfiles/reports/build artifacts should be excluded from mechanism PRs.

## Split-Series Metadata Schema
```yaml
splitSeries: true|false
parentIssue: <url-or-id>
dependsOn:
  - <pr-or-commit>
  - <pr-or-commit>
```

## Generated Artifact Allowlist (initial)
- ABI snapshots (when interface changed)
- deployment artifacts required for reproducibility
- lockfile updates tied to dependency/security fixes

## Required-Check Matrix (Branch Protection)
| Merge path | Required checks |
|---|---|
| PR → main/develop (all changes) | `ci/test`, `ci/typecheck`, `ci/pr-hygiene` |
| PR with interface delta | all above + `ci/interface-delta-report` |
| PR with split-series=true | all above + `ci/split-series-metadata` |
| Emergency override merge | all above unless explicitly waived in override record; `postmortem` + `followup-issue` required within 24h |

## Merge Preconditions
- Interface delta declared and consistent with diff
- If split-series=true: parentIssue + dependsOn present
- Generated artifacts either allowlisted or removed
- Tests/typecheck pass
- Required-check matrix coverage satisfied for selected merge path

## Merge-Path Coverage Notes
- No direct pushes to protected branches for mechanism-critical changes.
- Any path that bypasses `ci/pr-hygiene` is considered non-compliant.
- Override path is for time-critical incidents only and is auditable.
