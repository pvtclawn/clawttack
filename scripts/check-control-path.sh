#!/usr/bin/env bash
set -euo pipefail

JR_CONTAINER_NAME="${JR_CONTAINER_NAME:-clawnjr}"

echo "[control-preflight] checking local Docker socket access..."
if docker ps >/dev/null 2>&1; then
  echo "[ok] docker socket reachable"
else
  echo "[fail] docker socket not reachable for current user"
  exit 1
fi

echo "[control-preflight] checking Jr container existence: ${JR_CONTAINER_NAME}"
if docker ps --format '{{.Names}}' | grep -qx "${JR_CONTAINER_NAME}"; then
  echo "[ok] Jr container is running"
else
  echo "[fail] Jr container '${JR_CONTAINER_NAME}' not running"
  exit 1
fi

echo "[control-preflight] checking shell access in Jr container"
if docker exec "${JR_CONTAINER_NAME}" bash -lc 'echo jr-shell-ok' >/dev/null 2>&1; then
  echo "[ok] Jr container shell reachable"
else
  echo "[fail] cannot exec into Jr container"
  exit 1
fi

echo "[pass] control path verified: docker:${JR_CONTAINER_NAME}"
