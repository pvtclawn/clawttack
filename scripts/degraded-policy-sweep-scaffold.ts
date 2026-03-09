#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

type SabotageMode = 'none' | 'false_flag_poisoning' | 'telemetry_degradation'

type SweepPoint = {
  payoutCapRatio: number
  multiplierCap: number
  degradeAbuseCounterThreshold: number
}

type SweepCell = {
  id: string
  mode: SabotageMode
  point: SweepPoint
  deltas: {
    colluderEvDelta: number
    honestRetentionDelta: number
  }
  signFlipFlags: {
    colluderEvSignFlip: boolean
    honestRetentionSignFlip: boolean
  }
}

type SweepArtifact = {
  generatedAt: string
  status: 'scaffold'
  purpose: string
  parameterGrid: {
    payoutCapRatio: number[]
    multiplierCap: number[]
    degradeAbuseCounterThreshold: number[]
  }
  sabotageModes: SabotageMode[]
  cellCount: number
  baselineReference: {
    colluderEvDeltaSign: 'negative-is-better'
    honestRetentionDeltaSign: 'positive-is-better'
  }
  cells: SweepCell[]
  signFlipSummary: Record<SabotageMode, { colluderEvSignFlips: number; honestRetentionSignFlips: number }>
  nextImplementationSteps: string[]
}

const SABOTAGE_MODES: SabotageMode[] = ['none', 'false_flag_poisoning', 'telemetry_degradation']

const PAYOUT_CAP_GRID = parseNumberList(process.env.SWEEP_PAYOUT_CAPS ?? '0.5,0.6,0.7,0.8')
const MULTIPLIER_CAP_GRID = parseNumberList(process.env.SWEEP_MULTIPLIER_CAPS ?? '1.0,1.05,1.1,1.2')
const ABUSE_THRESHOLD_GRID = parseIntList(process.env.SWEEP_ABUSE_THRESHOLDS ?? '2,3,4')

function parseNumberList(raw: string): number[] {
  return raw.split(',').map((v) => Number(v.trim())).filter((v) => Number.isFinite(v))
}

function parseIntList(raw: string): number[] {
  return raw.split(',').map((v) => Number(v.trim())).filter((v) => Number.isInteger(v))
}

function assertGrid(name: string, grid: number[]) {
  if (grid.length === 0) throw new Error(`${name} must not be empty`)
}

function simulateDelta(mode: SabotageMode, point: SweepPoint): { colluderEvDelta: number; honestRetentionDelta: number } {
  const modeBias = mode === 'none' ? 0.02 : mode === 'false_flag_poisoning' ? -0.01 : -0.03
  const colluderEvDelta = Number((modeBias + (point.payoutCapRatio - 0.65) * 0.2 - (point.multiplierCap - 1.05) * 0.15 + (point.degradeAbuseCounterThreshold - 3) * 0.01).toFixed(4))
  const honestRetentionDelta = Number((0.03 + (point.payoutCapRatio - 0.65) * 0.25 + (point.multiplierCap - 1.05) * 0.12 - (point.degradeAbuseCounterThreshold - 3) * 0.015).toFixed(4))
  return { colluderEvDelta, honestRetentionDelta }
}

function buildCells(): SweepCell[] {
  const cells: SweepCell[] = []

  for (const mode of SABOTAGE_MODES) {
    let prev: { colluderEvDelta: number; honestRetentionDelta: number } | undefined

    for (const payoutCapRatio of PAYOUT_CAP_GRID) {
      for (const multiplierCap of MULTIPLIER_CAP_GRID) {
        for (const degradeAbuseCounterThreshold of ABUSE_THRESHOLD_GRID) {
          const point: SweepPoint = { payoutCapRatio, multiplierCap, degradeAbuseCounterThreshold }
          const deltas = simulateDelta(mode, point)

          const signFlipFlags = {
            colluderEvSignFlip: prev ? Math.sign(prev.colluderEvDelta) !== Math.sign(deltas.colluderEvDelta) : false,
            honestRetentionSignFlip: prev ? Math.sign(prev.honestRetentionDelta) !== Math.sign(deltas.honestRetentionDelta) : false,
          }

          cells.push({
            id: `${mode}__p${payoutCapRatio.toFixed(2)}__m${multiplierCap.toFixed(2)}__t${degradeAbuseCounterThreshold}`,
            mode,
            point,
            deltas,
            signFlipFlags,
          })

          prev = deltas
        }
      }
    }
  }

  return cells
}

function summarizeSignFlips(cells: SweepCell[]): SweepArtifact['signFlipSummary'] {
  const summary: SweepArtifact['signFlipSummary'] = {
    none: { colluderEvSignFlips: 0, honestRetentionSignFlips: 0 },
    false_flag_poisoning: { colluderEvSignFlips: 0, honestRetentionSignFlips: 0 },
    telemetry_degradation: { colluderEvSignFlips: 0, honestRetentionSignFlips: 0 },
  }

  for (const cell of cells) {
    if (cell.signFlipFlags.colluderEvSignFlip) summary[cell.mode].colluderEvSignFlips += 1
    if (cell.signFlipFlags.honestRetentionSignFlip) summary[cell.mode].honestRetentionSignFlips += 1
  }

  return summary
}

function main() {
  assertGrid('SWEEP_PAYOUT_CAPS', PAYOUT_CAP_GRID)
  assertGrid('SWEEP_MULTIPLIER_CAPS', MULTIPLIER_CAP_GRID)
  assertGrid('SWEEP_ABUSE_THRESHOLDS', ABUSE_THRESHOLD_GRID)

  const cells = buildCells()
  const artifact: SweepArtifact = {
    generatedAt: new Date().toISOString(),
    status: 'scaffold',
    purpose: 'Deterministic degraded-policy sweep scaffold with sign-flip detection for monotonicity checks',
    parameterGrid: {
      payoutCapRatio: PAYOUT_CAP_GRID,
      multiplierCap: MULTIPLIER_CAP_GRID,
      degradeAbuseCounterThreshold: ABUSE_THRESHOLD_GRID,
    },
    sabotageModes: SABOTAGE_MODES,
    cellCount: cells.length,
    baselineReference: {
      colluderEvDeltaSign: 'negative-is-better',
      honestRetentionDeltaSign: 'positive-is-better',
    },
    cells,
    signFlipSummary: summarizeSignFlips(cells),
    nextImplementationSteps: [
      'Replace scaffold deltas with simulation-engine outputs',
      'Attach subgroup guardrail checks per sweep cell',
      'Extract mode-specific safe bands and overlap score',
    ],
  }

  const outDir = join(process.cwd(), '..', '..', 'memory', 'metrics')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, `degraded-policy-sweep-scaffold-${new Date().toISOString().slice(0, 10)}.json`)
  writeFileSync(outPath, JSON.stringify(artifact, null, 2))

  console.log(outPath)
  console.log(JSON.stringify({ cellCount: artifact.cellCount, signFlipSummary: artifact.signFlipSummary }, null, 2))
}

main()
