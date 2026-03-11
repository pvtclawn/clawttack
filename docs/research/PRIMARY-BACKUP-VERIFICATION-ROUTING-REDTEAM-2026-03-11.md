# Primary/Backup Verification Routing Red Team (2026-03-11)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Focus challenged
- `docs/model/114-PRIMARY-BACKUP-VERIFICATION-ROUTING-PLAN-2026-03-11.md`

## Why this might fail
The routing layer is a necessary extension of escalation, but it becomes a new optimization target. Attackers can try to manipulate **which route** the system chooses: cheap primary, deeper backup, budget-exhausted fallback, or fail-closed.

## Weaknesses identified
### 1. Budget-drain abuse
Attackers can keep cases barely salvageable so the system repeatedly sends them to the backup path.

**Risk:** backup verification capacity is consumed by adversarially shaped uncertainty rather than by genuinely valuable difficult cases.

### 2. Backup-path farming
If backup verification is more permissive, more informative, or otherwise more attractive, attackers will learn to target it deliberately.

**Risk:** ambiguity becomes a ticket to the "better" route instead of a diagnostic liability.

### 3. Forced fail-closed routing
If routing-level fail-closed triggers are too permissive, attackers can combine budget scarcity and risk bits to force unnecessary shutdown behavior.

**Risk:** routing protection becomes a denial-of-service primitive.

### 4. Shared-budget starvation
Coarse shared budgets let one actor/context starve unrelated cases of backup verification capacity.

**Risk:** fairness collapses and unrelated honest cases get pushed into budget-exhausted or degraded outcomes.

### 5. Routing-artifact opacity
If artifacts only preserve the chosen route, later consumers lose visibility into budget state, debt context, and why the route was selected.

**Risk:** routing attacks become hard to audit and tune.

## Proposed mitigation directions
1. **Per-actor / per-context budget partitioning**
   - avoid one noisy source draining the entire backup pool.

2. **Backup-path anti-reward guard**
   - keep backup verification from becoming a strategically attractive route.

3. **Routing-level fail-closed admissibility**
   - distinguish hostile risk from ordinary budget exhaustion.

4. **Budget/debt-aware route trace**
   - preserve route rationale, budget state, and debt state in the artifact.

5. **Graceful budget exhaustion semantics**
   - prefer explicit `budget-exhausted` for non-hostile scarcity instead of collapsing into fail-closed.

## Concrete next tasks
### Task 1 — Budget-partition + route-trace support
Acceptance criteria:
- backup-budget farming fixture preserves per-actor/context budget state,
- artifact preserves route rationale + budget/debt trace.

### Task 2 — Backup-path anti-reward guard
Acceptance criteria:
- strategically ambiguous case does not receive a systematically better route than a clean case,
- backup-path attractiveness exploitation fixture is downgraded or rate-limited.

### Task 3 — Routing fail-closed admissibility guard
Acceptance criteria:
- non-hostile budget exhaustion yields `budget-exhausted`,
- hostile contradiction/version-risk + budget stress fixture yields fail-closed only with stronger evidence.

## Non-overclaim caveat
This red-team pass does **not** show the routing direction is wrong. It shows that without budget partitioning, anti-reward guards, fail-closed admissibility, and richer route traces, the system may evolve from **controller gaming** into **routing gaming**.
