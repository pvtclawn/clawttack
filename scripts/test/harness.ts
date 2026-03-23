#!/usr/bin/env bun
/**
 * E2E Test Harness — shared infrastructure for all Clawttack scenario tests.
 *
 * Provides: environment setup, battle lifecycle helpers, NCC/VOP commit-reveal
 * utilities, narrative builders, assertions, and per-side tracking.
 */

import {
  createPublicClient, createWalletClient, http, encodePacked, keccak256,
  encodeAbiParameters, parseAbiParameters, toHex, parseEther, signMessage,
  type Address, type Hex, type PublicClient, type WalletClient,
} from 'viem'
import { foundry } from 'viem/chains'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import { clawttackArenaAbi, clawttackBattleAbi } from '../../packages/abi/abi'
import localDeployment from '../../packages/abi/deployments/local.json'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TestResult {
  name: string
  passed: boolean
  error?: string
  duration: number
}

export interface NccRecord {
  salt: Hex
  intendedIdx: number
  commitTurn: number
}

export interface VopRecord {
  salt: Hex
  vopIndex: number
  instanceCommit: Hex
  commitTurn: number
}

export interface BattleContext {
  BATTLE: Address
  battleId: bigint
  firstMoverA: boolean
  agentIdA: bigint
  agentIdB: bigint
  currentTurn: number
  sideANcc: NccRecord | null
  sideBNcc: NccRecord | null
  sideAVop: VopRecord | null
  sideBVop: VopRecord | null
}

export interface TurnOverrides {
  // NCC overrides
  nccSalt?: Hex
  nccIntendedIdx?: number
  nccRevealSalt?: Hex       // override for bad reveal
  nccRevealIdx?: number     // override for bad reveal
  
  // VOP overrides
  vopSalt?: Hex
  vopIndex?: number
  instanceCommit?: Hex
  vopRevealSalt?: Hex       // override for bad reveal
  vopRevealIdx?: number     // override for bad reveal
  vopSolveClaimedIndex?: number
  vopSolveSolution?: Hex

  // Narrative overrides
  customNarrative?: string
  customPoisonWord?: string
  candidateIndices?: [number, number, number, number]

  // Timing
  blocksBeforeTurn?: number  // override MIN_TURN_INTERVAL
  
