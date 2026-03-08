# Branch Review Judgment Template

Use this template when giving a merge/no-merge judgment on a branch or PR.

## Required fields

```yaml
reviewedRef: <commit sha / fetched ref>
judgmentType: prHead | mergeCandidate
reviewScope:
  - runtimeConsumers
  - docs
  - typecheck
  - tests
  - ciStatus
  - mergeState
codeImpact: none | unknown | changed
mechanismImpact: none | unknown | changed
semanticConfidence: low | medium | high
invalidatedPriorBlockers:
  - <previous blocker no longer present on reviewedRef>
remainingCurrentBlockers:
  - <blocker still present on reviewedRef>
envNoise:
  - <local/dependency/tooling issue not proven to be branch-state>
notChecked:
  - <areas not reviewed>
```

## Rules

1. **Always pin the exact reviewed ref.**
   Never give a merge judgment against an unpinned local impression.

2. **Always declare scope.**
   `reviewedRef` without `reviewScope` is incomplete and can overstate confidence.

3. **Invalidate stale blockers explicitly.**
   If a previously cited blocker is gone on the reviewed ref, list it under `invalidatedPriorBlockers`.

4. **Separate branch-state from environment-state.**
   If a failure may be local/dependency noise, put it under `envNoise` until proven otherwise.

5. **Distinguish PR head from merge candidate.**
   A `prHead` approval is not automatically a `mergeCandidate` approval.

6. **State code/mechanism impact explicitly.**
   If the review artifact or process improved but the underlying code/mechanism did not, say `codeImpact: none` and `mechanismImpact: none`.

7. **Scope-qualify the verdict.**
   If review coverage is partial, the headline judgment must say so (for example: `mergeable at prHead/runtime+typecheck scope`). Avoid unqualified global `mergeable` when scope is limited.

8. **Use `notChecked` as a real disclosure, not a decorative field.**
   If meaningful areas were not checked, say so plainly. Empty `notChecked` on a partial review is a governance defect.

9. **Freshness is not semantic certainty.**
   `semanticConfidence` exists so a fresh ref review can still admit limited confidence about deeper correctness.

10. **Lead with evidence state, not confidence language.**
   In summaries and verdict rationale, say what the reviewed ref actually shows first (current blockers, invalidated blockers, pass/fail state). Confidence labels and caveats come after the evidence state.

11. **Keep confidence language subordinate and short.**
   Confidence/uncertainty wording should be brief and must not outgrow the evidence-state sentence it qualifies.

12. **Mention governance/review improvements only after branch/evidence state is clear.**
   Review-process quality, template quality, or governance rigor belongs after the branch-state and impact state are established.

13. **Opening evidence sentence must be concrete.**
   The first summary sentence must name actual current blockers, invalidated blockers, pass/fail state, or measured branch state. Vague openings like `things look better now` or `overall state is improved` are not acceptable.

14. **Opening evidence sentence must be non-spinny.**
   The first sentence should describe state, not celebrate it. Avoid flattering wording like `strongly improved`, `solid`, `clean`, or `healthy` unless that state is explicitly evidenced and relevant.

15. **Avoid ungrounded severity adjectives.**
   Do not call remaining issues `minor`, `small`, `light`, `clean`, or similar unless severity is directly supported by the checked scope. Prefer naming the blockers instead of characterizing them.

16. **Lead with the most relevant/top-line evidence for the judgment being made.**
   If a narrower slice is mentioned first, the summary must make clear why that slice is the correct lens. Do not front-load a favorable subgroup when the top-line state is the real merge-relevant signal.

17. **Use symmetric specificity for cleared vs remaining blockers.**
   If invalidated blockers are named concretely, remaining blockers should be named with comparable specificity rather than collapsed into vague residue like `some cleanup remains`.

18. **The opening sentence must earn its place.**
   If removing the first sentence would not materially change the merge judgment, it is probably too vague or ceremonial.

## Scope-qualified verdict examples

**Acceptable:**
- `mergeable at prHead/runtime+typecheck scope`
- `not mergeable at mergeCandidate/docs+tests scope`
- `mergeable with caveats at prHead/runtimeConsumers scope`

**Unacceptable when scope is partial:**
- `mergeable`
- `safe to merge`
- `looks good to me`

## Plain-English summary order

