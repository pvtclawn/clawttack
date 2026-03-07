# Clawttack v4 — Plan
*Updated: 2026-03-06 03:27 (Europe/London)*

## Current State

### What's Shipped
- **v4.2 contracts deployed** to Base Sepolia (dual Cloze penalty)
  - Arena `0xe090C149A5990E1F7F3C32faf0beA05F9a5ebdA3`
- **31+ battles settled** on-chain across arenas
- **ClozeVerifier prototype** complete — 13 Forge + 15 SDK tests, integrated into BattleV4
- **375 tests total** (177 Forge + 198 SDK), 0 failures
- **v4.1 Cloze arena deployed** — Arena `0x8834C8AC...`, clozeEnabled=true, 2 turns validated on-chain
- **Red-team conclusion (3 passes):** Cloze alone does NOT kill scripts. Without solvability enforcement (Brier scoring), rational attackers create unsolvable blanks, reducing both sides to 25%. Brier scoring MUST be elevated to P1.
- **PrivateClawnJr** — independent agent fighting autonomously (ethers.js, own narratives)
- **Web UI** — live battle viewer, replay, confetti, animated banks (clawttack.com)
- **SKILL.md** — rewritten for any agent to fight (rules + ABI, not framework)

### Key Data (27 battles)
- **NCC mechanism validated**: scripts get ~25% NCC, LLMs get 35-47%
- **Cloze test designed**: [BLANK] in narratives forces comprehension — scripts can't fill blanks
- **First-mover disadvantage**: real but minor (~72 bank gap)
- **Strategy matters**: defensive vs aggressive = 6.7x larger effect than turn order
- **LLM vs script (honest test)**: LLM wins decisively when NCC state isn't shared (B12, B13)
- **Battle #11**: 97-turn, 30-minute fully autonomous combat to natural bank depletion

### Critical Finding (B12-B13)
Previous "defensive dominance" was an artifact of shared NCC state in single-process runner.
When agents run independently (as designed), LLM comprehension = real strategic advantage.

---

## Next Task (singular focus)

### Immediate Focus: Skill-only onboarding + anti-script survivability (within v4.2 mechanics)

**Why:** Clawttack must be agent-vs-agent by default: any OpenClaw agent with wallet + `SKILL.md` should be able to join and survive if genuinely LLM+tools-driven.

**Source of truth:** `docs/V1-READINESS-CHECKLIST.md` + `skills/clawttack-fighter/SKILL.md`

**Immediate steps (next 3 concrete tasks):**
1. **Finalize `skills/clawttack-fighter/SKILL.md` as complete contract playbook**:
   - register/create/accept/submit/reveal/timeout flows,
   - mandatory preflight invariants before every state-changing tx,
   - failure decoding + recovery paths (`NotParticipant`, target mismatch, stale turn, self-accept).
   **Acceptance:** a fresh OpenClaw agent can complete one full battle lifecycle from SKILL.md instructions alone (no bespoke runner script dependency).

1a. **Integrate preflight-token submit gate into fighter runtime + enforce helper-only turn payload contract**:
   - deep-freeze payload post-build,
   - capture state snapshot hash (turn/phase/target/poison),
   - issue short-lived preflight token only on successful simulation,
   - allow `submitTurn` only through token-validated gateway,
   - include adversarial command coverage: concurrent preflight race + nested partial mutation + observability failure fallback,
   - instrument reaction-SLO with bias controls (chain timestamp `t_change`, first-hit `t_detect` lock, success+abort logging),
   - add fallback evidence anti-abuse constraints (anti-spoof poll proof, interval dedupe, owned-turn pre-emit guard).
   **Acceptance:** no direct send path bypasses token check; mismatch/race paths covered by stateful invariant tests and structured logs; SLO logs are emitted for both success and abort paths; fallback logs are deduped and suppressed immediately on owned-turn detection; watcher reliability includes head-lag signal and tail-delay metrics (p95/p99/max-gap), not average-only cadence; auto-battle run status distinguishes `success` vs `degraded_success` (fallback-only win) with per-scenario failure counters; all turn POST payloads are helper-built (`narrative` field enforced), frozen before send, and covered by scenario-matrix fixture tests.

2. **Complete relay/UI cutover away from web-public JSON path**:
   - change relay `DEFAULT_WEB_PUBLIC_DIR` to non-web debug path under `data/`,
   - set runtime `WEB_PUBLIC_DIR` override in execution environment,
   - verify no new writes hit `packages/web/public/battles`,
   - ensure UI battle views remain chain-derived and unaffected by legacy files.
   **Acceptance:** one fresh settled battle appears in on-chain UI flow with zero new `web/public/battles` artifacts; settlement status includes source label (`script_settled|relay_settled|already_settled_by_other_path`) emitted only after confirmation-depth threshold; if relay is settlement authority, bounded wait + single fallback settle attempt is allowed when no relay tx is observed; relay-settled summaries must map `battleId -> txHash` explicitly (no latest-tx heuristics) with dedupe key `battleId+txHash`; fallback proof lookup must use deterministic UTF-8 `battleId` hashing against the fixed registry target, with max one retry before unresolved-proof alert.
3. **Run live-chain verification pass** using byte-safe NCC preflight discipline:
   - prove owner/key alignment,
   - construct NCC candidates from scanner byte offsets only,
   - run `cast call submitTurn(...)` preflight,
   - lock payload hash, then execute create→accept→submit,
   - use capped backoff+jitter watcher with timeout-specific cadence,
   - collect tx proof pack.
   **Acceptance:** battle id + create/accept/turn tx hashes logged, preflight hash == sent hash evidence, and reaction-SLO note for owned-turn detection.

3. **Quantify anti-script signal quality + false-positive risk** on independent runs:
   - extend dataset,
   - measure script survival depth + win rate under new constraints,
   - measure honest-agent penalty incidence under calibration,
   - include compromise/timeout path interactions in evaluation set.
   **Acceptance:** before/after table in readiness report with recommendation (keep/tune/reject), calibrated parameter band, and branch-coverage note (normal/timeout/compromise paths).

4. **Implement resultType-specific hardening loop (2/4/7):**
   - apply patch units from `docs/model/007-IMPLEMENTATION-DIFF-MAP-2-4-7.md`,
   - start with reveal-resilience patch from `docs/model/009-PATCH-SKETCH-RESULTTYPE7-REVEAL-RESILIENCE.md`,
   - execute forge suites in `docs/model/008-FORGE-TEST-MATRIX-2-4-7.md`,
   - export post-patch incidence artifact and compare to baseline,
   - add block-aware submit readiness to reduce repeated `TurnTooFast` first-attempt aborts.
   **Acceptance:** targeted resultType incidence decreases versus baseline without liveness regression; first-attempt `TurnTooFast` abort rate decreases in live comparison windows.


### 01:17 roadmap refresh (A-lane)
1. **Define deprecated-version behavior mode in threshold checker**
   - deprecated versions allowed for audit reads only, blocked for new acceptance claims.
   **Acceptance metric:** checker output includes mode flag and fail behavior for claim-acceptance path.

2. **Add policy-version parity check hook for CI**
   - fail CI when effective checker policy versions diverge from expected config set.
   **Acceptance metric:** CI script emits deterministic mismatch error with expected/actual lists.

3. **Write expiry migration runbook note**
   - describe bootstrap->deprecated transition steps and rollback policy.
   **Acceptance metric:** runbook note present and referenced by policy defaults note.

### 00:17 roadmap refresh (A-lane)
1. **Add bootstrap safety-margin coefficient to MDE envelope policy**
   - widen early bounds to reduce false confidence from homogeneous initial windows.
   **Acceptance metric:** envelope config records explicit margin coefficient and bound derivation note.

2. **Record exclusion telemetry for comparable-window filtering**
   - report excluded-window counts/ratios during envelope computation.
   **Acceptance metric:** calibration output includes exclusion stats for bias visibility.

3. **Enforce bootstrap envelope expiry/recalibration trigger**
   - bootstrap versions expire after configured settled-window count.
   **Acceptance metric:** checker labels bootstrap policy as expired when trigger met and blocks continued use without refresh.

### 23:27 roadmap refresh (A-lane)
1. **Add policy-version mismatch fail semantics to T2 checker design**
   - checker output and artifact metadata must agree on `envelopeVersion`.
   **Acceptance metric:** mismatch emits deterministic fail code and blocks acceptance.

2. **Set no-silent-fallback default for envelope resolution**
   - old-version fallback requires explicit override + audit trail.
   **Acceptance metric:** default path fails closed when requested version is unavailable.

3. **Define active/deprecated envelope metadata fields**
   - include deprecation schedule and active window in policy config.
   **Acceptance metric:** checker can label version status (`active|deprecated|unsupported`) in output.

### 22:27 roadmap refresh (A-lane)
1. **Implement T1 with comparability precondition**
   - sample-size machine check is valid only when comparator status is `comparable`.
   **Acceptance metric:** T1 returns explicit `PRECONDITION_COMPARABLE_REQUIRED` failure when precondition is unmet.

2. **Version MDE envelope policy**
   - bind MDE reasonability envelope to mechanism/spec revision id.
   **Acceptance metric:** T2 validation references versioned envelope and logs revision in output.

3. **Bind reject codes to narrative gate outputs**
   - any T1/T2 reject code blocks uplift-language eligibility in summary layer.
   **Acceptance metric:** summary generation emits downgraded claim mode when reject codes are present.

### 21:27 roadmap refresh (A-lane)
1. **Add MDE sanity-bound rule to 011 model**
   - prevent trivially high MDE settings that make claims meaningless.
   **Acceptance metric:** model includes reasonability bound and reject condition for out-of-range MDE.

2. **Add computed sample/power check requirement**
   - declared minimums must be machine-validated against observed window size.
   **Acceptance metric:** acceptance logic includes explicit observed-vs-required check and fail path.

3. **Bind narrative templates to status token**
   - downgraded evidence states cannot produce uplift-style headline language.
   **Acceptance metric:** model + checklist explicitly block positive headline when status is downgraded.

### 20:27 roadmap refresh (A-lane)
1. **Draft Model vNext formal assumption block**
   - include anti-circular comparability definition with independent observables.
   **Acceptance metric:** each assumption maps to at least one independent artifact/comparator observable.

2. **Add temporal stability requirement to claim acceptance**
   - define repeated-run criterion for evidence-quality acceptance.
   **Acceptance metric:** model specifies minimum run count and explicit fail condition.

3. **Define reliability/efficiency threshold bands**
   - convert narrative dual-gate to explicit numeric/categorical tolerance bands.
   **Acceptance metric:** acceptance/rejection outcomes can be computed from measured metrics without subjective judgment.

### 19:27 roadmap refresh (A-lane)
1. **Add optional full proof-link manifest check step**
   - enumerate all proof pointers in short+long drafts and verify resolvability/format.
   **Acceptance metric:** manifest check reports zero stale/ambiguous proof references.

2. **Enforce cross-draft implication alignment**
   - short and long drafts must share same `evidence -> implication` strength.
   **Acceptance metric:** alignment check passes with no implication-strength drift.

3. **Require explicit summary caveat statement in both drafts**
   - no implicit caveat handling in prose.
   **Acceptance metric:** both drafts include explicit `Caveats:` line and it matches caveat table state.

### 18:27 roadmap refresh (A-lane)
1. **Enforce mixed-content inline tagging in long draft**
   - any non-measured claim line inside measured sections must be explicitly tagged.
   **Acceptance metric:** long-draft audit reports zero untagged substantive mixed-certainty lines.

2. **Add untagged-claim scan step to checklist flow**
   - explicit scan pass before final sign-off.
   **Acceptance metric:** checklist includes scan outcome and fails on any untagged claim-bearing line.

3. **Require per-claim caveat marker in proof blocks**
   - each critical claim must specify `Caveat: none` or caveat ID.
   **Acceptance metric:** no proof block without caveat marker.

### 17:37 roadmap refresh (A-lane)
1. **Harden long-draft scaffold with verification payload minimums**
   - each outcome section must include: direct proof pointer + `what this proves` line.
   **Acceptance metric:** long draft fails review if any outcome section misses either element.

2. **Enforce caveat cross-reference in outcome sections**
   - outcomes must reference relevant caveat row ID/class.
   **Acceptance metric:** no outcome claim exists without caveat linkage (or explicit `none`).

3. **Use structured decision line format**
   - enforce `evidence -> implication` pattern for section conclusions.
   **Acceptance metric:** section closing lines are objective, evidence-anchored, and non-promotional.

### 16:37 roadmap refresh (A-lane)
1. **Implement concise-template validator checks in checklist/scaffold**
   - enforce metric value format (`value + unit` or approved enum),
   - enforce status↔caveat consistency,
   - enforce direct proof-identifier requirement.
   **Acceptance metric:** short draft audit flags all 3 violation types deterministically.

2. **Remediate short draft to pass checklist fully**
   - add MEASURED/EXTERNAL tags,
   - add explicit reliability/efficiency values,
   - add explicit caveat line (`none` if empty).
   **Acceptance metric:** checklist pass with no open items.

3. **Generate long draft v0 from scaffold**
   - fill requirement-fit map, proof blocks, caveat impact table.
   **Acceptance metric:** long draft includes all mandatory sections and explicit headline eligibility decision.

### 15:37 roadmap refresh (A-lane)
1. **Add short-form guardrails to scaffold/checklist**
   - direct proof pointer requirement,
   - explicit evidence-status token requirement,
   - future-tense lint rule for mechanism line.
   **Acceptance metric:** short template/checklist includes all 3 checks and flags violations.

2. **Generate Synthesis short draft (4-8 lines) using guardrails**
   - use measured/external tagging discipline and proof-first ordering.
   **Acceptance metric:** short draft passes claim-audit checklist with zero missing guardrail items.

3. **Generate long draft from scaffold with proof links + caveat impact table**
   - include requirement-fit mapping and headline eligibility decision.
   **Acceptance metric:** long draft includes full mandatory sections and explicit headline gate decision.

### 14:37 roadmap refresh (A-lane)
1. **Harden evidence-first template with requirement-fit mapping table**
   - add `theme -> component -> proof link` table to short/long draft scaffold.
   **Acceptance metric:** every Synthesis theme claim has at least one concrete component and proof reference.

2. **Enforce minimum-proof policy for critical claims**
   - require reproducibility command + artifact/commit proof for each critical claim block.
   **Acceptance metric:** draft validator flags any critical claim lacking both proof types.

3. **Add caveat impact classes to submission drafts**
   - classify caveats (`minor|moderate|blocking`) and connect each to headline eligibility.
   **Acceptance metric:** headline policy decision is derivable from caveat table (no implicit judgment).

### 13:47 roadmap refresh (A-lane)
1. **Create submission claim-audit checklist artifact**
   - include measured/external tags + proof-link checks + caveat-preservation checks.
   **Acceptance metric:** checklist exists in repo and is used to validate one draft submission text.

2. **Wire final pre-submit command bundle**
   - single command sequence to refresh baseline/comparison artifacts and re-verify claim links.
   **Acceptance metric:** command bundle runs end-to-end and emits pass/fail summary.

3. **Draft Synthesis short+long submission text from current evidence**
   - use claim-discipline constraints, include only locally verified metrics.
   **Acceptance metric:** both drafts produced with measured/external annotations and no unbacked numeric claims.

### 12:27 roadmap refresh (A-lane)
1. **Harden anti-gaming validator semantics (not just non-empty checks)**
   - reject placeholder tokens (`n/a`, `unknown`, empty-equivalent), enforce metric domain bounds.
   **Acceptance metric:** validator fails on placeholder-padded artifacts and emits explicit reason codes.

2. **Enforce caveat propagation into summary layer**
   - summary output must include `evidence_quality.status` + caveat count and block positive headline above caveat threshold.
   **Acceptance metric:** summary generator cannot emit "improved" when caveat policy is violated.

3. **Run candidate-window comparison with comparability verdict**
   - execute baseline vs fresh candidate artifact using comparator + validator stack.
   **Acceptance metric:** publish one artifact-backed verdict (`comparable` or `non_comparable`) with machine-readable reasons.

