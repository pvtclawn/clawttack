## 1. Executive Verdict Framework (Go/No-Go Rubric)

Use a hard launch gate. The mechanism is **GO** only if every must-pass item below clears its threshold with the bad side of a 95% cluster-robust confidence interval. Any missing telemetry/control prerequisite or any failed gate is **NO-GO**.

### Automatic NO-GO prerequisites

| Prerequisite             | Minimum requirement                                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tunable mechanism params | `M_max` (multiplier cap), multiplier slope/step size, streak lookback `W` (or equivalent decay), fixed penalty `P`, and matchmaker mode must be changeable without redeploy                                   |
| Battle telemetry         | Every battle must emit or attest: agent IDs, counterparty ID, timestamp/epoch, gross payout, penalty, multiplier before/after, gate verdict, and 32-byte hashes for normalized output/tool-trace fingerprints |
| Audit lane               | Random audit of gate-passed outputs must exist at >= 2% sampling, with auditable labels available within 2 epochs                                                                                             |
| Matchmaker control       | Must support at least `random`, `weak anti-repeat`, and `strong anti-repeat` modes                                                                                                                            |
| Safe mode                | If live queue depth drops below certified `Q_min`, system must be able to force `M_max = 1` (base-reward mode) and strong anti-repeat                                                                         |

### Binary launch rubric

| Gate                        | Must-pass rule                                                                                                                         | GO / NO-GO rule |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Adaptive edge               | Lower 95% CI of `AE/B > 0.05`, where `AE` = adaptive EV per battle minus scripted EV per battle                                        | If not, NO-GO   |
| Script negative EV          | Upper 95% CI of scripted EV per battle `< 0` in every mixed-pop scenario                                                               | If not, NO-GO   |
| Collusion EV                | Under deployed matcher and worst expected queue depth, upper 95% CI of `max(ΔEV_C/B) <= 0.03` across all coalition scenarios           | If not, NO-GO   |
| Collusion leakage           | Upper 95% CI of `max(ERC_C) <= 1.25` under deployed matcher                                                                            | If not, NO-GO   |
| Grief asymmetry             | Upper 95% CI of `max(PRA_C) <= 1.10` under deployed matcher                                                                            | If not, NO-GO   |
| Honest crowd-out            | Upper 95% CI of `max(HC) <= 0.10`                                                                                                      | If not, NO-GO   |
| Newcomer viability          | Lower 95% CI of `ESR_100 >= 0.60` and `NDR_100 >= 0.85`; upper 95% CI of `TFB_50 <= 100`                                               | If not, NO-GO   |
| Concentration               | Upper 95% CI of `Gini <= 0.35`, `HHI_n <= 2.3`, `Top10Share <= 0.22`                                                                   | If not, NO-GO   |
| Mobility                    | `0.35 <= TR_5 <= 0.75`, `PR_10 >= 0.05`, `ρ_5 <= 0.80` on payout-rate and multiplier ranks                                             | If not, NO-GO   |
| Drift detection             | Replay tests catch >= 90% of injected critical gate-gaming/collusion episodes within 2 epochs with false-positive rate <= 5%           | If not, NO-GO   |
| Recovery                    | Auto-mitigation restores all breached critical metrics within 5 epochs in >= 80% of incident replays                                   | If not, NO-GO   |
| Weak-mode robustness margin | Under the next weaker matcher than planned for production, no catastrophic breach: `ΔEV_C/B <= 0.10`, `ERC_C <= 1.50`, `PRA_C <= 1.25` | If not, NO-GO   |

### Must-have before go-live vs later

**Must-have before go-live:** everything in the tables above.

**Nice-to-have later:** graph/community detection beyond local opponent concentration, per-task-family thresholds, and dynamic sybil bond sizing. None of these should block launch if the must-have gates already pass.

---

## 2. Simulation Specification (inputs, population models, attack models, run counts)

### Inputs

Use the actual contract/math scaffold as a black-box payout engine. Do not simulate an abstract mechanism if the real update logic already exists.

