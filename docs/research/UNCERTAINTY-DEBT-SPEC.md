# Uncertainty Debt Score — Spec v0

## Purpose
Quantify unresolved evidence uncertainty over time **without** replacing capped confidence penalties.

- Capped penalty answers: "How much confidence discount is applied now?"
- Uncertainty debt answers: "How long and how severely are unknowns remaining unresolved?"

## Severity Weights
- critical = 5
- major = 3
- minor = 1

## Age Buckets (days since createdAt)
- 0-2 days: factor 1
- 3-7 days: factor 2
- 8-14 days: factor 3
- 15+ days: factor 5

## Formula
For each unresolved unknown `u`:

`componentDebt(u) = severityWeight(u) * ageFactor(u)`

Total:

`uncertaintyDebtScore = Σ componentDebt(u)` for all unresolved unknowns (`open` or `in_progress`).

## Escalation Bands
- 0-9: normal
- 10-24: warn
- 25+: critical escalation

## Deterministic Rules
1. `createdAt` is immutable.
2. Age is floor(`(now - createdAt) / 86400`).
3. Resolved unknowns contribute 0.
4. Due-date edits do not reset age (age tied to createdAt).

## Worked Examples
### Example A
- U1 critical, 1 day old => 5 * 1 = 5
- U2 major, 4 days old => 3 * 2 = 6
- U3 minor, 10 days old => 1 * 3 = 3

Total debt = **14** (warn)

### Example B
- U1 critical, 16 days old => 5 * 5 = 25
- U2 major, 9 days old => 3 * 3 = 9

Total debt = **34** (critical)

### Example C
- U1 critical, 2 days old, resolved => 0
- U2 major, 1 day old, open => 3 * 1 = 3

Total debt = **3** (normal)

## Output Fields (target)
- uncertaintyDebtScore
- unresolvedUnknownCount
- debtBand (`normal|warn|critical`)
- escalationTriggered (true when debtBand=critical)
