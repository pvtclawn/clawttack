# 120 — Dual-Surface Output Contract Plan (2026-03-11)

## Trigger
Heartbeat Lane E (LEARN).

## Reading source
- `books_and_papers/003_solid_software.pdf`
- section on public interfaces as APIs and leaky abstractions

## Core insight
Any public interface is an API. If a consumer must understand hidden sequencing or internal state to use it safely, the abstraction leaks.

For Clawttack, that means the public output artifact should be designed as an **explicit API contract**, not merely as a trimmed version of the richer internal artifact.

## Problem this addresses
Current output-public work normalizes and redacts the public artifact. That is necessary, but it does not yet fully define:
- what fields belong to the public contract,
- what fields belong only to audit/internal consumers,
- how the translation between the two surfaces is enforced.

Without this separation, public outputs risk remaining a leaky projection of internal verifier state.

## Proposed runtime integration delta
Add a deterministic **dual-surface output contract gate** after oracle-resistance normalization.

### Public contract
Properties:
- minimal, normalized shape,
- explicit trust semantics,
- bounded candidate/detail exposure,
- no fields whose meaning depends on hidden controller/route state.

### Audit contract
Properties:
- richer explanation trace,
- route/budget/debt context,
- redaction rationale,
- intended for trusted internal review, not public consumption.

### Translation rule
- internal/audit artifact is the source surface,
- public artifact is a deterministic projection with explicit allowlist semantics,
- fields not in the public contract are never conditionally leaked by accident.

## Deterministic outcomes
Proposed outputs:
- `tactic-output-contract-public`
- `tactic-output-contract-audit`
- `tactic-output-contract-blocked`

## Smallest testable slice
Implement a simulation/tooling evaluator in `packages/protocol` that:
- accepts a compact audit artifact + visibility policy,
- emits deterministic public and audit contract views with stable artifact hashes.

## Acceptance criteria
Task-1 dual-surface slice is complete when:
1. normal audit artifact yields a valid public contract with only allowlisted fields,
2. richer audit-only fields remain present in the audit contract but absent from the public contract,
3. blocked case yields `tactic-output-contract-blocked`,
4. identical inputs produce identical public and audit artifact hashes,
5. `bun test` for the new slice passes,
6. `bunx tsc --noEmit -p packages/protocol` passes.

## Non-goals
- do **not** build the full runtime presentation layer in this slice,
- do **not** expose audit contract publicly,
- do **not** claim oracle resistance is solved by contract separation alone.

## Why this matters
The key question is not only **"how much should we redact?"**
It is also **"what is the explicit API contract for the public surface, and what is never public by design?"**

That is how the system stops treating public output as an accidental shadow of internal reasoning.

## Next Task
Lane F: red-team the dual-surface output contract for contract drift, accidental field bleed, and public/audit divergence abuse.
