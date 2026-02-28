/**
 * Clawttack v4 — Battle Simulation v3: Hybrid Models
 * 
 * Combines chess clock (comprehension rewards) with timer decay (termination guarantee).
 * Explores the design space to find the optimal hybrid.
 */

interface AgentProfile {
  name: string;
  nccSuccessRate: number;
  brierQuality: number;
  turnTimeMean: number;
  turnTimeStddev: number;
}

const SCRIPT: AgentProfile = { name: 'Script', nccSuccessRate: 0.25, brierQuality: 0.05, turnTimeMean: 2, turnTimeStddev: 1 };
const HEURISTIC: AgentProfile = { name: 'Heuristic', nccSuccessRate: 0.35, brierQuality: 0.10, turnTimeMean: 2, turnTimeStddev: 1 };
const LLM_BASIC: AgentProfile = { name: 'LLM-Basic', nccSuccessRate: 0.65, brierQuality: 0.40, turnTimeMean: 6, turnTimeStddev: 3 };
const LLM_STRONG: AgentProfile = { name: 'LLM-Strong', nccSuccessRate: 0.85, brierQuality: 0.65, turnTimeMean: 10, turnTimeStddev: 4 };

function gaussRandom(mean: number, stddev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(1, Math.round(mean + z * stddev));
}

interface HybridConfig {
  name: string;
  initialBank: number;         // starting time bank (blocks)
  nccRefundPct: number;        // % of turn time refunded on NCC success
  nccFailPenalty: number;      // blocks DEDUCTED on NCC failure (0 = no penalty)
  brierRefundPct: number;      // % of turn time refunded on good Brier
  maxTurnTimeout: number;      // per-turn maximum (prevents hoarding bank)
  bankDecayPct: number;        // % of bank that decays each turn (0 = no decay)
  minTurnInterval: number;     // minimum blocks per turn (levels speed)
}

interface BattleResult {
  winner: 'A' | 'B';
  totalTurns: number;
  reason: string;
  bankA: number;
  bankB: number;
}

function simulateHybrid(config: HybridConfig, agentA: AgentProfile, agentB: AgentProfile): BattleResult {
  let bankA = config.initialBank;
  let bankB = config.initialBank;
  let turn = 0;
  
  while (turn < 300) {
    const isATurn = turn % 2 === 0;
    const agent = isATurn ? agentA : agentB;
    let bank = isATurn ? bankA : bankB;
    
    // Bank decay (erosion each turn to guarantee termination)
    if (config.bankDecayPct > 0) {
      const decay = Math.max(1, Math.floor(bank * config.bankDecayPct / 100));
      bank -= decay;
      if (isATurn) bankA = bank; else bankB = bank;
    }
    
    // Per-turn timeout (can't use more than bank or maxTurnTimeout)
    const turnTimeout = Math.min(bank, config.maxTurnTimeout);
    
    if (turnTimeout <= 0) {
      return { winner: isATurn ? 'B' : 'A', totalTurns: turn, reason: 'bank_empty', bankA, bankB };
    }
    
    // Agent turn time (with minimum interval)
    const rawTime = gaussRandom(agent.turnTimeMean, agent.turnTimeStddev);
    const turnTime = Math.max(config.minTurnInterval, rawTime);
    
    if (turnTime > turnTimeout) {
      return { winner: isATurn ? 'B' : 'A', totalTurns: turn, reason: 'timeout', bankA, bankB };
    }
    
    // Deduct time used
    bank -= turnTime;
    
    // NCC resolution (after turn 0)
    if (turn > 0) {
      if (Math.random() < agent.nccSuccessRate) {
        // NCC success — refund time
        const refund = Math.floor(turnTime * config.nccRefundPct / 100);
        bank += refund;
      } else {
        // NCC failure — penalty
        bank -= config.nccFailPenalty;
      }
    }
    
    // Brier bonus (as attacker)
    if (Math.random() < agent.brierQuality) {
      const refund = Math.floor(turnTime * config.brierRefundPct / 100);
      bank += refund;
    }
    
    // Prevent negative bank
    bank = Math.max(0, bank);
    
    if (isATurn) bankA = bank; else bankB = bank;
    turn++;
  }
  
  return { winner: bankA >= bankB ? 'A' : 'B', totalTurns: 300, reason: 'max_turns', bankA, bankB };
}

// --- Hybrid Configurations to Test ---

