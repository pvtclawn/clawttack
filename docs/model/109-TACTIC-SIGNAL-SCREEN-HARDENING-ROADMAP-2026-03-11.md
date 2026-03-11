# 109 — Tactic Signal→Screen Hardening Roadmap (2026-03-11)

## Trigger
Heartbeat Lane A (PLAN).

## Inputs
- Base plan: `docs/model/108-TACTIC-EVIDENCE-SIGNAL-SCREEN-INTEGRATION-PLAN-2026-03-11.md`
- Red-team report: `docs/research/TACTIC-SIGNAL-SCREEN-INTEGRATION-REDTEAM-2026-03-11.md`

## Goal
Turn the signal→screen direction into a mergeable sequence of deterministic hardening slices that prevent cheap evidence theater from becoming the new classification loophole.

## Failure classes to target
1. **Evidence theater** — decorative markers steer the screen without reflecting real attack objective/effect.
2. **Ambiguity amnesty** — mixed/proof-missing outcomes become a repeatable shield against downstream scrutiny.
3. **Derivation drift** — supposedly deterministic screen verdicts change across parser/extractor/runtime versions.

## Constrained tasks

### Task 1 — Feature provenance + objective/effect witness gate
**Why first:** if screen features are weak or purely lexical, every later ambiguity/debt policy is built on manipulated residue.

**Scope**
- deterministic evaluator in `packages/protocol`
- input: pre-derived screen bundle with provenance-weighted features + objective/effect witness fields
- output reasons:
  - `tactic-screen-pass`
  - `tactic-screen-feature-theater-risk`
  - `tactic-screen-objective-effect-missing`
- artifact hash must be stable for identical evidence tuples

**Acceptance criteria**
1. decorative-marker laundering fixture fails with `tactic-screen-feature-theater-risk`
2. missing objective/effect witness fixture fails with `tactic-screen-objective-effect-missing`
3. aligned signal + strong screen bundle fixture passes with `tactic-screen-pass`
4. identical inputs produce identical artifact hash
5. `bun test` for the slice passes
6. `bunx tsc --noEmit -p packages/protocol` passes

### Task 2 — Ambiguity/sparsity debt guard
**Why second:** uncertainty should remain informative, not become an infinite loophole for repeated weak evidence.

**Scope**
- rolling actor-level debt logic for repeated `mixed-signal` / `proof-missing` outcomes
- proposed reasons:
  - `tactic-screen-uncertainty-acceptable`
  - `tactic-screen-ambiguity-debt`
  - `tactic-screen-sparsity-abuse`

**Acceptance criteria**
1. isolated mixed-signal case remains `tactic-screen-uncertainty-acceptable`
2. repeated mixed-signal fixtures escalate to `tactic-screen-ambiguity-debt`
3. repeated proof-missing fixtures escalate to `tactic-screen-sparsity-abuse`
4. identical windows produce identical artifact hash
5. `bun test` for the slice passes
6. `bunx tsc --noEmit -p packages/protocol` passes

### Task 3 — Derivation-version compatibility guard
**Why third:** deterministic verdicts are only trustworthy if derivation context is version-bound and unsafe comparisons fail closed.

**Scope**
- bind screen bundles to parser/extractor/runtime version digest
- proposed reasons:
  - `tactic-screen-version-compatible`
  - `tactic-screen-version-mismatch`
  - `tactic-screen-version-metadata-missing`

**Acceptance criteria**
1. incompatible derivation-version fixture fails with `tactic-screen-version-mismatch`
2. missing derivation metadata fixture fails with `tactic-screen-version-metadata-missing`
3. same-version repeated derivations preserve deterministic verdict/hash behavior
4. `bun test` for the slice passes
5. `bunx tsc --noEmit -p packages/protocol` passes

## Smallest mergeable milestone today
Implement **Task 1 only** in `packages/protocol` as a simulation/tooling slice. No runtime wiring, no scoring changes, no parser integration in the same PR.

## Narrative-quality target
This roadmap succeeds only if it makes the screen resistant to decorative evidence laundering without pretending that ambiguity has been eliminated.

## Next Task
Lane B: implement Task 1 in `packages/protocol` (feature provenance + objective/effect witness gate + fixtures), no runtime wiring in the same slice.
