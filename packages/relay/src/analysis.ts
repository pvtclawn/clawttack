// packages/relay/src/analysis.ts — Post-battle analysis for spectator insight
//
// Generates a strategy breakdown from completed battle turns.
// No LLM needed — pure heuristic analysis of conversation patterns.

import type { RelayBattle, SignedTurn } from '@clawttack/protocol';

export interface BattleAnalysis {
  battleId: string;
  scenario: string;
  totalTurns: number;
  duration: { startMs: number; endMs: number; totalMs: number };
  agents: AgentAnalysis[];
  highlights: string[];
  tensionCurve: number[]; // 0-1 per turn, how "close" to extraction
}

export interface AgentAnalysis {
  address: string;
  role: string;
  stats: {
    avgMessageLength: number;
    totalWords: number;
    questionCount: number;
    exclamationCount: number;
    longestMessage: number;
    shortestMessage: number;
  };
  tactics: string[]; // detected strategy patterns
}

/** Detect strategy patterns from message content */
function detectTactics(turns: SignedTurn[], role: string): string[] {
  const tactics: string[] = [];
  const messages = turns.map(t => t.message.toLowerCase());
  const allText = messages.join(' ');

  // Topic steering — introducing specific themes
  const themeWords = ['imagine', 'what if', 'let\'s say', 'suppose', 'picture this', 'think about'];
  if (themeWords.some(w => allText.includes(w))) {
    tactics.push('Topic Steering');
  }

  // Direct probing — asking pointed questions
  const questionTurns = messages.filter(m => m.includes('?')).length;
  if (questionTurns > messages.length * 0.5) {
    tactics.push('Heavy Interrogation');
  } else if (questionTurns > messages.length * 0.25) {
    tactics.push('Moderate Probing');
  }

  // Emotional manipulation
  const emotionalWords = ['please', 'trust me', 'help', 'friend', 'honest', 'promise', 'between us'];
  if (emotionalWords.filter(w => allText.includes(w)).length >= 2) {
    tactics.push('Emotional Appeal');
  }

  // Authority claims
  const authorityWords = ['supervisor', 'admin', 'system', 'override', 'authorized', 'command', 'instruction'];
  if (authorityWords.some(w => allText.includes(w))) {
    tactics.push('Authority Impersonation');
  }

  // Storytelling / roleplay
  const storyWords = ['once upon', 'story', 'character', 'pretend', 'role', 'game', 'play along'];
  if (storyWords.some(w => allText.includes(w))) {
    tactics.push('Roleplay / Storytelling');
  }

  // Fill-in-the-blank extraction
  if (allText.includes('___') || allText.includes('fill in') || allText.includes('complete the')) {
    tactics.push('Fill-in-the-blank');
  }

  // Reciprocity — offering information to get information
  const reciprocityWords = ['i\'ll tell you', 'in exchange', 'my secret', 'i\'ll share', 'fair trade'];
  if (reciprocityWords.some(w => allText.includes(w))) {
    tactics.push('Reciprocity / Trade');
  }

  // Context switching — abrupt topic changes
  const topicShifts = messages.filter((m, i) => {
    if (i === 0) return false;
    const prev = messages[i - 1]!;
    // Simple heuristic: very different word overlap between consecutive messages
    const prevWords = new Set(prev.split(/\s+/));
    const currWords = m.split(/\s+/);
    const overlap = currWords.filter(w => prevWords.has(w)).length;
    return overlap < 2 && currWords.length > 5;
  }).length;
  if (topicShifts > 2) {
    tactics.push('Context Switching');
  }

  // Deflection — short non-committal responses
  const shortResponses = messages.filter(m => m.split(/\s+/).length < 5).length;
  if (shortResponses > messages.length * 0.4) {
    tactics.push('Deflection / Evasion');
  }

  if (tactics.length === 0) {
    tactics.push('Conversational');
  }

  return tactics;
}

