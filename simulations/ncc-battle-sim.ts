/**
 * Clawttack v4 — NCC Battle Simulation
 * 
 * Monte Carlo simulation of script vs LLM agent battles
 * under different NCC mechanisms and timer shield models.
 * 
 * Tests invariants AS1-AS4 from V4-INVARIANTS.md
 */

// --- Configuration ---

interface SimConfig {
  numBattles: number;
  baseTimeoutBlocks: number;
  turnsUntilHalving: number;
  minTimeoutBlocks: number; // floor (0 = no floor)
  
  // NCC
  nccCandidates: number; // number of candidates (4)
  
  // Agent profiles
  agentA: AgentProfile;
  agentB: AgentProfile;
  
  // Shield model
  shieldModel: 'none' | 'one-shot' | 'accumulated' | 'multiplicative';
  defenderShieldPct: number;  // % added for correct NCC guess (e.g., 20)
  attackerShieldPct: number;  // % added for good Brier score (e.g., 10)
  shieldCap: number;          // max accumulated shield % (for 'accumulated' model)
}

interface AgentProfile {
  name: string;
  type: 'script' | 'heuristic' | 'llm-basic' | 'llm-strong';
  nccSuccessRate: number;     // probability of guessing correct candidate (0-1)
  brierQuality: number;       // probability of earning Brier shield as attacker (0-1)
  avgTurnTimeBlocks: number;  // how many blocks to generate + submit a turn
}

interface BattleResult {
  winner: 'A' | 'B';
  reason: 'timeout' | 'ctf'; // simplified: no poison/reveal for sim
  totalTurns: number;
  agentAShieldsEarned: number;
  agentBShieldsEarned: number;
}

// --- Simulation Engine ---

function simulateBattle(config: SimConfig): BattleResult {
  let currentTurn = 0;
  let agentAAccumulatedShield = 0;
  let agentBAccumulatedShield = 0;
  let agentAShieldsEarned = 0;
  let agentBShieldsEarned = 0;
  
  // Track one-shot shields
  let agentANextShield = 0;
  let agentBNextShield = 0;
  
  while (true) {
    const isAgentATurn = currentTurn % 2 === 0;
    const activeAgent = isAgentATurn ? config.agentA : config.agentB;
    const passiveAgent = isAgentATurn ? config.agentB : config.agentA;
    
    // Calculate current timeout with decay
    const halvings = Math.floor(currentTurn / config.turnsUntilHalving);
    let baseTimeout = config.baseTimeoutBlocks >> halvings;
    if (config.minTimeoutBlocks > 0) {
      baseTimeout = Math.max(baseTimeout, config.minTimeoutBlocks);
    }
    if (baseTimeout <= 0) baseTimeout = 1;
    
    // Apply shield model
    let effectiveTimeout = baseTimeout;
    if (config.shieldModel === 'one-shot') {
      const shield = isAgentATurn ? agentANextShield : agentBNextShield;
      effectiveTimeout = Math.floor(baseTimeout * (1 + shield / 100));
      // Reset one-shot shield after use
      if (isAgentATurn) agentANextShield = 0;
      else agentBNextShield = 0;
    } else if (config.shieldModel === 'accumulated') {
      const shield = isAgentATurn ? agentAAccumulatedShield : agentBAccumulatedShield;
      effectiveTimeout = Math.floor(baseTimeout * (1 + Math.min(shield, config.shieldCap) / 100));
    } else if (config.shieldModel === 'multiplicative') {
      const shield = isAgentATurn ? agentAAccumulatedShield : agentBAccumulatedShield;
      // Multiplicative: shields slow decay but can't stop it
      // Effective multiplier = 1 + shield/200 (diminishing returns)
      effectiveTimeout = Math.floor(baseTimeout * (1 + Math.min(shield, config.shieldCap) / 200));
    }
    
    // Check if agent can submit in time
    if (activeAgent.avgTurnTimeBlocks >= effectiveTimeout) {
      // Timeout! Other agent wins
      return {
        winner: isAgentATurn ? 'B' : 'A',
        reason: 'timeout',
        totalTurns: currentTurn,
        agentAShieldsEarned,
        agentBShieldsEarned,
      };
    }
    
    // Agent submits turn successfully
    // --- NCC Defense (answering opponent's previous riddle) ---
    if (currentTurn > 0) {
      const defenseSuccess = Math.random() < activeAgent.nccSuccessRate;
      if (defenseSuccess) {
        if (isAgentATurn) agentAShieldsEarned++;
        else agentBShieldsEarned++;
        
        // Apply shield based on model
        if (config.shieldModel === 'one-shot') {
          if (isAgentATurn) agentANextShield = config.defenderShieldPct;
          else agentBNextShield = config.defenderShieldPct;
        } else if (config.shieldModel === 'accumulated' || config.shieldModel === 'multiplicative') {
          if (isAgentATurn) agentAAccumulatedShield += config.defenderShieldPct;
          else agentBAccumulatedShield += config.defenderShieldPct;
        }
      }
    }
    
    // --- NCC Attack (Brier quality as attacker) ---
    const brierSuccess = Math.random() < activeAgent.brierQuality;
    if (brierSuccess) {
      if (config.shieldModel === 'one-shot') {
        // Brier shield for attacker's NEXT turn
        if (isAgentATurn) agentANextShield = Math.max(agentANextShield, config.attackerShieldPct);
        else agentBNextShield = Math.max(agentBNextShield, config.attackerShieldPct);
      } else if (config.shieldModel === 'accumulated' || config.shieldModel === 'multiplicative') {
        if (isAgentATurn) agentAAccumulatedShield += config.attackerShieldPct;
        else agentBAccumulatedShield += config.attackerShieldPct;
      }
    }
    
    currentTurn++;
    
    // Safety: prevent infinite loops
    if (currentTurn > 200) {
      // Should never happen with decay, but just in case
      return {
        winner: agentAShieldsEarned >= agentBShieldsEarned ? 'A' : 'B',
        reason: 'timeout',
        totalTurns: currentTurn,
        agentAShieldsEarned,
        agentBShieldsEarned,
      };
    }
  }
}

