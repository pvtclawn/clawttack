/**
 * v05 battle loop: runs both A and B agents from one process.
 *
 * Required env:
 *   CLAWTTACK_BATTLE
 *   CLAWTTACK_OPPONENT_PRIVATE_KEY
 *
 * Optional env:
 *   CLAWTTACK_RPC (default: https://sepolia.base.org)
 *   CLAWTTACK_MAX_TURNS (default: 120)
 *   CLAWTTACK_VOP_MODE (default: hash-only) // hash-only | mixed
 *   CLAWTTACK_CHECKPOINT_PATH
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { ethers } from 'ethers'

const RPC = process.env.CLAWTTACK_RPC?.trim() || 'https://sepolia.base.org'
const BATTLE_ADDRESS = mustEnv('CLAWTTACK_BATTLE')
const OPPONENT_PRIVATE_KEY = mustEnv('CLAWTTACK_OPPONENT_PRIVATE_KEY')
const VOP_MODE = (process.env.CLAWTTACK_VOP_MODE?.trim() || 'hash-only').toLowerCase()
const MAX_TURNS = Number.parseInt(process.env.CLAWTTACK_MAX_TURNS || '120', 10)
const CHECKPOINT_PATH = process.env.CLAWTTACK_CHECKPOINT_PATH?.trim()
  || `${process.env.HOME}/.openclaw/workspace/projects/clawttack/battle-results/checkpoints/v05-${BATTLE_ADDRESS.toLowerCase()}.json`

const MAIN_KEY_PATH = `${process.env.HOME}/.foundry/keystores/clawn`
const SECRETS_PATH = `${process.env.HOME}/.config/pvtclawn/secrets.json`
const BIP39_PATH = `${process.env.HOME}/.openclaw/workspace/projects/clawttack/packages/sdk/data/bip39-english.txt`

const L1_BLOCK_PREDEPLOY = '0x4200000000000000000000000000000000000015'

const BATTLE_ABI = [
  'function getBattleState() view returns (uint8 phase, uint32 currentTurn, uint128 bankA, uint128 bankB, bytes32 sequenceHash, uint256 battleId)',
  'function firstMoverA() view returns (bool)',
  'function challengerOwner() view returns (address)',
  'function acceptorOwner() view returns (address)',
  'function targetWordIndex() view returns (uint16)',
  'function poisonWord() view returns (string)',
  'function jokersRemainingA() view returns (uint8)',
  'function jokersRemainingB() view returns (uint8)',
  'function pendingNccA() view returns (bytes32 commitment, uint16[4] candidateWordIndices, uint8 defenderGuessIdx, bool hasDefenderGuess)',
  'function pendingNccB() view returns (bytes32 commitment, uint16[4] candidateWordIndices, uint8 defenderGuessIdx, bool hasDefenderGuess)',
  'function pendingVopA() view returns (bytes32 commitment, uint8 solverClaimedIndex, uint256 solverSolution, uint64 commitBlockNumber, bool solverPassed, bool hasSolverResponse)',
  'function pendingVopB() view returns (bytes32 commitment, uint8 solverClaimedIndex, uint256 solverSolution, uint64 commitBlockNumber, bool solverPassed, bool hasSolverResponse)',
  'function submitTurn((string narrative,string customPoisonWord,(uint16[4] candidateWordIndices,uint16[4] candidateOffsets,bytes32 nccCommitment) nccAttack,(uint8 guessIdx) nccDefense,(bytes32 salt,uint8 intendedIdx) nccReveal,(bytes32 vopCommitment) vopCommit,(uint8 vopClaimedIndex,uint256 solution) vopSolve,(bytes32 vopSalt,uint8 vopIndex) vopReveal) payload)',
] as const

const L1_BLOCK_ABI = [
  'function number() view returns (uint64)',
  'function basefee() view returns (uint256)',
] as const

type AgentSide = 'A' | 'B'

type RevealCheckpoint = {
  nccSalt: `0x${string}`
  nccIdx: number
  vopSalt: `0x${string}`
  vopIdx: number
  turn: number
}

type Checkpoint = {
  battle: string
  lastTurn: number
  lastSubmitBlock: number | null
  prevByAgent: {
    A: RevealCheckpoint | null
    B: RevealCheckpoint | null
  }
  lastNarrativeByAgent: {
    A: string | null
    B: string | null
  }
  results: Array<{
    turn: number
    agent: AgentSide
    txHash: string
    gasUsed: string
    blockNumber: number
    bankA: string
    bankB: string
    vopClaimedIndex: number
    vopCommittedIndex: number
    vopSolved: boolean
    nccGuess: number
  }>
}

function mustEnv(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

function ensureDir(path: string): void {
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function loadWords(): string[] {
  const txt = readFileSync(BIP39_PATH, 'utf8')
  return txt.split(/\r?\n/).map((w) => w.trim().toLowerCase()).filter(Boolean)
}

function loadCheckpoint(): Checkpoint {
  if (!existsSync(CHECKPOINT_PATH)) {
    return {
      battle: BATTLE_ADDRESS.toLowerCase(),
      lastTurn: -1,
      lastSubmitBlock: null,
      prevByAgent: { A: null, B: null },
      lastNarrativeByAgent: { A: null, B: null },
      results: [],
    }
  }
  const raw = JSON.parse(readFileSync(CHECKPOINT_PATH, 'utf8'))
  return raw as Checkpoint
}

function saveCheckpoint(cp: Checkpoint): void {
  ensureDir(CHECKPOINT_PATH)
  writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 2))
}

function encodePackedHash(types: string[], values: unknown[]): `0x${string}` {
  return ethers.solidityPackedKeccak256(types as any, values as any) as `0x${string}`
}

function byteOffset(haystack: string, needle: string): number {
  const idx = haystack.toLowerCase().indexOf(needle.toLowerCase())
  if (idx < 0) return -1
  return new TextEncoder().encode(haystack.slice(0, idx)).length
}

const NARRATIVE_MAX_BYTES = 240
const NARRATIVE_MIN_BYTES = 72

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

function pickCandidates(words: string[], target: string, poison: string, seed: number): string[] {
  const safe = words.filter((w) => w !== target && w !== poison && w.length >= 4)
  if (safe.length < 16) throw new Error('Not enough safe BIP39 words')
  const base = Math.abs(seed) % safe.length
  const chosen: string[] = []
  const offsets = [7, 53, 109, 167, 223, 281, 337, 389]
  for (const step of offsets) {
    const candidate = safe[(base + step) % safe.length]
    if (!chosen.includes(candidate)) {
      chosen.push(candidate)
    }
    if (chosen.length === 4) {
      return chosen
    }
  }
  throw new Error('Unable to pick 4 unique candidates')
}

function chooseVopIndex(turn: number): number {
  if (VOP_MODE === 'mixed') return turn % 2
  return 0
}

type NarrativeTemplateFamily = 'chain' | 'ledger' | 'relay'

type TurnConstructionDiagnostics = {
  target: string
  candidates: string[]
  poison: string
  narrative: string
  byteLength: number
  offsets: number[]
  missingCandidates: string[]
  targetPresent: boolean
  poisonPresent: boolean
  templateFamily: NarrativeTemplateFamily
  fallbackStep: number
}

type TurnConstructionResult = {
  narrative: string
  offsets: number[]
  templateFamily: NarrativeTemplateFamily
  fallbackStep: number
}

function validateNarrative(input: {
  target: string
  candidates: string[]
  poison: string
  narrative: string
  templateFamily: NarrativeTemplateFamily
  fallbackStep: number
}): TurnConstructionDiagnostics {
  const offsets = input.candidates.map((w) => byteOffset(input.narrative, w))
  return {
    target: input.target,
    candidates: input.candidates,
    poison: input.poison,
    narrative: input.narrative,
    byteLength: byteLength(input.narrative),
    offsets,
    missingCandidates: input.candidates.filter((_, idx) => offsets[idx] < 0),
    targetPresent: byteOffset(input.narrative, input.target) >= 0,
    poisonPresent: byteOffset(input.narrative, input.poison) >= 0,
    templateFamily: input.templateFamily,
    fallbackStep: input.fallbackStep,
  }
}

function buildNarrativeFromTemplate(input: {
  turn: number
  side: AgentSide
  target: string
  candidates: string[]
  vopIndex: number
  templateFamily: NarrativeTemplateFamily
  fallbackStep: number
}): string {
  const sideLabel = input.side === 'A' ? 'Challenger' : 'Defender'
  const hint = input.vopIndex === 0 ? 'hashpulse' : 'metasync'
  const [c1, c2, c3, c4] = input.candidates

  const variants: Record<NarrativeTemplateFamily, string> = {
    chain: `${sideLabel} turn ${input.turn}: ${input.target} threads ${c1}, ${c2}, ${c3}, ${c4}. ${hint} route stable now.`,
    ledger: `${sideLabel} ${input.turn}: ${input.target} maps ${c1} -> ${c2} -> ${c3} -> ${c4}. ${hint} confirms clean ledger.`,
    relay: `${input.target} links ${c1}, ${c2}, ${c3}, ${c4}. ${sideLabel} turn ${input.turn}; ${hint} relay holds firm.`,
  }

  let text = variants[input.templateFamily]
  const fillerOptions = [
    '',
    ' Sequence remains coherent.',
    ' Timing stays aligned.',
    ' Route pressure is contained.',
  ]

  if (input.fallbackStep < fillerOptions.length) {
    text += fillerOptions[input.fallbackStep]
  }

  if (byteLength(text) < NARRATIVE_MIN_BYTES) {
    text += ' Signal path remains stable.'
  }

  return text
}

function constructNarrative(input: {
  turn: number
  side: AgentSide
  target: string
  poison: string
  candidates: string[]
  vopIndex: number
}): TurnConstructionResult {
  const templateFamilies: NarrativeTemplateFamily[] = ['chain', 'ledger', 'relay']
  const diagnostics: TurnConstructionDiagnostics[] = []

  for (const templateFamily of templateFamilies) {
    for (let fallbackStep = 0; fallbackStep < 3; fallbackStep++) {
      const narrative = buildNarrativeFromTemplate({
        turn: input.turn,
        side: input.side,
        target: input.target,
        candidates: input.candidates,
        vopIndex: input.vopIndex,
        templateFamily,
        fallbackStep,
      })
      const result = validateNarrative({
        target: input.target,
        candidates: input.candidates,
        poison: input.poison,
        narrative,
        templateFamily,
        fallbackStep,
      })
      diagnostics.push(result)

      if (
        result.byteLength <= NARRATIVE_MAX_BYTES
        && result.byteLength >= NARRATIVE_MIN_BYTES
        && result.targetPresent
        && !result.poisonPresent
        && result.missingCandidates.length === 0
      ) {
        return {
          narrative,
          offsets: result.offsets,
          templateFamily,
          fallbackStep,
        }
      }
    }
  }

  console.error('❌ turn construction diagnostics:', JSON.stringify(diagnostics, null, 2))
  throw new Error('turn construction failed after deterministic template attempts')
}

function guessVopIndexFromNarrative(narrative: string | null): number {
  if (!narrative) return 0
  const n = narrative.toLowerCase()
  if (n.includes('metasync')) return 1
  if (n.includes('hashpulse')) return 0
  return 0
}

async function solveHashPreimage(provider: ethers.JsonRpcProvider, commitBlock: number): Promise<bigint> {
  const block = await provider.getBlock(commitBlock)
  const seed = block?.hash
  if (!seed) return 0n

  const difficulty = 8 + (commitBlock % 4)
  const shift = 256n - BigInt(difficulty)
  const abi = ethers.AbiCoder.defaultAbiCoder()

  for (let i = 0n; i < 2_000_000n; i++) {
    const encoded = abi.encode(['bytes32', 'uint256'], [seed, i])
    const h = BigInt(ethers.keccak256(encoded))
    if ((h >> shift) === 0n) return i
  }
  return 0n
}

async function solveL1Metadata(provider: ethers.JsonRpcProvider, commitBlock: number): Promise<bigint> {
  const block = await provider.getBlock(commitBlock)
  const seed = block?.hash
  if (!seed) return 0n
  const l1 = new ethers.Contract(L1_BLOCK_PREDEPLOY, L1_BLOCK_ABI, provider)
  const [l1Number, l1BaseFee] = await Promise.all([l1.number(), l1.basefee()])
  const abi = ethers.AbiCoder.defaultAbiCoder()
  const encoded = abi.encode(['uint64', 'uint256', 'bytes32'], [BigInt(l1Number), BigInt(l1BaseFee), seed])
  return BigInt(ethers.keccak256(encoded))
}

async function solveVop(provider: ethers.JsonRpcProvider, index: number, commitBlock: number): Promise<bigint> {
  if (index === 0) return solveHashPreimage(provider, commitBlock)
  if (index === 1) return solveL1Metadata(provider, commitBlock)
  return 0n
}

async function submitWithRetry(contract: ethers.Contract, payload: any): Promise<ethers.TransactionReceipt> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const est = await contract.submitTurn.estimateGas(payload)
      const gasLimit = (est * BigInt(130 + attempt * 15)) / 100n
      const tx = await contract.submitTurn(payload, { gasLimit })
      const rc = await tx.wait()
      if (!rc || Number(rc.status) !== 1) throw new Error('submit failed: status != 1')
      return rc
    } catch (err: any) {
      const msg = String(err?.shortMessage || err?.message || '')
      if (attempt < 4 && (msg.includes('BattleNotActive') || msg.includes('TurnTooFast') || msg.includes('replacement'))) {
        await new Promise((r) => setTimeout(r, 5000 * attempt))
        continue
      }
      throw err
    }
  }
  throw new Error('submit retries exhausted')
}

async function main(): Promise<void> {
  const words = loadWords()
  const provider = new ethers.JsonRpcProvider(RPC)

  const secrets = JSON.parse(readFileSync(SECRETS_PATH, 'utf8'))
  const pw = secrets.WALLET_PASSWORD
  if (!pw) throw new Error('WALLET_PASSWORD missing')

  const encrypted = readFileSync(MAIN_KEY_PATH, 'utf8')
  const walletA = (await ethers.Wallet.fromEncryptedJson(encrypted, pw)).connect(provider)
  const walletB = new ethers.Wallet(OPPONENT_PRIVATE_KEY, provider)

  const battleRead = new ethers.Contract(BATTLE_ADDRESS, BATTLE_ABI, provider)
  const challengerOwner = String(await battleRead.challengerOwner()).toLowerCase()
  const acceptorOwner = String(await battleRead.acceptorOwner()).toLowerCase()

  if (challengerOwner !== walletA.address.toLowerCase() && challengerOwner !== walletB.address.toLowerCase()) {
    throw new Error(`Neither managed wallet matches challengerOwner ${challengerOwner}`)
  }
  if (acceptorOwner !== walletA.address.toLowerCase() && acceptorOwner !== walletB.address.toLowerCase()) {
    throw new Error(`Neither managed wallet matches acceptorOwner ${acceptorOwner}`)
  }

  const cp = loadCheckpoint()
  const firstMoverA = Boolean(await battleRead.firstMoverA())

  console.log(`🏟️  v05 loop on ${BATTLE_ADDRESS}`)
  console.log(`🔑 A wallet: ${walletA.address}`)
  console.log(`🔑 B wallet: ${walletB.address}`)
  console.log(`🧭 first mover A=${firstMoverA}`)

  for (let step = 0; step < MAX_TURNS; step++) {
    const [phaseRaw, turnRaw, bankA, bankB, _seqHash, battleId] = await battleRead.getBattleState()
    const phase = Number(phaseRaw)
    const turn = Number(turnRaw)

    if (phase !== 1) {
      console.log(`🏁 stop: phase=${phase} turn=${turn} bankA=${bankA} bankB=${bankB}`)
      break
    }

    const currentBlock = await provider.getBlockNumber()
    if (cp.lastSubmitBlock !== null && currentBlock < cp.lastSubmitBlock + 5) {
      await new Promise((r) => setTimeout(r, 3500))
      continue
    }

    const isATurn = firstMoverA ? (turn % 2 === 0) : (turn % 2 === 1)
    const side: AgentSide = isATurn ? 'A' : 'B'
    const other: AgentSide = side === 'A' ? 'B' : 'A'
    const actor = side === 'A' ? walletA : walletB
    const battle = new ethers.Contract(BATTLE_ADDRESS, BATTLE_ABI, actor)

    const targetIdx = Number(await battleRead.targetWordIndex())
    const target = words[targetIdx]
    const poison = String(await battleRead.poisonWord())

    const candidates = pickCandidates(words, target, poison, turn + (side === 'A' ? 17 : 31))
    const intendedIdx = (turn + (side === 'A' ? 1 : 2)) % 4
    const vopIndex = chooseVopIndex(turn + (side === 'A' ? 0 : 1))
    const nccSalt = ethers.hexlify(ethers.randomBytes(32)) as `0x${string}`
    const vopSalt = ethers.hexlify(ethers.randomBytes(32)) as `0x${string}`

    const constructed = constructNarrative({ turn, side, target, poison, candidates, vopIndex })
    const narrative = constructed.narrative

    const nccCommitment = encodePackedHash(
      ['uint256', 'uint256', 'string', 'bytes32', 'uint8'],
      [battleId, BigInt(turn), 'NCC', nccSalt, intendedIdx],
    )
    const vopCommitment = encodePackedHash(
      ['uint256', 'uint256', 'string', 'bytes32', 'uint8'],
      [battleId, BigInt(turn), 'VOP', vopSalt, vopIndex],
    )

    const wordIndices = candidates.map((w) => words.indexOf(w))
    const offsets = constructed.offsets
    if (wordIndices.some((v) => v < 0)) {
      throw new Error(`candidate index encoding failed for ${JSON.stringify(candidates)}`)
    }

    const oppNcc = side === 'A' ? await battleRead.pendingNccB() : await battleRead.pendingNccA()
    const nccGuess = String(oppNcc.commitment) === ethers.ZeroHash
      ? 0
      : ((turn + (side === 'A' ? 3 : 1)) % 4)

    const prev = cp.prevByAgent[side]
    const nccReveal = prev && turn >= 2
      ? { salt: prev.nccSalt, intendedIdx: prev.nccIdx }
      : { salt: ethers.ZeroHash, intendedIdx: 0 }
    const vopReveal = prev && turn >= 2
      ? { vopSalt: prev.vopSalt, vopIndex: prev.vopIdx }
      : { vopSalt: ethers.ZeroHash, vopIndex: 0 }

    const oppVop = side === 'A' ? await battleRead.pendingVopB() : await battleRead.pendingVopA()
    let vopClaimedIndex = 0
    let vopSolution = 0n
    let vopSolved = false

    if (String(oppVop.commitment) !== ethers.ZeroHash) {
      vopClaimedIndex = guessVopIndexFromNarrative(cp.lastNarrativeByAgent[other])
      const commitBlock = Number(oppVop.commitBlockNumber)
      vopSolution = await solveVop(provider, vopClaimedIndex, commitBlock)
      vopSolved = vopSolution !== 0n || vopClaimedIndex === 1
    }

    const customPoison = side === 'A' ? 'ember' : 'cipher'

    const payload = {
      narrative,
      customPoisonWord: customPoison,
      nccAttack: {
        candidateWordIndices: wordIndices,
        candidateOffsets: offsets,
        nccCommitment,
      },
      nccDefense: { guessIdx: nccGuess },
      nccReveal,
      vopCommit: { vopCommitment },
      vopSolve: { vopClaimedIndex, solution: vopSolution },
      vopReveal,
    }

    console.log(
      `\n🎮 turn=${turn} side=${side} bankA=${bankA} bankB=${bankB} target=${target} poison=${poison} template=${constructed.templateFamily} fallback=${constructed.fallbackStep}`,
    )
    const rc = await submitWithRetry(battle, payload)

    cp.prevByAgent[side] = {
      nccSalt,
      nccIdx: intendedIdx,
      vopSalt,
      vopIdx: vopIndex,
      turn,
    }
    cp.lastNarrativeByAgent[side] = narrative
    cp.lastTurn = turn
    cp.lastSubmitBlock = Number(rc.blockNumber)
    cp.results.push({
      turn,
      agent: side,
      txHash: rc.hash,
      gasUsed: rc.gasUsed.toString(),
      blockNumber: Number(rc.blockNumber),
      bankA: bankA.toString(),
      bankB: bankB.toString(),
      vopClaimedIndex,
      vopCommittedIndex: vopIndex,
      vopSolved,
      nccGuess,
    })
    saveCheckpoint(cp)

    await new Promise((r) => setTimeout(r, 3000))
  }

  console.log(`✅ v05 loop complete. saved checkpoint=${CHECKPOINT_PATH}`)
}

main().catch((err) => {
  console.error('❌ v05 battle loop failed:', err)
  process.exit(1)
})
