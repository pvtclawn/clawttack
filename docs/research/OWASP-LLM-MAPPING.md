# OWASP LLM Top10 Mapping Checklist (Clawttack)

- checklistVersion: `v1.0.0`
- lastReviewedAt: `2026-03-07`
- reviewIntervalDays: `30`

## Usage
For mechanism/security-affecting PRs, complete all mandatory items.

Rule: each mandatory item must include at least one concrete evidence link.

## Mandatory Core Items
(Required in every mechanism/security-affecting PR; each item needs evidence links.)

### 1) Prompt Injection Resistance
- Clawttack control mapping:
  - Mechanism-level constraints (NCC/Cloze/turn validity) over model intent.
- Evidence links:
  - [ ]
- Status: `pass|fail|partial`

### 2) Insecure Output Handling
- Clawttack control mapping:
  - Output validation before settlement/policy transitions.
- Evidence links:
  - [ ]
- Status: `pass|fail|partial`

### 3) Training/Data Poisoning Exposure
- Clawttack control mapping:
  - Tiered evidence ingestion; external signals treated as untrusted by default.
- Evidence links:
  - [ ]
- Status: `pass|fail|partial`

### 4) Model DoS / Resource Abuse
- Clawttack control mapping:
  - Bounded retries, timeout handling, liveness/safety gate checks.
- Evidence links:
  - [ ]
- Status: `pass|fail|partial`

### 5) Supply Chain / Dependency Integrity
- Clawttack control mapping:
  - PR hygiene policy, generated-artifact control, interface delta declaration.
- Evidence links:
  - [ ]
- Status: `pass|fail|partial`

### 6) Sensitive Information Disclosure
- Clawttack control mapping:
  - No secret output paths; explicit secret-handling constraints.
- Evidence links:
  - [ ]
- Status: `pass|fail|partial`

### 7) Tool/Plugin Misuse
- Clawttack control mapping:
  - Strict tool boundary preconditions and allowlisted side effects.
- Evidence links:
  - [ ]
- Status: `pass|fail|partial`

### 8) Excessive Agency
- Clawttack control mapping:
  - Hard-stop decisionTrace + worst-case guardrails before aggregate pass.
- Evidence links:
  - [ ]
- Status: `pass|fail|partial`

### 9) Overreliance on LLM Correctness
- Clawttack control mapping:
  - Mechanism-first verifiable artifacts over model assertions.
- Evidence links:
  - [ ]
- Status: `pass|fail|partial`

### 10) Inadequate Monitoring/Logging
- Clawttack control mapping:
  - Deterministic metrics artifacts + decision trace + uncertainty/debt tracking.
- Evidence links:
  - [ ]
- Status: `pass|fail|partial`

## Validation Rules
- If any mandatory item has no evidence link => checklist is non-compliant.
- If checklist age > reviewIntervalDays => mark stale and require review update before approval.

## Reviewer Summary
- Overall: `pass|fail|conditional`
- Blocking findings:
  1.
- Notes:

## Optional Deep-Dive Section
(Use when PR touches high-risk surfaces or reviewer requests expanded analysis.)
- Attack replay notes:
- Edge-case adversarial prompts tried:
- Additional evidence artifacts:
