# Clawttack Mechanism Deployment Readiness Validation Plan

## Executive Verdict Framework

1. Executive Verdict Framework (Go/No-Go Rubric)

This rubric is designed to produce a **binary** deployment decision (“Go” vs “No-Go”) for the current direction: **dynamic reward multiplier from verified-quality streaks + fixed/simple penalty constants**, with explicit coverage of the four red-team findings (collusive streak farming, rich-get-richer spirals, quality-gate brittleness, and reward/penalty griefing asymmetry).

The underlying standard is **coalition robustness** in the sense that agents can coordinate without binding commitments and will exploit public rules; mechanism validation therefore must be explicitly “coalition-aware” rather than purely single-agent incentive compatible. citeturn1search20

### Go decision rule

**GO** only if **all hard gates** below pass in the final simulation matrix and the monitoring system (Drift Alarms) is demonstrably able to detect and auto-mitigate the failure modes within defined time/volume bounds.

**NO-GO** if **any** hard gate fails, or if thresholds can only be met by relying on unverifiable / discretionary / human-only judgments (because the system must remain auditable and abuse-resistant).

### Hard gates (must pass before go-live)

**Gate A: Collusion resistance (Pillar A)**
- For each coalition size **k ∈ {2,3,5}** and each matchmaker regime (random / weak anti-repeat / strong anti-repeat), the **collusive uplift** (defined precisely in the Metric Suite) must be below threshold, and **low-effort collusion strategies must have non-positive EV** after penalties/fees. This is the direct operationalization of Sybil/collusion risk: if identities are cheap, Sybil-style coordination is always on the table, so profitable streak farming is a deployment blocker. citeturn11search7turn11search8  
- Additionally, **collusion detection leakage metrics** must remain below threshold *even when colluders adapt to anti-repeat rules* (ring rotation + Sybil padding).

**Gate B: Fairness and non-centralization (Pillar B)**
- Newcomer viability must remain above threshold, and reward concentration metrics (Gini/HHI/Palma/top-decile-to-median ratio) must remain within acceptable ranges across epochs.
- Mobility must be non-trivial (rank churn exists): if ranking/reward becomes “sticky” (high persistence), the system is structurally vulnerable to Matthew-effect dynamics (rich-get-richer) and will centralize over time. citeturn2search0turn10search34turn6search1

**Gate C: Drift and gaming detection with hard thresholds (Pillar C)**
- The live monitoring design must provide:
  - leading indicators of heuristic gaming,
  - lagging indicators of economic distortion,
  - explicit warn/critical thresholds,
  - parameter-change playbook (“if X then Y”) that is enforceable and gas-aware (heavy analytics off-chain; on-chain only needs parameter knobs and auditable event logs).
- Drift detection should use **standard statistical process monitoring primitives** (EWMA/CUSUM control logic) with controlled false-positive rates, rather than opaque classifiers. citeturn9search1turn9search14turn9search3

### “Must-have now” vs “nice-to-have later”

**Must-have before go-live**
- Full scenario matrix simulations with reproducible seeds and CI reporting.
- Hard-gate thresholds met.
- Drift Alarm System implemented and run in a canary environment with auto-mitigation enabled (or at least “shadow mode” with explicit sign-off criteria).
- Emergency response controls exist (parameter caps, multiplier cap reductions, anti-repeat window expansions, and—if already supported—penalty scaling with multiplier).

**Nice-to-have after go-live (does not block if hard gates pass)**
- Stronger identity/Sybil friction (proof-of-personhood, attestations) — valuable but not assumed by default in adversarial settings. citeturn11search7turn11search19
- Sophisticated community-detection tooling beyond the minimal leakage metrics.
- More elaborate quality auditing pipelines.

## Simulation Specification

2. Simulation Specification (inputs, population models, attack models, run counts)

This section defines a **simulation harness** that can be implemented immediately as engineering tasks. It is intentionally **mechanism-first**: it treats the current reward/penalty logic and matchmaker as black-box functions so you can “drop in” your real contract math and rails without re-deriving theory.

### Core simulation interface (drop-in functions)

Your sim harness should accept the following deterministic, testable functions:

- `matchmaker(pool_state, matchmaker_mode, seed) -> list of pairs`
  - modes: `random`, `weak_anti_repeat(w)`, `strong_anti_repeat(w, u, H)`
- `quality_gate(agent_i, opponent_j, environment_state, agent_action) -> {pass, fail} + score_components`
- `payout(agent_i, battle_outcome, agent_state, params) -> Δbalance`
- `state_update(agent_i, battle_outcome, quality_result, agent_state, params) -> agent_state'`
  - must include: streak update, multiplier update, rating update, cooldowns/eligibility if any

All outputs must be fully logged per battle (agent IDs, opponent IDs, quality results, streak, multiplier, reward, penalty). This is required for auditability and for the leakage metrics used in Pillars A–C.

### Population model (agent types and behavior models)

Use a **mixed-population** with at least three agent archetypes, parameterized so you can sweep difficulty:

1) **Honest adaptive**
- Objective: maximize long-run expected net reward by choosing higher effort when stakes justify it.
- In the sim: produces higher “true quality” and has a reasonably aligned gate-pass probability.

2) **Scripted exploiter**
- Objective: maximize EV with minimal effort; optimizes for the gate’s most learnable heuristics.
- In the sim: has **higher gate-pass-per-unit-effort** but a **lower true-quality rate** when evaluated on out-of-distribution or withheld checks.

3) **Colluder**
- Objective: maximize coalition total EV; coordinates actions across accounts (rings) and uses Sybil padding if it increases the chance of favorable pairings.
- In the sim: may be low-effort or mixed-skill; must include cases where colluders are individually mediocre but can farm streaks via coordination (the key red-team failure mode).

This framework mirrors well-known manipulation categories in reputation/feedback systems (Sybil attacks, collusion, and low-effort manipulation), where cheap identity creation and coordinated feedback loops can defeat naive mechanisms. citeturn11search7turn11search8turn7search2

### Matchmaker assumptions to test

You must test all three (per user requirement):

- **Random**: uniform pairing among available agents.
- **Weak anti-repeat**: disallow same opponent within last `w` matches for either agent.
- **Strong anti-repeat**: enforce both:
  - no repeats within last `w`, and
  - minimum opponent diversity: in any rolling window of `H` matches, each agent must face at least `u` distinct opponents (or else becomes temporarily ineligible for streak gains).

“Strong anti-repeat” is explicitly an adversarial setting: colluders will respond by increasing ring size and Sybil padding, so the sim must model that adaptation.

### Pillar A attack scenarios table

Attack scenarios table (required)

Each scenario below is a *fully specified* sim configuration. “Parameters per scenario” are shown as explicit knobs to set or sweep.

**Global defaults (unless overridden per scenario)**
- Total agents: `N = 2,000`
- Epoch length: `B = 10,000` battles (20,000 participations) per epoch
- Total epochs: `E = 100` (1,000,000 battles) so long-run centralization and drift can emerge
- Population mix baseline: `70% honest adaptive, 20% scripted exploiter, 10% colluder accounts` (by count)
- Entry/exit: newcomers join at start of epoch with probability `p_join`; drop out if EV < threshold (used for newcomer viability, defined later)

> Important: All thresholds below are defined in Section 3 to avoid inconsistencies.

| Scenario | Coalition structure | Population mix override | Matchmaker | Key parameters to set/sweep | Expected exploit pathway | Leakage detection metrics to compute | “Collusion-resistant enough” thresholds |
|---|---|---|---|---|---|---|---|
| A0 Baseline | No collusion coordination | None | Random | Use production params | Establish baseline distributions for EV, concentration, mobility | All A-metrics (as baseline) | Not a pass/fail; used to compute baseline bands |
| A1 | 2-agent ring (k=2) | Colluders are low-skill | Random | Sybil padding `s=0`; align effort low | Simple reciprocal streak farming: accounts coordinate to keep streak alive, exploit dynamic multiplier | Collusive uplift ΔEV(k), streak amplification ratio, opponent diversity deficit | ΔEV(k) ≤ max(0, 0.05·R_base) AND low-skill colluders remain EV ≤ 0 |
| A2 | 2-agent ring | Colluders low-skill | Weak anti-repeat | `w∈{1,3,5}`; colluders can “wait” | Ring uses timing (join/leave) to re-match after cooldown; brute-force matchmaker via repeated queue attempts | Repeat-rate anomaly vs expected, time-to-rematch distribution, ΔEV(k) | Same as A1 + repeat-rate anomaly must not exceed baseline+3σ |
| A3 | 2-agent ring + Sybil padding | Colluders low-skill | Strong anti-repeat | `w`, `u`, `H`; Sybil padding `s∈{2,5,10}` | Colluders add Sybils to satisfy opponent-diversity constraints while keeping matches within coalition set | Coalition subgraph exclusivity/cohesion, unique-opponent entropy, ΔEV(k) | ΔEV(k) ≤ max(0, 0.05·R_base) AND exclusivity spike < threshold |
| A4 | 3-agent cycle (k=3) | Mixed-skill colluders | Random | Allow coordination | Cycle farming: rotate (A→B→C→A) to maintain streaks; if gate is brittle, scripted templates stabilize pass | ΔEV(3), coalition reward share lift, multiplier share | ΔEV(3) ≤ 0.10·EV_baseline_coalition AND coalition share lift ≤ +2pp |
| A5 | 3-agent cycle + queue shaping | Mixed-skill | Weak anti-repeat | `w`; allow “queue shaping” | Colluders manipulate availability windows to increase intra-coalition match probability | Intra-coalition match frequency / expected, pairwise mutual-information of matches | Intra-coalition match frequency ≤ 2× expected AND ΔEV(3) bound holds |
| A6 | 3-agent cycle + Sybil padding | Mixed-skill | Strong anti-repeat | `u,H`; Sybil padding `s` | Sybils used to satisfy diversity while still effectively colluding | Exclusivity/cohesion, unique-opponent entropy | Cohesion/exclusivity must not exceed critical thresholds (Section 3) |
| A7 | 5-agent ring (k=5) | Low-skill majority | Random | baseline params | Large ring enables high probability of always finding a “friendly” counterparty even under randomness as k increases | ΔEV(5), streak persistence, coalition capture rate | Low-skill majority must stay EV ≤ 0; ΔEV(5) ≤ max(0,0.05·R_base) |
| A8 | 5-agent ring | Low-skill majority | Weak anti-repeat | `w`; ring decides schedule | Rotate to avoid repeat bans; still keep all matches coalition-internal | Repetition anomaly, entropy of opponents, coalition capture rate | Opponent entropy must be within baseline band; capture rate ≤ baseline+2pp |
| A9 | 5-agent ring + Sybil padding | Low-skill majority | Strong anti-repeat | `u,H`; Sybil padding `s∈{5,10,20}` | Coalition inflates “distinct opponent” constraint by adding cheap accounts; classic Sybil amplification pattern citeturn11search7 | Cohesion/exclusivity, match graph clustering, ΔEV(5) | ΔEV(5) ≤ max(0,0.05·R_base) AND exclusivity < critical |
| A10 | Mixed population: colluders + scripted exploiters | Increase scripted to 40% | Random | Sweep quality-gate brittleness parameter `b` | Scripts learn heuristics; colluders use scripts to maintain pass streaks cheaply, leading to streak multiplier inflation | False-pass rate proxy, near-boundary score mass, ΔEV(k) | Gate-gaming indicators must trigger alarms before ΔEV crosses threshold (Section 4) |
| A11 | Coalition griefing (k=3 or 5) | Colluders medium-skill | Any (test all 3) | Fixed penalties P vs dynamic rewards M; sweep P | “Economic griefing asymmetry”: coalition spends small fixed penalties to force others to lose streak/multiplier, extracting long-run advantage; griefing is defined as causing harm without proportional benefit to the victim’s attacker citeturn7search29turn10search0 | Griefing asymmetry ratio (victim loss / attacker cost), streak-sniping rate | Griefing ratio must be ≤ 1.0 (or ≤ 1.2 warn, >1.2 fail) across regimes |

**Why these scenarios are sufficient coverage**
- They cover the minimum coalition sizes requested (2/3/5), and explicitly include the *adaptive response* of adding Sybil padding when anti-repeat constraints tighten—matching the core Sybil insight that cheap identities enable disproportionate influence. citeturn11search7
- They also include a dedicated griefing scenario to test asymmetries between dynamic reward scaling and fixed penalty constants; this aligns with known blockchain griefing categories where an attacker can cause harm or blockage without direct proportional cost. citeturn7search1turn7search29

### Run counts and statistical confidence targets

Because this is Monte Carlo evaluation over adversarial strategies, you need enough samples to:
- reach steady-state (avoid “warm-up bias”), and
- report confidence intervals (CIs) tight enough to support a binary decision.

**Minimum recommended runs**
- Per scenario: `E = 100` epochs of `B = 10,000` battles ⇒ `1,000,000` battles per replicate.
- Replicates: `R = 30` independent seeds per scenario (different RNG for matchmaker + stochastic agent outcomes).
- Total per scenario: `30,000,000` battles; across 12 scenarios: `360,000,000` battles (heavy but feasible in an optimized simulator; if too heavy, see “two-stage” approach below).

Monte Carlo error on estimated means typically shrinks on the order of \(1/\sqrt{R}\), motivating multiple independent replicates rather than a single ultra-long run. citeturn8search10

**Two-stage alternative (if compute constrained)**
- Stage 1 (screening): `R=10`, `B·E = 200,000` battles per replicate (2M per scenario). Use to identify obvious failures.
- Stage 2 (go/no-go): run full `R=30`, `B·E = 1,000,000`.

## Metric Suite

3. Metric Suite (definitions, formulas, thresholds)

This suite combines **Pillar A leakage metrics** and **Pillar B fairness/concentration metrics**, with explicit formulas, baseline bands, and hard failure thresholds.

### Notation

- Let agents be \(i \in \{1,\dots,N\}\).
- Let epochs be \(t \in \{1,\dots,E\}\).
- Let \(R_{i,t}\) be agent \(i\)’s **net reward** in epoch \(t\) (rewards minus penalties/fees).
- Let \(G_{i,t}\) be agent \(i\)’s **gross payout** before penalties (used if net can be negative).
- Let \(M_{i,b}\) be agent \(i\)’s reward multiplier at battle \(b\).
- Let \(S_{i,b}\) be streak length at battle \(b\).
- Let coalition \(C\) be a set of colluding accounts; \(|C|=k\).

### Pillar A metrics (collusion leakage)

These are computed per scenario and compared to non-collusive baselines.

**A1: Collusive uplift (primary collusion success metric)**
- Definition: incremental coalition EV due to collusion, controlling for the same agents’ intrinsic skill.
- Compute:
  - Baseline (no coordination): \( \mathrm{EV}^{\mathrm{base}}_C = \frac{1}{T}\sum_{t=1}^{T}\sum_{i\in C} R_{i,t}\)
  - Collusive: \( \mathrm{EV}^{\mathrm{collude}}_C = \frac{1}{T}\sum_{t=1}^{T}\sum_{i\in C} R_{i,t}\)
  - Uplift: \( \Delta \mathrm{EV}_C = \mathrm{EV}^{\mathrm{collude}}_C - \mathrm{EV}^{\mathrm{base}}_C \)

**Thresholds**
- Hard fail if, for any \(k \in \{2,3,5\}\) and matchmaker regime:
  - \( \Delta \mathrm{EV}_C > \max(0,\;0.05 \cdot R_{\text{base-per-battle}}) \) (absolute cap), **or**
  - \( \Delta \mathrm{EV}_C > 0.10 \cdot \max(\epsilon,\mathrm{EV}^{\mathrm{base}}_C) \) (relative cap; \(\epsilon\) prevents division instability).
- Additional hard fail: if “low-skill colluders” (configured in scenarios A1/A7/A9) achieve \( \mathrm{EV}^{\mathrm{collude}}_C > 0 \).  
Rationale: low-effort templates must have non-positive EV; otherwise streak farming is profitable.

**A2: Coalition capture rate**
- Let total net in epoch \(t\): \(R_{\mathrm{tot},t}=\sum_i R_{i,t}\) (or gross totals if net can be negative).
- Coalition share: \( \mathrm{Share}_{C,t}=\frac{\sum_{i\in C} \max(R_{i,t},0)}{\sum_{j} \max(R_{j,t},0)}\)

**Thresholds**
- Hard fail if \( \max_t \mathrm{Share}_{C,t} \) exceeds “population share + 2 percentage points” in baseline-calibrated steady state, unless justified by coalition being significantly higher-skill in calibration (in which case use uplift metric as primary).

**A3: Opponent diversity deficit**
- For agent \(i\), in a rolling window of \(H\) battles, compute unique opponents \(U_{i}\).
- Define deficit: \( \mathrm{ODD}_i = 1 - \frac{U_i}{H} \).

**Thresholds**
- Hard fail if coalition median \(\mathrm{ODD}\) exceeds baseline median by more than **3 baseline standard deviations** in strong anti-repeat scenarios (because strong anti-repeat should already suppress repeats; if ODD is still high, colluders are exploiting Sybil padding).

**A4: Match-graph exclusivity and cohesion (minimal, non-ML cartel-style screen)**
Build a weighted interaction graph where edge weight \(w_{ij}\) is the number of matches between \(i\) and \(j\) in the window. Network-based cartel detection literature shows that cohesive and exclusive interaction patterns can identify groups positioned to sustain cooperation. citeturn7search3

For a candidate group \(C\):
- Internal weight: \(W_{\mathrm{in}}=\sum_{i\in C}\sum_{j\in C, j\neq i} w_{ij}\)
- External weight: \(W_{\mathrm{out}}=\sum_{i\in C}\sum_{j\notin C} w_{ij}\)
- Exclusivity: \( \mathrm{Excl}(C)=\frac{W_{\mathrm{in}}}{W_{\mathrm{in}}+W_{\mathrm{out}}} \in [0,1]\)
- Cohesion (simple version): compute coefficient of variation of internal degrees within \(C\):  
  - internal degree \(d_i^{\mathrm{in}}=\sum_{j\in C} w_{ij}\)  
  - \( \mathrm{Coh}(C)=1-\frac{\mathrm{sd}(d^{\mathrm{in}})}{\mathrm{mean}(d^{\mathrm{in}})+\epsilon} \) (higher means more evenly connected)

**Thresholds**
- Warn if \( \mathrm{Excl}(C) > 0.70 \) and \( \mathrm{Coh}(C) > 0.60 \) for any cluster of size ≥2.
- Hard fail (collusion not “resistant enough”) if \( \mathrm{Excl}(C) > 0.85 \) and \( \mathrm{Coh}(C) > 0.70 \) coincides with positive uplift \( \Delta \mathrm{EV}_C > 0 \).

### Pillar B metrics (fairness and concentration)

These must be computed over epochs after a burn-in period (e.g., ignore first 10 epochs).

**B1: Newcomer viability rate**
Define “newcomer cohort” \(J_t\): agents that first appear at epoch \(t\), assigned initial rating/state as in production.

Let viability window be \(T_v\) epochs (recommended \(T_v=10\), i.e., 100k battles under defaults).
Define:
\[
\mathrm{NV}(t) = \frac{1}{|J_t|}\sum_{j\in J_t} \mathbf{1}\left(\sum_{\tau=t}^{t+T_v-1} R_{j,\tau} \ge 0\right)
\]

**Why it matters**
If newcomers cannot break even within a reasonable participation budget, the system becomes effectively closed and centralizes. This is a direct manifestation of cumulative advantage (“Matthew effect”), widely described as “the rich get richer” dynamics. citeturn2search0turn10search34

**Thresholds**
- Baseline: compute \(\overline{\mathrm{NV}}_{\mathrm{base}}\) under scenario A0 (no collusion).
- Acceptable: \(\mathrm{NV}(t) \ge \overline{\mathrm{NV}}_{\mathrm{base}} - 0.05\) for all \(t\) in steady state.
- Hard fail: \(\mathrm{NV}(t) < 0.35\) for any sustained window of 5 consecutive newcomer cohorts.

**B2: Reward concentration via Gini coefficient**
Use gross positive payouts for inequality to avoid negative-value complications:
- Let \(x_i = \sum_{t} \max(G_{i,t},0)\) over a measurement horizon.
- Gini:
\[
G = \frac{\sum_{i=1}^N \sum_{j=1}^N |x_i - x_j|}{2N^2 \bar{x}}
\]
where \(\bar{x} = \frac{1}{N}\sum_i x_i\). citeturn5search0turn5search8

**Why it matters**
Gini is a standard inequality summary; higher values indicate more concentration. citeturn0search2

**Thresholds**
- Baseline: \(G_{\mathrm{base}}\) from A0.
- Acceptable: \(G \le \min(0.55,\; G_{\mathrm{base}} + 0.05)\).
- Hard fail: \(G > 0.60\) for any steady-state measurement window.

**Confidence reporting**
Construct 95% CIs for Gini via bootstrap (recommended \(B=1{,}000\) bootstrap resamples over agents). Bootstrap CI methods are standard for Gini inference. citeturn4search10turn4search2

**B3: Concentration via Herfindahl–Hirschman Index**
Let market share analogue be reward share:
\[
s_i = \frac{x_i}{\sum_j x_j}
\quad ; \quad
\mathrm{HHI} = \sum_i (100 s_i)^2
\]
(“percent HHI” ranges 0–10,000). The HHI is defined as the sum of squared market shares. citeturn1search3

**Why it matters**
HHI is more sensitive to top-heavy concentration than Gini in many settings (it squares shares).

**Thresholds**
- Baseline: \(\mathrm{HHI}_{\mathrm{base}}\) from A0.
- Acceptable: \(\mathrm{HHI} \le \mathrm{HHI}_{\mathrm{base}} \cdot 1.20\).
- Hard fail: \(\mathrm{HHI} > 1{,}500\) (moderate-to-high concentration in antitrust practice) **or** \(> \mathrm{HHI}_{\mathrm{base}} \cdot 1.40\). citeturn1search3  
(Use the relative threshold if your baseline is structurally higher because rewards are inherently competitive.)

**B4: Palma ratio (top-decile vs bottom-40%)**
Let income shares:
- \(S_{10} =\) share of rewards earned by top 10% agents
- \(S_{40} =\) share earned by bottom 40%
\[
\mathrm{Palma} = \frac{S_{10}}{S_{40}}
\]
This is the standard definition. citeturn4search4turn4search0

**Why it matters**
Palma is explicitly tail-sensitive (top vs bottom), making it a direct centralization check. citeturn4search4turn4search0

**Thresholds**
- Baseline: \(\mathrm{Palma}_{\mathrm{base}}\) from A0.
- Acceptable: \(\mathrm{Palma} \le \min(4.0,\; \mathrm{Palma}_{\mathrm{base}} + 0.5)\).
- Hard fail: \(\mathrm{Palma} > 5.0\).

**B5: Top-decile to median disparity**
Let:
- \( \mu_{90-100} =\) mean reward among top decile
- \( \mathrm{median} =\) median reward across all agents
\[
\mathrm{TD\_Med} = \frac{\mu_{90-100}}{\mathrm{median}+\epsilon}
\]

**Thresholds**
- Baseline: \(\mathrm{TD\_Med}_{\mathrm{base}}\).
- Acceptable: ≤ baseline·1.25
- Hard fail: ≥ baseline·1.50

**B6: Mobility metrics over epochs**
You must measure whether agents can move up/down the reward/rating distribution.

**B6a: Rank persistence via Spearman correlation**
Compute Spearman’s rank correlation between agent reward ranks in consecutive epochs:
\[
\rho_t = \mathrm{SpearmanCorr}(\mathrm{rank}(x_{\cdot,t}),\; \mathrm{rank}(x_{\cdot,t+1}))
\]
Spearman correlation is a rank-based association measure between −1 and +1. citeturn6search33turn6search29

Define mobility proxy:
\[
\mathrm{Mob}_{\rho}(t) = 1 - \rho_t
\]

**Thresholds**
- Acceptable: median \(\mathrm{Mob}_{\rho}\) ≥ 0.10 in steady state.
- Hard fail: median \(\mathrm{Mob}_{\rho}\) < 0.05 for 10 consecutive epochs (system becomes too “sticky”).

**B6b: Transition-matrix mobility via Prais–Shorrocks trace index**
Bin agents into \(K\) quantiles (e.g., deciles) of reward or rating each epoch, estimate transition matrix \(P\) from epoch \(t\) to \(t+1\). The trace-based mobility index:
\[
M_P = \frac{K - \mathrm{tr}(P)}{K - 1}
\]
This is the standard trace-based mobility (“Prais index / Shorrocks”) form. citeturn6search1turn6search8

**Thresholds**
- Acceptable: \(M_P \ge 0.15\) in steady state.
- Hard fail: \(M_P < 0.10\) sustained for 10 epochs.

### How many simulated battles for statistical confidence (explicit requirement)

You need different sample sizes for different metrics:

**For newcomer viability \(\mathrm{NV}\) (a proportion)**
If you want a 95% CI half-width ≤ 0.02 in worst case \(p=0.5\), the classic approximation is \(n \approx 1.96^2 p(1-p)/\varepsilon^2 \approx 2{,}401\) independent newcomer observations. citeturn8search10  
Practical plan: ensure ≥ 3,000 newcomers per scenario (across runs) in steady state.

**For inequality metrics (Gini/Palma/HHI)**
Because these depend on distribution tails, use bootstrap CIs (≥ 1,000 bootstrap samples) and require CI width targets:
- Gini 95% CI width ≤ 0.03
- Palma 95% CI width ≤ 0.5
Bootstrap CI construction for inequality metrics is standard practice. citeturn4search10turn4search2

**For collusion uplift \(\Delta \mathrm{EV}\)**
Require the 95% CI for \(\Delta \mathrm{EV}\) to lie entirely below the hard threshold. Monte Carlo precision improves with replicate count roughly as \(1/\sqrt{R}\). citeturn8search10  
Practical plan: minimum **R = 30** independent seeds for go/no-go.

## Drift Alarm System

4. Drift Alarm System (signals, thresholds, mitigations)

This is Pillar C: an **anti-gaming monitoring and response system** that is (i) measurable, (ii) minimally reliant on opaque ML, and (iii) enforceable through parameter changes.

### Alarm catalog (required)

Alarms are split into:
- **Leading indicators**: detect early signs of heuristic-gaming or coordination before economic damage accumulates.
- **Lagging indicators**: detect realized distortion (concentration, EV inversion, griefing).

Each alarm has:
- signal definition,
- trigger logic (warn / critical),
- mitigation playbook,
- false-positive management.

### Trigger logic primitives (EWMA, CUSUM) with controlled false alarms

**EWMA smoothing**
For a metric stream \(x_t\):
\[
z_t = \lambda x_t + (1-\lambda) z_{t-1}
\]
EWMA gives more weight to recent data; it is a standard process monitoring tool. citeturn2search3turn9search17

**EWMA control limits**
Use baseline mean \(\mu_0\) and baseline std dev \(\sigma_0\), then:
\[
UCL = \mu_0 + L \sigma_0 \sqrt{\frac{\lambda}{2-\lambda}}, \quad
LCL = \mu_0 - L \sigma_0 \sqrt{\frac{\lambda}{2-\lambda}}
\]
This is a standard EWMA limits form. citeturn9search5turn9search1  
Recommend: \(\lambda \in [0.2,0.3]\), \(L=3\) for “3-sigma style” critical detection and \(L=2\) for warning. citeturn2search22turn9search5

**CUSUM for small drifts**
CUSUM accumulates deviations and is known to be more efficient than Shewhart-style charts for small mean shifts. citeturn9search14turn0search15  
Use standardized one-sided CUSUM:
\[
S^+_t=\max(0,(z_t-k)+S^+_{t-1}),\quad
S^-_t=\max(0,(-z_t-k)+S^-_{t-1})
\]
with action when \(S^+\) or \(S^-\) exceeds threshold. citeturn5search7turn9search2

### False-positive management (explicit requirement)

Because you’ll monitor many metrics at once, you must control expected false alarms.

Use **false discovery rate (FDR)** control across simultaneous alarm tests (per epoch/day), rather than naive per-metric 0.05 thresholds. The Benjamini–Hochberg procedure is the canonical FDR controller. citeturn5search6turn4search15  
If dependence between metrics is a concern, use the Benjamini–Yekutieli correction factor \(c(m)=\sum_{j=1}^m 1/j\). citeturn9search0

Operational setting:
- Target FDR per day: **5%** (i.e., among metrics flagged “significant drift,” expected ≤ 5% are false alarms). citeturn5search10turn5search6

### Alarm catalog with thresholds and mitigations

Alarm catalog (required)

| Alarm ID | Type | Signal definition | Warning trigger | Critical trigger | Auto-mitigation playbook (gas-aware) | Notes on false positives |
|---|---|---|---|---|---|---|
| C1 Gate-pass surge | Leading | \(x_t =\) overall gate pass-rate per epoch | EWMA \(z_t\) > \(\mu_0 + 2\sigma_0\) for 3 epochs | EWMA \(z_t\) > \(\mu_0 + 3\sigma_0\) for 2 epochs | Reduce multiplier growth rate by 25%; increase per-fail streak reset severity; increase audit sampling | EWMA control logic uses standard limits citeturn9search5turn9search1 |
| C2 Near-boundary mass | Leading | fraction of submissions with gate score within ε of threshold | +2σ | +3σ | Randomly widen score threshold band (harder) *or* require extra “proof-of-work” step for high-multiplier accounts (if supported) | If score components are discrete, use CUSUM instead |
| C3 Template similarity spike | Leading | median pairwise n-gram Jaccard similarity within epoch | +2σ | +3σ | Add diversity requirement for streak credit: streak increments only if opponent diversity ≥ u (pre-existing knob) | Off-chain compute; on-chain only needs the knob |
| C4 Coalition exclusivity spike | Leading | max cluster exclusivity \(\mathrm{Excl}(C)\) among clusters size ≥2 | \(\mathrm{Excl}>0.70\) & cohesion>0.60 | \(\mathrm{Excl}>0.85\) & cohesion>0.70 | Increase anti-repeat window \(w\); increase opponent diversity requirement \(u\); cap multiplier \(M_{\max}\) | Cartel-style topology signals motivated by interaction-pattern logic citeturn7search3 |
| C5 Multiplier concentration | Lagging | share of total rewards paid at multipliers ≥ \(M_{\text{high}}\) | share > baseline+10% | share > baseline+20% | Reduce \(M_{\max}\) by 10–20%; add stronger decay to streak | A direct “rich-get-richer” guardrail citeturn2search0turn10search34 |
| C6 Reward Gini drift | Lagging | Gini of gross epoch payouts | \(G>G_{\mathrm{base}}+0.05\) | \(G>0.60\) | Reduce multiplier cap; increase newcomer boost (if exists); widen anti-repeat | Gini definition standard citeturn5search0turn0search2 |
| C7 Newcomer viability drop | Lagging | \(\mathrm{NV}(t)\) over newcomers | \(\mathrm{NV}<\mathrm{NV}_{\mathrm{base}}-0.05\) | \(\mathrm{NV}<0.35\) for 5 cohorts | Temporarily increase newcomer base reward; cap top multipliers; tighten anti-repeat | Blocks centralization trap |
| C8 Griefing asymmetry | Lagging | \(\mathrm{GAR}=\) victim loss / attacker cost (defined below) | GAR > 1.0 | GAR > 1.2 | Scale penalty with multiplier: \(P \leftarrow P\cdot f(M)\) (if supported) OR cap M aggressively | Griefing defined as harm without direct proportional gain citeturn7search29turn10search0 |

**Griefing asymmetry ratio (GAR)**
For a detected streak-sniping episode family:
\[
\mathrm{GAR} = \frac{\sum \text{(victim lost future rewards due to streak break)}}{\sum \text{(attacker penalties + fees + forfeited rewards)}}
\]
Hard requirement: GAR must be ≤ 1.0 in steady state; otherwise the system invites cheap disruption. citeturn7search29turn7search1

### Decision matrix (required)

Decision matrix (required)

| State | Condition | What changes are allowed | Who/what triggers | Time to apply |
|---|---|---|---|---|
| Normal | No warnings/criticals | None | — | — |
| Warn | Any warning alarm fires with FDR-controlled significance | Small parameter changes only: reduce multiplier growth rate ≤25%, increase anti-repeat window, increase opponent diversity min | Auto (pre-approved parameter deltas) | Within 1 epoch |
| Critical | Any critical alarm fires (or 2+ warnings persist 5 epochs) | Stronger changes: reduce \(M_{\max}\) 10–30%, increase penalty scaling with multiplier if supported, temporarily suppress streak credit for low-diversity match patterns | Auto + mandatory operator review | Immediate / same epoch |
| Emergency | Critical persists 3 epochs or collusion uplift threshold breached in live data | Circuit breaker: cap multiplier at 1.0; pause rewards above base; optionally pause matchmaking | Auto + governance multisig | Immediate |

### “If X then Y” response table (required)

| If observed X | Then execute Y | Measurable stop condition |
|---|---|---|
| \(\Delta \mathrm{EV}_C\) estimate crosses 5% base reward in any suspected cluster | Reduce \(M_{\max}\) by 20% and increase anti-repeat window \(w\) by +2 | \(\Delta \mathrm{EV}_C\) CI upper bound < threshold for 10 epochs |
| Exclusivity spike \(\mathrm{Excl}>0.85\) | Increase opponent diversity requirement \(u\) and set streak credit = 0 when diversity unmet | Exclusivity returns to ≤0.70 for 10 epochs |
| Newcomer viability \(\mathrm{NV}<0.35\) | Temporary newcomer subsidy + clamp top multipliers | \(\mathrm{NV} \ge 0.40\) for 5 cohorts |
| Gini > 0.60 | Reduce multiplier cap and increase decay | Gini ≤ 0.55 for 10 epochs |
| GAR > 1.2 | Scale penalty with multiplier (or cap multiplier hard) | GAR ≤ 1.0 for 10 epochs |

## Risk Register

5. Risk Register (top residual risks after mitigations)

Even if all gates pass, the following risks remain “structural” (cannot be eliminated, only bounded and monitored):

| Risk | Why it remains | Residual severity | How it is detected | Residual mitigation |
|---|---|---:|---|---|
| Adaptive Sybil + rotation strategies | Cheap identities make Sybil patterns fundamentally available in decentralized systems. citeturn11search7turn11search19 | High | Cluster exclusivity/cohesion, uplift ΔEV | Keep multiplier caps conservative; keep strong anti-repeat; require opponent diversity for streak credit |
| Quality gate proxy gaming evolves | Any proxy is gameable; scripts will adapt to heuristics. | High | C1–C3 alarms (pass surge, near-boundary mass, similarity) | Frequent gate refresh; add unpredictability; keep drift alarms strict |
| Rich-get-richer through multiplier dynamics | Preferential attachment/cumulative advantage is a known dynamic in many systems and can emerge even without explicit collusion. citeturn2search0turn10search34turn10search3 | Medium–High | Gini/HHI/Palma/mobility alarms | Hard caps and decay; newcomer subsidy; mobility guardrails |
| Economic griefing via cost asymmetry | Griefing attacks exist in smart-contract ecosystems; attackers may pay small costs to impose larger harm. citeturn7search29turn7search1 | Medium–High | GAR metric; streak-sniping rate | Penalty scaling with multiplier; cap multipliers during episodes |
| Parameter governance capture | If parameter changes are controlled by a small group, they can be attacked or captured. | Medium | Out-of-band (operational) | Hard-coded safety bounds; multi-sig + time locks; public dashboards |
| Off-chain analytics manipulation | Heavy analytics are off-chain; attackers can try to flood or confuse signals. | Medium | Cross-validate by multiple indexers; FDR controls | Multiple independent indexers; conservative mitigations |
| Strategic dropout / entry attacks | Attackers can churn identities to reset states (“whitewashing”). citeturn11search8turn10search9 | Medium | New-account bursts, reset patterns | Add cooldowns or entry costs; delay streak eligibility |

## Minimum Viable Hardening Plan

6. Minimum Viable Hardening Plan (7-day) with daily milestones

This plan assumes today is **2026-03-07** (Asia/Yerevan) and is designed to produce a final binary decision by day 7.

| Day | Milestone | Concrete deliverables | Pass criteria |
|---|---|---|---|
| Day 1 | Simulation harness skeleton | Implement drop-in interfaces (matchmaker/quality/payout/state update), replayable seeds, battle log schema | Harness runs A0 baseline end-to-end with deterministic replay |
| Day 2 | Encode agent populations + strategy library | Implement honest adaptive, scripted exploiter, colluder (ring + Sybil padding + timing/queue shaping) | Unit tests: strategies trigger expected behavioral signatures (repeat matches, low diversity, etc.) |
| Day 3 | Implement Pillar A scenario matrix | Implement A0–A11 configs as JSON/YAML, batch runner, metrics logger | All scenarios execute; logs contain all variables required for metrics suite |
| Day 4 | Metric suite implementation + CI reporting | Implement ΔEV, exclusivity/cohesion, NV, Gini, HHI, Palma, mobility; bootstrap CI for Gini/Palma; replicate aggregation | For A0, metrics stable across replicates; CI widths meet targets |
| Day 5 | Run full screening (Stage 1) + iterate | Run Stage 1 (compute-constrained) across all scenarios; identify failing thresholds; propose parameter knobs to mitigate | No scenario shows catastrophic failures (e.g., low-skill colluders EV>>0) without any available knob to fix |
| Day 6 | Drift alarm system in shadow mode | Implement EWMA/CUSUM logic, baseline calibration, FDR management; produce “If X then Y” actions list | Alarm triggers reproduce known injected drifts in test streams; false alarm rate within design bands citeturn9search5turn5search6 |
| Day 7 | Full go/no-go run (Stage 2 for finalists) + verdict | Run Stage 2 on all scenarios that passed Stage 1; finalize thresholds; produce go/no-go report using Gate A/B/C | **GO** only if all hard gates pass with 95% CI; otherwise **NO-GO** with failing metrics and required parameter changes |

## Open Questions / Assumptions to Validate

7. Open Questions / Assumptions to Validate

These are the specific unknowns that must be resolved to instantiate the plan against your *actual* contract math and rails:

1) **Exact reward/penalty math**  
   - Is reward only paid on “win”, on “pass”, or both?  
   - Are penalties applied on “fail”, on “loss”, or both?  
   The definitions of EV, ΔEV, and griefing ratio require this to be explicit.

2) **Multiplier update function and caps**  
   - Exact multiplier growth per streak step, cap \(M_{\max}\), decay rules, reset rules.  
   The plan assumes these exist as parameter knobs (or can be added with bounded on-chain cost).

3) **Matchmaking constraints currently enforced on-chain**  
   - Is opponent selection fully random, partially controllable, or adversary-influenceable through timing?  
   Scenario A2/A5 rely on modeling queue shaping; if not possible in production, those scenarios become “lower weight” but should still be tested as worst-case.

4) **Quality gate outputs available on-chain**  
   - Do you store a binary pass/fail only, or also score components?  
   Drift alarms C2 and template-gaming detection strengthen materially if some score telemetry is available (even coarse buckets).

5) **Dispute/audit mechanisms**  
   - Is there a secondary verification channel (even small sample) that can estimate false-pass risk?  
   If no, you must treat C1–C3 as higher uncertainty and keep multiplier caps more conservative until you have an audit signal.

6) **Newcomer initial state policy**  
   - Initial rating/multiplier/streak rules can make or break newcomer viability; the NV metric assumes these are defined and stable.

7) **Operational constraints on auto-mitigation**  
   - Can parameters change automatically (within on-chain bounds), or only via governance?  
   If only via governance, then “time-to-mitigate” must be treated as slower, and warn/critical thresholds should be earlier/more conservative.

8) **Definition of “negative EV” for scripts**  
   - Does EV include explicit on-chain fees/stakes/bonds, or only token transfers?  
   To enforce negative EV, there must be some cost basis; otherwise “negative EV” is not meaningfully enforceable.

9) **Target chain gas budgets and event logging costs**  
   - The plan assumes heavy analytics off-chain and minimal on-chain logic; confirm what event fields are already emitted and what can be added without gas blowups.

If any of (1)–(4) are currently undefined or not parameterizable, the correct output of this framework is **NO-GO** until those are pinned down, because the simulation and drift system cannot be instantiated without them.