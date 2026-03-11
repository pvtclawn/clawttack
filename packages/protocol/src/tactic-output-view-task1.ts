import { createHash } from 'node:crypto'

export type TacticOutputViewTask1Role =
  | 'public-reader'
  | 'operator-debug'
  | 'research-metrics'
  | 'internal-verifier'

export type TacticOutputViewTask1Mode =
  | 'tactic-output-view-public-reader'
  | 'tactic-output-view-operator-debug'
  | 'tactic-output-view-research-metrics'
  | 'tactic-output-view-internal-verifier'

export type TacticOutputViewTask1RoleMatrix = Record<TacticOutputViewTask1Role, string[]>

export interface TacticOutputViewTask1Input {
  role: TacticOutputViewTask1Role
  linkedIdentity: `0x${string}`
  publicFields: Record<string, string>
  auditFields: Record<string, string>
  roleMatrix: TacticOutputViewTask1RoleMatrix
}

export interface TacticOutputViewTask1Artifact {
  linkedIdentity: `0x${string}`
  role: TacticOutputViewTask1Role
  fields: Record<string, string>
}

export interface TacticOutputViewTask1Result {
  mode: TacticOutputViewTask1Mode
  artifact: TacticOutputViewTask1Artifact
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

const normalizeText = (value: string): string => value.trim()

const normalizeRecord = (value: Record<string, string>): Record<string, string> => {
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b))
  const normalized: Record<string, string> = {}
  for (const key of keys) {
    normalized[key] = normalizeText(value[key] ?? '')
  }
  return normalized
}

const normalizeList = (value: string[]): string[] =>
  [...new Set(value.map((item) => item.trim()).filter((item) => item.length > 0))].sort((a, b) =>
    a.localeCompare(b),
  )

const normalizeRoleMatrix = (value: TacticOutputViewTask1RoleMatrix): TacticOutputViewTask1RoleMatrix => ({
  'public-reader': normalizeList(value['public-reader'] ?? []),
  'operator-debug': normalizeList(value['operator-debug'] ?? []),
  'research-metrics': normalizeList(value['research-metrics'] ?? []),
  'internal-verifier': normalizeList(value['internal-verifier'] ?? []),
})

const roleToMode = (role: TacticOutputViewTask1Role): TacticOutputViewTask1Mode => {
  switch (role) {
    case 'public-reader':
      return 'tactic-output-view-public-reader'
    case 'operator-debug':
      return 'tactic-output-view-operator-debug'
    case 'research-metrics':
      return 'tactic-output-view-research-metrics'
    case 'internal-verifier':
      return 'tactic-output-view-internal-verifier'
  }
}

export const compileTacticOutputViewTask1 = (
  input: TacticOutputViewTask1Input,
): TacticOutputViewTask1Result => {
  const publicFields = normalizeRecord(input.publicFields)
  const auditFields = normalizeRecord(input.auditFields)
  const roleMatrix = normalizeRoleMatrix(input.roleMatrix)
  const combinedFields = {
    ...auditFields,
    ...publicFields,
  }

  const allowedKeys = roleMatrix[input.role]
  const roleFields: Record<string, string> = {}
  for (const key of allowedKeys) {
    if (key in combinedFields) {
      roleFields[key] = combinedFields[key] ?? ''
    }
  }

  const artifact: TacticOutputViewTask1Artifact = {
    linkedIdentity: input.linkedIdentity,
    role: input.role,
    fields: roleFields,
  }

  const mode = roleToMode(input.role)

  return {
    mode,
    artifact,
    artifactHash: sha256({
      input: {
        ...input,
        publicFields,
        auditFields,
        roleMatrix,
      },
      mode,
      artifact,
    }),
  }
}
