/**
 * Clawttack v4 — Battle Simulation v2
 * 
 * Fixed critical flaw in v1: timer decay inherently favors fast agents.
 * Tests THREE timing models:
 *   Model A: Timer decay + shields (original v4)
 *   Model B: Chess clock + NCC refund
 *   Model C: Timer decay + NCC cooldown penalty
 */

// --- Types ---

interface AgentProfile {
  name: string;
  nccSuccessRate: number;     // P(correct NCC guess), 0-1
  brierQuality: number;       // P(good Brier score), 0-1
  turnTimeMean: number;       // mean blocks to submit turn
  turnTimeStddev: number;     // stddev in turn time (adds variance)
}

interface BattleResult {
  winner: 'A' | 'B';
  totalTurns: number;
  reason: string;
}

// --- Agent Profiles ---

const SCRIPT: AgentProfile = {
  name: 'Script',
  nccSuccessRate: 0.25,
  brierQuality: 0.05,
  turnTimeMean: 2,
  turnTimeStddev: 1,
};

const HEURISTIC: AgentProfile = {
  name: 'Heuristic',
  nccSuccessRate: 0.35,
  brierQuality: 0.10,
  turnTimeMean: 2,
  turnTimeStddev: 1,
};

const LLM_BASIC: AgentProfile = {
  name: 'LLM-Basic',
  nccSuccessRate: 0.65,
  brierQuality: 0.40,
  turnTimeMean: 6,
  turnTimeStddev: 3,
};

const LLM_STRONG: AgentProfile = {
  name: 'LLM-Strong',
  nccSuccessRate: 0.85,
  brierQuality: 0.65,
  turnTimeMean: 10,
  turnTimeStddev: 4,
};

// --- Utilities ---

function gaussRandom(mean: number, stddev: number): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(1, Math.round(mean + z * stddev));
}

// ============================================
// MODEL A: Timer Decay + Shields (Original v4)
// ============================================
// Problem identified: scripts are faster → always win

function simulateModelA(agentA: AgentProfile, agentB: AgentProfile): BattleResult {
  const BASE_TIMEOUT = 150;
  const HALVING_INTERVAL = 5;
  const SHIELD_PCT = 20; // one-shot +20%
  
  let turn = 0;
  let aNextShield = 0;
  let bNextShield = 0;
  
  while (turn < 200) {
    const isATurn = turn % 2 === 0;
    const agent = isATurn ? agentA : agentB;
    
    // Calculate timeout
    const halvings = Math.floor(turn / HALVING_INTERVAL);
    let timeout = Math.max(1, BASE_TIMEOUT >> halvings);
    
    // Apply one-shot shield
    const shield = isATurn ? aNextShield : bNextShield;
    timeout = Math.floor(timeout * (1 + shield / 100));
    if (isATurn) aNextShield = 0; else bNextShield = 0;
    
    // Agent turn time (with variance)
    const turnTime = gaussRandom(agent.turnTimeMean, agent.turnTimeStddev);
    
    if (turnTime > timeout) {
      return { winner: isATurn ? 'B' : 'A', totalTurns: turn, reason: 'timeout' };
    }
    
    // NCC defense (after turn 0)
    if (turn > 0 && Math.random() < agent.nccSuccessRate) {
      if (isATurn) aNextShield = SHIELD_PCT; else bNextShield = SHIELD_PCT;
    }
    
    turn++;
  }
  return { winner: 'A', totalTurns: 200, reason: 'max_turns' };
}

// ============================================
// MODEL B: Chess Clock + NCC Refund
// ============================================
// Each agent has a time bank. NCC success refunds time.

function simulateModelB(agentA: AgentProfile, agentB: AgentProfile): BattleResult {
  const INITIAL_BANK = 300; // blocks
  const NCC_REFUND_PCT = 150; // refund 150% of time used on NCC success
  
  let bankA = INITIAL_BANK;
  let bankB = INITIAL_BANK;
  let turn = 0;
  
  while (turn < 200) {
    const isATurn = turn % 2 === 0;
    const agent = isATurn ? agentA : agentB;
    
    // Agent turn time
    const turnTime = gaussRandom(agent.turnTimeMean, agent.turnTimeStddev);
    
    // Check if agent has enough time
    const bank = isATurn ? bankA : bankB;
    if (turnTime > bank) {
      return { winner: isATurn ? 'B' : 'A', totalTurns: turn, reason: 'bank_empty' };
    }
    
    // Deduct time
    if (isATurn) bankA -= turnTime; else bankB -= turnTime;
    
    // NCC refund
    if (turn > 0 && Math.random() < agent.nccSuccessRate) {
      const refund = Math.floor(turnTime * NCC_REFUND_PCT / 100);
      if (isATurn) bankA += refund; else bankB += refund;
    }
    
    turn++;
  }
  return { winner: bankA >= bankB ? 'A' : 'B', totalTurns: 200, reason: 'max_turns' };
}

