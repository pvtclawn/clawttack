import { createHash } from 'node:crypto'

export type InteractionTask1Reason =
  | 'interaction-consistency-pass'
  | 'interaction-prereq-conflict'
  | 'interaction-evidence-incomplete'

export type InteractionModuleName =
  | 'caveat'
  | 'triangulation'
  | 'trace'
  | 'safetyLiveness'
  | 'responsiveness'

export interface InteractionModuleVerdict {
  module: InteractionModuleName
  verdict: 'pass' | 'fail'
}

export interface VerificationClaimInteractionTask1Input {
  aggregateVerdict: 'pass' | 'fail'
  moduleVerdicts: InteractionModuleVerdict[]
}

export interface VerificationClaimInteractionTask1Result {
  verdict: 'pass' | 'fail'
  reason: InteractionTask1Reason
  completenessHash: `0x${string}`
  missingModules: InteractionModuleName[]
  conflictingModules: InteractionModuleName[]
  artifactHash: `0x${string}`
}

const REQUIRED_MODULES: InteractionModuleName[] = [
  'caveat',
  'triangulation',
  'trace',
  'safetyLiveness',
  'responsiveness',
]

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

export const evaluateVerificationClaimInteractionTask1 = (
  input: VerificationClaimInteractionTask1Input,
): VerificationClaimInteractionTask1Result => {
  const verdictMap = new Map<InteractionModuleName, 'pass' | 'fail'>()
  input.moduleVerdicts.forEach((entry) => {
    verdictMap.set(entry.module, entry.verdict)
  })

  const missingModules = REQUIRED_MODULES.filter((module) => !verdictMap.has(module))
  const conflictingModules = REQUIRED_MODULES.filter((module) => verdictMap.get(module) === 'fail')

  const completenessHash = sha256({
    requiredModules: REQUIRED_MODULES,
    moduleVerdicts: REQUIRED_MODULES.map((module) => ({ module, verdict: verdictMap.get(module) ?? 'missing' })),
  })

  const payload = {
    aggregateVerdict: input.aggregateVerdict,
    moduleVerdicts: REQUIRED_MODULES.map((module) => ({ module, verdict: verdictMap.get(module) ?? 'missing' })),
    missingModules,
    conflictingModules,
    completenessHash,
  }

  if (missingModules.length > 0) {
    return {
      verdict: 'fail',
      reason: 'interaction-evidence-incomplete',
      completenessHash,
      missingModules,
      conflictingModules,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'interaction-evidence-incomplete' }),
    }
  }

  if (input.aggregateVerdict === 'pass' && conflictingModules.length > 0) {
    return {
      verdict: 'fail',
      reason: 'interaction-prereq-conflict',
      completenessHash,
      missingModules,
      conflictingModules,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'interaction-prereq-conflict' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'interaction-consistency-pass',
    completenessHash,
    missingModules,
    conflictingModules,
    artifactHash: sha256({ ...payload, verdict: 'pass', reason: 'interaction-consistency-pass' }),
  }
}
