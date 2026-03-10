import { createHash } from 'node:crypto'

export type GlobalObservabilityTask1Reason =
  | 'global-observability-pass'
  | 'global-witness-auth-invalid'
  | 'global-witness-diversity-insufficient'

export interface GlobalWitness {
  witnessId: string
  isAuthentic: boolean
  operatorClass: string
  regionClass: string
}

export interface GlobalObservabilityTask1Input {
  requiredWitnesses: number
  minOperatorClasses: number
  minRegionClasses: number
  witnesses: GlobalWitness[]
}

export interface GlobalObservabilityTask1Result {
  verdict: 'pass' | 'fail'
  reason: GlobalObservabilityTask1Reason
  invalidWitnessIds: string[]
  uniqueWitnesses: number
  operatorClassCount: number
  regionClassCount: number
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

export const evaluateVerificationClaimGlobalObservabilityTask1 = (
  input: GlobalObservabilityTask1Input,
): GlobalObservabilityTask1Result => {
  const invalidWitnessIds = input.witnesses.filter((w) => !w.isAuthentic).map((w) => w.witnessId)

  const uniqueWitnessIds = new Set(input.witnesses.map((w) => w.witnessId))
  const operatorClasses = new Set(input.witnesses.map((w) => w.operatorClass))
  const regionClasses = new Set(input.witnesses.map((w) => w.regionClass))

  const uniqueWitnesses = uniqueWitnessIds.size
  const operatorClassCount = operatorClasses.size
  const regionClassCount = regionClasses.size

  const payload = {
    input,
    invalidWitnessIds,
    uniqueWitnesses,
    operatorClassCount,
    regionClassCount,
  }

  if (invalidWitnessIds.length > 0) {
    return {
      verdict: 'fail',
      reason: 'global-witness-auth-invalid',
      invalidWitnessIds,
      uniqueWitnesses,
      operatorClassCount,
      regionClassCount,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'global-witness-auth-invalid' }),
    }
  }

  if (
    uniqueWitnesses < input.requiredWitnesses ||
    operatorClassCount < input.minOperatorClasses ||
    regionClassCount < input.minRegionClasses
  ) {
    return {
      verdict: 'fail',
      reason: 'global-witness-diversity-insufficient',
      invalidWitnessIds,
      uniqueWitnesses,
      operatorClassCount,
      regionClassCount,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'global-witness-diversity-insufficient' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'global-observability-pass',
    invalidWitnessIds,
    uniqueWitnesses,
    operatorClassCount,
    regionClassCount,
    artifactHash: sha256({ ...payload, verdict: 'pass', reason: 'global-observability-pass' }),
  }
}