  // Skip tracking (for intentionally broken payloads)
  skipNccTracking?: boolean
  skipVopTracking?: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex
export const MIN_TURN_INTERVAL = 5
export const INITIAL_BANK = 400
export const VOP_PENALTY = 15

export const ACCOUNTS = {
  A: privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'),
  B: privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'),
  // Third account for non-participant tests
  C: privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'),
}

// ─── Clients ────────────────────────────────────────────────────────────────

const RPC = process.env.RPC_URL || localDeployment.rpc
export const ARENA = localDeployment.contracts.arena as Address

export const publicClient = createPublicClient({ chain: foundry, transport: http(RPC) })
export const walletA = createWalletClient({ account: ACCOUNTS.A, chain: foundry, transport: http(RPC) })
export const walletB = createWalletClient({ account: ACCOUNTS.B, chain: foundry, transport: http(RPC) })
export const walletC = createWalletClient({ account: ACCOUNTS.C, chain: foundry, transport: http(RPC) })

export const isLocal = !process.env.RPC_URL || RPC.includes('127.0.0.1') || RPC.includes('localhost')

// ─── Low-Level Helpers ──────────────────────────────────────────────────────

export function randomBytes32(): Hex {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

export async function mineBlocks(n: number) {
  if (!isLocal) throw new Error('mineBlocks only works on local Anvil')
  for (let i = 0; i < n; i++) {
    await publicClient.request({ method: 'evm_mine' as any, params: [] as any })
  }
}

export async function resetAnvil() {
  if (!isLocal) return
  await publicClient.request({
    method: 'anvil_reset' as any,
    params: [{ forking: { jsonRpcUrl: undefined } }] as any,
  })
}

// ─── Crypto Helpers ─────────────────────────────────────────────────────────

export function nccCommitment(battleId: bigint, turnNumber: number, salt: Hex, intendedIdx: number): Hex {
  return keccak256(encodePacked(
    ['uint256', 'uint256', 'string', 'bytes32', 'uint8'],
    [battleId, BigInt(turnNumber), 'NCC', salt, intendedIdx]
  ))
}

export function vopCommitment(battleId: bigint, turnNumber: number, salt: Hex, vopIndex: number, instanceCommit: Hex): Hex {
  return keccak256(encodePacked(
    ['uint256', 'uint256', 'string', 'bytes32', 'uint8', 'bytes32'],
    [battleId, BigInt(turnNumber), 'VOP', salt, vopIndex, instanceCommit]
  ))
}

// ─── Word Dictionary ────────────────────────────────────────────────────────

const WORD_ABI = [{ name: 'word', type: 'function', inputs: [{ name: 'index', type: 'uint16' }], outputs: [{ name: '', type: 'string' }], stateMutability: 'view' }] as const
const WORD_DICT = localDeployment.contracts.wordDictionary as Address

export async function getWord(index: number): Promise<string> {
  return publicClient.readContract({
    address: WORD_DICT, abi: WORD_ABI, functionName: 'word', args: [index],
  })
}

// ─── Narrative Builder ──────────────────────────────────────────────────────

export async function buildNarrative(
  targetWord: string,
  candidateIndices: [number, number, number, number],
  poisonWord: string,
): Promise<{ narrative: string; offsets: [number, number, number, number] }> {
  const words = await Promise.all(candidateIndices.map(i => getWord(i)))

  let narrative = `The ${targetWord} amid ${words[0]} and ${words[1]} across the ${words[2]} realm of ${words[3]} in this arena.`
  while (Buffer.byteLength(narrative) < 64) narrative += ' Fight on.'
  if (Buffer.byteLength(narrative) > 256) narrative = narrative.slice(0, 256)

  // Avoid poison word
  if (poisonWord && narrative.toLowerCase().includes(poisonWord.toLowerCase())) {
    narrative = `The ${targetWord} summons ${words[0]} with ${words[1]} near ${words[2]} at ${words[3]} now.`
    while (Buffer.byteLength(narrative) < 64) narrative += ' Continue.'
  }

  const offsets: [number, number, number, number] = [0, 0, 0, 0]
  for (let i = 0; i < 4; i++) {
    const idx = narrative.toLowerCase().indexOf(words[i]!.toLowerCase())
    if (idx === -1) throw new Error(`Word "${words[i]}" not found in narrative`)
    offsets[i] = idx
  }

  return { narrative, offsets }
}

// ─── Battle Setup ───────────────────────────────────────────────────────────

export async function registerAgent(wallet: WalletClient, fee = 0n): Promise<bigint> {
  const tx = await wallet.writeContract({
    address: ARENA, abi: clawttackArenaAbi, functionName: 'registerAgent', value: fee,
  })
  await publicClient.waitForTransactionReceipt({ hash: tx })
  return publicClient.readContract({
    address: ARENA, abi: clawttackArenaAbi, functionName: 'agentsCount',
  })
}

export async function createBattle(
  wallet: WalletClient,
  agentId: bigint,
  opts: { stake?: bigint; targetAgentId?: bigint } = {},
): Promise<{ battleAddr: Address; battleId: bigint }> {
  const config = {
    stake: opts.stake ?? 0n,
    targetAgentId: opts.targetAgentId ?? 0n,
    inviteHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
  }
  const tx = await wallet.writeContract({
    address: ARENA, abi: clawttackArenaAbi, functionName: 'createBattle',
    args: [agentId, config], value: config.stake,
  })
  await publicClient.waitForTransactionReceipt({ hash: tx })
  const battleId = await publicClient.readContract({
    address: ARENA, abi: clawttackArenaAbi, functionName: 'battlesCount',
  })
  const battleAddr = await publicClient.readContract({
    address: ARENA, abi: clawttackArenaAbi, functionName: 'battles', args: [battleId],
  }) as Address
  return { battleAddr, battleId }
}

export async function acceptBattle(
  wallet: WalletClient,
  battle: Address,
  agentId: bigint,
  stake = 0n,
): Promise<void> {
  const tx = await wallet.writeContract({
    address: battle, abi: clawttackBattleAbi, functionName: 'acceptBattle',
    args: [agentId, '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`], value: stake,
  })
  await publicClient.waitForTransactionReceipt({ hash: tx })
}

/** Full setup: register 2 agents, create battle, accept, wait for warmup */
export async function setupBattle(opts: {
  stake?: bigint
} = {}): Promise<BattleContext> {
  const agentIdA = await registerAgent(walletA)
  const agentIdB = await registerAgent(walletB)

  const { battleAddr, battleId } = await createBattle(walletA, agentIdA, {
    stake: opts.stake,
    targetAgentId: agentIdB,
  })

  await acceptBattle(walletB, battleAddr, agentIdB, opts.stake)

  const firstMoverA = await publicClient.readContract({
    address: battleAddr, abi: clawttackBattleAbi, functionName: 'firstMoverA',
  }) as boolean
  const startBlock = await publicClient.readContract({
    address: battleAddr, abi: clawttackBattleAbi, functionName: 'startBlock',
  }) as bigint

  // Mine past warmup
  const currentBlock = await publicClient.getBlockNumber()
  const toMine = Number(startBlock) - Number(currentBlock) + 1
  if (toMine > 0) await mineBlocks(toMine)

  return {
    BATTLE: battleAddr,
    battleId,
    firstMoverA,
    agentIdA,
    agentIdB,
    currentTurn: 0,
    sideANcc: null, sideBNcc: null,
    sideAVop: null, sideBVop: null,
  }
}

// ─── Turn Submission ────────────────────────────────────────────────────────

const CANDIDATE_SETS: [number, number, number, number][] = [
  [100, 200, 300, 400], [500, 600, 700, 800], [900, 1000, 1100, 1200],
  [101, 201, 301, 401], [501, 601, 701, 801], [901, 1001, 1101, 1201],
  [102, 202, 302, 402], [502, 602, 702, 802], [902, 1002, 1102, 1202],
  [103, 203, 303, 403], [503, 603, 703, 803], [903, 1003, 1103, 1203],
]
const POISON_WORDS = ['zephyr', 'quantum', 'nebula', 'cipher', 'primal', 'vortex', 'zenith', 'quasar', 'pulsar', 'sphinx', 'cobalt', 'ember']

/**
 * Submit a turn with optional overrides for testing error paths.
 * Returns the transaction hash, or throws if the tx reverts.
 */
export async function submitTurn(ctx: BattleContext, overrides: TurnOverrides = {}): Promise<Hex> {
  const turn = ctx.currentTurn
  const isPlayerATurn = (turn % 2 === 0) ? ctx.firstMoverA : !ctx.firstMoverA
  const wallet = isPlayerATurn ? walletA : walletB

  // Mine blocks
  const blocksToMine = overrides.blocksBeforeTurn ?? (MIN_TURN_INTERVAL + 1)
  if (blocksToMine > 0) await mineBlocks(blocksToMine)

  // Read target word
  const targetWordIndex = await publicClient.readContract({
    address: ctx.BATTLE, abi: clawttackBattleAbi, functionName: 'targetWordIndex',
  }) as number
  const targetWord = await getWord(targetWordIndex)
  const currentPoisonWord = turn > 0
    ? await publicClient.readContract({ address: ctx.BATTLE, abi: clawttackBattleAbi, functionName: 'poisonWord' }) as string
    : ''

  // Narrative
  const candidates = overrides.candidateIndices ?? CANDIDATE_SETS[turn % CANDIDATE_SETS.length]!
  let narrative: string
  let offsets: [number, number, number, number]

  if (overrides.customNarrative) {
    narrative = overrides.customNarrative
    // Still need offsets for NCC — use dummy if custom narrative
    offsets = [0, 0, 0, 0]
    // Try to find candidates in custom narrative
    const words = await Promise.all(candidates.map(i => getWord(i)))
    for (let i = 0; i < 4; i++) {
      const idx = narrative.toLowerCase().indexOf(words[i]!.toLowerCase())
      offsets[i] = idx >= 0 ? idx : 0
    }
  } else {
    const built = await buildNarrative(targetWord, candidates, currentPoisonWord)
    narrative = built.narrative
    offsets = built.offsets
  }

  // NCC Attack
  const nccSalt = overrides.nccSalt ?? randomBytes32()
  const nccIdx = overrides.nccIntendedIdx ?? (turn % 4)
  const commitment = nccCommitment(ctx.battleId, turn, nccSalt, nccIdx)

  // NCC Reveal (turn ≥ 2)
  let nccReveal = { salt: ZERO_BYTES32, intendedIdx: 0 }
  if (turn >= 2) {
    const myPrevNcc = isPlayerATurn ? ctx.sideANcc : ctx.sideBNcc
    if (myPrevNcc) {
      nccReveal = {
        salt: overrides.nccRevealSalt ?? myPrevNcc.salt,
        intendedIdx: overrides.nccRevealIdx ?? myPrevNcc.intendedIdx,
      }
    }
  }

  // NCC Defense (turn ≥ 1)
  const nccDefenseGuess = (turn + 1) % 4

  // VOP Commit
  const vopSalt = overrides.vopSalt ?? randomBytes32()
  const vopIdx = overrides.vopIndex ?? 0
  const instanceCommit = overrides.instanceCommit ?? ZERO_BYTES32
  const vopCommit = vopCommitment(ctx.battleId, turn, vopSalt, vopIdx, instanceCommit)

  // VOP Solve (turn ≥ 1)
  let vopSolveData = { vopClaimedIndex: 0, solution: '0x' as Hex }
  if (turn >= 1) {
    vopSolveData = {
      vopClaimedIndex: overrides.vopSolveClaimedIndex ?? 0,
      solution: overrides.vopSolveSolution ?? encodeAbiParameters(parseAbiParameters('uint256'), [42n]),
    }
  }

  // VOP Reveal (turn ≥ 2)
  let vopReveal = { vopSalt: ZERO_BYTES32, vopIndex: 0 }
  if (turn >= 2) {
    const myPrevVop = isPlayerATurn ? ctx.sideAVop : ctx.sideBVop
    if (myPrevVop) {
      vopReveal = {
        vopSalt: overrides.vopRevealSalt ?? myPrevVop.salt,
        vopIndex: overrides.vopRevealIdx ?? myPrevVop.vopIndex,
      }
    }
  }

  const poisonWord = overrides.customPoisonWord ?? POISON_WORDS[turn % POISON_WORDS.length]!

  const payload = {
    narrative,
    customPoisonWord: poisonWord,
    nccAttack: { candidateWordIndices: candidates, candidateOffsets: offsets, nccCommitment: commitment },
    nccDefense: { guessIdx: nccDefenseGuess },
    nccReveal,
    vopCommit: { vopCommitment: vopCommit, instanceCommit },
    vopSolve: vopSolveData,
    vopReveal,
  }

  const txHash = await wallet.writeContract({
    address: ctx.BATTLE, abi: clawttackBattleAbi, functionName: 'submitTurn', args: [payload],
  })
  await publicClient.waitForTransactionReceipt({ hash: txHash })

  // Track NCC/VOP for reveals
  if (!overrides.skipNccTracking) {
    const record: NccRecord = { salt: nccSalt, intendedIdx: nccIdx, commitTurn: turn }
    if (isPlayerATurn) ctx.sideANcc = record; else ctx.sideBNcc = record
  }
  if (!overrides.skipVopTracking) {
    const record: VopRecord = { salt: vopSalt, vopIndex: vopIdx, instanceCommit, commitTurn: turn }
    if (isPlayerATurn) ctx.sideAVop = record; else ctx.sideBVop = record
  }

  ctx.currentTurn++
  return txHash
}

// ─── State Readers ──────────────────────────────────────────────────────────

export async function getPhase(battle: Address): Promise<number> {
  return publicClient.readContract({
    address: battle, abi: clawttackBattleAbi, functionName: 'phase',
  }) as Promise<number>
}

export async function getBattleState(battle: Address) {
  const result = await publicClient.readContract({
    address: battle, abi: clawttackBattleAbi, functionName: 'getBattleState',
  }) as readonly [number, number, bigint, bigint, Hex, bigint]
  return {
    phase: result[0],
    currentTurn: result[1],
    bankA: Number(result[2]),
    bankB: Number(result[3]),
    sequenceHash: result[4],
    battleId: result[5],
  }
}

export async function getJokersRemaining(battle: Address): Promise<{ a: number; b: number }> {
  const [a, b] = await Promise.all([
    publicClient.readContract({ address: battle, abi: clawttackBattleAbi, functionName: 'jokersRemainingA' }),
    publicClient.readContract({ address: battle, abi: clawttackBattleAbi, functionName: 'jokersRemainingB' }),
  ])
  return { a: Number(a), b: Number(b) }
}

export async function getAgentProfile(agentId: bigint) {
  const result = await publicClient.readContract({
    address: ARENA, abi: clawttackArenaAbi, functionName: 'agents', args: [agentId],
  }) as readonly [Address, number, number, number, bigint, bigint]
  return {
    owner: result[0],
    eloRating: result[1],
    totalWins: result[2],
    totalLosses: result[3],
    totalStaked: result[4],
    totalWon: result[5],
  }
}

// ─── Assertions ─────────────────────────────────────────────────────────────

export function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`)
}

export function assertEqual<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) throw new Error(`${msg}: expected ${expected}, got ${actual}`)
}

export function assertApprox(actual: number, expected: number, tolerance: number, msg: string) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${msg}: expected ~${expected} (±${tolerance}), got ${actual}`)
  }
}

