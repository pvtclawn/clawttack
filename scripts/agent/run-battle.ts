#!/usr/bin/env bun
/**
 * Run a battle between two fighters.
 *
 * Usage:
 *   bun scripts/agent/run-battle.ts --a script --b script
 *   bun scripts/agent/run-battle.ts --a llm --b script
 *   bun scripts/agent/run-battle.ts --a llm --b llm --rounds 5
 *
 * Environment:
 *   RPC_URL — Anvil endpoint (default: http://127.0.0.1:8545)
 *   LLM_URL, LLM_API_KEY, LLM_MODEL — for LLM strategy
 */

import { type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { Fighter, type FightResult, type Strategy } from './fighter'
import { scriptStrategy } from './strategies/script'
import { llmStrategy } from './strategies/llm'
import { smartLlmStrategy } from './strategies/smart-llm'
import { smartScriptStrategy } from './strategies/smart-script'
import { hermesStrategy } from './strategies/hermes'
import { openclawStrategy } from './strategies/openclaw'
import { agentStrategy } from './strategies/agent'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

// ─── Parse args ─────────────────────────────────────────────────────────

const args = process.argv.slice(2)
function arg(name: string, def = ''): string {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1]! : def
}

const strategyA = arg('a', 'script')
const strategyB = arg('b', 'script')
const rounds = parseInt(arg('rounds', '1'))
const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545'

function pickStrategy(name: string): Strategy {
  if (name === 'llm') return llmStrategy
  if (name === 'smart-llm') return smartLlmStrategy
  if (name === 'smart-script') return smartScriptStrategy
  if (name === 'script') return scriptStrategy
  if (name === 'hermes') return hermesStrategy
  if (name === 'openclaw') return openclawStrategy
  if (name === 'agent') return agentStrategy
  throw new Error(`Unknown strategy: ${name}. Use 'script', 'smart-script', 'llm', 'smart-llm', 'hermes', 'openclaw', or 'agent'.`)
}

// ─── Load deployment ────────────────────────────────────────────────────

function loadDeployment() {
  const p = join(import.meta.dir, '../../packages/abi/deployments/local.json')
  if (!existsSync(p)) throw new Error(`No deployment at ${p}. Run: bash scripts/dev.sh --fast`)
  return JSON.parse(readFileSync(p, 'utf-8')) as {
    contracts: { arena: string; wordDictionary: string }
  }
}

// ─── Run one battle ─────────────────────────────────────────────────────

