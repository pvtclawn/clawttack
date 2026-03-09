export * from './transport.ts';
export { WebSocketTransport } from './ws-transport.ts';
export { WakuTransport, signRegistration, signForfeit } from './waku-transport.ts';
export type { WakuTransportConfig, WakuBattleMessage } from './waku-transport.ts';
export { ClawttackClient } from './client.ts';
export type { ClawttackClientConfig, BattleContext, Strategy } from './client.ts';
export { Fighter } from './fighter.ts';
export type { FighterConfig, FightResult } from './fighter.ts';
export { WakuFighter, generateChallengeWord, getChallengeWordTimeout } from './waku-fighter.ts';
export type { WakuFighterConfig, WakuBattleContext, WakuStrategy, WakuFightResult, ChallengeWordConfig } from './waku-fighter.ts';
export type { MatchResult } from './types.ts';

export * from './types.ts';
export {
  createNccAttack,
  createNccDefense,
  createNccReveal,
  verifyCommitment,
  findWordOffset,
  embedCandidates,
} from './ncc-helper.ts';
export type { BIP39Word } from './ncc-helper.ts';
export { createGatewayStrategy, createPentestAttackerStrategy, sanitizeDefenderResponse } from './strategies/gateway.ts';
// On-chain fighter
export { Fighter } from './fighter.ts';
export type { FighterConfig, Strategy, StrategyResult, FightResult } from './fighter.ts';
// BIP39 scanner
export { scanForBip39Words, loadWordList, BIP39_TEST_WORDS } from './bip39-scanner.ts';
export type { WordMatch, ScanResult } from './bip39-scanner.ts';
// Strategy template
export { createStrategy } from './strategy-template.ts';
export type { StrategyConfig } from './strategy-template.ts';
// VOP solver
export { solveHashPreimage, solveVOP } from './vop-solver.ts';
export type { VOPSolution } from './vop-solver.ts';
export type { GatewayStrategyConfig } from './strategies/gateway.ts';
export { createMultiLLMAttackerStrategy, parsePlannerOutput } from './strategies/multi-llm-attacker.ts';
export type { MultiLLMAttackerConfig, PlannerOutput } from './strategies/multi-llm-attacker.ts';
export { analyzePentest } from './pentest-report.ts';
export type { PentestTurn, PentestFinding, PentestReport } from './pentest-report.ts';
export { PentestRunner, formatReport, DEFAULT_PENTEST_OBJECTIVES } from './pentest-runner.ts';
export type { PentestRunnerConfig, PentestResult } from './pentest-runner.ts';
