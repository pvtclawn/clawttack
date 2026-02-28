/**
 * Clawttack v4 — Simulation v5: Sensitivity Analysis
 * 
 * Tests how robust H9 parameters are to perturbation.
 * Varies one parameter at a time, measures LLM vs Script win rate.
 */

interface AgentProfile {
  name: string;
  nccSuccessRate: number;
  turnTimeMean: number;
  turnTimeStddev: number;
}

const SCRIPT: AgentProfile = { name: 'Script', nccSuccessRate: 0.25, turnTimeMean: 2, turnTimeStddev: 1 };
const LLM_STRONG: AgentProfile = { name: 'LLM-Strong', nccSuccessRate: 0.85, turnTimeMean: 10, turnTimeStddev: 4 };

function gaussRandom(mean: number, stddev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(1, Math.round(mean + z * stddev));
}

interface Config {
  bank: number;
  refundPct: number;
  penalty: number;
  decayPct: number;
  minInterval: number;
  maxTimeout: number;
}

function simulate(config: Config, a: AgentProfile, b: AgentProfile): 'A' | 'B' {
  let bankA = config.bank, bankB = config.bank, turn = 0;
  while (turn < 300) {
    const isA = turn % 2 === 0;
    const agent = isA ? a : b;
    let bank = isA ? bankA : bankB;
    bank -= Math.max(1, Math.floor(bank * config.decayPct / 100));
    const timeout = Math.min(bank, config.maxTimeout);
    if (timeout <= 0) return isA ? 'B' : 'A';
    const turnTime = Math.max(config.minInterval, gaussRandom(agent.turnTimeMean, agent.turnTimeStddev));
    if (turnTime > timeout) return isA ? 'B' : 'A';
    bank -= turnTime;
    if (turn > 0) {
      if (Math.random() < agent.nccSuccessRate) bank += Math.floor(turnTime * config.refundPct / 100);
      else bank -= config.penalty;
    }
    bank = Math.max(0, bank);
    if (bank === 0) return isA ? 'B' : 'A';
    if (isA) bankA = bank; else bankB = bank;
    turn++;
  }
  return bankA >= bankB ? 'A' : 'B';
}

const NUM = 5000;
const H9: Config = { bank: 400, refundPct: 100, penalty: 20, decayPct: 2, minInterval: 5, maxTimeout: 80 };

function winRate(config: Config): number {
  let wins = 0;
  for (let i = 0; i < NUM; i++) if (simulate(config, LLM_STRONG, SCRIPT) === 'A') wins++;
  return wins / NUM;
}

console.log('# Sensitivity Analysis: H9 Parameters');
console.log(`# ${NUM} battles per data point | ${new Date().toISOString()}`);
console.log('');

// Vary each parameter
const params: { name: string; key: keyof Config; values: number[] }[] = [
  { name: 'Initial Bank', key: 'bank', values: [100, 200, 300, 400, 500, 600, 800, 1000] },
  { name: 'NCC Refund %', key: 'refundPct', values: [0, 25, 50, 75, 100, 125, 150, 200] },
  { name: 'NCC Fail Penalty', key: 'penalty', values: [0, 5, 10, 15, 20, 25, 30, 40, 50] },
  { name: 'Bank Decay %', key: 'decayPct', values: [0, 1, 2, 3, 5, 7, 10] },
  { name: 'Min Turn Interval', key: 'minInterval', values: [0, 2, 5, 8, 10, 12, 15] },
  { name: 'Max Turn Timeout', key: 'maxTimeout', values: [20, 40, 60, 80, 100, 120, 150] },
];

for (const param of params) {
  console.log(`## ${param.name} (baseline: ${H9[param.key]})`);
  console.log(`| ${param.name} | LLM Win% | Verdict |`);
  console.log('|---|---|---|');
  
  for (const val of param.values) {
    const config = { ...H9, [param.key]: val };
    const wr = winRate(config);
    const pct = (wr * 100).toFixed(1);
    const mark = val === H9[param.key] ? ' ◀ H9' : '';
    const verdict = wr > 0.95 ? '✅' : wr > 0.80 ? '⚠️' : wr > 0.50 ? '🟡' : '❌';
    console.log(`| ${val}${mark} | ${pct}% | ${verdict} |`);
  }
  console.log('');
}
