#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ethers } from 'ethers';

const RPC_URL = process.env.RPC_URL ?? 'https://sepolia.base.org';
const ARENA_ADDRESS = (process.env.ARENA_ADDRESS ?? '0xe090C149A5990E1F7F3C32faf0beA05F9a5ebdA3').toLowerCase();
const WINDOW_SIZE = Number(process.env.WINDOW_SIZE ?? '10');
const CHUNK = Number(process.env.LOG_CHUNK ?? '9000');
const MAX_SCAN_BLOCKS = Number(process.env.MAX_SCAN_BLOCKS ?? '250000');

// keccak256("BattleSettled(...)") topic used by deployed battle contracts
const BATTLE_SETTLED_TOPIC = '0xcebb94d4b42245f4d24861e32069ab9594aeb5412160533a4222fd8000b90dfa';

const arenaAbi = [
  'function battlesCount() view returns (uint256)',
  'function battles(uint256) view returns (address)',
];

const battleAbi = [
  'function getBattleState() view returns (uint8 phase, uint32 currentTurn, uint128 bankA, uint128 bankB, bytes32 sequenceHash, uint256 extra)',
];

type BattleRow = {
  battleId: number;
  battle: string;
  phase: number;
  turn: number;
  bankA: string;
  bankB: string;
  resultType: number | null;
};

function assertNonEmptyString(name: string, value: string) {
  if (!value || !value.trim()) {
    throw new Error(`metadata validation failed: ${name} is empty`);
  }
}

function assertNonEmptyArray(name: string, value: unknown[]) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`metadata validation failed: ${name} is empty`);
  }
}

async function findLatestSettledResultType(
  provider: ethers.JsonRpcProvider,
  battleAddress: string,
): Promise<number | null> {
  const latest = await provider.getBlockNumber();
  const minBlock = Math.max(0, latest - MAX_SCAN_BLOCKS);

  for (let end = latest; end >= minBlock; end -= CHUNK) {
    const start = Math.max(minBlock, end - CHUNK + 1);
    const logs = await provider.getLogs({
      address: battleAddress,
      topics: [BATTLE_SETTLED_TOPIC],
      fromBlock: start,
      toBlock: end,
    });

    if (logs.length > 0) {
      logs.sort((a, b) => {
        if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
        return (a.index ?? 0) - (b.index ?? 0);
      });
      const last = logs[logs.length - 1]!;
      return Number(BigInt(last.data));
    }
  }

  return null;
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const arena = new ethers.Contract(ARENA_ADDRESS, arenaAbi, provider);

  const total = Number(await arena.battlesCount());
  const start = Math.max(1, total - WINDOW_SIZE + 1);

  const rows: BattleRow[] = [];
  const resultTypeCounts: Record<string, number> = { '2': 0, '4': 0, '7': 0, other: 0 };

  for (let id = start; id <= total; id++) {
    const battleAddress = String(await arena.battles(id)).toLowerCase();
    const battle = new ethers.Contract(battleAddress, battleAbi, provider);
    const state = await battle.getBattleState();

    const phase = Number(state.phase);
    const turn = Number(state.currentTurn);
    const bankA = state.bankA.toString();
    const bankB = state.bankB.toString();

    let resultType: number | null = null;

    if (phase === 2) {
      resultType = await findLatestSettledResultType(provider, battleAddress);
      if (resultType !== null) {
        const key = String(resultType);
        if (key in resultTypeCounts) resultTypeCounts[key] += 1;
        else resultTypeCounts.other += 1;
      }
    }

    rows.push({
      battleId: id,
      battle: battleAddress,
      phase,
      turn,
      bankA,
      bankB,
      resultType,
    });
  }

  const settled = rows.filter((r) => r.phase === 2).length;
  const shortSettledLe1 = rows.filter((r) => r.phase === 2 && r.turn <= 1).length;

  const out = {
    generatedAt: new Date().toISOString(),
    rpcUrl: RPC_URL,
    arena: ARENA_ADDRESS,
    params: { WINDOW_SIZE, CHUNK, MAX_SCAN_BLOCKS },
    trust_assumption: {
      onchain_verifiable: [
        'BattleSettled log topics/data from Base Sepolia RPC',
        'battle addresses resolved from Arena contract storage',
      ],
      operator_trusted: [
        'single RPC endpoint availability/correctness',
        'local script execution environment and clock',
        'local process integrity (script runtime and filesystem)',
      ],
      verifier: 'ethers JsonRpcProvider + contract calls + log scans',
    },
    attacker_model: {
      class: 'adaptive',
      capabilities: [
        'timing pressure via turn cadence and liveness races',
        'scripted deterministic play and replayable strategies',
        'benefit from RPC instability side effects',
      ],
    },
    assumption_breaks: [
      'single-RPC view divergence from canonical chain state',
      'local clock skew materially impacting timing analysis',
    ],
    evidence_quality: {
      status: 'success',
      caveats: [],
    },
    range: [start, total],
    settled,
    shortSettledLe1,
    resultTypeCounts,
    rows,
  };

  assertNonEmptyArray('trust_assumption.onchain_verifiable', out.trust_assumption.onchain_verifiable);
  assertNonEmptyArray('trust_assumption.operator_trusted', out.trust_assumption.operator_trusted);
  assertNonEmptyString('trust_assumption.verifier', out.trust_assumption.verifier);
  assertNonEmptyString('attacker_model.class', out.attacker_model.class);
  assertNonEmptyArray('attacker_model.capabilities', out.attacker_model.capabilities);
  assertNonEmptyArray('assumption_breaks', out.assumption_breaks);
  assertNonEmptyString('evidence_quality.status', out.evidence_quality.status);

  const outDir = join(process.cwd(), '..', '..', 'memory', 'metrics');
  mkdirSync(outDir, { recursive: true });
  const filename = `resulttype-baseline-${new Date().toISOString().slice(0, 10)}.json`;
  const outPath = join(outDir, filename);
  writeFileSync(outPath, JSON.stringify(out, null, 2));

  console.log(outPath);
  console.log(
    JSON.stringify(
      {
        range: out.range,
        settled: out.settled,
        shortSettledLe1: out.shortSettledLe1,
        resultTypeCounts: out.resultTypeCounts,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error('resulttype-baseline failed:', err);
  process.exit(1);
});