/** Calculate per-turn tension score (0-1) based on how "close" messages get to secrets */
function calculateTension(
  turns: SignedTurn[],
  secretWords?: string[],
): number[] {
  if (!secretWords || secretWords.length === 0) {
    // Without secrets, use message length + question density as proxy
    return turns.map(t => {
      const words = t.message.split(/\s+/).length;
      const hasQuestion = t.message.includes('?') ? 0.3 : 0;
      return Math.min(1, (words / 50) * 0.5 + hasQuestion);
    });
  }

  // With secrets, count how many secret words appear in messages so far
  return turns.map((_, idx) => {
    const messagesSoFar = turns.slice(0, idx + 1).map(t => t.message.toLowerCase()).join(' ');
    const hits = secretWords.filter(w => messagesSoFar.includes(w.toLowerCase())).length;
    return Math.min(1, hits / secretWords.length);
  });
}

/** Generate highlights — notable moments in the battle */
function generateHighlights(
  battle: RelayBattle,
  agentAnalyses: AgentAnalysis[],
): string[] {
  const highlights: string[] = [];
  const turns = battle.turns;

  if (turns.length === 0) return ['No turns played'];

  // Longest message
  const longestTurn = turns.reduce((a, b) =>
    a.message.length > b.message.length ? a : b
  );
  const longestAgent = agentAnalyses.find(a => a.address === longestTurn.agentAddress);
  highlights.push(
    `Longest message: Turn ${longestTurn.turnNumber} by ${longestAgent?.role ?? 'unknown'} (${longestTurn.message.split(/\s+/).length} words)`
  );

  // Most questions asked
  const questionCounts = agentAnalyses.map(a => ({
    role: a.role,
    questions: a.stats.questionCount,
  }));
  const mostQuestions = questionCounts.reduce((a, b) => a.questions > b.questions ? a : b);
  if (mostQuestions.questions > 0) {
    highlights.push(`Most questions: ${mostQuestions.role} asked ${mostQuestions.questions} questions`);
  }

  // Quick finish (< 10 turns)
  if (turns.length < 10 && battle.outcome) {
    highlights.push(`Quick battle: resolved in just ${turns.length} turns`);
  }

  // Full duration (hit max turns)
  if (turns.length >= battle.maxTurns) {
    highlights.push(`Went the distance: all ${battle.maxTurns} turns used`);
  }

  return highlights;
}

/** Analyze a completed battle */
export function analyzeBattle(battle: RelayBattle): BattleAnalysis {
  const turns = battle.turns;
  const agents = battle.agents;

  // Split turns by agent
  const agentAnalyses: AgentAnalysis[] = agents.map(agent => {
    const agentTurns = turns.filter(t => t.agentAddress === agent.address);
    const messages = agentTurns.map(t => t.message);
    const wordCounts = messages.map(m => m.split(/\s+/).length);
    const role = battle.roles[agent.address] ?? 'unknown';

    return {
      address: agent.address,
      role,
      stats: {
        avgMessageLength: wordCounts.length > 0
          ? Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length)
          : 0,
        totalWords: wordCounts.reduce((a, b) => a + b, 0),
        questionCount: messages.filter(m => m.includes('?')).length,
        exclamationCount: messages.filter(m => m.includes('!')).length,
        longestMessage: Math.max(0, ...wordCounts),
        shortestMessage: wordCounts.length > 0 ? Math.min(...wordCounts) : 0,
      },
      tactics: detectTactics(agentTurns, role),
    };
  });

  const timestamps = turns.map(t => t.timestamp ?? 0).filter(t => t > 0);
  const startMs = timestamps.length > 0 ? Math.min(...timestamps) : battle.createdAt;
  const endMs = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();

  return {
    battleId: battle.id,
    scenario: battle.scenarioId,
    totalTurns: turns.length,
    duration: { startMs, endMs, totalMs: endMs - startMs },
    agents: agentAnalyses,
    highlights: generateHighlights(battle, agentAnalyses),
    tensionCurve: calculateTension(turns),
  };
}
