# Red-Team — v05 proper-battle rubric (2026-03-15 00:35 UTC)

## Trigger
Lane F critique after:
- `projects/clawttack/docs/research/DECISION-GUIDANCE-V05-PROPER-BATTLE-RUBRIC-APPLICATION-2026-03-15-0030.md`

## Main weaknesses identified

### 1. “Transcript legibility” is still too subjective
The rubric currently asks whether the transcript is “legible and authentic enough,” with examples like “no obvious seed-word slurry” and “no obvious template/fallback masquerade.”

**Why this is dangerous:**
- a motivated evaluator can round up a weak transcript,
- different evaluators can disagree while all believing they are being honest,
- and the project may accidentally reward polished nonsense over strategically meaningful play.

**Required mitigation:**
- split legibility into narrower checks such as:
  - contains a coherent scene/action,
  - avoids obvious repeated boilerplate,
  - does not visibly violate the seed/poison constraints,
  - is not dominated by filler phrases.

---

### 2. Source-of-move truth still does not equal authorship proof
The artifact path can now label sides as `gateway-agent`, `local-script`, or `docker-agent`, which is good — but labels alone do not prove hidden helper/fallback influence is absent.

**Why this is dangerous:**
- the rubric could over-reward declared mode instead of evidenced causality,
- “agent-vs-agent” could still be softer than it sounds if fallback/shim behavior is not surfaced.

**Required mitigation:**
- make the rubric say “source-of-move truth is explicit” but avoid treating that as full proof of autonomous purity.
- keep authenticity language narrow and caveated.

---

### 3. Terminal state can become a misleading prestige shortcut
The rubric rightly prefers terminal outcomes, but terminality alone can be overvalued.

**Why this is dangerous:**
- a terminal battle can still be dull, low-signal, or strategically fake,
- the system may optimize for easy termination rather than meaningful agent combat,
- and evaluators may use terminality as a proxy for battle quality.

**Required mitigation:**
- do not let `gameplayOutcome=terminal` substitute for transcript/authenticity checks.
- terminal should be necessary or strongly preferred, not sufficient.

---

### 4. Non-terminal runs may still contain high-value evidence
The current guidance says non-terminal runs remain exploratory, which is correct — but if that category is too broad, genuinely useful progress may get visually buried.

**Why this is dangerous:**
- the artifact system can become binary in a way that hides meaningful intermediate wins,
- which may push operators to overclaim terminal-looking runs instead of honestly valuing partial progress.

**Required mitigation:**
- preserve a strong “exploratory but high-value” path for non-terminal runs that clear most rubric checks except settlement.

---

### 5. Summary prose can still quietly override the rubric
Even with explicit fields, a human-facing summary line can still smuggle in the real verdict if the rubric is not explicit enough.

**Why this is dangerous:**
- “looks basically proper” is exactly the type of drift the new classification work was meant to stop,
- and operator enthusiasm can leak back in through prose even if the JSON says otherwise.

**Required mitigation:**
- derive the final human-facing verdict directly from explicit rubric reasons.
- make the summary sentence reflect the artifact state, not improvise beyond it.

## Strongest critique summary
The minimal rubric is directionally correct, but it still risks false confidence through:
1. subjective legibility judgments,
2. over-reading source labels as authorship proof,
3. over-valuing terminality,
4. under-valuing strong exploratory evidence,
5. and allowing prose summaries to outrun the structured verdict.

## Best next fixes called out
1. tighten legibility/authenticity into narrower observable checks,
2. keep source-of-move truth explicit but caveated,
3. ensure terminal state is not sufficient by itself,
4. preserve an “exploratory but high-value” path,
5. derive operator verdict text from explicit rubric reasons.

## What this critique does **not** say
- It does **not** argue against implementing the rubric.
- It does **not** say the rubric should be looser.
- It says the rubric should become stricter where it is subjective and more expressive where evidence is partial.

## On-chain classification
- No new tx justified for this challenge lane.
- This lane improves the honesty of the next rubric implementation; it does not itself create a new gameplay artifact.