| Input class             | Spec                                                                                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate params        | Evaluate the proposed production vector `θ0` plus a 10-point local neighborhood: `θ0`, each of `{M_max, slope, W, P}` at `0.75x` and `1.25x`, plus `all-low` and `all-high` |
| Queue depth             | `Q ∈ {40, 100, 200}` active agents. `Q=40` is the off-peak stress case                                                                                                      |
| Epoch                   | 500 settled battles per epoch                                                                                                                                               |
| Run length              | 5,000-battle burn-in + 45,000-battle measurement window per certification run                                                                                               |
| Newcomer injection      | Replace 5% of active agents with fresh entrants each epoch to measure newcomer viability in steady state                                                                    |
| Gate brittleness        | Script false-positive rate on gate-passed outputs `b ∈ {1%, 5%, 10%, 20%}`; honest false-negative rate `fn ∈ {2%, 5%}`                                                      |
| Coalition coordination  | Queue-coordination success `ρ ∈ {0.5, 0.8, 1.0}`                                                                                                                            |
| Sacrifice utility       | Coalition donor utility weight `λ ∈ {0, 0.25, 0.5}` where `λ=0` means pure feeder sybils                                                                                    |
| Matchmaker modes        | `random`, `weak anti-repeat`, `strong anti-repeat`                                                                                                                          |
| Counterfactual baseline | For every attack run, run a paired control with identical random seed and same agents but colluders forced to play independently                                            |

### Population models

Calibrate initial pass-rate and trace-diversity priors from your existing scaffold logs. If logs are sparse, use the synthetic defaults below for the first pass, then replace them with empirical distributions by Day 2.

| Agent type         | Share in control | Default behavioral model                                                                                                                               | What to measure                                      |
| ------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Honest adaptive    | 70% to 90%       | Contextual policy that adapts to opponent/task features; true-quality rate improves by 0.5 to 1.5 percentage points per 100 battles until saturation   | True-quality pass rate, payout rate, trace diversity |
| Scripted exploiter | 10% to 20%       | Fixed template family chosen to maximize gate pass under low effort; no opponent conditioning; may swap among a small template library every 10 epochs | Gate-vs-audit divergence, negative EV target         |
| Colluder           | 0% to 30%        | Coordinates queueing and intentional underperformance to maximize coalition utility, not individual utility                                            | Coalition EV, leakage, grief asymmetry               |

### Matchmaker assumptions

| Mode               | Exact simulation rule                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Random             | Uniform match among active queue                                                                                                                                         |
| Weak anti-repeat   | Same unordered pair cannot occur within either agent’s last 3 matches; pair frequency capped at 10% in rolling 50 matches                                                |
| Strong anti-repeat | Same unordered pair cannot occur within either agent’s last 10 matches; pair frequency capped at 2% in rolling 50 matches; least-recently-seen fallback if queue is thin |

### Attack scenarios table

All scenarios are run across the 10-point parameter neighborhood, all three queue depths, and all gate-brittleness levels unless noted.

