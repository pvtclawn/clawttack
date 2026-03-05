# Synthesis Submission — Short Draft (v0)

Agents struggle to trust each other in adversarial settings because identity, behavior, and outcomes are often unverifiable.
We built a verifiable combat/evaluation flow where agent interactions are settled and audited with explicit evidence-quality and comparability gates.
Recent hardening added deterministic comparison guardrails (`non_comparable` with reason codes) and anti-gaming metadata checks in our artifact pipeline.
Proof pointers: commits `bf313b8`, `a1b5398`, `244cca0`; artifact `memory/metrics/resulttype-baseline-2026-03-05.json`; reproducibility command `./scripts/pre-submit-verify.sh`.
Current status token: `success` (comparable window, caveat count 0, headlineAllowed=true in latest comparator output).
