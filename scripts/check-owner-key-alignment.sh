#!/usr/bin/env bash
set -euo pipefail

ARENA="${ARENA:-0xe090C149A5990E1F7F3C32faf0beA05F9a5ebdA3}"
RPC_URL="${RPC_URL:-https://sepolia.base.org}"
AGENT_ID="${1:-}"
KEY_FILE="${2:-/tmp/batch_opponent_key}"
SDK_DIR="/home/clawn/.openclaw/workspace/projects/clawttack/packages/sdk"

if [[ -z "${AGENT_ID}" ]]; then
  echo "usage: $0 <agentId> [keyFile]"
  exit 2
fi

if [[ ! -f "${KEY_FILE}" ]]; then
  echo "[fail] key file not found: ${KEY_FILE}"
  exit 1
fi

export ARENA RPC_URL AGENT_ID KEY_FILE

cd "$SDK_DIR"

RESULT="$(bun -e '
import { ethers } from "ethers";
import { readFileSync } from "fs";

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL!);
const key = readFileSync(process.env.KEY_FILE!, "utf-8").trim();
const wallet = new ethers.Wallet(key, provider);
const arena = new ethers.Contract(process.env.ARENA!, [
  "function agents(uint256) view returns (address owner,uint32 eloRating,uint32 totalWins,uint32 totalLosses)"
], provider);

const id = BigInt(process.env.AGENT_ID!);
const a = await arena.agents(id);
const owner = String(a.owner).toLowerCase();
const signer = wallet.address.toLowerCase();
const ok = owner === signer;
console.log(JSON.stringify({ ok, owner: a.owner, signer: wallet.address, agentId: process.env.AGENT_ID }));
')"

OK="$(echo "$RESULT" | bun -e 'const i=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(i.ok ? "1" : "0")')"
OWNER="$(echo "$RESULT" | bun -e 'const i=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(i.owner)')"
SIGNER="$(echo "$RESULT" | bun -e 'const i=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(i.signer)')"

if [[ "$OK" == "1" ]]; then
  echo "[pass] agent/key aligned: agent ${AGENT_ID} owner ${OWNER} == signer ${SIGNER}"
else
  echo "[fail] owner mismatch: agent ${AGENT_ID} owner ${OWNER} != signer ${SIGNER}"
  exit 1
fi