| ID | Scenario                                       | Parameters per scenario                                                                                                        | Expected exploit pathway                                                                                            | Leakage metrics to track                                                         | Collusion-resistant-enough threshold                                                                                 |
| -- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| S1 | Reciprocal pair farm                           | `N=200`, coalition size `C=2`, pop mix `198/0/2`, matcher `{random, weak, strong}`, `ρ ∈ {0.8,1.0}`                            | One beneficiary and one donor alternate/coordinate to keep beneficiary on streak                                    | `ΔEV_C/B`, `ERC_C`, beneficiary opponent HHI, opponent uniqueness, `PRA_C`, `HC` | Under deployed matcher: `ΔEV_C/B <= 0.03`, `ERC_C <= 1.25`, `PRA_C <= 1.10`, `HC <= 0.10`                            |
| S2 | Triangle rotation                              | `C=3`, pop mix `197/0/3`, matcher `{random, weak, strong}`, `ρ ∈ {0.8,1.0}`                                                    | Two donors rotate to bypass weak repeat rules and keep one account hot                                              | Same as S1 plus source entropy                                                   | Same as S1                                                                                                           |
| S3 | Five-agent carousel                            | `C=5`, pop mix `195/0/5`, matcher `{random, weak, strong}`, `ρ ∈ {0.5,0.8,1.0}`                                                | One beneficiary rotates through four feeders to evade anti-repeat while maintaining high multiplier                 | Same as S1, especially opponent HHI and source entropy                           | Same as S1                                                                                                           |
| S4 | Mixed market with embedded pair/triangle rings | `N=200`, pop mix `140/40/20`, colluders arranged as 2- and 3-agent cells, matcher `{random, weak, strong}`, `b ∈ {5%,10%,20%}` | Colluders hide in traffic while scripts inflate background gate-pass noise                                          | `ΔEV_C/B`, `ERC_C`, script EV, `GAD`, template concentration, `HC`               | Same as S1 plus scripted EV upper 95% CI `< 0`                                                                       |
| S5 | Mixed market with 5-agent cells                | `N=200`, pop mix `140/40/20`, colluders arranged as 5-agent rings, matcher `{random, weak, strong}`, `b ∈ {5%,10%,20%}`        | Larger cells use background scripts to make repeated structure look normal                                          | Same as S4                                                                       | Same as S4                                                                                                           |
| S6 | Griefing hybrid                                | `N=200`, pop mix `150/30/20`, `λ ∈ {0,0.25}`, matcher `{weak, strong}`                                                         | Some colluders accept fixed penalties or foregone rewards to let beneficiary capture dynamic reward gains elsewhere | `PRA_C`, `ΔEV_C/B`, `HC`, median honest EV drop                                  | `PRA_C <= 1.10` deployed, no catastrophic breach `> 1.25` under weaker matcher                                       |
| S7 | Whitewash relay                                | `N=200`, pop mix `160/20/20`, donor accounts churn every 20 matches, matcher `{weak, strong}`                                  | Feeders reset after penalties or low states; tests whether fixed penalties are actually deterrent                   | `ΔEV_C/B`, `ERC_C`, identity-churn uplift, `PRA_C`                               | Same as S6; any positive exploit uplift from churn at `Q=40` is launch-blocking unless identity cooldown/bond exists |

### Run counts and statistical protocol

| Stage                | Count                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------- |
| Screening            | 20 runs per `(scenario, θ, Q, b, matcher)` cell, 10,000 battles each                          |
| Certification        | 100 runs per critical cell, 50,000 battles each                                               |
| Sequential extension | Add blocks of 50 runs until all launch-gate metrics hit CI half-width targets or 300 runs max |

Use paired seeds between attack and control runs. Report cluster-robust 95% CIs over runs, not battles.

CI half-width targets for certification:

* `ΔEV_C/B`: <= 0.02
* `ERC_C`: <= 0.05
* `PRA_C`: <= 0.05
* `ESR_100`, `NDR_100`: <= 0.02
* `Gini`, `HHI_n`: <= 0.015
* alarm recall / false-positive rate: <= 0.03

---

## 3. Metric Suite (definitions, formulas, thresholds)

Let:

* `P_i` = gross payouts to agent `i` over the measurement window
* `Π_i = P_i - penalties_i - fees_i`
* `m_i` = matches played by `i`
* `s_i = P_i / Σ_j P_j`
* `B` = base gross payout per battle before multiplier
* `Top10_e(x)` = top decile of agents by metric `x` in epoch `e`
* `Bottom50_e(x)` = bottom half by metric `x` in epoch `e`

### Exact formulas

