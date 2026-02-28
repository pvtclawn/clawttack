/**
 * Clawttack v4 — Simulation v4: Edge Cases & v4h (Entangled Deposits)
 * 
 * Tests:
 * 1. v4h (entangled time deposits) — Gemini's design
 * 2. Variable LLM latency (network congestion / model switching)
 * 3. Mixed strategies (CTF-focused agents that sacrifice NCC)
 * 4. Asymmetric NCC quality (one agent writes trivial riddles)
 */

interface AgentProfile {
  name: string;
  nccSuccessRate: number;
  brierQuality: number;
  turnTimeMean: number;
  turnTimeStddev: number;
  // v4h specific
  riddleSolvability: number; // P(opponent solves YOUR riddle), 0-1
}

const SCRIPT: AgentProfile = { name: 'Script', nccSuccessRate: 0.25, brierQuality: 0.05, turnTimeMean: 2, turnTimeStddev: 1, riddleSolvability: 0.30 };
const HEURISTIC: AgentProfile = { name: 'Heuristic', nccSuccessRate: 0.35, brierQuality: 0.10, turnTimeMean: 2, turnTimeStddev: 1, riddleSolvability: 0.35 };
const LLM_BASIC: AgentProfile = { name: 'LLM-Basic', nccSuccessRate: 0.65, brierQuality: 0.40, turnTimeMean: 6, turnTimeStddev: 3, riddleSolvability: 0.70 };
const LLM_STRONG: AgentProfile = { name: 'LLM-Strong', nccSuccessRate: 0.85, brierQuality: 0.65, turnTimeMean: 10, turnTimeStddev: 4, riddleSolvability: 0.85 };

// Edge case agents
const LLM_LAGGY: AgentProfile = { name: 'LLM-Laggy', nccSuccessRate: 0.85, brierQuality: 0.65, turnTimeMean: 20, turnTimeStddev: 10, riddleSolvability: 0.85 };
const CTF_FOCUSED: AgentProfile = { name: 'CTF-Focused', nccSuccessRate: 0.15, brierQuality: 0.05, turnTimeMean: 8, turnTimeStddev: 4, riddleSolvability: 0.40 };
const TRIVIAL_RIDDLER: AgentProfile = { name: 'Trivial-Riddler', nccSuccessRate: 0.85, brierQuality: 0.65, turnTimeMean: 10, turnTimeStddev: 4, riddleSolvability: 1.0 };

function gaussRandom(mean: number, stddev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(1, Math.round(mean + z * stddev));
}

// ============================================
// MODEL H9 (our optimal — for comparison)
// ============================================
function simulateH9(agentA: AgentProfile, agentB: AgentProfile): { winner: 'A' | 'B'; turns: number; reason: string } {
  let bankA = 400, bankB = 400, turn = 0;
  while (turn < 300) {
    const isA = turn % 2 === 0;
    const agent = isA ? agentA : agentB;
    let bank = isA ? bankA : bankB;
    
    bank -= Math.max(1, Math.floor(bank * 2 / 100)); // decay
    const timeout = Math.min(bank, 80);
    if (timeout <= 0) return { winner: isA ? 'B' : 'A', turns: turn, reason: 'bank_empty' };
    
    const turnTime = Math.max(5, gaussRandom(agent.turnTimeMean, agent.turnTimeStddev));
    if (turnTime > timeout) return { winner: isA ? 'B' : 'A', turns: turn, reason: 'timeout' };
    
    bank -= turnTime;
    if (turn > 0) {
      if (Math.random() < agent.nccSuccessRate) bank += turnTime;
      else bank -= 20;
    }
    bank = Math.max(0, bank);
    if (bank === 0) return { winner: isA ? 'B' : 'A', turns: turn, reason: 'bank_empty' };
    
    if (isA) bankA = bank; else bankB = bank;
    turn++;
  }
  return { winner: bankA >= bankB ? 'A' : 'B', turns: 300, reason: 'max_turns' };
}

