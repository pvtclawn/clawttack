export type SubmitFencingReason =
  | 'pass'
  | 'missing-lock-state'
  | 'stale-fencing-token'
  | 'lock-scope-mismatch'
  | 'token-regression-detected';

export interface SubmitFencingInput {
  /** Canonical lock scope key, e.g. chainId:arena:wallet */
  expectedScopeKey: string;
  /** Current runner identity attempting to submit */
  runnerId: string;
  /** Token held by this runner */
  heldToken: number;
  /** Lock state read from shared artifact */
  lockState:
    | {
        scopeKey: string;
        ownerId: string;
        activeToken: number;
        tokenFloor?: number;
      }
    | null
    | undefined;
}

export interface SubmitFencingResult {
  allowSubmit: boolean;
  reason: SubmitFencingReason;
}

const isFiniteNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value) && value >= 0;

/**
 * Deterministic submit-path fencing guard.
 *
 * Fails closed for stale token ownership, scope mismatches, or token regression.
 */
export const evaluateSubmitFencingGuard = (
  input: SubmitFencingInput,
): SubmitFencingResult => {
  if (!input.lockState) {
    return { allowSubmit: false, reason: 'missing-lock-state' };
  }

  if (input.lockState.scopeKey !== input.expectedScopeKey) {
    return { allowSubmit: false, reason: 'lock-scope-mismatch' };
  }

  if (!isFiniteNonNegativeInteger(input.heldToken) || !isFiniteNonNegativeInteger(input.lockState.activeToken)) {
    return { allowSubmit: false, reason: 'token-regression-detected' };
  }

  const tokenFloor = input.lockState.tokenFloor;
  if (tokenFloor !== undefined && (!isFiniteNonNegativeInteger(tokenFloor) || input.lockState.activeToken < tokenFloor)) {
    return { allowSubmit: false, reason: 'token-regression-detected' };
  }

  if (input.lockState.ownerId !== input.runnerId || input.heldToken !== input.lockState.activeToken) {
    return { allowSubmit: false, reason: 'stale-fencing-token' };
  }

  return { allowSubmit: true, reason: 'pass' };
};