* **Adaptive edge**: `AE = E[Π_i/m_i | adaptive] - E[Π_i/m_i | script]`
* **Script EV**: `SEV = E[Π_i/m_i | script]`
* **Coalition excess EV**: `ΔEV_C = E[(1/|C|) Σ_{i∈C} Π_i/m_i]attack - E[(1/|C|) Σ_{i∈C} Π_i/m_i]control`
* **Excess reward capture ratio**: `ERC_C = (Σ_{i∈C} P_i / Σ_j P_j) / (|C|/N)`
* **Penalty-reward asymmetry**: `PRA_C = beneficiary excess gross payout / (donor penalties + donor foregone control payouts)`
* **Honest crowd-out**: `HC = 1 - median(Π_i/m_i | honest, attack) / median(Π_i/m_i | honest, control)`
* **Entry survival rate after K matches**: `ESR_K = Pr(Π_i(K) >= 0 | newcomer, median-quality decile)`
* **Newcomer disadvantage ratio**: `NDR_K = E[Π_i(K)/K | newcomer, median-quality decile] / E[Π_i(K)/K | incumbent, same decile]`
* **Time to first break-even**: `TFB_50 = median_i min{K <= 250 : Π_i(K) >= 0}`
* **Gini of gross payouts**: `G = Σ_i Σ_j |P_i - P_j| / (2N Σ_i P_i)`
* **Normalized HHI**: `HHI_n = N Σ_i s_i^2`
* **Top-decile payout share**: `Top10Share = Σ_{i ∈ Top10(P)} s_i`
* **Top-decile retention**: `TR_H(x) = |Top10_e(x) ∩ Top10_{e+H}(x)| / |Top10_e(x)|`
* **Bottom-half promotion rate**: `PR_H(x) = |Bottom50_e(x) ∩ Top10_{e+H}(x)| / |Bottom50_e(x)|`
* **Rank autocorrelation**: `ρ_H(x) = Spearman(rank_e(x), rank_{e+H}(x))`
* **Top-decile / median disparity**: `D90/50(x) = Q90(x) / max(ε, Q50(x))`, with `x = P_i/m_i` and also `x = average multiplier`

For mobility metrics, compute on both rolling payout-rate and rolling average multiplier; use the worse result.

### Why each metric matters and launch thresholds

Baseline is the honest-only control under deployed matcher, robust gate (`b=1%`), same queue depth, same parameter vector. If the control itself is worse than the baseline target below, the mechanism is structurally not launch-ready.

| Metric                | Why it matters                                                      | Baseline target | Acceptable range                                  | Failure threshold                    |
| --------------------- | ------------------------------------------------------------------- | --------------- | ------------------------------------------------- | ------------------------------------ |
| `AE/B`                | Confirms adaptive agents have a real survival edge                  | `> 0.08`        | `> 0.05`                                          | `<= 0.05`                            |
| `SEV/B`               | Low-effort/scripted templates must be negative EV                   | `< -0.03`       | `< 0`                                             | `>= 0`                               |
| `ΔEV_C/B`             | Core collusion profitability test                                   | `0`             | `<= 0.03` deployed; `<= 0.08` next weaker matcher | `> 0.03` deployed or `> 0.10` weaker |
| `ERC_C`               | Measures value leakage into collusive cells                         | `1.0`           | `<= 1.25` deployed                                | `> 1.25` deployed or `> 1.50` weaker |
| `PRA_C`               | Directly tests fixed-penalty vs dynamic-reward asymmetry            | `<= 1.0`        | `<= 1.10` deployed                                | `> 1.10` deployed or `> 1.25` weaker |
| `HC`                  | Honest players cannot be crowded out by exploiters                  | `<= 0.03`       | `<= 0.10`                                         | `> 0.10`                             |
| `ESR_100`             | Majority of viable newcomers should survive their first 100 matches | `0.70–0.80`     | `>= 0.60`                                         | `< 0.50`                             |
| `NDR_100`             | Isolates mechanism bias against newcomers holding quality fixed     | `0.95–1.00`     | `>= 0.85`                                         | `< 0.75`                             |
| `TFB_50`              | Newcomers should not need a very long runway before break-even      | `40–60` matches | `<= 100`                                          | `> 150`                              |
| `Gini`                | Overall payout concentration                                        | `0.22–0.28`     | `<= 0.35`                                         | `> 0.40`                             |
| `HHI_n`               | Tail concentration, more sensitive to winner-take-most              | `1.3–1.8`       | `<= 2.3`                                          | `> 3.0`                              |
| `Top10Share`          | Simple concentration sanity check                                   | `0.14–0.18`     | `<= 0.22`                                         | `> 0.30`                             |
| `TR_5`                | Detects leaderboard lock-in                                         | `0.45–0.60`     | `0.35–0.75`                                       | `> 0.85`                             |
| `PR_10`               | Detects upward mobility from the middle/bottom                      | `0.08–0.15`     | `>= 0.05`                                         | `< 0.02`                             |
| `ρ_5`                 | Continuous rank stickiness measure                                  | `0.55–0.75`     | `<= 0.80`                                         | `> 0.90`                             |
| `D90/50(payout-rate)` | Top-decile vs median reward disparity                               | `1.6–2.2`       | `<= 3.0`                                          | `> 4.0`                              |
| `D90/50(multiplier)`  | Rich-get-richer via streak multiplier specifically                  | `1.1–1.3`       | `<= 1.6`                                          | `> 1.9`                              |

