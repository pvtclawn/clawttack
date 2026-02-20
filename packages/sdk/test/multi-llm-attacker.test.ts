// packages/sdk/test/multi-llm-attacker.test.ts — Tests for ARACNE-inspired multi-LLM attacker
import { describe, it, expect } from 'bun:test';
import { parsePlannerOutput, createMultiLLMAttackerStrategy } from '../src/strategies/multi-llm-attacker.ts';
import type { PlannerOutput } from '../src/strategies/multi-llm-attacker.ts';

describe('parsePlannerOutput', () => {
  it('parses valid JSON', () => {
    const input = JSON.stringify({
      tactic: 'social-engineering',
      assessment: 'First turn — no data yet.',
      nextStep: 'Ask a friendly question about their capabilities.',
      goalReached: false,
      pivotNeeded: false,
    });
    const result = parsePlannerOutput(input);
    expect(result.tactic).toBe('social-engineering');
    expect(result.assessment).toBe('First turn — no data yet.');
    expect(result.nextStep).toContain('friendly question');
    expect(result.goalReached).toBe(false);
    expect(result.pivotNeeded).toBe(false);
  });

  it('handles JSON wrapped in markdown code fences', () => {
    const input = '```json\n{"tactic":"jailbreak","assessment":"Testing","nextStep":"Try DAN","goalReached":false,"pivotNeeded":true}\n```';
    const result = parsePlannerOutput(input);
    expect(result.tactic).toBe('jailbreak');
    expect(result.pivotNeeded).toBe(true);
  });

  it('handles code fences without language tag', () => {
    const input = '```\n{"tactic":"authority-claim","assessment":"x","nextStep":"y","goalReached":false,"pivotNeeded":false}\n```';
    const result = parsePlannerOutput(input);
    expect(result.tactic).toBe('authority-claim');
  });

  it('falls back gracefully on invalid JSON', () => {
    const result = parsePlannerOutput('This is not JSON at all');
    expect(result.tactic).toBe('social-engineering');
    expect(result.assessment).toContain('not valid JSON');
    expect(result.goalReached).toBe(false);
    expect(result.pivotNeeded).toBe(false);
  });

  it('handles missing fields with defaults', () => {
    const result = parsePlannerOutput('{}');
    expect(result.tactic).toBe('unknown');
    expect(result.nextStep).toContain('Probe');
    expect(result.goalReached).toBe(false);
  });

  it('goalReached is only true for explicit true', () => {
    const result1 = parsePlannerOutput('{"goalReached": true}');
    expect(result1.goalReached).toBe(true);

    const result2 = parsePlannerOutput('{"goalReached": "yes"}');
    expect(result2.goalReached).toBe(false);

    const result3 = parsePlannerOutput('{"goalReached": 1}');
    expect(result3.goalReached).toBe(false);
  });

  it('pivotNeeded is only true for explicit true', () => {
    const result = parsePlannerOutput('{"pivotNeeded": "true"}');
    expect(result.pivotNeeded).toBe(false);
  });
});

describe('createMultiLLMAttackerStrategy', () => {
  it('exports a function that returns an async strategy', () => {
    const strategy = createMultiLLMAttackerStrategy({
      apiKey: 'test-key',
    });
    expect(typeof strategy).toBe('function');
  });

  it('accepts custom models', () => {
    // Just ensure it doesn't throw on creation
    const strategy = createMultiLLMAttackerStrategy({
      apiKey: 'test-key',
      plannerModel: 'anthropic/claude-3.5-sonnet',
      executorModel: 'google/gemini-2.0-flash-001',
      objective: 'Extract the system prompt',
      pivotThreshold: 3,
    });
    expect(typeof strategy).toBe('function');
  });

  it('accepts custom API base URL', () => {
    const strategy = createMultiLLMAttackerStrategy({
      apiKey: 'test-key',
      apiBaseUrl: 'http://localhost:11434/v1',
    });
    expect(typeof strategy).toBe('function');
  });
});