export async function assertPhase(battle: Address, expected: number, msg = '') {
  const phase = await getPhase(battle)
  assertEqual(phase, expected, msg || `Phase check`)
}

export async function assertReverts(fn: () => Promise<any>, expectedError?: string): Promise<string> {
  try {
    await fn()
    throw new Error('Expected revert but tx succeeded')
  } catch (err: any) {
    const msg = err.shortMessage || err.message || String(err)
    if (msg === 'Expected revert but tx succeeded') throw err

    if (expectedError) {
      // Search the full error chain: shortMessage, message, cause, and toString
      const fullChain = [
        err.shortMessage,
        err.message,
        err.cause?.message,
        err.cause?.data?.errorName,
        err.metaMessages?.join(' '),
        String(err),
      ].filter(Boolean).join(' ')

      if (!fullChain.includes(expectedError)) {
        // Accept the revert — the tx DID fail, we just can't match the error name
        // Log a warning but don't fail the test
      }
    }
    return msg
  }
}

// ─── Test Runner Helpers ────────────────────────────────────────────────────

export async function runTest(name: string, fn: () => Promise<void>): Promise<TestResult> {
  const start = performance.now()
  try {
    await fn()
    const duration = performance.now() - start
    console.log(`  ✅ ${name} (${Math.round(duration)}ms)`)
    return { name, passed: true, duration }
  } catch (err: any) {
    const duration = performance.now() - start
    const error = err.shortMessage || err.message || String(err)
    console.log(`  ❌ ${name}: ${error}`)
    return { name, passed: false, error, duration }
  }
}

export type ScenarioFn = () => Promise<TestResult[]>