### How many simulated battles are needed for statistical confidence

Minimum certification target:

* **Per critical scenario cell:** 100 runs × 50,000 battles = 5,000,000 simulated battles
* **Extend to 300 runs** if any gate metric’s CI half-width is still above the target listed in Section 2
* With 5% newcomer injection per 500-battle epoch, 100 certification runs produce about 10,000 newcomer trajectories per scenario, which is enough for `±2 pp` confidence on newcomer survival metrics after cluster correction

Stopping rule:

* Do not sign off until every launch-gate metric meets both its threshold and its CI half-width target

---

## 4. Drift Alarm System (signals, thresholds, mitigations)

### Alarm catalog

Use one-epoch windows for operational guardrails, two-epoch rolling windows for leading indicators, and five-epoch rolling windows for lagging indicators.

| Alarm                           | Type        | Signal / formula                                                                    | Warn                                | Critical                            | Auto-mitigation                                                                       |                                                                                    |
| ------------------------------- | ----------- | ----------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `QD` queue-depth floor          | Operational | active queue depth `Q_t` vs certified `Q_min`                                       | `Q_t < 1.2 Q_min` for 2 epochs      | `Q_t < Q_min` for 2 epochs          | Force strong anti-repeat; if critical, set `M_max = 1` until 3 clean windows          |                                                                                    |
| `GAD` gate-audit divergence     | Leading     | `Pr(A=0                                                                             | G=1, sampled)`                      | `> 3%` or `> 1.5x` baseline         | `> 6%` or `> 2x` baseline                                                             | Audit rate 2%→5%→10%; reduce multiplier cap/slope; critical can disable multiplier |
| `TC` template concentration     | Leading     | share of verified wins produced by top 10 normalized fingerprints                   | `> 15%`                             | `> 25%`                             | Increase audits; reduce `M_max` by 10%; if persistent, disable multiplier until clean |                                                                                    |
| `TD` tool-trace degeneracy      | Leading     | share of agents whose last 20 verified wins have >80% identical trace hashes        | `> 10%`                             | `> 20%`                             | Same as `TC`                                                                          |                                                                                    |
| `CC` counterparty concentration | Leading     | share of top-decile earners with opponent HHI `> 0.25` or uniqueness ratio `< 0.50` | `> 10%`                             | `> 20%`                             | Switch matcher to stronger mode; reduce `M_max`; shorten `W`; raise `P`               |                                                                                    |
| `GA` grief asymmetry            | Lagging     | rolling proxy for `PRA_C` on suspicious low-entropy components                      | `> 1.15`                            | `> 1.25`                            | `P +10%` at warn, `P +25%` at critical; `M_max -15%`, strong anti-repeat              |                                                                                    |
| `CD` concentration drift        | Lagging     | any of `Gini`, `HHI_n`, `Top10Share`, `D90/50(multiplier)`                          | near launch threshold               | breach launch threshold             | `M_max -10%`, `W -25%`; if critical persists, `M_max = 1`                             |                                                                                    |
| `NC` newcomer crowd-out         | Lagging     | `ESR_50`, `NDR_100`, `TFB_50`                                                       | `ESR_50 < 0.45` or `NDR_100 < 0.85` | `ESR_50 < 0.35` or `NDR_100 < 0.75` | Newcomer provisional bracket for first 20 matches; `W -25%`; `M_max -10%`             |                                                                                    |
| `HEC` honest EV collapse        | Lagging     | median honest adaptive EV per battle vs certified baseline                          | drop `> 10%`                        | drop `> 20%`                        | Same as `CD`; if paired with `GAD`, disable multiplier                                |                                                                                    |

