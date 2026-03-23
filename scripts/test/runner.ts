#!/usr/bin/env bun
/**
 * E2E Test Runner — discovers and runs scenario files with TAP-style output.
 *
 * Usage:
 *   bun scripts/test/runner.ts                    # run all scenarios
 *   bun scripts/test/runner.ts --filter 07        # run only matching scenarios
 *   RPC_URL=https://... bun scripts/test/runner.ts # run against remote chain
 */

import { readdirSync } from 'fs'
import { join, basename } from 'path'
import type { TestResult, ScenarioFn } from './harness'
import { isLocal } from './harness'

const args = process.argv.slice(2)
const filterIdx = args.indexOf('--filter')
const filter = filterIdx >= 0 ? args[filterIdx + 1] : null

const scenariosDir = join(import.meta.dir, 'scenarios')
const files = readdirSync(scenariosDir)
  .filter(f => f.endsWith('.ts'))
  .sort()
  .filter(f => !filter || f.includes(filter))

console.log('')
console.log('═══════════════════════════════════════════════════════')
console.log('  🦞 Clawttack E2E Test Suite')
console.log('═══════════════════════════════════════════════════════')
console.log(`  Environment: ${isLocal ? 'Local Anvil' : process.env.RPC_URL}`)
console.log(`  Scenarios:   ${files.length}${filter ? ` (filter: "${filter}")` : ''}`)
console.log('')

let totalPassed = 0
let totalFailed = 0
let totalSkipped = 0
const allResults: { file: string; results: TestResult[] }[] = []

for (const file of files) {
  const path = join(scenariosDir, file)
  const mod = await import(path)
  const name = basename(file, '.ts')

  console.log(`── ${name} ──────────────────────────────────────────`)

  if (mod.localOnly && !isLocal) {
    console.log('  ⏭️  Skipped (local-only scenario)')
    totalSkipped++
    continue
  }

  try {
    const results: TestResult[] = await mod.default()
    allResults.push({ file: name, results })

    for (const r of results) {
      if (r.passed) totalPassed++
      else totalFailed++
    }
  } catch (err: any) {
    console.log(`  💥 Scenario crashed: ${err.message}`)
    totalFailed++
    allResults.push({ file: name, results: [{ name: 'scenario crash', passed: false, error: err.message, duration: 0 }] })
  }
  console.log('')
}

console.log('═══════════════════════════════════════════════════════')
console.log(`  Results: ${totalPassed} passed, ${totalFailed} failed${totalSkipped ? `, ${totalSkipped} skipped` : ''}`)
if (totalFailed === 0) {
  console.log('  ✅ ALL TESTS PASSED')
} else {
  console.log('  ❌ SOME TESTS FAILED:')
  for (const { file, results } of allResults) {
    for (const r of results) {
      if (!r.passed) console.log(`     - ${file}/${r.name}: ${r.error}`)
    }
  }
}
console.log('═══════════════════════════════════════════════════════')
console.log('')

process.exit(totalFailed > 0 ? 1 : 0)
