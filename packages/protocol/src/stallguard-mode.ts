export interface StallGuardModeInput {
  featureFlagEnabled: boolean;
  challengerOptIn: boolean;
  defenderOptIn: boolean;
  canaryDisabled?: boolean;
}

export type StallGuardModeReason =
  | 'canary-disabled'
  | 'feature-disabled'
  | 'missing-bilateral-opt-in'
  | 'enabled';

export interface StallGuardModeDecision {
  enabled: boolean;
  reason: StallGuardModeReason;
}

/**
 * Task-2 guard: StallGuard can only activate when both sides opt in and the global feature gate is on.
 */
export function resolveStallGuardMode(input: StallGuardModeInput): StallGuardModeDecision {
  if (input.canaryDisabled) {
    return { enabled: false, reason: 'canary-disabled' };
  }

  if (!input.featureFlagEnabled) {
    return { enabled: false, reason: 'feature-disabled' };
  }

  if (!(input.challengerOptIn && input.defenderOptIn)) {
    return { enabled: false, reason: 'missing-bilateral-opt-in' };
  }

  return { enabled: true, reason: 'enabled' };
}

export interface ModeOffBaselineEquivalence {
  equivalent: boolean;
  reason?: 'length-mismatch' | 'content-mismatch';
  firstMismatchIndex?: number;
}

/**
 * Task-2 guard: when StallGuard is off, state-transition traces must remain baseline-identical.
 */
export function checkModeOffBaselineEquivalence(
  baselineTrace: readonly string[],
  candidateTrace: readonly string[],
): ModeOffBaselineEquivalence {
  if (baselineTrace.length !== candidateTrace.length) {
    return {
      equivalent: false,
      reason: 'length-mismatch',
      firstMismatchIndex: Math.min(baselineTrace.length, candidateTrace.length),
    };
  }

  for (let i = 0; i < baselineTrace.length; i += 1) {
    if (baselineTrace[i] !== candidateTrace[i]) {
      return {
        equivalent: false,
        reason: 'content-mismatch',
        firstMismatchIndex: i,
      };
    }
  }

  return { equivalent: true };
}