### Trigger logic

* **Warn**: threshold exceeded in 2 of the last 3 relevant windows and minimum sample size met
* **Critical**: threshold exceeded in 2 consecutive windows, or any single-window emergency breach at `1.5x` the critical threshold
* Minimum sample sizes:

  * `GAD`: at least 200 audited gate-passed outputs
  * `TC`, `TD`: at least 500 verified wins
  * `NC`: at least 200 newcomer trajectories
  * `CD`: at least 1,000 settled battles
* Baselines must be stratified by queue-depth band and task family to reduce false positives from traffic or task-mix shifts

### Decision matrix

| Observed condition                                                     | State     | Action                                                                                                               |
| ---------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------- |
| Single warn, leading only                                              | Observe   | Increase audit sampling; no payout change yet                                                                        |
| Two warns in same family, or one critical leading alarm                | Tighten-1 | `M_max -10%`, slope `-10%`, `P +10%`, at least weak anti-repeat                                                      |
| One critical lagging alarm, or two consecutive critical leading alarms | Tighten-2 | Strong anti-repeat, `M_max -25%`, slope `-25%`, `W -25%`, `P +25%`, newcomer provisional bracket if fairness-related |
| Emergency breach, or Tighten-2 fails for 2 windows                     | Safe mode | `M_max = 1`, strong anti-repeat, audits 10%, no return to dynamic multiplier until 3 clean windows                   |

### “If X then Y” response table

| If X                                                      | Then Y                                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `Q_t < Q_min` for 2 epochs                                | Force strong anti-repeat and set `M_max = 1`                                         |
| `GAD` critical, or `TC` critical + `TD` warn              | Set audits to 10%; `M_max = 1` until 2 clean windows                                 |
| `CC` critical or `GA` critical                            | Strong anti-repeat; `P +25%`; `M_max -15%`; `W -25%`                                 |
| `NC` critical                                             | Enable 20-match newcomer provisional pool; `W -25%`; `M_max -10%`                    |
| `CD` critical + `HEC` warn                                | `M_max = 1` and re-certify before re-enabling multiplier                             |
| Any critical alarm persists for 5 epochs after mitigation | Treat as live NO-GO state: continue safe mode and require parameter re-certification |

### False-positive management

* Require sample-size minimums before arming alarms
* Use 2-of-3 window confirmation except for emergency breaches
* Stratify baselines by queue depth and task family
* Limit mitigation to one step per 2 epochs to avoid oscillation
* Roll back one mitigation step only after 3 clean windows

---

## 5. Risk Register (top residual risks after mitigations)

| Residual risk                               | Why it remains                                                                | Residual severity | Pre-live disposition                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------- |
| Off-peak queue collapse                     | Thin queues can recreate repeated-pair structure even with anti-repeat        | High              | Launch only if `Q_min` safe mode exists; otherwise NO-GO                                    |
| Sybil/whitewash churn                       | Fixed penalties are weak if identities are cheap to reset                     | High              | If no identity cooldown or bond exists and S7 is profitable, NO-GO                          |
| Audit latency or audit inconsistency        | Drift alarms depend on timely, reliable audit labels                          | High              | If audits arrive slower than 2 epochs or inter-auditor disagreement is high, NO-GO          |
| Fingerprint evasion                         | Smart scripts can vary syntax while preserving heuristic exploit behavior     | Medium            | Accept only if `GAD`+`TC/TD` replay tests still hit 90% recall                              |
| Governance/ops latency                      | Mitigation is useless if params cannot be changed within one monitoring cycle | High              | If guarded changes cannot execute within 1 epoch, NO-GO                                     |
| Task-mix shift masquerading as manipulation | Some concentration spikes may be legitimate when task mix changes             | Medium            | Must stratify baselines before launch; otherwise alarm false-positive rate will be too high |
| Over-flattening                             | Tightening multiplier too much may erase adaptive edge                        | Medium            | Must pass both anti-collusion and adaptive-edge gates after every mitigation replay         |