function runSimulation(config: SimConfig): {
  agentAWins: number;
  agentBWins: number;
  avgTurns: number;
  avgShieldsA: number;
  avgShieldsB: number;
  maxTurns: number;
  minTurns: number;
} {
  let agentAWins = 0;
  let agentBWins = 0;
  let totalTurns = 0;
  let totalShieldsA = 0;
  let totalShieldsB = 0;
  let maxTurns = 0;
  let minTurns = Infinity;
  
  for (let i = 0; i < config.numBattles; i++) {
    const result = simulateBattle(config);
    if (result.winner === 'A') agentAWins++;
    else agentBWins++;
    totalTurns += result.totalTurns;
    totalShieldsA += result.agentAShieldsEarned;
    totalShieldsB += result.agentBShieldsEarned;
    maxTurns = Math.max(maxTurns, result.totalTurns);
    minTurns = Math.min(minTurns, result.totalTurns);
  }
  
  return {
    agentAWins,
    agentBWins,
    avgTurns: totalTurns / config.numBattles,
    avgShieldsA: totalShieldsA / config.numBattles,
    avgShieldsB: totalShieldsB / config.numBattles,
    maxTurns,
    minTurns,
  };
}

// --- Agent Profiles ---

const SCRIPT_AGENT: AgentProfile = {
  name: 'Script (random)',
  type: 'script',
  nccSuccessRate: 0.25,    // 1 in 4 random guess
  brierQuality: 0.05,      // almost never good Brier (random forecast)
  avgTurnTimeBlocks: 1,     // fast (no LLM call)
};

const HEURISTIC_AGENT: AgentProfile = {
  name: 'Script (heuristic)',
  type: 'heuristic',
  nccSuccessRate: 0.35,    // slightly better than random
  brierQuality: 0.10,      // rarely good Brier
  avgTurnTimeBlocks: 1,     // fast
};

const LLM_BASIC: AgentProfile = {
  name: 'LLM (basic)',
  type: 'llm-basic',
  nccSuccessRate: 0.65,    // decent comprehension
  brierQuality: 0.40,      // moderate forecasting
  avgTurnTimeBlocks: 3,     // slower (LLM inference)
};

const LLM_STRONG: AgentProfile = {
  name: 'LLM (strong)',
  type: 'llm-strong',
  nccSuccessRate: 0.85,    // high comprehension
  brierQuality: 0.65,      // good forecasting
  avgTurnTimeBlocks: 5,     // slowest (best model, more thinking)
};

// --- Run All Scenarios ---

const BASE_CONFIG: Partial<SimConfig> = {
  numBattles: 10000,
  baseTimeoutBlocks: 150,   // ~5 min on Base
  turnsUntilHalving: 5,
  minTimeoutBlocks: 0,      // no floor
  nccCandidates: 4,
  shieldCap: 100,           // for accumulated model
};

interface Scenario {
  name: string;
  config: SimConfig;
}

