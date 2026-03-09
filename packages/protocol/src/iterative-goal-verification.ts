import { createHash } from 'node:crypto'

export interface IterativeGoalConfig {
  maxIterations: number
}

export interface GoalVerificationEvidence {
  schemaVersion?: string
  proofHash?: `0x${string}`
  completedChecks?: string[]
}

export interface IterativeGoalStepInput {
  verificationAction: string
  proposedGoalReached: boolean
  continueReason?: string
  evidence?: GoalVerificationEvidence
}

export type IterativeGoalHaltReason =
  | 'goal-reached'
  | 'insufficient-verification-evidence'
  | 'max-iterations'

export interface IterativeGoalState {
  iteration: number
  halted: boolean
  haltReason?: IterativeGoalHaltReason
  evidenceSchemaCompletenessHash?: `0x${string}`
}

export interface IterativeGoalDecision {
  halted: boolean
  haltReason?: IterativeGoalHaltReason
  evidenceSchemaCompletenessHash?: `0x${string}`
  continueReason?: string
}

const stableStringify = (value: unknown): string => {
  if (value === null) return 'null'
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'string') return JSON.stringify(value)

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b))
    const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    return `{${entries.join(',')}}`
  }

  return JSON.stringify(String(value))
}

const toHash = (value: unknown): `0x${string}` => {
  const digest = createHash('sha256').update(stableStringify(value)).digest('hex')
  return `0x${digest}`
}

const buildCompletenessVector = (evidence?: GoalVerificationEvidence) => ({
  hasSchemaVersion: Boolean(evidence?.schemaVersion && evidence.schemaVersion.trim().length > 0),
  hasProofHash: Boolean(evidence?.proofHash && /^0x[0-9a-fA-F]{64}$/.test(evidence.proofHash)),
  hasCompletedChecks: Boolean(evidence?.completedChecks && evidence.completedChecks.length > 0),
})

export const getExpectedEvidenceCompletenessHash = (): `0x${string}` =>
  toHash({
    hasSchemaVersion: true,
    hasProofHash: true,
    hasCompletedChecks: true,
  })

export const computeEvidenceSchemaCompletenessHash = (
  evidence?: GoalVerificationEvidence,
): `0x${string}` => toHash(buildCompletenessVector(evidence))

export const createInitialIterativeGoalState = (): IterativeGoalState => ({
  iteration: 0,
  halted: false,
})

/**
 * Simulation-only iterative goal-verification step evaluator.
 *
 * Task-1 guarantees:
 * - goalReached=true requires machine-verifiable evidence schema completeness,
 * - unsupported success claims halt deterministically with insufficient-verification-evidence,
 * - loop halts with bounded max-iteration fallback.
 */
export const evaluateIterativeGoalStep = (
  config: IterativeGoalConfig,
  state: IterativeGoalState,
  step: IterativeGoalStepInput,
): { state: IterativeGoalState; decision: IterativeGoalDecision } => {
  if (!Number.isInteger(config.maxIterations) || config.maxIterations < 1) {
    throw new Error(`invalid-max-iterations:${config.maxIterations}`)
  }

  if (state.halted) {
    return {
      state,
      decision: {
        halted: true,
        haltReason: state.haltReason,
        evidenceSchemaCompletenessHash: state.evidenceSchemaCompletenessHash,
      },
    }
  }

  const nextIteration = state.iteration + 1
  const evidenceHash = computeEvidenceSchemaCompletenessHash(step.evidence)

  if (step.proposedGoalReached) {
    const expected = getExpectedEvidenceCompletenessHash()
    if (evidenceHash !== expected) {
      const haltedState: IterativeGoalState = {
        iteration: nextIteration,
        halted: true,
        haltReason: 'insufficient-verification-evidence',
        evidenceSchemaCompletenessHash: evidenceHash,
      }

      return {
        state: haltedState,
        decision: {
          halted: true,
          haltReason: 'insufficient-verification-evidence',
          evidenceSchemaCompletenessHash: evidenceHash,
        },
      }
    }

    const haltedState: IterativeGoalState = {
      iteration: nextIteration,
      halted: true,
      haltReason: 'goal-reached',
      evidenceSchemaCompletenessHash: evidenceHash,
    }

    return {
      state: haltedState,
      decision: {
        halted: true,
        haltReason: 'goal-reached',
        evidenceSchemaCompletenessHash: evidenceHash,
      },
    }
  }

  if (nextIteration >= config.maxIterations) {
    const haltedState: IterativeGoalState = {
      iteration: nextIteration,
      halted: true,
      haltReason: 'max-iterations',
      evidenceSchemaCompletenessHash: evidenceHash,
    }

    return {
      state: haltedState,
      decision: {
        halted: true,
        haltReason: 'max-iterations',
        evidenceSchemaCompletenessHash: evidenceHash,
      },
    }
  }

  const nextState: IterativeGoalState = {
    ...state,
    iteration: nextIteration,
    evidenceSchemaCompletenessHash: evidenceHash,
  }

  return {
    state: nextState,
    decision: {
      halted: false,
      continueReason: step.continueReason,
      evidenceSchemaCompletenessHash: evidenceHash,
    },
  }
}
