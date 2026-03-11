import { createHash } from 'node:crypto'

export type TacticOutputContractTask1Mode =
  | 'tactic-output-contract-public'
  | 'tactic-output-contract-audit'
  | 'tactic-output-contract-blocked'

export interface TacticOutputContractTask1Input {
  caseKey: string
  blocked: boolean
  publicFields: Record<string, string>
  auditFields: Record<string, string>
  publicAllowlist: string[]
}

export interface TacticOutputContractTask1Artifact {
  linkedIdentity: `0x${string}`
  fields: Record<string, string>
}

export interface TacticOutputContractTask1Result {
  mode: TacticOutputContractTask1Mode
  publicArtifact: TacticOutputContractTask1Artifact
  auditArtifact: TacticOutputContractTask1Artifact
  publicArtifactHash: `0x${string}`
  auditArtifactHash: `0x${string}`
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

const normalizeText = (value: string): string => value.trim()

const normalizeRecord = (value: Record<string, string>): Record<string, string> => {
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b))
  const normalized: Record<string, string> = {}
  for (const key of keys) {
    normalized[key] = normalizeText(value[key] ?? '')
  }
  return normalized
}

const normalizeAllowlist = (value: string[]): string[] =>
  [...new Set(value.map((item) => item.trim()).filter((item) => item.length > 0))].sort((a, b) =>
    a.localeCompare(b),
  )

export const compileTacticOutputContractTask1 = (
  input: TacticOutputContractTask1Input,
): TacticOutputContractTask1Result => {
  const caseKey = normalizeText(input.caseKey)
  const publicFields = normalizeRecord(input.publicFields)
  const auditFields = normalizeRecord(input.auditFields)
  const publicAllowlist = normalizeAllowlist(input.publicAllowlist)
  const linkedIdentity = sha256({ caseKey })

  const baseAuditFields = {
    ...auditFields,
    ...publicFields,
  }

  const allowedPublicFields: Record<string, string> = {}
  for (const key of publicAllowlist) {
    if (key in baseAuditFields) {
      allowedPublicFields[key] = baseAuditFields[key] ?? ''
    }
  }

  const publicArtifact: TacticOutputContractTask1Artifact = {
    linkedIdentity,
    fields: input.blocked
      ? {
          status: 'blocked',
        }
      : allowedPublicFields,
  }

  const auditArtifact: TacticOutputContractTask1Artifact = {
    linkedIdentity,
    fields: input.blocked
      ? {
          ...baseAuditFields,
          status: 'blocked',
        }
      : baseAuditFields,
  }

  const mode: TacticOutputContractTask1Mode = input.blocked
    ? 'tactic-output-contract-blocked'
    : 'tactic-output-contract-public'

  return {
    mode,
    publicArtifact,
    auditArtifact,
    publicArtifactHash: sha256({ mode, surface: 'public', artifact: publicArtifact }),
    auditArtifactHash: sha256({ mode: input.blocked ? 'tactic-output-contract-blocked' : 'tactic-output-contract-audit', surface: 'audit', artifact: auditArtifact }),
  }
}