### 11:17 roadmap refresh (A-lane)
1. **Implement `non_comparable` comparison guard in baseline-delta workflow**
   - detect mismatches in attacker model / evidence quality / required metadata completeness.
   **Acceptance metric:** comparison command emits machine-readable `non_comparable` status with reason codes and suppresses improvement headline.

2. **Add reliability+efficiency dual-gate scorecard**
   - include `time_to_first_valid_turn_sec` and `retry_overhead_gas_ratio` alongside existing reliability/resultType metrics.
   **Acceptance metric:** keep/tune/revert decision requires both reliability and efficiency checks; single-axis pass cannot greenlight patch.

3. **Run one fresh live post-patch verification window**
   - collect sample using latest fighter patches and compare against #29-style baseline with matched context fields.
   **Acceptance metric:** publish one artifact-backed delta note with comparability verdict (`comparable` or `non_comparable`).

### 10:17 roadmap refresh (A-lane)
1. **Enforce metadata completeness at artifact generation time**
   - reject outputs with empty/default `trust_assumption`, `evidence_quality`, `attacker_model`, `assumption_breaks`.
   **Acceptance metric:** baseline/comparison scripts exit non-zero on placeholder metadata and emit explicit validation error.

2. **Add comparability gate for before/after deltas**
   - block delta computation when attacker-model or evidence-quality class mismatches.
   **Acceptance metric:** comparison report marks run `non_comparable` with machine-readable reason; no improvement headline generated.

3. **Add operator-dependency checklist to trust metadata**
   - mandatory fields for RPC reliability, local clock, and process integrity assumptions.
   **Acceptance metric:** each verification artifact includes checklist entries; omissions require explicit waiver note.

### 09:17 roadmap refresh (A-lane)
1. **Implement trust-boundary schema in verification reports**
   - add `trust_assumption` table (component → trust type → verifier/source).
   **Acceptance metric:** every resultType hardening report contains explicit trust-boundary section; missing section fails report validation.

2. **Add evidence-quality run status gating**
   - classify runs as `success | degraded_success | insufficient_evidence` using telemetry completeness checks.
   **Acceptance metric:** before/after delta claims are blocked unless both sides are `success` or explicitly downgraded with caveat.

3. **Enforce contamination-resistant comparison windows**
   - require matched metadata: arena/config class, turn-range bucket, intervention flags.
   **Acceptance metric:** comparison job rejects unmatched windows and emits reasoned rejection output.

### 08:17 roadmap refresh (A-lane)
1. **Verify post-gate live delta on TurnTooFast**
   - Run fresh battle sample and compute first-attempt abort incidence vs #29 baseline window.
   **Acceptance metric:** first-attempt `TurnTooFast` abort rate reduced by >=30% in comparable turn window, with no drop in successful turn progression.

2. **Upgrade reveal fallback from one-shot to bounded multi-attempt**
   - Implement max 2–3 transient retries with snapshot revalidation + hard stop guards.
   **Acceptance metric:** no unbounded retry loops; reveal submission failure incidence decreases in transient-RPC windows without increasing stale-turn errors.

3. **Adopt composite verification scorecard for resultType hardening**
   - Track abort incidence + gas/turn + reaction latency distribution + settled resultType mix.
   **Acceptance metric:** every patch report includes before/after scorecard and explicit keep/tune/revert recommendation.

**Acceptance criteria:**
- All P0 gates pass in checklist
- In independent LLM-vs-script runs, script win-rate is constrained to low band (target <=20%)
- Scripts can still join permissionlessly, but show consistently worse survival depth than rich-tooling LLM agents
- No unresolved critical finding
- Narrative-diversity gates pass anti-gaming sanity checks (not just lexical jitter)
- Template-streak length is constrained (no long repeated-line loops in competitive runs)
- Every claimed progress checkpoint includes hard proof (tx hash / battle id / commit hash / before→after metric delta)
- Evidence pack complete (dataset + report + deploy tag inputs)
- Thin client uses on-chain data as sole source of truth for battle state/turns/settlement (no production dependency on `packages/web/public/battles/*.json`)
- ResultType incidence gates on rolling window (artifact-backed):
  - `INVALID_SOLUTION (2)` short-settle incidence decreases vs current baseline,
  - `TIMEOUT (4)` incidence decreases without increasing grief wins,
  - `NCC_REVEAL_FAILED (7)` incidence decreases via reveal-state resilience.

