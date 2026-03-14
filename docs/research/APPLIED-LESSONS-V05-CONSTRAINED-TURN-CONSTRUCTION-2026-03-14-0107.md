# Applied Lessons — v05 Constrained Turn Construction (2026-03-14 01:07 UTC)

## Trigger
Heartbeat Lane E (LEARN).

## Source
- `books_and_papers/007_building_agentic_ai.pdf`
- Focused areas: focused prompts, state validation, constraint satisfaction, resource-aware task handling, self-explanation for learning.

## Why this source is relevant
The current live blocker in v05 is a narrow but real one:
- battle bootstrap works,
- battle create/accept works,
- first-turn submission fails because the loop declares NCC candidate words that are not always embedded in the generated narrative.

This is better understood as a **constrained construction** problem than as an open-ended text generation problem.

## Applied lessons

### 1) State validation should be embedded in the construction path
Validation after generation is too late for a high-frequency overnight runner.

**Applied rule:** narrative assembly should be coupled to candidate selection so the generator cannot "forget" required words.

### 2) This should be modeled as constraint satisfaction first
The hard constraints are explicit:
- include target word,
- include all four NCC candidate words,
- exclude poison word,
- fit byte budget,
- remain interpretable enough for gameplay.

**Applied rule:** solve the hard constraints deterministically first, then add optional style if there is still room.

### 3) Focused, narrow construction is better than broad generation here
A simple valid turn is more valuable than a richer but invalid one.

**Applied rule:** for the unblock slice, replace or wrap the current narrative generator with a rigid template/composition function that guarantees embedding.

### 4) Resource-aware control flow says "cheap validity first"
The overnight battle runner should spend minimal effort on routine turn formatting compared with on-chain tx latency and battle progression.

**Applied rule:** choose a deterministic low-cost string constructor before any fancy variation logic.

### 5) Self-explanation should be used inwardly for failed turn assembly
The runner should leave structured breadcrumbs when construction fails.

**Applied rule:** emit structured turn-construction diagnostics:
- target word,
- candidate words,
- offsets found/missing,
- poison check result,
- byte length,
- final narrative string.

## Concrete next build contract
Patch `packages/sdk/scripts/v05-battle-loop.ts` to:
1. assemble the narrative from the chosen candidate words directly,
2. validate all hard constraints before payload assembly,
3. regenerate candidates or fall back to a simpler deterministic template instead of throwing,
4. emit structured failure diagnostics if all attempts fail.

## Smallest next slice
Implement deterministic candidate→narrative coupling in `v05-battle-loop.ts` so first-turn submission can proceed on the new v05 arena.

## Explicit caveat
This note does **not** claim that the resulting narrative quality will already be ideal. It narrows the next objective:
- unblock mechanically valid first-turn submission,
- resume smoke-ladder progression,
- iterate on richer gameplay style after hard constraint correctness is restored.
