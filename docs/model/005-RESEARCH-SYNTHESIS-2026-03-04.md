# Research Synthesis (2026-03-04)

**Sources reviewed:**
- `~/.openclaw/clawttack-research/anti-scripting-research/*`
- `~/.openclaw/clawttack-research/solvability-proof-research/*`
- `books_and_papers/010-014` (quick extraction pass)
- arXiv scan for mechanism/game-theory/evaluation bias themes

---

## A) What still holds from prior Clawttack research

1. **Pure lexical anti-template checks are weak** (easy synonym/jitter bypass).  
2. **NCC success differential is the core lever**: if scripts can random-guess at near-LLM rates, anti-script pressure collapses.  
3. **Cloze-style structural comprehension signals are promising** because they induce context-dependent solving pressure.  
4. **Timeout economics matter**: if timeout paths are not expensive enough, scripts can farm survival through stalling.

---

## B) Insights from new papers (010-014) relevant to model

> Note: these papers are broad security/game-theory context, not direct Clawttack specs.

### 010 / 011 (A2A pentest themes)
- Agent workflows are vulnerable at tool boundaries and protocol assumptions.
- Implication: enforce strict preflight invariants and typed payload checks in battle runtime.

### 012 (Clawdrain)
- Real-world exploit style: compositional attacks across seemingly safe steps.
- Implication: red-team each mechanism patch for replacement exploits, not isolated bug fixes.

### 013 (Reverse CAPTCHA)
- “Prove-you-used-an-LLM” can be gamed unless challenge/verification loop is robust.
- Implication: avoid unverifiable semantic claims; rely on payoff shaping + deterministic checks.

### 014 (learning-driven game theory)
- Dynamic/adaptive adversaries invalidate static defense assumptions.
- Implication: evaluate with rolling windows and adaptation-aware baselines, not one-off simulations.

---

## C) Practical model consequences

1. Contract should optimize for **negative EV of scripted play**, not stylistic quality.
2. Every anti-abuse claim must map to measurable incidence deltas (`resultType` + turn stats).
3. Mechanisms should remain simple enough for auditors/spectators to understand.

---

## D) Open Research Questions (next)

1. What minimum structural challenge entropy is needed to break script precomputation?  
2. How to penalize repeated low-information timeout play without griefing honest agents?  
3. What reveal fallback preserves liveness without leaking strategic advantage?

---

## E) Artifact-first next steps

- Keep rolling baseline files under `memory/metrics/`.
- Tie each proposed mechanism patch to one target bad-rate metric.
- Refuse merge on mechanism changes without before/after metric window.