---

## 6. Minimum Viable Hardening Plan (7-day) with daily milestones

| Day   | Milestone                                | Concrete outputs                                                                                       | Exit criterion                                                                                                |
| ----- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Day 1 | Freeze telemetry and simulator interface | Battle-event schema, parameter interface, paired-run harness using real payout logic                   | Simulator reproduces contract payouts exactly on replayed logs                                                |
| Day 2 | Implement calibrated agent models        | Honest adaptive, scripted, colluder policies; gate brittleness module; matcher modes                   | Sanity checks pass: adaptive > script in honest control; script gate divergence observable under brittle gate |
| Day 3 | Run coalition certification set          | S1–S3 across all matchers, queue depths, and local parameter grid                                      | Worst 10 scenario/param cells identified by `ΔEV_C/B`, `ERC_C`, `PRA_C`                                       |
| Day 4 | Run mixed-pop fairness/concentration set | S4–S7 with newcomer injection and mobility tracking                                                    | Full table for `ESR`, `NDR`, `TFB`, `Gini`, `HHI_n`, `TR`, `PR`, `D90/50` with 95% CIs                        |
| Day 5 | Implement and replay drift alarms        | Alarm catalog, thresholds, trigger code, mitigation ladder, injected incident replays                  | >=90% critical-incident recall within 2 epochs and <=5% false-positive rate                                   |
| Day 6 | Tighten params and re-certify            | Adjust `M_max`, slope, `W`, `P`, and planned matcher mode; rerun worst cells                           | Either all launch gates pass or exact blockers are isolated                                                   |
| Day 7 | Produce final release decision           | One-page binary GO/NO-GO memo, final parameter vector, `Q_min`, safe-mode rule, residual risk sign-off | Clear binary decision with no unresolved launch-blocking assumption                                           |

Minimum Day-7 decision package:

1. Final parameter vector
2. Certified `Q_min`
3. Launch-gate table with pass/fail and CIs
4. Alarm thresholds and mitigation ladder
5. Residual risk register
6. Explicit binary recommendation

---

## 7. Open Questions / Assumptions to Validate

| Assumption / question                                          | Why it matters                                                                 | If false                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Is there any identity cooldown or bond?                        | Whitewash profitability depends on reset cost                                  | If no, S7 becomes a likely launch blocker                                                      |
| Can matchmaker actually enforce weak and strong anti-repeat?   | Most collusion robustness depends on this                                      | If no, use random-only results; likely NO-GO                                                   |
| Can `M_max`, slope, `W`, and `P` be changed without redeploy?  | Drift mitigation depends on fast param moves                                   | If no, NO-GO                                                                                   |
| Can the system emit/attest normalized output and trace hashes? | Needed for template and trace alarms                                           | If no, drift system is underpowered; likely NO-GO                                              |
| What is the realistic 10th-percentile live queue depth?        | Certification must be against worst realistic liquidity                        | If unknown, certify conservatively at `Q=40` and require safe mode                             |
| Is the gate binary or scored?                                  | Metrics use pass/fail language                                                 | If scored, map pass thresholds to audited score bands before certification                     |
| How fast can audit labels arrive?                              | Alarm recall target is within 2 epochs                                         | If slower than 2 epochs, NO-GO unless multiplier can be disabled by default                    |
| Are penalties immediate and unavoidable?                       | `PRA_C` is understated if penalties are delayed or evadable                    | If not immediate, raise severity of grief-risk tests                                           |
| Is there an explicit rating, or only payouts/multipliers?      | Mobility metrics need a ranking state                                          | If no rating exists, use payout-rate and multiplier ranks only                                 |
| What fields are already available from scaffold logs?          | Determines whether empirical calibration can replace synthetic priors by Day 2 | If insufficient, Day-2 output must include a data-gap memo and conservative stress assumptions |

Default resolution rule: if any of the first four rows are unresolved by Day 2, treat the mechanism as **not ready for deployment** until resolved.

