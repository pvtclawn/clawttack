import { createHash } from 'node:crypto'

export type TimeoutBucketMonotonicKnowledgeTask1Reason =
  | 'timeout-bucket-monotonic-pass'
  | 'timeout-bucket-monotonicity-claim-invalid'
  | 'timeout-bucket-transitive-regression-detected'

export interface TimeoutBucketMonotonicCapability {
  reducerVersion: string
  reducerDigest: string
  monotonicKnowledgeSafe: boolean
  allowedSideEffectClasses: string[]
}

export interface TimeoutBucketTransitiveEffect {
  effectId: string
  parentEffectId?: string
  sideEffectClass: string
  regressesPredicates: boolean
}

export interface TimeoutBucketMonotonicKnowledgeTask1Input {
  reducerVersion: string
  reducerDigest: string
  declaredMonotonicKnowledgeSafe: boolean
  declaredSideEffectClasses: string[]
  observedSideEffectClasses: string[]
  transitiveEffects: TimeoutBucketTransitiveEffect[]
  authenticatedCapabilities: TimeoutBucketMonotonicCapability[]
}

export interface TimeoutBucketMonotonicKnowledgeTask1Result {
  verdict: 'pass' | 'fail'
  reason: TimeoutBucketMonotonicKnowledgeTask1Reason
  capabilityFound: boolean
  reducerDigestMatch: boolean
  monotonicClaimMatch: boolean
  undeclaredObservedSideEffectClasses: string[]
  disallowedSideEffectClasses: string[]
  regressingEffectIds: string[]
  artifactHash: `0x${string}`
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

const normalize = (value: string): string => value.trim().toLowerCase()

const uniqSorted = (values: string[]): string[] => [...new Set(values.map((value) => normalize(value)))].sort((a, b) => a.localeCompare(b))

export const evaluateTimeoutBucketMonotonicKnowledgeTask1 = (
  input: TimeoutBucketMonotonicKnowledgeTask1Input,
): TimeoutBucketMonotonicKnowledgeTask1Result => {
  const reducerVersion = normalize(input.reducerVersion)
  const reducerDigest = normalize(input.reducerDigest)

  const capabilities = input.authenticatedCapabilities.map((capability) => ({
    reducerVersion: normalize(capability.reducerVersion),
    reducerDigest: normalize(capability.reducerDigest),
    monotonicKnowledgeSafe: capability.monotonicKnowledgeSafe,
    allowedSideEffectClasses: uniqSorted(capability.allowedSideEffectClasses),
  }))

  const declaredSideEffectClasses = uniqSorted(input.declaredSideEffectClasses)
  const observedSideEffectClasses = uniqSorted(input.observedSideEffectClasses)

  const transitiveEffects = input.transitiveEffects.map((effect) => ({
    effectId: normalize(effect.effectId),
    parentEffectId: effect.parentEffectId ? normalize(effect.parentEffectId) : undefined,
    sideEffectClass: normalize(effect.sideEffectClass),
    regressesPredicates: effect.regressesPredicates,
  }))

  const matched = capabilities.find((capability) => capability.reducerVersion === reducerVersion)
  const capabilityFound = Boolean(matched)
  const reducerDigestMatch = Boolean(matched && matched.reducerDigest === reducerDigest)
  const monotonicClaimMatch = Boolean(
    matched && matched.monotonicKnowledgeSafe === input.declaredMonotonicKnowledgeSafe,
  )

  const allowedSideEffectClasses = matched?.allowedSideEffectClasses ?? []

  const undeclaredObservedSideEffectClasses = observedSideEffectClasses
    .filter((effectClass) => !declaredSideEffectClasses.includes(effectClass))
    .sort((a, b) => a.localeCompare(b))

  const disallowedSideEffectClasses = observedSideEffectClasses
    .filter((effectClass) => !allowedSideEffectClasses.includes(effectClass))
    .sort((a, b) => a.localeCompare(b))

  const regressingEffectIds = transitiveEffects
    .filter((effect) => effect.regressesPredicates)
    .map((effect) => effect.effectId)
    .sort((a, b) => a.localeCompare(b))

  const payload = {
    reducerVersion,
    reducerDigest,
    declaredMonotonicKnowledgeSafe: input.declaredMonotonicKnowledgeSafe,
    declaredSideEffectClasses,
    observedSideEffectClasses,
    transitiveEffects,
    capabilities,
    capabilityFound,
    reducerDigestMatch,
    monotonicClaimMatch,
    undeclaredObservedSideEffectClasses,
    disallowedSideEffectClasses,
    regressingEffectIds,
  }

  if (
    !capabilityFound ||
    !reducerDigestMatch ||
    !monotonicClaimMatch ||
    undeclaredObservedSideEffectClasses.length > 0 ||
    disallowedSideEffectClasses.length > 0
  ) {
    return {
      verdict: 'fail',
      reason: 'timeout-bucket-monotonicity-claim-invalid',
      capabilityFound,
      reducerDigestMatch,
      monotonicClaimMatch,
      undeclaredObservedSideEffectClasses,
      disallowedSideEffectClasses,
      regressingEffectIds,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'timeout-bucket-monotonicity-claim-invalid' }),
    }
  }

  if (regressingEffectIds.length > 0) {
    return {
      verdict: 'fail',
      reason: 'timeout-bucket-transitive-regression-detected',
      capabilityFound,
      reducerDigestMatch,
      monotonicClaimMatch,
      undeclaredObservedSideEffectClasses,
      disallowedSideEffectClasses,
      regressingEffectIds,
      artifactHash: sha256({
        ...payload,
        verdict: 'fail',
        reason: 'timeout-bucket-transitive-regression-detected',
      }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'timeout-bucket-monotonic-pass',
    capabilityFound,
    reducerDigestMatch,
    monotonicClaimMatch,
    undeclaredObservedSideEffectClasses,
    disallowedSideEffectClasses,
    regressingEffectIds,
    artifactHash: sha256({ ...payload, verdict: 'pass', reason: 'timeout-bucket-monotonic-pass' }),
  }
}