// ============================================
// MODEL v4h: Entangled Time Deposits
// ============================================
function simulateV4h(agentA: AgentProfile, agentB: AgentProfile): { winner: 'A' | 'B'; turns: number; reason: string } {
  const DEPOSIT = 20;      // attacker pays to submit riddle
  const RETURN_OK = 30;     // attacker gets back if defender solves
  const DEFENDER_BONUS = 15; // defender gets if they solve
  
  let bankA = 400, bankB = 400, turn = 0;
  while (turn < 300) {
    const isA = turn % 2 === 0;
    const agent = isA ? agentA : agentB;
    const opponent = isA ? agentB : agentA;
    let bank = isA ? bankA : bankB;
    let oppBank = isA ? bankB : bankA;
    
    // Decay
    bank -= Math.max(1, Math.floor(bank * 2 / 100));
    const timeout = Math.min(bank, 80);
    if (timeout <= 0) return { winner: isA ? 'B' : 'A', turns: turn, reason: 'bank_empty' };
    
    const turnTime = Math.max(5, gaussRandom(agent.turnTimeMean, agent.turnTimeStddev));
    if (turnTime > timeout) return { winner: isA ? 'B' : 'A', turns: turn, reason: 'timeout' };
    
    bank -= turnTime;
    
    // Entangled deposit: attacker pays DEPOSIT to submit riddle
    bank -= DEPOSIT;
    
    // NCC resolution: did opponent solve PREVIOUS riddle (our previous attack)?
    if (turn > 1) {
      // Check if opponent solved OUR riddle (based on our riddleSolvability)
      if (Math.random() < agent.riddleSolvability) {
        // Opponent solved it — attacker gets deposit back + bonus
        bank += RETURN_OK;
        // Opponent gets defender bonus (applied to their bank next turn)
        oppBank += DEFENDER_BONUS;
      }
      // If opponent didn't solve: attacker loses deposit (already deducted)
    }
    
    // Defender side: did WE solve opponent's riddle?
    if (turn > 0 && Math.random() < agent.nccSuccessRate) {
      // We solved it — we get defender bonus (already handled by opponent's turn)
      // Plus refund our turn time
      bank += Math.floor(turnTime * 0.5); // partial refund for our own NCC success
    }
    
    bank = Math.max(0, bank);
    oppBank = Math.max(0, oppBank);
    if (bank === 0) return { winner: isA ? 'B' : 'A', turns: turn, reason: 'bank_empty' };
    
    if (isA) { bankA = bank; bankB = oppBank; }
    else { bankB = bank; bankA = oppBank; }
    turn++;
  }
  return { winner: bankA >= bankB ? 'A' : 'B', turns: 300, reason: 'max_turns' };
}

// ============================================
// RUN
// ============================================

const NUM = 10000;

const matchups: [AgentProfile, AgentProfile, string][] = [
  [LLM_STRONG, SCRIPT, 'LLM-Strong vs Script'],
  [LLM_BASIC, SCRIPT, 'LLM-Basic vs Script'],
  [LLM_STRONG, LLM_BASIC, 'LLM-Strong vs LLM-Basic'],
  [SCRIPT, SCRIPT, 'Script vs Script'],
  [LLM_STRONG, LLM_STRONG, 'LLM-Strong vs LLM-Strong'],
  // Edge cases
  [LLM_LAGGY, SCRIPT, 'LLM-Laggy vs Script'],
  [CTF_FOCUSED, LLM_STRONG, 'CTF-Focused vs LLM-Strong'],
  [TRIVIAL_RIDDLER, LLM_STRONG, 'Trivial-Riddler vs LLM-Strong'],
  [LLM_STRONG, TRIVIAL_RIDDLER, 'LLM-Strong vs Trivial-Riddler'],
];

type SimFn = (a: AgentProfile, b: AgentProfile) => { winner: 'A' | 'B'; turns: number; reason: string };
const models: [string, SimFn][] = [
  ['H9 (Chess Clock + Penalty)', simulateH9],
  ['v4h (Entangled Deposits)', simulateV4h],
];

console.log('# Clawttack v4 — Edge Case & v4h Simulation');
console.log(`# ${NUM} battles per scenario | ${new Date().toISOString()}`);
console.log('');

for (const [modelName, simFn] of models) {
  console.log(`## ${modelName}`);
  console.log('| Matchup | A Win% | Avg Turns | Max | Reason Distribution |');
  console.log('|---|---|---|---|---|');
  
  for (const [a, b, name] of matchups) {
    let aW = 0, tot = 0, maxT = 0;
    const reasons: Record<string, number> = {};
    for (let i = 0; i < NUM; i++) {
      const r = simFn(a, b);
      if (r.winner === 'A') aW++;
      tot += r.turns;
      maxT = Math.max(maxT, r.turns);
      reasons[r.reason] = (reasons[r.reason] || 0) + 1;
    }
    const reasonStr = Object.entries(reasons).map(([k, v]) => `${k}:${((v/NUM)*100).toFixed(0)}%`).join(' ');
    console.log(`| ${name} | ${((aW/NUM)*100).toFixed(1)}% | ${(tot/NUM).toFixed(1)} | ${maxT} | ${reasonStr} |`);
  }
  console.log('');
}
