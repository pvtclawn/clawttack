import { describe, expect, it } from 'bun:test';
import { evaluateStopDecision, type RandomizedHorizonConfig } from '../src/randomized-horizon';

const CONFIG: RandomizedHorizonConfig = {
  enabled: true,
  minTurns: 12,
  hardCap: 28,
  stopProbability: 0.12,
};

describe('randomized horizon stop decision', () => {
  it('never samples while timeout is pending', () => {
    const decision = evaluateStopDecision(CONFIG, {
      turnNumber: 15,
      turnAccepted: true,
      timeoutPending: true,
      alreadySampledThisTurn: false,
      randomValue: 0.01,
    });

    expect(decision).toEqual({
      shouldSample: false,
      shouldStop: false,
      reason: 'timeout-pending',
    });
  });

  it('never samples when turn was not accepted', () => {
    const decision = evaluateStopDecision(CONFIG, {
      turnNumber: 15,
      turnAccepted: false,
      timeoutPending: false,
      alreadySampledThisTurn: false,
      randomValue: 0.01,
    });

    expect(decision).toEqual({
      shouldSample: false,
      shouldStop: false,
      reason: 'turn-not-accepted',
    });
  });

  it('keeps deterministic hard cap when feature is disabled', () => {
    const disabled: RandomizedHorizonConfig = { ...CONFIG, enabled: false };

    const beforeCap = evaluateStopDecision(disabled, {
      turnNumber: 20,
      turnAccepted: true,
      timeoutPending: false,
      alreadySampledThisTurn: false,
      randomValue: 0.0,
    });
    expect(beforeCap).toEqual({
      shouldSample: false,
      shouldStop: false,
      reason: 'feature-disabled',
    });

    const atCap = evaluateStopDecision(disabled, {
      turnNumber: 28,
      turnAccepted: true,
      timeoutPending: false,
      alreadySampledThisTurn: false,
      randomValue: 0.99,
    });
    expect(atCap).toEqual({
      shouldSample: false,
      shouldStop: true,
      reason: 'hard-cap',
    });
  });

  it('does not sample before minTurns', () => {
    const decision = evaluateStopDecision(CONFIG, {
      turnNumber: 11,
      turnAccepted: true,
      timeoutPending: false,
      alreadySampledThisTurn: false,
      randomValue: 0.01,
    });

    expect(decision).toEqual({
      shouldSample: false,
      shouldStop: false,
      reason: 'below-min-turns',
    });
  });

  it('samples once for eligible accepted turns', () => {
    const continueDecision = evaluateStopDecision(CONFIG, {
      turnNumber: 12,
      turnAccepted: true,
      timeoutPending: false,
      alreadySampledThisTurn: false,
      randomValue: 0.5,
    });

    expect(continueDecision).toEqual({
      shouldSample: true,
      shouldStop: false,
      reason: 'random-tail-continue',
    });

    const stopDecision = evaluateStopDecision(CONFIG, {
      turnNumber: 12,
      turnAccepted: true,
      timeoutPending: false,
      alreadySampledThisTurn: false,
      randomValue: 0.01,
    });

    expect(stopDecision).toEqual({
      shouldSample: true,
      shouldStop: true,
      reason: 'random-tail-stop',
    });
  });

  it('rejects duplicate sampling for same accepted turn', () => {
    expect(() =>
      evaluateStopDecision(CONFIG, {
        turnNumber: 13,
        turnAccepted: true,
        timeoutPending: false,
        alreadySampledThisTurn: true,
        randomValue: 0.4,
      }),
    ).toThrow('already sampled');
  });
});
