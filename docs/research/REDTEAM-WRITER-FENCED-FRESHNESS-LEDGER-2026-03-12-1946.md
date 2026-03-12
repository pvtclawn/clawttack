# Red-Team — Writer-Fenced Freshness Ledger Append Contract (2026-03-12 19:46 UTC)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Scope
Red-team the proposed writer-fenced append contract for the file-backed consumed-digest ledger.

## Proposed target
A freshness-ledger append path where a runtime instance may durably append consumed-digest state only if it holds the valid writer token/epoch for the relevant battle/run scope.

## Main question
Why might writer fencing still fail even if the append format, checksum, and restart recovery are already correct?

## Weakness 1 — Split-brain writer belief with stale local lock view
### Failure mode
Two runtime instances can both believe they are the legitimate writer if fencing authority is checked against stale local state instead of a current shared lock artifact.

### Exploit path
- writer A acquires scope ownership,
- writer B starts from stale snapshot / delayed lock view,
- both append authoritative consumed records under different beliefs,
- ledger history becomes internally well-formed but externally contradictory.

### Consequence
The log remains parseable, but append authority is no longer coherent. Replay history becomes a function of which writer’s state survived rather than one authoritative sequence.

### Mitigation
- evaluate fencing against a current shared lock artifact, not cached assumptions,
- bind each append to explicit `scopeKey`, `ownerId`, and `writerToken`/epoch,
- reject append when shared authority state is missing or stale.

### Acceptance criteria
1. append without current shared lock state fails closed,
2. append with wrong owner or stale token fails deterministically,
3. two writers with divergent local views cannot both pass against the same current authority artifact.

## Weakness 2 — Epoch regression / token rollback resurrects fenced writers
### Failure mode
If writer tokens are not monotonic and rollback-resistant, a previously fenced-off writer can regain append authority after recovery from an older snapshot.

### Exploit path
- writer token advances from `n` to `n+1`,
- old runtime snapshot or stale artifact still shows token `n`,
- recovered stale writer resumes and appends using regressed authority state.

### Consequence
Fencing stops being a real exclusion mechanism; it becomes advisory and reversible under rollback.

### Mitigation
- maintain a monotonic token floor / writer epoch,
- reject any append whose token is below the observed floor,
- ensure recovery loads the highest known valid epoch before append is possible.

### Acceptance criteria
1. token regression is detected deterministically,
2. stale epoch cannot re-authorize an old writer after restart,
3. recovery path loads authority floor before append evaluation.

## Weakness 3 — Append-after-fence race
### Failure mode
A writer can pass fencing, then lose authority, then still complete a durable append because append execution is not atomically tied to the fencing decision.

### Exploit path
- writer passes authority check,
- another writer fences it off immediately after,
- old writer continues to append based on the now-stale positive check,
- ledger records an entry from a writer that is no longer authoritative.

### Consequence
The contract appears fenced in theory but still admits stale-authority writes in practice.

### Mitigation
- couple authority proof and append as one contract boundary,
- include writer token in the durable record itself,
- on recovery or replay analysis, reject records that do not match the winning authority epoch for the scope.

### Acceptance criteria
1. durable record includes writer token/epoch,
2. stale writer append after fence-off is detectable as invalid history,
3. append contract does not separate “check authority” and “write authoritative record” into loosely related steps.

## Weakness 4 — Same digest across scope confusion
### Failure mode
A fencing system can still corrupt history if digest uniqueness is treated globally while writer authority is scoped per battle/run.

### Exploit path
- same digest shape appears under adjacent scope or reused test fixture,
- wrong writer with valid authority for one scope appends digest intended for another,
- ledger now contains consumed state under the wrong scope authority.

### Consequence
Replay denial can bleed across scopes or falsely poison unrelated execution paths.

### Mitigation
- bind ledger authority and consumed records to canonical scope key (`battleId`, `runId`, side / turn domain as needed),
- treat digest presence as meaningful only within the scoped authority boundary,
- make scope mismatch a hard append failure.

### Acceptance criteria
1. writer with authority for scope A cannot append consumed record for scope B,
2. same digest under different scopes cannot alias authority history,
3. append contract validates scope key before durable write.

## Weakness 5 — Failing open on missing authority artifact
### Failure mode
When lock state cannot be loaded (corruption, IO error, missing file), a convenience fallback may let the local runtime append “temporarily” to preserve liveness.

### Exploit path
- authority artifact unavailable,
- runtime assumes singleton / best-effort local ownership,
- append proceeds without verified fencing.

### Consequence
The most important failure mode converts into silent local optimism exactly when correctness matters most.

### Mitigation
- missing/corrupt authority state must fail closed,
- append is denied or sealed until authority artifact is restored,
- liveness recovery must be explicit, not implicit permissiveness.

### Acceptance criteria
1. missing authority artifact yields deterministic non-append outcome,
2. corrupt authority artifact yields deterministic non-append outcome,
3. no fallback path invents temporary local ownership.

## Bottom line
Writer fencing is the right direction, but only if treated as a **history-authority contract**, not a loose preflight check. The cheapest failure modes are:
1. split-brain due to stale lock view,
2. epoch/token regression after rollback,
3. append-after-fence race,
4. scope confusion under valid-but-wrong writer authority,
5. fail-open behavior on missing authority state.

## Recommended next build slice
Implement the smallest writer-fenced ledger append contract with:
- canonical `scopeKey`, `ownerId`, `writerToken`, and token floor,
- fail-closed authority loading,
- durable record embedding the writer token/epoch,
- deterministic rejection for stale token, scope mismatch, missing authority, and token regression,
- narrow tests for split-brain/stale-token/epoch-regression failure paths.

## Explicit caveat
This red-team artifact narrows the authority design surface but does not prove live multi-process correctness. It identifies the cheapest ways a seemingly fenced ledger can still admit contradictory authoritative history.
