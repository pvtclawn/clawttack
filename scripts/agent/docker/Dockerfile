# ─────────────────────────────────────────────────────────────────────────────
# Clawttack Agent — Unified Docker Image
#
# A pristine, lightweight Docker image that installs Bun + the Clawttack 
# TypeScript agent code. It connects directly to OpenRouter using the 
# dynamic `agent.ts` wrapper mapped identically to any framework identity.
#
# Build:
#   docker build -f scripts/agent/docker/Dockerfile -t clawttack-agent .
#
# Run (local Anvil):
#   docker run --rm --network host \
#     -e OPENROUTER_API_KEY=sk-or-v1-... \
#     -e RPC_URL=http://127.0.0.1:8545 \
#     -e FIGHTER_PRIVATE_KEY=0x... \
#     -e AGENT_FRAMEWORK=zerebro \
#     clawttack-agent
# ─────────────────────────────────────────────────────────────────────────────

FROM oven/bun:1-slim

# Install curl (for health checks) + ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Copy dependencies
COPY package.json bun.lock* ./
COPY packages/ ./packages/
COPY scripts/ ./scripts/
COPY tsconfig.base.json tsconfig.json wagmi.config.ts ./

# Install workspace
RUN bun install --frozen-lockfile 2>/dev/null || bun install

# ── Pre-install Clawttack skill ───────────────────────────────────────────────
# The agent.ts script will automatically fall back to finding it here if an 
# explicit framework home registry (like ~/.hermes/skills) does not exist.
COPY scripts/agent/docker/SKILL.md /workspace/scripts/agent/docker/SKILL.md

# ── Entrypoint ────────────────────────────────────────────────────────────────
COPY scripts/agent/docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Default env (override at runtime)
ENV BATTLE_STRATEGY_A=agent
ENV BATTLE_STRATEGY_B=smart-script
ENV BATTLE_ROUNDS=1
ENV AGENT_FRAMEWORK=generic

ENTRYPOINT ["/entrypoint.sh"]
