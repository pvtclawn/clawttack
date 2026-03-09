import { createHash } from 'node:crypto'

export type FixtureVisibility = 'public' | 'hidden'

export interface FailureMatrixTask1Config {
  seed: string
  schemaVersion: string
  configVersion: string
  moduleSet: string[]
}

export interface FailureMatrixFixture {
  fixtureId: string
  moduleName: string
  failureClass: string
  visibility: FixtureVisibility
  input: unknown
}

export interface FailureMatrixRunContext {
  seed: string
  schemaVersion: string
  configVersion: string
  moduleSet: string[]
  fixtureId: string
  moduleName: string
  failureClass: string
  visibility: FixtureVisibility
}

export interface FailureMatrixResult {
  fixtureId: string
  visibility: FixtureVisibility
  passed: boolean
  replayHash: `0x${string}`
}

export interface FailureMatrixTask1Report {
  total: number
  public: {
    count: number
    passed: number
    failed: number
  }
  hidden: {
    count: number
    passed: number
    failed: number
  }
  results: FailureMatrixResult[]
}

const missingContextError = (field: string): Error =>
  new Error(`incomplete-run-context:${field}`)

const requireNonEmptyString = (value: string, field: string): void => {
  if (!value || value.trim().length === 0) {
    throw missingContextError(field)
  }
}

const requireNonEmptyArray = (value: string[], field: string): void => {
  if (!Array.isArray(value) || value.length === 0) {
    throw missingContextError(field)
  }

  const invalid = value.some((item) => !item || item.trim().length === 0)
  if (invalid) {
    throw missingContextError(field)
  }
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

export const buildFailureMatrixRunContext = (
  config: FailureMatrixTask1Config,
  fixture: FailureMatrixFixture,
): FailureMatrixRunContext => {
  requireNonEmptyString(config.seed, 'seed')
  requireNonEmptyString(config.schemaVersion, 'schemaVersion')
  requireNonEmptyString(config.configVersion, 'configVersion')
  requireNonEmptyArray(config.moduleSet, 'moduleSet')

  requireNonEmptyString(fixture.fixtureId, 'fixtureId')
  requireNonEmptyString(fixture.moduleName, 'moduleName')
  requireNonEmptyString(fixture.failureClass, 'failureClass')

  return {
    seed: config.seed,
    schemaVersion: config.schemaVersion,
    configVersion: config.configVersion,
    moduleSet: [...config.moduleSet].sort((a, b) => a.localeCompare(b)),
    fixtureId: fixture.fixtureId,
    moduleName: fixture.moduleName,
    failureClass: fixture.failureClass,
    visibility: fixture.visibility,
  }
}

export const computeFailureMatrixReplayHash = (
  context: FailureMatrixRunContext,
  fixtureInput: unknown,
): `0x${string}` => {
  const preimage = stableStringify({
    context,
    fixtureInput,
  })

  const digest = createHash('sha256').update(preimage).digest('hex')
  return `0x${digest}`
}

export const runFailureMatrixTask1 = (
  fixtures: FailureMatrixFixture[],
  config: FailureMatrixTask1Config,
  evaluator: (fixture: FailureMatrixFixture) => boolean,
): FailureMatrixTask1Report => {
  const results = fixtures.map((fixture) => {
    const context = buildFailureMatrixRunContext(config, fixture)

    return {
      fixtureId: fixture.fixtureId,
      visibility: fixture.visibility,
      passed: evaluator(fixture),
      replayHash: computeFailureMatrixReplayHash(context, fixture.input),
    } satisfies FailureMatrixResult
  })

  const publicResults = results.filter((r) => r.visibility === 'public')
  const hiddenResults = results.filter((r) => r.visibility === 'hidden')

  return {
    total: results.length,
    public: {
      count: publicResults.length,
      passed: publicResults.filter((r) => r.passed).length,
      failed: publicResults.filter((r) => !r.passed).length,
    },
    hidden: {
      count: hiddenResults.length,
      passed: hiddenResults.filter((r) => r.passed).length,
      failed: hiddenResults.filter((r) => !r.passed).length,
    },
    results,
  }
}
