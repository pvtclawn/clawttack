import { createHash } from 'node:crypto'

import type { TacticOutputCapabilityContextScope } from './tactic-output-capability-context-task1.ts'

export type TacticOutputCapabilityRuntimeSide = 'attacker' | 'defender'

export type TacticOutputCapabilityRuntimeFreshnessDecision =
  | 'allow'
  | 'duplicate'
  | 'wrong-runtime-binding'
  | 'stale-turn'
  | 'stale-context'
  | 'dependency-invalid'

export interface TacticOutputCapabilityRuntimeFreshnessClaim {
  schemaVersion: number
  battleId: string
  side: TacticOutputCapabilityRuntimeSide
  runId: string
  turnIndex: number
  contextVersion: number
  scope: TacticOutputCapabilityContextScope
  actionKind: string
  actionPayload: unknown
}

export interface TacticOutputCapabilityRuntimeFreshnessState {
  battleId: string
  side: TacticOutputCapabilityRuntimeSide
  runId: string
  turnIndex: number
  contextVersion: number
  dependencyValid: boolean
}

export interface TacticOutputCapabilityRuntimeFreshnessConsumedDigestStore {
  has(digest: `0x${string}`): boolean
  markConsumed(
    digest: `0x${string}`,
    metadata: {
      battleId: string
      runId: string
      turnIndex: number
      decision: TacticOutputCapabilityRuntimeFreshnessDecision
    },
  ): void
}

export interface TacticOutputCapabilityRuntimeFreshnessTask1Input {
  claim: TacticOutputCapabilityRuntimeFreshnessClaim
  runtime: TacticOutputCapabilityRuntimeFreshnessState
  consumedDigests: TacticOutputCapabilityRuntimeFreshnessConsumedDigestStore
  consumeOnAllow?: boolean
}

export interface TacticOutputCapabilityRuntimeFreshnessTask1Result {
  decision: TacticOutputCapabilityRuntimeFreshnessDecision
  claimDigest: `0x${string}`
  normalizedClaim: TacticOutputCapabilityRuntimeFreshnessClaim
  normalizedRuntime: TacticOutputCapabilityRuntimeFreshnessState
  artifactHash: `0x${string}`
}

export class InMemoryTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore
  implements TacticOutputCapabilityRuntimeFreshnessConsumedDigestStore {
  readonly #digests = new Map<`0x${string}`, { battleId: string; runId: string; turnIndex: number; decision: TacticOutputCapabilityRuntimeFreshnessDecision }>()

  has(digest: `0x${string}`): boolean {
    return this.#digests.has(digest)
  }

  markConsumed(
    digest: `0x${string}`,
    metadata: { battleId: string; runId: string; turnIndex: number; decision: TacticOutputCapabilityRuntimeFreshnessDecision },
  ): void {
    this.#digests.set(digest, metadata)
  }
}

const stableStringify = (value: unknown): string => {
  if (value === null) return 'null'
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b))
    const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(String(value))
}

const sha256 = (payload: unknown): `0x${string}` => {
  const digest = createHash('sha256').update(stableStringify(payload)).digest('hex')
  return `0x${digest}`
}

const normalizeToken = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ')

const normalizeScope = (scope: TacticOutputCapabilityContextScope): TacticOutputCapabilityContextScope => ({
  scopeClass: scope.scopeClass,
  namespace: normalizeToken(scope.namespace),
  scopeId: normalizeToken(scope.scopeId),
  scopeVersion: scope.scopeVersion,
})

const normalizeClaim = (
  claim: TacticOutputCapabilityRuntimeFreshnessClaim,
): TacticOutputCapabilityRuntimeFreshnessClaim => ({
  schemaVersion: claim.schemaVersion,
  battleId: normalizeToken(claim.battleId),
  side: claim.side,
  runId: normalizeToken(claim.runId),
  turnIndex: claim.turnIndex,
  contextVersion: claim.contextVersion,
  scope: normalizeScope(claim.scope),
  actionKind: normalizeToken(claim.actionKind),
  actionPayload: claim.actionPayload,
})

const normalizeRuntime = (
  runtime: TacticOutputCapabilityRuntimeFreshnessState,
): TacticOutputCapabilityRuntimeFreshnessState => ({
  battleId: normalizeToken(runtime.battleId),
  side: runtime.side,
  runId: normalizeToken(runtime.runId),
  turnIndex: runtime.turnIndex,
  contextVersion: runtime.contextVersion,
  dependencyValid: runtime.dependencyValid,
})

export const computeTacticOutputCapabilityRuntimeClaimDigestTask1 = (
  claim: TacticOutputCapabilityRuntimeFreshnessClaim,
): `0x${string}` => {
  const normalizedClaim = normalizeClaim(claim)

  return sha256({
    domain: 'clawttack/tactic-output-capability-runtime-freshness-task1/claim-digest',
    schemaVersion: normalizedClaim.schemaVersion,
    battleId: normalizedClaim.battleId,
    side: normalizedClaim.side,
    runId: normalizedClaim.runId,
    turnIndex: normalizedClaim.turnIndex,
    contextVersion: normalizedClaim.contextVersion,
    scope: normalizedClaim.scope,
    actionKind: normalizedClaim.actionKind,
    actionPayload: normalizedClaim.actionPayload,
  })
}

export const evaluateTacticOutputCapabilityRuntimeFreshnessTask1 = (
  input: TacticOutputCapabilityRuntimeFreshnessTask1Input,
): TacticOutputCapabilityRuntimeFreshnessTask1Result => {
  const normalizedClaim = normalizeClaim(input.claim)
  const normalizedRuntime = normalizeRuntime(input.runtime)
  const claimDigest = computeTacticOutputCapabilityRuntimeClaimDigestTask1(normalizedClaim)

  let decision: TacticOutputCapabilityRuntimeFreshnessDecision

  if (input.consumedDigests.has(claimDigest)) {
    decision = 'duplicate'
  } else if (
    normalizedClaim.battleId !== normalizedRuntime.battleId
    || normalizedClaim.side !== normalizedRuntime.side
    || normalizedClaim.runId !== normalizedRuntime.runId
  ) {
    decision = 'wrong-runtime-binding'
  } else if (normalizedClaim.turnIndex !== normalizedRuntime.turnIndex) {
    decision = 'stale-turn'
  } else if (normalizedClaim.contextVersion !== normalizedRuntime.contextVersion) {
    decision = 'stale-context'
  } else if (!normalizedRuntime.dependencyValid) {
    decision = 'dependency-invalid'
  } else {
    decision = 'allow'
  }

  if (decision === 'allow' && input.consumeOnAllow !== false) {
    input.consumedDigests.markConsumed(claimDigest, {
      battleId: normalizedRuntime.battleId,
      runId: normalizedRuntime.runId,
      turnIndex: normalizedRuntime.turnIndex,
      decision,
    })
  }

  return {
    decision,
    claimDigest,
    normalizedClaim,
    normalizedRuntime,
    artifactHash: sha256({
      domain: 'clawttack/tactic-output-capability-runtime-freshness-task1/result',
      decision,
      claimDigest,
      normalizedClaim,
      normalizedRuntime,
    }),
  }
}