async function runOneBattle(
  fighterA: Fighter, fighterB: Fighter,
  idA: bigint, idB: bigint,
  labelA: string, labelB: string,
): Promise<{ a: FightResult; b: FightResult } | null> {
  // A creates, B accepts
  const { battleAddr, battleId } = await fighterA.createBattle(idA)
  await fighterB.acceptBattle(battleAddr, idB)

  console.log(`\n⚔️  ${labelA} vs ${labelB} — Battle #${battleId} at ${battleAddr}\n`)

  // Both fight concurrently
  let a: FightResult, b: FightResult
  try {
    ;[a, b] = await Promise.all([
      fighterA.fight(battleAddr).catch((e: Error) => {
        console.error(`\n💥 ${labelA} fight crashed:`, e.message, e.stack)
        return { battleAddress: battleAddr, won: false, reason: 'crash:' + e.message, totalTurns: 0, nccCorrectCount: 0, nccAttemptCount: 0, bankHistory: [], gasUsed: 0n } as FightResult
      }),
      fighterB.fight(battleAddr).catch((e: Error) => {
        console.error(`\n💥 ${labelB} fight crashed:`, e.message, e.stack)
        return { battleAddress: battleAddr, won: false, reason: 'crash:' + e.message, totalTurns: 0, nccCorrectCount: 0, nccAttemptCount: 0, bankHistory: [], gasUsed: 0n } as FightResult
      }),
    ])
  } catch (e: any) {
    console.error(`\n💥 Battle crashed:`, e.message, e.stack)
    return null
  }

  return { a, b }
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main() {
  const sA = pickStrategy(strategyA)
  const sB = pickStrategy(strategyB)

  console.log(`\n🦞 Clawttack Battle Runner`)
  console.log(`  Matchup: ${strategyA} vs ${strategyB}`)
  console.log(`  Rounds: ${rounds}`)
  console.log(`  RPC: ${rpcUrl}`)
  if (strategyA === 'llm' || strategyB === 'llm') {
    console.log(`  LLM: ${process.env.LLM_MODEL || 'google/gemini-2.5-flash-preview'} @ ${process.env.LLM_URL || 'openrouter'}`)
  }
  if (strategyA === 'smart-llm' || strategyB === 'smart-llm') {
    console.log(`  Smart-LLM: ${process.env.LLM_MODEL || 'google/gemini-2.5-flash-preview'} @ ${process.env.LLM_URL || 'openrouter'}`)
  }
  if (['hermes', 'openclaw', 'agent'].includes(strategyA) || ['hermes', 'openclaw', 'agent'].includes(strategyB)) {
    console.log(`  Agent API: ${process.env.OPENROUTER_BASE || 'https://openrouter.ai/api/v1'} (model=${process.env.AGENT_MODEL || process.env.LLM_MODEL || 'nousresearch/hermes-3-llama-3.1-8b'})`)
  }
  console.log()

  // Setup: register agents once, reuse across rounds
  const deploy = loadDeployment()
  const arenaAddr = deploy.contracts.arena as Address
  const wordAddr = deploy.contracts.wordDictionary as Address

  const accA = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
  const accB = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')

  
  // Set execution environments if playing with unified agent frameworks
  if (strategyA === 'openclaw' || strategyA === 'hermes') process.env.AGENT_FRAMEWORK = strategyA
  if (strategyB === 'openclaw' || strategyB === 'hermes') process.env.AGENT_FRAMEWORK = strategyB

  const fighterA = new Fighter({
    strategy: sA, account: accA, rpcUrl,
    arenaAddress: arenaAddr, wordDictAddress: wordAddr,
    label: `${strategyA}(A)`, pollMs: 100, verbose: true,
  })
  const fighterB = new Fighter({
    strategy: sB, account: accB, rpcUrl,
    arenaAddress: arenaAddr, wordDictAddress: wordAddr,
    label: `${strategyB}(B)`, pollMs: 100, verbose: true,
  })

  const idA = await fighterA.register()
  const idB = await fighterB.register()

  const allResults: { round: number; winner: string; turns: number; nccA: string; nccB: string; reason: string }[] = []

  for (let round = 1; round <= rounds; round++) {
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`  Round ${round}/${rounds}`)
    console.log(`${'═'.repeat(60)}`)

    try {
      const result = await runOneBattle(fighterA, fighterB, idA, idB, strategyA, strategyB)
      if (!result) {
        allResults.push({ round, winner: 'error', turns: 0, nccA: '0%', nccB: '0%', reason: 'null' })
        continue
      }
      const { a, b } = result

      const winner = a.won === true ? strategyA : b.won === true ? strategyB : 'draw'
      const turns = Math.max(a.totalTurns, b.totalTurns)
      const nccAcc = (n: FightResult) => n.nccAttemptCount > 0 ? `${((n.nccCorrectCount / n.nccAttemptCount) * 100).toFixed(0)}%` : 'N/A'

      console.log(`\n  🏆 ${winner.toUpperCase()} wins in ${turns} turns`)
      console.log(`  NCC: ${strategyA}=${nccAcc(a)}, ${strategyB}=${nccAcc(b)}`)
      console.log(`  Reason: ${a.won ? a.reason : b.reason}`)

      allResults.push({ round, winner, turns, nccA: nccAcc(a), nccB: nccAcc(b), reason: a.won ? a.reason : b.reason })
    } catch (err: any) {
      console.error(`  ❌ Round ${round} failed: ${err.message?.slice(0, 200)}`)
      allResults.push({ round, winner: 'error', turns: 0, nccA: '0%', nccB: '0%', reason: err.message?.slice(0, 100) })
    }
  }

  // Summary
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  SUMMARY: ${strategyA} vs ${strategyB} (${rounds} rounds)`)
  console.log(`${'═'.repeat(60)}`)

  const aWins = allResults.filter(r => r.winner === strategyA).length
  const bWins = allResults.filter(r => r.winner === strategyB).length
  const errors = allResults.filter(r => r.winner === 'error').length

  console.log(`  ${strategyA}: ${aWins} wins`)
  console.log(`  ${strategyB}: ${bWins} wins`)
  if (errors) console.log(`  Errors: ${errors}`)
  console.log()

  // Save
  const outDir = join(import.meta.dir, '../../local/battles')
  mkdirSync(outDir, { recursive: true })
  const outFile = join(outDir, `${strategyA}-vs-${strategyB}-${Date.now()}.json`)
  writeFileSync(outFile, JSON.stringify({
    matchup: `${strategyA} vs ${strategyB}`,
    timestamp: new Date().toISOString(),
    rounds, aWins, bWins, errors,
    results: allResults,
  }, null, 2))
  console.log(`  Saved: ${outFile}`)
}

main().catch(err => { console.error(err); process.exit(1) })