// ============================================
// MODEL C: Timer Decay + NCC Cooldown Penalty
// ============================================
// Wrong NCC = forced wait (cooldown). This eats into the decaying timer.

function simulateModelC(agentA: AgentProfile, agentB: AgentProfile): BattleResult {
  const BASE_TIMEOUT = 150;
  const HALVING_INTERVAL = 5;
  const COOLDOWN_BLOCKS = 15; // wrong NCC = wait 15 extra blocks
  
  let turn = 0;
  
  while (turn < 200) {
    const isATurn = turn % 2 === 0;
    const agent = isATurn ? agentA : agentB;
    
    // Calculate timeout
    const halvings = Math.floor(turn / HALVING_INTERVAL);
    const timeout = Math.max(1, BASE_TIMEOUT >> halvings);
    
    // Agent turn time
    let turnTime = gaussRandom(agent.turnTimeMean, agent.turnTimeStddev);
    
    // NCC cooldown penalty (after turn 0)
    if (turn > 0 && Math.random() >= agent.nccSuccessRate) {
      // WRONG answer → add cooldown
      turnTime += COOLDOWN_BLOCKS;
    }
    
    if (turnTime > timeout) {
      return { winner: isATurn ? 'B' : 'A', totalTurns: turn, reason: 'timeout' };
    }
    
    turn++;
  }
  return { winner: 'A', totalTurns: 200, reason: 'max_turns' };
}

// ============================================
// MODEL D: Timer Decay + NCC Gates Submission
// ============================================
// Must pass NCC to submit. Failed NCC = wasted turn attempt (time passes but no turn).
// Multiple attempts allowed within timeout window.

function simulateModelD(agentA: AgentProfile, agentB: AgentProfile): BattleResult {
  const BASE_TIMEOUT = 150;
  const HALVING_INTERVAL = 5;
  const ATTEMPT_COST = 3; // blocks per NCC attempt
  
  let turn = 0;
  
  while (turn < 200) {
    const isATurn = turn % 2 === 0;
    const agent = isATurn ? agentA : agentB;
    
    // Calculate timeout
    const halvings = Math.floor(turn / HALVING_INTERVAL);
    const timeout = Math.max(1, BASE_TIMEOUT >> halvings);
    
    // Agent must pass NCC to submit (turn 0 exempt)
    let totalTime = 0;
    if (turn === 0) {
      totalTime = gaussRandom(agent.turnTimeMean, agent.turnTimeStddev);
    } else {
      // Keep trying until NCC passes or timeout
      let passed = false;
      while (!passed && totalTime < timeout) {
        totalTime += gaussRandom(agent.turnTimeMean, agent.turnTimeStddev);
        if (Math.random() < agent.nccSuccessRate) {
          passed = true;
        } else {
          totalTime += ATTEMPT_COST; // re-submit attempt
        }
      }
      if (!passed) {
        return { winner: isATurn ? 'B' : 'A', totalTurns: turn, reason: 'ncc_block' };
      }
    }
    
    if (totalTime > timeout) {
      return { winner: isATurn ? 'B' : 'A', totalTurns: turn, reason: 'timeout' };
    }
    
    turn++;
  }
  return { winner: 'A', totalTurns: 200, reason: 'max_turns' };
}

// ============================================
// MODEL E: Minimum Turn Interval + Timer Decay + Shields
// ============================================
// Enforced minimum time between turns. Levels speed playing field.