Always order summary content like this:
1. **current branch/evidence state**
2. **impact limits** (`codeImpact` / `mechanismImpact` when relevant)
3. **confidence / caveats / env noise**
4. **review-governance or process nuance**

### Good opening sentence shapes
- `Runtime blockers on 56341e3 are cleared; remaining issues are doc drift in CHANGELOG.md and docs/SKILL.md plus local env noise.`
- `Typecheck passes on 56341e3; branch-state failures observed in checked scope are limited to active doc drift.`
- `The reviewed ref still contains active doc drift in CHANGELOG.md and docs/SKILL.md.`

### Bad opening sentence shapes
- `Things look much better now.`
- `This is in a strong place.`
- `Overall state is improved.`
- `The branch is pretty healthy.`
- `Only minor issues remain.`
- `Most blockers are gone and there’s just a bit of cleanup left.`

### Good summary shape
- `Current state: runtime blockers on 56341e3 are cleared; remaining issues are doc drift in CHANGELOG.md and docs/SKILL.md plus local env noise.`
- `Impact: code changed. Mechanism impact: none.`
- `Confidence/caveats: medium confidence because merge-candidate state was not checked.`

### Bad summary shape
- `With medium confidence and improved review rigor, this looks basically mergeable...`
- `This seems fairly safe, though not fully checked, and runtime blockers appear gone...`

## Decision-utility check for opening sentence

Before finalizing a review summary, ask:
- Does the first sentence tell the reader **what matters now** on this ref?
- Would removing it materially reduce decision quality?
- Does it name both the cleared and remaining blocker classes with comparable specificity when relevant?

If the answer is no, rewrite it.

## Compact review template

```md
## Branch Review Judgment

- reviewedRef: <sha>
- judgmentType: <prHead|mergeCandidate>
- reviewScope:
  - <scope item>
- codeImpact: <none|unknown|changed>
- mechanismImpact: <none|unknown|changed>
- semanticConfidence: <low|medium|high>
- invalidatedPriorBlockers:
  - <item>
- remainingCurrentBlockers:
  - <item>
- envNoise:
  - <item>
- notChecked:
  - <item>

### Judgment
- <scope-qualified mergeable / not mergeable / mergeable with caveats>

### Plain-English summary
- Current state: <concrete current blockers / invalidated blockers / pass-fail state on the reviewed ref>.
- Impact: code <none|unknown|changed>; mechanism <none|unknown|changed>.
- Confidence/caveats: <short caveat sentence, if needed>.

### Rationale
- <1–3 bullets tied only to reviewedRef + declared scope>
```

## Example — stale review corrected by live head

```md
## Branch Review Judgment

- reviewedRef: 56341e3
- judgmentType: prHead
- reviewScope:
  - runtimeConsumers
  - docs
  - typecheck
  - tests
- codeImpact: changed
- mechanismImpact: none
- semanticConfidence: medium
- invalidatedPriorBlockers:
  - `useChain.ts` still using stale `BattleV4Created`
  - active scripts still calling `createBattleV4`
  - stale test name `requiresV4Impl`
- remainingCurrentBlockers:
  - active doc drift in `CHANGELOG.md` and `docs/SKILL.md`
  - active script naming drift in `packages/sdk/scripts/fight.ts` (`V4Fighter` import)
- envNoise:
  - `bun test --bail` failing on missing `ethers` in local test env
- notChecked:
  - merge-candidate state against latest base

### Judgment
- mergeable with caveats at prHead/runtimeConsumers+docs+typecheck+tests scope

### Plain-English summary
- Current state: original runtime blockers are gone on 56341e3; remaining checked issues are active doc drift in CHANGELOG.md and docs/SKILL.md, active script naming drift in packages/sdk/scripts/fight.ts, plus local env noise.
- Impact: code changed; mechanism none.
- Confidence/caveats: medium confidence because merge-candidate state against latest base was not checked.

### Rationale
- Original runtime blockers are no longer present on the reviewed ref.
- Remaining issues are narrower and mostly naming/doc drift.
- Test red signal appears environment-scoped rather than proven branch regression.
```

## Anti-prestige reminders

- A more disciplined review template improves **judgment quality**, not code quality.
- Fresh ref + structured fields does not imply deep semantic review.
- Governance/review artifacts should not be narrated as mechanism progress unless outcome evidence changes.
- Better confidence language should make claims smaller and clearer, not more impressive.
