#!/usr/bin/env bash
set -euo pipefail

ARENA="${ARENA:-0xe090C149A5990E1F7F3C32faf0beA05F9a5ebdA3}"
RPC_URL="${RPC_URL:-https://sepolia.base.org}"
BATTLE="${1:-}"
AGENT_ID="${2:-}"
KEY_FILE="${3:-/tmp/batch_opponent_key}"
SDK_DIR="/home/clawn/.openclaw/workspace/projects/clawttack/packages/sdk"

if [[ -z "${BATTLE}" || -z "${AGENT_ID}" ]]; then
  echo "usage: $0 <battleAddress> <agentId> [keyFile]"
  exit 2
fi

if [[ ! -f "${KEY_FILE}" ]]; then
  echo "[fail] key file not found: ${KEY_FILE}"
  exit 1
fi

cd "$SDK_DIR"
export ARENA RPC_URL BATTLE AGENT_ID KEY_FILE

bun -e '
import { ethers } from "ethers";
import { readFileSync } from "fs";

const p = new ethers.JsonRpcProvider(process.env.RPC_URL!);
const key = readFileSync(process.env.KEY_FILE!, "utf8").trim();
const signer = new ethers.Wallet(key, p);
const arena = new ethers.Contract(process.env.ARENA!, [
  "function agents(uint256) view returns (address owner,uint32,uint32,uint32)"
], p);
const battle = new ethers.Contract(process.env.BATTLE!, [
  "function phase() view returns (uint8)",
  "function challengerId() view returns (uint256)"
], p);

const agentId = BigInt(process.env.AGENT_ID!);
const [agent, phase, challengerId] = await Promise.all([
  arena.agents(agentId),
  battle.phase(),
  battle.challengerId()
]);

const owner = String(agent.owner).toLowerCase();
const signerAddr = signer.address.toLowerCase();
const checks = {
  openPhase: Number(phase) === 0,
  ownerMatch: owner === signerAddr,
  notSelf: BigInt(challengerId) !== agentId
};

if (!checks.openPhase) {
  console.log(`[fail] battle not open: phase=${phase}`);
  process.exit(1);
}
if (!checks.ownerMatch) {
  console.log(`[fail] owner mismatch: agentOwner=${agent.owner} signer=${signer.address}`);
  process.exit(1);
}
if (!checks.notSelf) {
  console.log(`[fail] self-accept blocked: challengerId=${challengerId} agentId=${agentId}`);
  process.exit(1);
}

console.log(`[pass] accept preflight ok for battle ${process.env.BATTLE} agent ${agentId} signer ${signer.address}`);
'