const configs: HybridConfig[] = [
  {
    name: 'H1: Chess Clock + 2% Decay',
    initialBank: 500, nccRefundPct: 120, nccFailPenalty: 0,
    brierRefundPct: 30, maxTurnTimeout: 100, bankDecayPct: 2, minTurnInterval: 0,
  },
  {
    name: 'H2: Chess Clock + 3% Decay',
    initialBank: 500, nccRefundPct: 120, nccFailPenalty: 0,
    brierRefundPct: 30, maxTurnTimeout: 100, bankDecayPct: 3, minTurnInterval: 0,
  },
  {
    name: 'H3: Chess Clock + 5% Decay',
    initialBank: 500, nccRefundPct: 120, nccFailPenalty: 0,
    brierRefundPct: 30, maxTurnTimeout: 100, bankDecayPct: 5, minTurnInterval: 0,
  },
  {
    name: 'H4: Chess Clock + Fail Penalty',
    initialBank: 500, nccRefundPct: 100, nccFailPenalty: 10,
    brierRefundPct: 20, maxTurnTimeout: 100, bankDecayPct: 2, minTurnInterval: 0,
  },
  {
    name: 'H5: Chess Clock + Min Interval + Decay',
    initialBank: 500, nccRefundPct: 120, nccFailPenalty: 0,
    brierRefundPct: 30, maxTurnTimeout: 100, bankDecayPct: 3, minTurnInterval: 8,
  },
  {
    name: 'H6: Large Bank + High Refund + Decay',
    initialBank: 1000, nccRefundPct: 150, nccFailPenalty: 0,
    brierRefundPct: 40, maxTurnTimeout: 150, bankDecayPct: 2, minTurnInterval: 0,
  },
  {
    name: 'H7: Small Bank + Aggressive',
    initialBank: 200, nccRefundPct: 100, nccFailPenalty: 15,
    brierRefundPct: 20, maxTurnTimeout: 60, bankDecayPct: 5, minTurnInterval: 5,
  },
  {
    name: 'H8: Balanced (target)',
    initialBank: 400, nccRefundPct: 130, nccFailPenalty: 5,
    brierRefundPct: 25, maxTurnTimeout: 80, bankDecayPct: 3, minTurnInterval: 5,
  },
  {
    name: 'H9: High Penalty for NCC Fail',
    initialBank: 400, nccRefundPct: 100, nccFailPenalty: 20,
    brierRefundPct: 20, maxTurnTimeout: 80, bankDecayPct: 2, minTurnInterval: 5,
  },
  {
    name: 'H10: Speed-Neutral (high min interval)',
    initialBank: 400, nccRefundPct: 120, nccFailPenalty: 5,
    brierRefundPct: 25, maxTurnTimeout: 80, bankDecayPct: 3, minTurnInterval: 12,
  },
];

// --- Run ---

const NUM_BATTLES = 10000;
const matchups: [AgentProfile, AgentProfile][] = [
  [LLM_STRONG, SCRIPT],
  [LLM_BASIC, SCRIPT],
  [LLM_STRONG, LLM_BASIC],
  [SCRIPT, SCRIPT],
  [LLM_STRONG, LLM_STRONG],
];

console.log('# Clawttack v4 — Hybrid Model Simulation');
console.log(`# ${NUM_BATTLES} battles per scenario`);
console.log(`# ${new Date().toISOString()}`);
console.log('');

// Summary table first
console.log('## Summary: LLM-Strong vs Script');
console.log('| Config | LLM Win% | Avg Turns | Max Turns | Verdict |');
console.log('|---|---|---|---|---|');

const summaryData: { name: string; llmWinPct: number; avgTurns: number; maxTurns: number }[] = [];

for (const config of configs) {
  let llmWins = 0, totalTurns = 0, maxT = 0;
  for (let i = 0; i < NUM_BATTLES; i++) {
    const r = simulateHybrid(config, LLM_STRONG, SCRIPT);
    if (r.winner === 'A') llmWins++;
    totalTurns += r.totalTurns;
    maxT = Math.max(maxT, r.totalTurns);
  }
  const pct = (llmWins / NUM_BATTLES) * 100;
  const avg = totalTurns / NUM_BATTLES;
  const verdict = pct > 90 ? '✅ PASS' : pct > 70 ? '⚠️ CLOSE' : pct > 50 ? '🟡 WEAK' : '❌ FAIL';
  summaryData.push({ name: config.name, llmWinPct: pct, avgTurns: avg, maxTurns: maxT });
  console.log(`| ${config.name} | ${pct.toFixed(1)}% | ${avg.toFixed(1)} | ${maxT} | ${verdict} |`);
}

console.log('');

// Detailed results for passing configs
const passingConfigs = configs.filter((c, i) => summaryData[i].llmWinPct > 70);

for (const config of passingConfigs) {
  console.log(`## ${config.name} (detailed)`);
  console.log('| Matchup | A Win% | B Win% | Avg Turns | Max |');
  console.log('|---|---|---|---|---|');
  
  for (const [a, b] of matchups) {
    let aW = 0, tot = 0, maxT = 0;
    for (let i = 0; i < NUM_BATTLES; i++) {
      const r = simulateHybrid(config, a, b);
      if (r.winner === 'A') aW++;
      tot += r.totalTurns;
      maxT = Math.max(maxT, r.totalTurns);
    }
    console.log(`| ${a.name} vs ${b.name} | ${((aW/NUM_BATTLES)*100).toFixed(1)}% | ${(((NUM_BATTLES-aW)/NUM_BATTLES)*100).toFixed(1)}% | ${(tot/NUM_BATTLES).toFixed(1)} | ${maxT} |`);
  }
  console.log('');
}

// Find optimal config
console.log('## Optimal Configuration');
const sorted = [...summaryData].sort((a, b) => {
  // Primary: LLM win rate > 90%
  // Secondary: reasonable game length (20-60 turns avg)
  // Tertiary: bounded max turns (<100)
  const aScore = a.llmWinPct * (a.avgTurns > 10 && a.avgTurns < 80 ? 1 : 0.5) * (a.maxTurns < 150 ? 1 : 0.7);
  const bScore = b.llmWinPct * (b.avgTurns > 10 && b.avgTurns < 80 ? 1 : 0.5) * (b.maxTurns < 150 ? 1 : 0.7);
  return bScore - aScore;
});
console.log(`Best: **${sorted[0].name}** — LLM wins ${sorted[0].llmWinPct.toFixed(1)}%, avg ${sorted[0].avgTurns.toFixed(1)} turns, max ${sorted[0].maxTurns}`);
