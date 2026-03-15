# V05 completion-boundary observability gap — research guidance (2026-03-15 11:22 UTC)

## Question
What is the narrowest research conclusion about why recent agent-vs-agent runs remain "unsettled" in artifacts despite real multi-turn live execution?

## Key finding
The current completion verdict is mediated by **artifact observability**, not only by gameplay progress.

In `packages/sdk/scripts/summarize-v05-batches.py`:
- `accepted = 'Accepted battle' in log_text`
- `settledHint = any(token in log_text.lower() for token in ('settled', 'winner', 'resulttype'))`
- `settlementObserved = out['settled']`
- `acceptedBattleCount` and `settlementObservedCount` are then aggregated from those derived fields.

That means the present "0 accepted / 0 settled / unsettledShare=1.0" status can arise from at least two different realities:
1. **true gameplay non-completion** — accept/settlement never actually happened,
2. **completion observability failure** — the battle may have crossed a late boundary, but the runner/log path never emitted the tokens the summarizer requires.

## Why this matters
Recent verification already established:
- repeated multi-turn live activity is real,
- parser contamination is no longer the immediate blocker on the tested gateway path,
- latest strict summaries still show `acceptedBattleCount=0` and `settlementObservedCount=0`.

So the next highest-value question is **not** "does the runner move at all?" — that part is already materially better.
The sharper question is:

> Where exactly is completion evidence being lost: before accept, before settlement, or only before settlement logging/classification?

## Supporting signals from prior artifacts
1. **Parser path improved, but settlement remained unproven**
   - `RELIABILITY-STATUS-V05-GATEWAY-PARSER-STRICT-SMOKE-2026-03-14-2354.md`
   - Conclusion there was already narrow: repeated mined turns, not settlement proof.

2. **Earlier red-team pointed at interface/runner boundary drift, not pure mechanism failure**
   - `REDTEAM-V05-INTERVENTION-OUTCOME-PENDINGVOPB-2026-03-14-1627.md`
   - This reinforced that some missing end-state evidence can come from boundary classification/decoding problems.

3. **Current summarizer contract is log-token dependent**
   - Acceptance and settlement are presently inferred from log text, not independently re-derived from on-chain terminal state.

## Most likely boundary buckets
### Bucket A — accept never happened
Signals:
- no `Accepted battle` token,
- no accept-state advancement in logs,
- battle remains pre-accept on-chain.

### Bucket B — accept happened, settlement never happened
Signals:
- accept evidence exists,
- multi-turn progression exists,
- no terminal state / timeout resolution observed on-chain.

### Bucket C — settlement happened, but artifact capture missed it
Signals:
- on-chain battle phase/result is terminal,
- but runner logs do not include `settled`/`winner`/`resulttype` tokens,
- summarizer therefore marks the run unsettled even though chain truth says otherwise.

## Research conclusion
**The narrowest missing boundary is completion observability, not generic liveness.**

That does not mean settlement is definitely working. It means the next run should be instrumented to distinguish:
- real non-completion,
- accept-gap,
- settlement-gap,
- or end-state logging/classification gap.

## Actionable insights
1. **For the next one-battle run, treat on-chain terminal-state capture as first-class evidence.**
   - Do not rely only on runner log keywords for completion classification.

2. **Capture accept and terminal checkpoints as separate milestones.**
   - "Created" → "Accepted" → "Multi-turn" → "Terminal/timeout" should be explicit, not inferred from one final summary.

3. **If the chain says terminal but artifacts say unsettled, prioritize observability patching over mechanism surgery.**
   - That is a much smaller and higher-confidence next fix than broad gameplay refactoring.

## Smallest next step
For the next controlled one-battle run, produce an artifact that records:
- battle address / id,
- whether accept was observed on-chain,
- whether terminal phase/result was observed on-chain,
- whether the runner log emitted accept tokens,
- whether the runner log emitted settlement tokens,
- and the first boundary where chain truth and artifact truth diverge.

## Posting decision
No public post justified from this lane alone.

## Bottom line
The current evidence gap is best described as:

> multi-turn agent-vs-agent liveness is real, but completion is still unproven because acceptance/settlement are currently judged through a log-token observability layer that may itself be the missing boundary.
