import { describe, expect, it } from 'bun:test';
import {
  checkModeOffBaselineEquivalence,
  resolveStallGuardMode,
} from '../src/stallguard-mode';

describe('resolveStallGuardMode', () => {
  it('does not enable when feature flag is disabled', () => {
    const decision = resolveStallGuardMode({
      featureFlagEnabled: false,
      challengerOptIn: true,
      defenderOptIn: true,
    });

    expect(decision).toEqual({ enabled: false, reason: 'feature-disabled' });
  });

  it('does not enable without bilateral opt-in', () => {
    const challengerOnly = resolveStallGuardMode({
      featureFlagEnabled: true,
      challengerOptIn: true,
      defenderOptIn: false,
    });

    const defenderOnly = resolveStallGuardMode({
      featureFlagEnabled: true,
      challengerOptIn: false,
      defenderOptIn: true,
    });

    expect(challengerOnly).toEqual({
      enabled: false,
      reason: 'missing-bilateral-opt-in',
    });
    expect(defenderOnly).toEqual({
      enabled: false,
      reason: 'missing-bilateral-opt-in',
    });
  });

  it('global canary disable wins over all local settings', () => {
    const decision = resolveStallGuardMode({
      featureFlagEnabled: true,
      challengerOptIn: true,
      defenderOptIn: true,
      canaryDisabled: true,
    });

    expect(decision).toEqual({ enabled: false, reason: 'canary-disabled' });
  });

  it('enables only when all gates pass', () => {
    const decision = resolveStallGuardMode({
      featureFlagEnabled: true,
      challengerOptIn: true,
      defenderOptIn: true,
      canaryDisabled: false,
    });

    expect(decision).toEqual({ enabled: true, reason: 'enabled' });
  });
});

describe('checkModeOffBaselineEquivalence', () => {
  const baseline = [
    'battle-created',
    'battle-accepted',
    'turn-submitted:1',
    'turn-submitted:2',
    'battle-settled',
  ] as const;

  it('passes when mode-off trace equals baseline fixture', () => {
    const result = checkModeOffBaselineEquivalence(baseline, [...baseline]);
    expect(result).toEqual({ equivalent: true });
  });

  it('fails on length mismatch', () => {
    const candidate = baseline.slice(0, baseline.length - 1);
    const result = checkModeOffBaselineEquivalence(baseline, candidate);

    expect(result.equivalent).toBe(false);
    expect(result.reason).toBe('length-mismatch');
  });

  it('fails on content mismatch with deterministic index', () => {
    const candidate = [...baseline];
    candidate[2] = 'turn-submitted:1:stallguard-penalty';

    const result = checkModeOffBaselineEquivalence(baseline, candidate);

    expect(result).toEqual({
      equivalent: false,
      reason: 'content-mismatch',
      firstMismatchIndex: 2,
    });
  });
});