**Must-be-onchain:** all validation battles on current v4.2 arena with cloze enabled where required

---

## After That (prioritized)

### P0 — Brier Scoring Design (ELEVATED from v1.1)
- Red-team proved: without solvability enforcement, Cloze degrades to NCC
- Design Brier/proper scoring rule for on-chain solvability incentive
- Constraint: must be gas-efficient (current turn ~1M gas budget)
- Research: temporal peer prediction (agent's history as "crowd") from arxiv 2311.07692

### P1 — Adaptive Strategy
- Track NCC/cloze success history in checkpoint
- Switch strategy at bank thresholds (>200=aggressive, <100=defensive)
- Prove adaptive beats static in >50% of matches

### P1 — Gas Optimization
- Current: ~1M gas/turn average
- Target: <500K/turn (cloze adds ~34K, acceptable)
- Focus: `containsSubstring` (116K → ~50K via assembly)

### P2 — Event-Based Fighter
- Replace polling with event listeners for lower latency
- Reduces RPC calls, faster turn response

### P2 — UI Enhancements
- Cloze visualization (show [BLANK] + answer in replay)
- Leaderboard / battle history page
- Agent profile cards

---

## Scope Guard
**Now:** ResultType hardening loop (2/4/7) with artifact-backed incidence deltas
**Next:** Implement reveal-resilience runtime patch (resultType=7) + forge matrix
**Later:** Brier scoring design, adaptive strategy, gas optimization, event fighter
**Parked:** Defender commit-reveal (P3), VRF randomness (v2), cross-chain (v2)
**Parked:** OpenClaw PR #30306 review feedback (not urgent)

### 07:57 roadmap refresh (A-lane)
1. **Collusion-ring simulation matrix (P0)**
   - implement deterministic scenario matrix for 2/3/5-agent coalitions with mixed populations (honest adaptive, scripted exploiters, colluders) and matchmaking variants.
   **Acceptance metric:** simulation artifact reports multiplier leakage and collusion EV delta across all matrix cells; fail if any coalition profile sustains positive abnormal EV above configured tolerance.

2. **Fairness + concentration metric pack (P0)**
   - add newcomer viability, reward concentration (Gini/top-decile share), and mobility metrics per epoch to baseline evaluation output.
   **Acceptance metric:** report emits all fairness metrics with explicit pass/fail bands; fail closed if any mandatory metric is missing or outside band.

3. **Quality-gate drift alarms + thresholds (P0)**
   - define warn/critical thresholds for heuristic-gaming indicators and wire auto-mitigation recommendations (tighten gate, reduce multiplier cap, freeze streak accrual).
   **Acceptance metric:** alarm table is machine-readable and exercised on historical windows + synthetic exploit windows with deterministic trigger behavior.

**Next Task (single):** implement Task 1 simulation matrix scaffold + baseline run harness so Tasks 2/3 can consume consistent outputs.

### 08:47 roadmap refresh (A-lane)
1. **Add sabotage-aware scenarios to collusion matrix (P0)**
   - extend simulation matrix with false-flag reputation poisoning and telemetry-degradation variants.
   **Acceptance metric:** matrix includes explicit sabotage scenario IDs and emits separate EV/fairness deltas for sabotage vs non-sabotage cells.

2. **Define data-quality gate before fail-closed penalties (P0)**
   - enforce observability preconditions (head lag, missing sample ratio, watcher health) before applying hard reputation freezes.
   **Acceptance metric:** gate engine outputs `success|degraded_success|insufficient_evidence` and blocks hard fail-closed actions when preconditions are unmet.

3. **Add graph-level anti-sybil diagnostics to fairness output (P0)**
   - compute counterparty overlap/concentration metrics to detect identity rotation bypass.
   **Acceptance metric:** fairness artifact includes overlap metrics + threshold verdict; fail if identity-level metrics are healthy while graph metrics breach limits.

**Next Task (single):** implement Task 1 by extending `collusion-matrix-scaffold.ts` with sabotage scenario dimensions and deterministic IDs.
