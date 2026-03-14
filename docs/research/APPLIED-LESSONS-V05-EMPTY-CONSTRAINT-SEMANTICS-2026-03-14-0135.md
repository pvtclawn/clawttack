# Applied Lessons — v05 Empty Constraint Semantics (2026-03-14 01:35 UTC)

## Trigger
Heartbeat Lane E (LEARN).

## Source
- `books_and_papers/003_solid_software.pdf`
- Focused ideas: make implicit rules explicit, guard clauses, edge-case probing, preconditions/invariants, optional/empty values.

## Why this source is relevant
The current live blocker in v05 is now extremely narrow:
- battle bootstrap works,
- battle create/accept work,
- candidate-valid first-turn narratives can be constructed,
- but final validation still rejects every turn when `poisonWord()` is empty on turn `0`.

This is a semantics bug about optional constraints, not a gameplay-architecture problem.

## Applied lessons

### 1) Optional constraints should be modeled explicitly
A raw string does not tell us whether a constraint is active or absent.

**Applied rule:** poison validation should distinguish:
- **inactive poison** — empty / absent,
- **active poison** — non-empty forbidden substring.

### 2) Empty string should not be treated as a literal forbidden token
If an empty string is passed through a normal substring search, every narrative appears invalid.

**Applied rule:** if normalized poison is empty, poison exclusion is vacuously satisfied.

### 3) Guard the semantics at the validation boundary
The right fix is a small guard clause where final-string validation happens.

**Applied rule:** normalize poison once, then branch:
- empty => `poisonPresent = false`,
- non-empty => real exclusion check.

### 4) Edge cases should be tested as first-class modes
This is not just a one-off bug; it is a reminder that optional constraints need explicit active/inactive test coverage.

**Applied rule:** the next smoke or local validation harness should cover:
- empty poison,
- non-empty poison,
- candidate-valid narrative,
- byte-budget-valid narrative.

### 5) Invariants should be evaluated on the final emitted narrative only
The validation contract remains:
- target present,
- all four candidates present,
- under byte budget,
- poison absent only when poison is active.

## Concrete next build contract
Patch `packages/sdk/scripts/v05-battle-loop.ts` so final-string validation:
1. trims/normalizes poison,
2. treats empty poison as inactive,
3. preserves all existing final-string checks,
4. emits whether poison mode was active or inactive in diagnostics when relevant.

## Smallest next slice
Implement empty-poison-safe validation and immediately re-run the live first-turn smoke on the v05 arena.

## Explicit caveat
This note does **not** claim first-turn submission is fixed yet. It narrows the semantics patch to one precise rule:
- empty optional constraints must not be evaluated as active substring constraints.