const scenarios: Scenario[] = [];

// Matchups to test
const matchups: [AgentProfile, AgentProfile, string][] = [
  [LLM_STRONG, SCRIPT_AGENT, 'LLM-Strong vs Script'],
  [LLM_STRONG, HEURISTIC_AGENT, 'LLM-Strong vs Heuristic'],
  [LLM_STRONG, LLM_BASIC, 'LLM-Strong vs LLM-Basic'],
  [LLM_BASIC, SCRIPT_AGENT, 'LLM-Basic vs Script'],
  [SCRIPT_AGENT, SCRIPT_AGENT, 'Script vs Script'],
  [LLM_STRONG, LLM_STRONG, 'LLM-Strong vs LLM-Strong'],
];

// Shield models to test
const shieldModels: SimConfig['shieldModel'][] = ['none', 'one-shot', 'accumulated', 'multiplicative'];

// Shield magnitudes to test
const shieldMagnitudes: [number, number][] = [
  [10, 5],   // conservative
  [15, 10],  // moderate
  [20, 10],  // current design
  [25, 15],  // aggressive
  [30, 20],  // very aggressive
];

// Build scenarios
for (const [agentA, agentB, matchupName] of matchups) {
  for (const model of shieldModels) {
    for (const [defShield, atkShield] of shieldMagnitudes) {
      if (model === 'none' && (defShield !== 20 || atkShield !== 10)) continue; // only run 'none' once
      
      scenarios.push({
        name: `${matchupName} | ${model} | def=${defShield}% atk=${atkShield}%`,
        config: {
          ...BASE_CONFIG as SimConfig,
          agentA,
          agentB,
          shieldModel: model,
          defenderShieldPct: defShield,
          attackerShieldPct: atkShield,
        },
      });
    }
  }
}

// --- Execute and Report ---

console.log('# Clawttack v4 NCC Battle Simulation');
console.log(`# ${scenarios.length} scenarios × 10,000 battles each`);
console.log(`# Date: ${new Date().toISOString()}`);
console.log('');
console.log('| Scenario | A Wins | B Wins | A Win% | Avg Turns | Min | Max | Avg Shields A | Avg Shields B |');
console.log('|---|---|---|---|---|---|---|---|---|');

const results: { name: string; data: ReturnType<typeof runSimulation> }[] = [];

for (const scenario of scenarios) {
  const data = runSimulation(scenario.config);
  results.push({ name: scenario.name, data });
  
  const aWinPct = ((data.agentAWins / scenario.config.numBattles) * 100).toFixed(1);
  console.log(
    `| ${scenario.name} | ${data.agentAWins} | ${data.agentBWins} | ${aWinPct}% | ${data.avgTurns.toFixed(1)} | ${data.minTurns} | ${data.maxTurns} | ${data.avgShieldsA.toFixed(1)} | ${data.avgShieldsB.toFixed(1)} |`
  );
}

// --- Summary Analysis ---

console.log('');
console.log('## Key Findings');
console.log('');

// Find best shield model for LLM-Strong vs Script
const llmVsScript = results.filter(r => r.name.startsWith('LLM-Strong vs Script'));
console.log('### LLM-Strong vs Script (best anti-scripting results):');
for (const r of llmVsScript) {
  const winPct = ((r.data.agentAWins / 10000) * 100).toFixed(1);
  console.log(`  ${r.name}: LLM wins ${winPct}% | avg ${r.data.avgTurns.toFixed(1)} turns`);
}

console.log('');

// Check invariant AS1: scripts must lose >90%
const as1Results = llmVsScript.filter(r => r.data.agentAWins / 10000 > 0.90);
console.log(`### Invariant AS1 (scripts lose >90%): ${as1Results.length}/${llmVsScript.length} scenarios pass`);

console.log('');

// Check for infinite games (max turns > 100)
const longGames = results.filter(r => r.data.maxTurns > 100);
console.log(`### Termination check: ${longGames.length} scenarios had battles >100 turns`);
for (const r of longGames) {
  console.log(`  ⚠️ ${r.name}: max ${r.data.maxTurns} turns`);
}

console.log('');

// Mirror matchups
const mirrors = results.filter(r => r.name.startsWith('Script vs Script') || r.name.startsWith('LLM-Strong vs LLM-Strong'));
console.log('### Mirror matchups (should be ~50/50):');
for (const r of mirrors) {
  const winPct = ((r.data.agentAWins / 10000) * 100).toFixed(1);
  console.log(`  ${r.name}: A wins ${winPct}%`);
}