function simulateModelE(agentA: AgentProfile, agentB: AgentProfile): BattleResult {
  const BASE_TIMEOUT = 150;
  const HALVING_INTERVAL = 5;
  const MIN_TURN_INTERVAL = 8; // minimum blocks between turns
  const SHIELD_PCT = 20;
  
  let turn = 0;
  let aNextShield = 0;
  let bNextShield = 0;
  
  while (turn < 200) {
    const isATurn = turn % 2 === 0;
    const agent = isATurn ? agentA : agentB;
    
    const halvings = Math.floor(turn / HALVING_INTERVAL);
    let timeout = Math.max(1, BASE_TIMEOUT >> halvings);
    
    const shield = isATurn ? aNextShield : bNextShield;
    timeout = Math.floor(timeout * (1 + shield / 100));
    if (isATurn) aNextShield = 0; else bNextShield = 0;
    
    // Agent turn time (minimum enforced)
    const rawTime = gaussRandom(agent.turnTimeMean, agent.turnTimeStddev);
    const turnTime = Math.max(MIN_TURN_INTERVAL, rawTime);
    
    if (turnTime > timeout) {
      return { winner: isATurn ? 'B' : 'A', totalTurns: turn, reason: 'timeout' };
    }
    
    if (turn > 0 && Math.random() < agent.nccSuccessRate) {
      if (isATurn) aNextShield = SHIELD_PCT; else bNextShield = SHIELD_PCT;
    }
    
    turn++;
  }
  return { winner: 'A', totalTurns: 200, reason: 'max_turns' };
}

// ============================================
// RUN ALL MODELS
// ============================================

const NUM_BATTLES = 10000;

const matchups: [AgentProfile, AgentProfile][] = [
  [LLM_STRONG, SCRIPT],
  [LLM_STRONG, HEURISTIC],
  [LLM_STRONG, LLM_BASIC],
  [LLM_BASIC, SCRIPT],
  [SCRIPT, SCRIPT],
  [LLM_STRONG, LLM_STRONG],
];

type SimFn = (a: AgentProfile, b: AgentProfile) => BattleResult;

const models: [string, SimFn][] = [
  ['A: Timer Decay + Shields', simulateModelA],
  ['B: Chess Clock + Refund', simulateModelB],
  ['C: Timer Decay + Cooldown', simulateModelC],
  ['D: Timer Decay + NCC Gate', simulateModelD],
  ['E: Min Interval + Shields', simulateModelE],
];

console.log('# Clawttack v4 — Battle Simulation v2');
console.log(`# ${NUM_BATTLES} battles per scenario`);
console.log(`# ${new Date().toISOString()}`);
console.log('');

for (const [modelName, simFn] of models) {
  console.log(`## ${modelName}`);
  console.log('| Matchup | A Win% | B Win% | Avg Turns | Min | Max |');
  console.log('|---|---|---|---|---|---|');
  
  for (const [agentA, agentB] of matchups) {
    let aWins = 0, bWins = 0, totalTurns = 0, maxTurns = 0, minTurns = Infinity;
    
    for (let i = 0; i < NUM_BATTLES; i++) {
      const r = simFn(agentA, agentB);
      if (r.winner === 'A') aWins++; else bWins++;
      totalTurns += r.totalTurns;
      maxTurns = Math.max(maxTurns, r.totalTurns);
      minTurns = Math.min(minTurns, r.totalTurns);
    }
    
    const aWinPct = ((aWins / NUM_BATTLES) * 100).toFixed(1);
    const bWinPct = ((bWins / NUM_BATTLES) * 100).toFixed(1);
    const avgTurns = (totalTurns / NUM_BATTLES).toFixed(1);
    
    console.log(`| ${agentA.name} vs ${agentB.name} | ${aWinPct}% | ${bWinPct}% | ${avgTurns} | ${minTurns} | ${maxTurns} |`);
  }
  console.log('');
}

// Summary
console.log('## Summary: LLM-Strong vs Script win rates by model');
console.log('');
for (const [modelName, simFn] of models) {
  let aWins = 0;
  for (let i = 0; i < NUM_BATTLES; i++) {
    if (simFn(LLM_STRONG, SCRIPT).winner === 'A') aWins++;
  }
  const verdict = aWins / NUM_BATTLES > 0.90 ? '✅ PASS' : 
                  aWins / NUM_BATTLES > 0.50 ? '⚠️ WEAK' : '❌ FAIL';
  console.log(`- **${modelName}**: LLM wins ${((aWins/NUM_BATTLES)*100).toFixed(1)}% ${verdict}`);
}
