#!/usr/bin/env bun
/**
 * V0 Fighter — Autonomous on-chain battle agent for Clawttack.
 *
 * Handles all blockchain interaction: polling, NCC/VOP crypto,
 * state tracking, turn submission. The "brain" is a swappable Strategy.
 */

import {
  createPublicClient, createWalletClient, http, encodePacked, encodeAbiParameters, keccak256, toHex,
  type Address, type Hex, type PublicClient, type WalletClient, type Chain, type Transport,
} from 'viem'
import { foundry } from 'viem/chains'
import { type PrivateKeyAccount } from 'viem/accounts'
import { clawttackArenaAbi, clawttackBattleAbi } from '../../packages/abi/abi'

// ─── Strategy Interface ─────────────────────────────────────────────────

export interface VopExtraction {
  type: string
  keyword?: string
  phrase?: string
  x1?: number; y1?: number; x2?: number; y2?: number
  a?: number; b?: number; op?: number
}

export interface TurnContext {
  turnNumber: number
  targetWord: string
  poisonWord: string
  opponentNarrative: string
  opponentNccCandidates: string[]
  myNccCandidateWords: string[]  // Words the agent must weave into its narrative
  vopTypes: string[]
  opponentVopCommitment: Hex
  opponentVopInstanceCommit: Hex
  opponentVopCommitBlock: number
  myBank: number
  opponentBank: number
  jokersRemaining: number
  battleId: bigint
  battleAddress: Address
  isFirstMover: boolean
  narrativeHistory: string[]
}

export interface StrategyResult {
  narrative: string
  poisonWord: string
  nccGuessIdx: 0 | 1 | 2 | 3
  vopGuessIdx?: number
  myVopIdx?: number
  vopExtraction?: VopExtraction
}

export type Strategy = (ctx: TurnContext) => Promise<StrategyResult>

// ─── Constants ──────────────────────────────────────────────────────────

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex
const DUMMY_VOP_SOLUTION = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex
const MIN_TURN_INTERVAL = 5

/** OP Stack L1Block precompile (provides L1 block number / basefee) */
const L1_GAS_ORACLE = '0x4200000000000000000000000000000000000015' as const
const L1_GAS_ORACLE_ABI = [
  { name: 'number', type: 'function', outputs: [{ type: 'uint64' }] },
  { name: 'basefee', type: 'function', outputs: [{ type: 'uint256' }] },
] as const

const WORD_ABI = [{
  name: 'word', type: 'function',
  inputs: [{ name: 'index', type: 'uint16' }],
  outputs: [{ name: '', type: 'string' }],
  stateMutability: 'view',
}] as const

// ─── Config ─────────────────────────────────────────────────────────────

export interface FighterConfig {
  strategy: Strategy
  account: PrivateKeyAccount
  rpcUrl: string
  arenaAddress: Address
  wordDictAddress: Address
  pollMs?: number
  maxTimeMs?: number
  label?: string
  verbose?: boolean
}

export interface FightResult {
  battleAddress: Address
  won: boolean | null
  reason: string
  totalTurns: number
  nccCorrectCount: number
  nccAttemptCount: number
  bankHistory: { turn: number; my: number; opp: number }[]
  gasUsed: bigint
}

// ─── Helpers ────────────────────────────────────────────────────────────

function randomBytes32(): Hex {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

function makeNccCommitment(battleId: bigint, turn: number, salt: Hex, idx: number): Hex {
  return keccak256(encodePacked(
    ['uint256', 'uint256', 'string', 'bytes32', 'uint8'],
    [battleId, BigInt(turn), 'NCC', salt, idx],
  ))
}

function makeVopCommitment(battleId: bigint, turn: number, salt: Hex, vopIndex: number, instanceCommit: Hex): Hex {
  return keccak256(encodePacked(
    ['uint256', 'uint256', 'string', 'bytes32', 'uint8', 'bytes32'],
    [battleId, BigInt(turn), 'VOP', salt, vopIndex, instanceCommit],
  ))
}

function candidateIndicesForTurn(turn: number): [number, number, number, number] {
  const base = ((turn * 137) + 42) % 2000
  return [base, base + 1, base + 2, base + 3] as [number, number, number, number]
}

// ─── Fighter ────────────────────────────────────────────────────────────

export class Fighter {
  private config: FighterConfig
  private pub: PublicClient
  private wallet: WalletClient<Transport, Chain, PrivateKeyAccount>
  private label: string

  private prevNccSalt: Hex = ZERO_BYTES32
  private prevNccIdx = 0
  private prevNccTurn = -1
  private prevVopSalt: Hex = ZERO_BYTES32
  private prevVopIndex = 0
  private prevVopTurn = -1

  private nccCorrectCount = 0
  private nccAttemptCount = 0
  private bankHistory: { turn: number; my: number; opp: number }[] = []
  private gasUsed = 0n
  private narrativeHistory: string[] = []

  constructor(config: FighterConfig) {
    this.config = config
    this.label = config.label ?? config.account.address.slice(0, 8)
    this.pub = createPublicClient({ chain: foundry, transport: http(config.rpcUrl) })
    this.wallet = createWalletClient({ account: config.account, chain: foundry, transport: http(config.rpcUrl) })
  }

  private log(...args: unknown[]) {
    if (this.config.verbose ?? true) console.log(`[${this.label}]`, ...args)
  }

  private async getWord(index: number): Promise<string> {
    return this.pub.readContract({
      address: this.config.wordDictAddress, abi: WORD_ABI,
      functionName: 'word', args: [index],
    })
  }

  async register(): Promise<bigint> {
    // Check for existing agents owned by this wallet
    const count = await this.pub.readContract({
      address: this.config.arenaAddress, abi: clawttackArenaAbi,
      functionName: 'agentsCount',
    }) as bigint

    for (let i = 1n; i <= count; i++) {
      try {
        const profile = await this.pub.readContract({
          address: this.config.arenaAddress, abi: clawttackArenaAbi,
          functionName: 'agents', args: [i],
        }) as readonly [string, ...unknown[]]
        if (profile[0].toLowerCase() === this.config.account.address.toLowerCase()) {
          this.log(`Reusing existing agent #${i}`)
          return i
        }
      } catch { /* skip unreadable agents */ }
    }

    // No existing agent found — register new one
    const tx = await this.wallet.writeContract({
      address: this.config.arenaAddress, abi: clawttackArenaAbi,
      functionName: 'registerAgent', value: 0n,
    })
    await this.pub.waitForTransactionReceipt({ hash: tx })
    const id = await this.pub.readContract({
      address: this.config.arenaAddress, abi: clawttackArenaAbi,
      functionName: 'agentsCount',
    }) as bigint
    this.log(`Registered as agent #${id}`)
    return id
  }

  async createBattle(agentId: bigint, opts: {
    stake?: bigint; targetAgentId?: bigint;
  } = {}): Promise<{ battleAddr: Address; battleId: bigint }> {
    const config = {
      stake: opts.stake ?? 0n,
      targetAgentId: opts.targetAgentId ?? 0n,
      inviteHash: ZERO_BYTES32,
    }
    const tx = await this.wallet.writeContract({
      address: this.config.arenaAddress, abi: clawttackArenaAbi,
      functionName: 'createBattle', args: [agentId, config], value: config.stake,
    })
    await this.pub.waitForTransactionReceipt({ hash: tx })
    const battleId = await this.pub.readContract({
      address: this.config.arenaAddress, abi: clawttackArenaAbi,
      functionName: 'battlesCount',
    }) as bigint
    const battleAddr = await this.pub.readContract({
      address: this.config.arenaAddress, abi: clawttackArenaAbi,
      functionName: 'battles', args: [battleId],
    }) as Address
    this.log(`Created battle #${battleId} at ${battleAddr}`)
    return { battleAddr, battleId }
  }

  async acceptBattle(battleAddr: Address, agentId: bigint, stake = 0n) {
    const tx = await this.wallet.writeContract({
      address: battleAddr, abi: clawttackBattleAbi,
      functionName: 'acceptBattle', args: [agentId, ZERO_BYTES32], value: stake,
    })
    await this.pub.waitForTransactionReceipt({ hash: tx })
    this.log(`Accepted battle at ${battleAddr}`)
  }

  /** Wait until enough blocks have passed since lastTurnBlock (chain-agnostic) */
  private async waitForMinInterval(battleAddr: Address) {
    while (true) {
      const clock = await this.pub.readContract({
        address: battleAddr, abi: clawttackBattleAbi, functionName: 'clock',
      }) as readonly [bigint, bigint, bigint]
      const lastTurnBlock = Number(clock[2])
      const nowBlock = Number(await this.pub.getBlockNumber())
      if (nowBlock >= lastTurnBlock + MIN_TURN_INTERVAL + 1) break
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  /** Main fight loop */
  async fight(battleAddr: Address): Promise<FightResult> {
    const pollMs = this.config.pollMs ?? 500
    const maxTime = this.config.maxTimeMs ?? 30 * 60 * 1000
    const deadline = Date.now() + maxTime

    const challengerOwner = await this.pub.readContract({
      address: battleAddr, abi: clawttackBattleAbi, functionName: 'challengerOwner',
    }) as Address
    const acceptorOwner = await this.pub.readContract({
      address: battleAddr, abi: clawttackBattleAbi, functionName: 'acceptorOwner',
    }) as Address
    const isAgentA = this.config.account.address.toLowerCase() === challengerOwner.toLowerCase()
    const firstMoverA = await this.pub.readContract({
      address: battleAddr, abi: clawttackBattleAbi, functionName: 'firstMoverA',
    }) as boolean

    this.log(`Fighting as ${isAgentA ? 'Challenger(A)' : 'Acceptor(B)'}, first=${firstMoverA ? 'A' : 'B'}`)
    this.log(`  myAddr=${this.config.account.address.slice(0,10)}  challOwner=${challengerOwner.slice(0,10)}  accOwner=${acceptorOwner.slice(0,10)}`)

    // Wait for warmup period (chain-agnostic — just poll until startBlock passed)
    const startBlock = await this.pub.readContract({
      address: battleAddr, abi: clawttackBattleAbi, functionName: 'startBlock',
    }) as number
    while (Number(await this.pub.getBlockNumber()) < Number(startBlock)) {
      this.log('Waiting for warmup blocks...')
      await new Promise(r => setTimeout(r, 2000))
    }

    let lastProcessedTurn = -1

    let vopTypes: string[] = []
    try {
      const vopCount = await this.pub.readContract({
        address: this.config.arenaAddress, abi: clawttackArenaAbi, functionName: 'getVopCount',
      }) as bigint
      for (let i = 0n; i < vopCount; i++) {
        const vopAddr = await this.pub.readContract({
          address: this.config.arenaAddress, abi: clawttackArenaAbi, functionName: 'getVopByIndex', args: [i],
        }) as Address
        const name = await this.pub.readContract({
          address: vopAddr,
          abi: [{ name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }],
          functionName: 'name',
        }) as string
        vopTypes.push(name)
      }
      this.log(`Loaded ${vopTypes.length} VOP types.`)
    } catch(err) {
      this.log(`⚠️ Failed to load VOP types: ${err}`)
    }
    // BattlePhase enum: Open=0, Active=1, Settled=2, Cancelled=3

    while (Date.now() < deadline) {
      // Read fresh state every loop
      const state = await this.pub.readContract({
        address: battleAddr, abi: clawttackBattleAbi, functionName: 'getBattleState',
      }) as readonly [number, number, bigint, bigint, Hex, bigint]

      const [phase, turn, bankABig, bankBBig, , battleId] = state
      const bankA = Number(bankABig)
      const bankB = Number(bankBBig)

      if (phase === 2 /* Settled */) {
        const myBank = isAgentA ? bankA : bankB
        const oppBank = isAgentA ? bankB : bankA
        this.log(`Battle settled. My bank: ${myBank}, Opp bank: ${oppBank}`)
        return {
          battleAddress: battleAddr,
          won: myBank > oppBank ? true : myBank < oppBank ? false : null,
          reason: 'settled', totalTurns: turn,
          nccCorrectCount: this.nccCorrectCount, nccAttemptCount: this.nccAttemptCount,
          bankHistory: this.bankHistory, gasUsed: this.gasUsed,
        }
      }

      if (phase !== 1 /* Active */) {
        this.log(`⚠️ Unexpected phase ${phase} — waiting...`)
        await new Promise(r => setTimeout(r, pollMs))
        continue
      }

      const isEvenTurn = turn % 2 === 0
      const isATurn = firstMoverA ? isEvenTurn : !isEvenTurn
      const isMyTurn = isAgentA === isATurn

      if (isMyTurn && turn > lastProcessedTurn) {
        try {
          await this.playTurn(battleAddr, battleId, turn, isAgentA, firstMoverA, bankA, bankB, vopTypes)
          lastProcessedTurn = turn

          const newState = await this.pub.readContract({
            address: battleAddr, abi: clawttackBattleAbi, functionName: 'getBattleState',
          }) as readonly [number, number, bigint, bigint, Hex, bigint]
          const newBankA = Number(newState[2])
          const newBankB = Number(newState[3])

          this.bankHistory.push({
            turn,
            my: isAgentA ? newBankA : newBankB,
            opp: isAgentA ? newBankB : newBankA,
          })
        } catch (err: any) {
          const errName = err?.cause?.data?.errorName || ''
          const msg = err.shortMessage || err.message || String(err)
          this.log(`⚠️ Turn ${turn} error: ${errName || msg.slice(0, 80)}`)
          if (errName === 'NotYourTurn' || errName === 'BattleNotActive') {
            // Not our turn or battle not active yet — just wait
          } else if (errName === 'TurnTooFast') {
            // Need more blocks — wait for them naturally
            await new Promise(r => setTimeout(r, 3000))
          } else {
            // Other error — skip this turn to prevent infinite loop
            lastProcessedTurn = turn
          }
        }
      }

      // Try timeout claim when it's not our turn and some turns have happened
      if (!isMyTurn && turn > 2) {
        try {
          // Diagnostic: read clock state before attempting timeout
          const clockState = await this.pub.readContract({
            address: battleAddr, abi: clawttackBattleAbi, functionName: 'clock',
          }) as readonly [bigint, bigint, bigint]
          const nowBlock = Number(await this.pub.getBlockNumber())
          const lastTurnBlk = Number(clockState[2])
          const elapsed = nowBlock - lastTurnBlk
          const clockBankA = Number(clockState[0] & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'))
          const clockBankB = Number((clockState[0] >> 128n) | (clockState[1] & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')))
          this.log(`⏱️ Timeout check: block=${nowBlock} lastTurn=${lastTurnBlk} elapsed=${elapsed} bankA=${bankA} bankB=${bankB}`)

          // Simulate first to avoid wasting gas
          await this.pub.simulateContract({
            address: battleAddr, abi: clawttackBattleAbi,
            functionName: 'claimTimeoutWin',
            account: this.config.account,
          })

          this.log(`⏰ Timeout simulation passed! elapsed=${elapsed} blocks`)
          const tx = await this.wallet.writeContract({
            address: battleAddr, abi: clawttackBattleAbi, functionName: 'claimTimeoutWin',
          })
          await this.pub.waitForTransactionReceipt({ hash: tx })
          this.log(`⏰ Claimed timeout win! elapsed=${elapsed} blocks since lastTurnBlock=${lastTurnBlk}`)
          return {
            battleAddress: battleAddr, won: true, reason: 'timeout_claimed',
            totalTurns: turn, nccCorrectCount: this.nccCorrectCount,
            nccAttemptCount: this.nccAttemptCount, bankHistory: this.bankHistory,
            gasUsed: this.gasUsed,
          }
        } catch { /* Not timed out yet — DeadlineNotExpired */ }
      }

      await new Promise(r => setTimeout(r, pollMs))
    }

    return {
      battleAddress: battleAddr, won: null, reason: 'fighter_timeout',
      totalTurns: 0, nccCorrectCount: 0, nccAttemptCount: 0,
      bankHistory: [], gasUsed: this.gasUsed,
    }
  }

  private async playTurn(
    battleAddr: Address, battleId: bigint, turn: number,
    isAgentA: boolean, firstMoverA: boolean, bankA: number, bankB: number,
    vopTypes: string[]
  ) {
    // Read context immediately (no waiting — gather everything the strategy needs)
    const targetWordIndex = await this.pub.readContract({
      address: battleAddr, abi: clawttackBattleAbi, functionName: 'targetWordIndex',
    }) as number
    const targetWord = await this.getWord(targetWordIndex)
    const currentPoisonWord = turn > 0
      ? await this.pub.readContract({ address: battleAddr, abi: clawttackBattleAbi, functionName: 'poisonWord' }) as string
      : ''

    let jokersRemaining = 0
    try {
      const fn = isAgentA ? 'jokersRemainingA' : 'jokersRemainingB'
      jokersRemaining = Number(await this.pub.readContract({ address: battleAddr, abi: clawttackBattleAbi, functionName: fn }))
    } catch { }

    // Read opponent's last turn data (narrative + NCC candidates)
    let opponentNarrative = ''
    let opponentNccCandidates: string[] = []
    if (turn >= 1) {
      try {
        const logs = await this.pub.getLogs({
          address: battleAddr,
          event: {
            type: 'event',
            name: 'TurnSubmitted',
            inputs: [
              { name: 'battleId', type: 'uint256', indexed: true },
              { name: 'playerId', type: 'uint256', indexed: true },
              { name: 'turnNumber', type: 'uint32', indexed: false },
              { name: 'sequenceHash', type: 'bytes32', indexed: false },
              { name: 'targetWord', type: 'uint16', indexed: false },
              { name: 'poisonWord', type: 'string', indexed: false },
              { name: 'narrative', type: 'string', indexed: false },
              { name: 'bankA', type: 'uint128', indexed: false },
              { name: 'bankB', type: 'uint128', indexed: false },
            ],
          },
          fromBlock: 0n,
          toBlock: 'latest',
        })

        // Find opponent's most recent turn (turn - 1)
        const oppTurnLog = logs.find((l: any) => Number(l.args.turnNumber) === turn - 1)
        if (oppTurnLog) {
          opponentNarrative = (oppTurnLog.args as any).narrative || ''
          this.narrativeHistory.push(opponentNarrative)

          // Decode NCC candidates from the transaction calldata
          try {
            const tx = await this.pub.getTransaction({ hash: oppTurnLog.transactionHash! })
            // submitTurn calldata contains TurnPayload struct with nccAttack.candidateWordIndices
            // Parse the candidateWordIndices from the decoded calldata
            const { decodeFunctionData } = await import('viem')
            const decoded = decodeFunctionData({ abi: clawttackBattleAbi, data: tx.input })
            if (decoded.functionName === 'submitTurn' && decoded.args) {
              const payload = decoded.args[0] as any
              const indices = payload.nccAttack?.candidateWordIndices as number[]
              if (indices) {
                for (const idx of indices) {
                  opponentNccCandidates.push(await this.getWord(idx))
                }
              }
            }
          } catch (e) {
            // Fallback: couldn't decode calldata
          }
        }
      } catch (e) {
        // Fallback: couldn't read logs
      }
    }

    // Read opponent's pending VOP commitment
    let opponentVopCommitment: Hex = ZERO_BYTES32
    let opponentVopInstanceCommit: Hex = ZERO_BYTES32
    let opponentVopCommitBlock: number = 0
    try {
      const fn = isAgentA ? 'pendingVopB' : 'pendingVopA'
      const vopArr = await this.pub.readContract({ address: battleAddr, abi: clawttackBattleAbi, functionName: fn }) as readonly any[]
      // pendingVop struct: commitment[0], solverClaimedIndex[1], solverSolution[2], commitBlockNumber[3], solverPassed[4], hasSolverResponse[5], instanceCommit[6]
      if (vopArr && vopArr.length >= 7) {
        opponentVopCommitment = vopArr[0] as Hex
        opponentVopCommitBlock = Number(vopArr[3])
        opponentVopInstanceCommit = vopArr[6] as Hex
      }
    } catch (e) {
      this.log(`⚠️ Failed to read pending VOP: ${e}`)
    }

    // Build NCC attack — pick safe candidate indices that don't collide with poison
    const poisonLower = currentPoisonWord.toLowerCase()
    const safeCandidateIndices: number[] = []
    const safeCandidateWords: string[] = []
    let searchBase = ((turn * 137) + 42) % 2000
    while (safeCandidateIndices.length < 4 && searchBase < 2048) {
      const word = await this.getWord(searchBase)
      if (!poisonLower || !word.toLowerCase().includes(poisonLower)) {
        safeCandidateIndices.push(searchBase)
        safeCandidateWords.push(word)
      }
      searchBase++
    }
    // Pad if somehow we ran out (shouldn't happen with 2048 words and short poison)
    while (safeCandidateIndices.length < 4) {
      safeCandidateIndices.push(0)
      safeCandidateWords.push('abandon')
    }
    const candidateIndices: [number, number, number, number] = [
      safeCandidateIndices[0]!, safeCandidateIndices[1]!,
      safeCandidateIndices[2]!, safeCandidateIndices[3]!,
    ]

    const ctx: TurnContext = {
      turnNumber: turn, targetWord, poisonWord: currentPoisonWord,
      opponentNarrative, opponentNccCandidates,
      myNccCandidateWords: safeCandidateWords,
      vopTypes, opponentVopCommitment, opponentVopInstanceCommit, opponentVopCommitBlock,
      myBank: isAgentA ? bankA : bankB,
      opponentBank: isAgentA ? bankB : bankA,
      jokersRemaining, battleId, battleAddress: battleAddr,
      isFirstMover: firstMoverA === isAgentA,
      narrativeHistory: this.narrativeHistory.slice(-3),
    }

    // Run strategy directly — no explicit block waiting
    // The contract enforces minTurnInterval via TurnTooFast revert;
    // LLM latency (~8s) already exceeds the 5-block minimum (10s at 2s/block)
    const result = await this.config.strategy(ctx)

    let narrative = result.narrative
    const enc = new TextEncoder()

    // Validate: strip poison word if strategy accidentally included it
    if (poisonLower && narrative.toLowerCase().includes(poisonLower)) {
      this.log(`⚠️ Strategy narrative contained poison "${currentPoisonWord}", using fallback`)
      narrative = `In the ${targetWord} domain we find clarity through adversarial competition and cryptographic proof.`
    }

    // Check which candidate words the agent already wove into the narrative (word-boundary aware)
    const missingCandidates: string[] = []
    for (const word of safeCandidateWords) {
      const wordLower = word.toLowerCase()
      const narLower = narrative.toLowerCase()
      // Check for word-boundary match (not just substring - "aim" inside "airport" doesn't count)
      const regex = new RegExp(`\\b${wordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
      if (!regex.test(narLower)) {
        missingCandidates.push(word)
      }
    }

    // Always ensure total narrative stays within 256 bytes
    // If candidates need appending, truncate narrative first to make room
    if (missingCandidates.length > 0) {
      const spaceNeeded = missingCandidates.reduce((s, w) => s + w.length + 1, 0)
      const maxNarrativeBytes = 256 - spaceNeeded
      if (maxNarrativeBytes < 64) {
        // Not enough room, rebuild with safe fallback
        narrative = `The ${targetWord} echoes across realms of logic and ${safeCandidateWords.join(' ')} proof.`
      } else {
        if (enc.encode(narrative).length > maxNarrativeBytes) {
          narrative = new TextDecoder().decode(enc.encode(narrative).slice(0, maxNarrativeBytes)).trimEnd()
        }
        for (const word of missingCandidates) {
          narrative += ` ${word}`
        }
      }
      if (missingCandidates.length >= 3) {
        this.log(`⚠️ Agent missed ${missingCandidates.length}/4 candidates — narrative quality poor`)
      }
    } else {
      // All candidates present! Just truncate to 256 if needed
      if (enc.encode(narrative).length > 256) {
        // Truncate but verify candidates survive — if not, fall back
        const truncated = new TextDecoder().decode(enc.encode(narrative).slice(0, 256))
        const allPresent = safeCandidateWords.every(w => {
          const regex = new RegExp(`\\b${w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
          return regex.test(truncated.toLowerCase())
        })
        narrative = allPresent ? truncated : narrative.slice(0, 256)
      }
    }

    // Final safety: strip any accidental poison in appended words
    if (poisonLower && narrative.toLowerCase().includes(poisonLower)) {
      const safe = `The ${targetWord} echoes across realms of logic and ${safeCandidateWords.join(' ')} proof.`
      narrative = safe
    }

    // Ensure target word is present
    if (!narrative.toLowerCase().includes(targetWord.toLowerCase())) {
      narrative = `The ${targetWord} ${narrative}`
    }

    // Pad to 64 bytes
    while (enc.encode(narrative).length < 64) { narrative += ' ' }
    // Final truncation — should be safe since we pre-calculated sizes above
    if (enc.encode(narrative).length > 256) {
      narrative = new TextDecoder().decode(enc.encode(narrative).slice(0, 256))
    }

    // Final safety: verify target word survived truncation
    if (!narrative.toLowerCase().includes(targetWord.toLowerCase())) {
      const base = `The ${targetWord} arena calls upon ` + safeCandidateWords.join(' ') + ' for proof.'
      narrative = base.length > 256 ? base.slice(0, 256) : base
      while (enc.encode(narrative).length < 64) { narrative += ' ' }
    }

    this.log(`  📝 narrative[${enc.encode(narrative).length}b]: "${narrative.slice(0, 80)}..."`)
    this.log(`  🎯 target="${targetWord}" poison="${currentPoisonWord}" candidates=[${safeCandidateWords.join(',')}]`)

    const offsets: [number, number, number, number] = [0, 0, 0, 0]
    const encodedNarrative = enc.encode(narrative.toLowerCase())
    for (let i = 0; i < 4; i++) {
      const wordEnc = enc.encode(safeCandidateWords[i]!.toLowerCase())
      let byteIdx = -1
      for (let j = 0; j <= encodedNarrative.length - wordEnc.length; j++) {
        let match = true
        for (let k = 0; k < wordEnc.length; k++) {
          if (encodedNarrative[j + k] !== wordEnc[k]) { match = false; break }
        }
        if (match) { byteIdx = j; break }
      }
      offsets[i] = byteIdx >= 0 ? byteIdx : 0
    }

    const nccSalt = randomBytes32()
    const intendedIdx = turn % 4
    const nccCommit = makeNccCommitment(battleId, turn, nccSalt, intendedIdx)

    const nccReveal = turn >= 2 && this.prevNccTurn === turn - 2
      ? { salt: this.prevNccSalt, intendedIdx: this.prevNccIdx }
      : { salt: ZERO_BYTES32, intendedIdx: 0 }

    const vopSalt = randomBytes32()
    const vopIndex = typeof result.myVopIdx === 'number' ? result.myVopIdx : 0
    const instanceCommit = ZERO_BYTES32
    const vopCommit = makeVopCommitment(battleId, turn, vopSalt, vopIndex, instanceCommit)

    const vopReveal = turn >= 2 && this.prevVopTurn === turn - 2
      ? { vopSalt: this.prevVopSalt, vopIndex: this.prevVopIndex }
      : { vopSalt: ZERO_BYTES32, vopIndex: 0 }

    // VOP solving: only attempt if strategy explicitly returns vopGuessIdx
    // Agents return vopGuessIdx=0, scripts don't return it (skip solving → dummy solution)
    const { vopClaimedIndex, solution: vopSolution } = turn >= 1 && opponentVopCommitBlock > 0 && result.vopGuessIdx !== undefined
      ? await this.solveVop(vopTypes[result.vopGuessIdx] || '', result.vopGuessIdx, opponentVopCommitBlock, opponentVopInstanceCommit, result.vopExtraction)
      : { vopClaimedIndex: 0, solution: (turn >= 1 ? DUMMY_VOP_SOLUTION : '0x') as Hex }

    const vopSolve = { vopClaimedIndex, solution: vopSolution }

    const payload = {
      narrative,
      customPoisonWord: result.poisonWord,
      nccAttack: { candidateWordIndices: candidateIndices, candidateOffsets: offsets, nccCommitment: nccCommit },
      nccDefense: { guessIdx: result.nccGuessIdx },
      nccReveal,
      vopCommit: { vopCommitment: vopCommit, instanceCommit },
      vopSolve,
      vopReveal,
    }

    // Simulate + submit with TurnTooFast retry
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await this.pub.simulateContract({
          address: battleAddr, abi: clawttackBattleAbi,
          functionName: 'submitTurn', args: [payload],
          account: this.config.account,
        })
        break // Simulation passed
      } catch (e: any) {
        const msg = String(e.message || e)
        if (msg.includes('TurnTooFast') && attempt < 4) {
          await new Promise(r => setTimeout(r, 2500)) // wait ~1 block
          continue
        }
        throw e // Other error — propagate
      }
    }

    const txHash = await this.wallet.writeContract({
      address: battleAddr, abi: clawttackBattleAbi,
      functionName: 'submitTurn', args: [payload],
    })
    const receipt = await this.pub.waitForTransactionReceipt({ hash: txHash })
    this.gasUsed += receipt.gasUsed

    this.prevNccSalt = nccSalt
    this.prevNccIdx = intendedIdx
    this.prevNccTurn = turn
    this.prevVopSalt = vopSalt
    this.prevVopIndex = vopIndex
    this.prevVopTurn = turn

    this.narrativeHistory.push(narrative)
    if (this.narrativeHistory.length > 6) this.narrativeHistory.shift()

    this.log(`✅ Turn ${turn} | bank: ${isAgentA ? bankA : bankB} | gas: ${receipt.gasUsed}`)
  }

  private async solveVop(vopType: string, vopIndex: number, commitBlockNumber: number, instanceCommit: Hex, extraction?: VopExtraction): Promise<{ vopClaimedIndex: number; solution: Hex }> {
    if (commitBlockNumber === 0) return { vopClaimedIndex: 0, solution: '0x' }
    let blockSeed = ZERO_BYTES32
    try {
      const block = await this.pub.getBlock({ blockNumber: BigInt(commitBlockNumber) })
      blockSeed = block.hash
    } catch { return { vopClaimedIndex: vopIndex, solution: '0x' } }

    let solution: Hex = '0x'
    try {
      if (vopType === 'PopCount') {
        let temp = BigInt(blockSeed), count = 0n
        while (temp !== 0n) { count += temp & 1n; temp >>= 1n }
        solution = encodeAbiParameters([{ type: 'uint256' }], [count])
      } else if (vopType === 'PrimeModulo') {
        solution = encodeAbiParameters([{ type: 'uint256' }], [BigInt(blockSeed) % 2147483647n])
      } else if (vopType === 'SequenceHash') {
        const prevBlock = await this.pub.getBlock({ blockNumber: BigInt(commitBlockNumber - 1) })
        solution = encodeAbiParameters([{ type: 'uint256' }], [BigInt(keccak256(encodeAbiParameters([{type: 'bytes32'}, {type: 'bytes32'}], [blockSeed, prevBlock.hash])))])
      } else if (vopType === 'TimestampHash') {
        solution = encodeAbiParameters([{ type: 'uint256' }], [BigInt(keccak256(encodeAbiParameters([{type:'bytes32'}, {type:'uint64'}, {type:'string'}], [blockSeed, BigInt(commitBlockNumber), 'TIME'])))])
      } else if (vopType === 'XorFold') {
        const s = BigInt(blockSeed)
        solution = encodeAbiParameters([{ type: 'uint256' }], [(s >> 128n) ^ (s & ((1n << 128n) - 1n))])
      } else if (vopType === 'EntropyMix') {
        solution = encodeAbiParameters([{ type: 'uint256' }], [BigInt(blockSeed) ^ BigInt(keccak256(encodeAbiParameters([{type: 'bytes32'}], [blockSeed])))])
      } else if (vopType === 'CoinbaseHash') {
        solution = encodeAbiParameters([{ type: 'uint256' }], [BigInt(keccak256(encodeAbiParameters([{type:'bytes32'}, {type:'uint64'}, {type:'string'}], [blockSeed, BigInt(commitBlockNumber), 'COINBASE'])))])
      } else if (vopType === 'MirrorHash') {
        solution = encodeAbiParameters([{ type: 'uint256' }], [BigInt(keccak256(encodeAbiParameters([{type:'bytes32'}, {type:'string'}], [blockSeed, 'MIRROR'])))])
      } else if (vopType === 'CascadeHash') {
        let h = keccak256(encodeAbiParameters([{type: 'bytes32'}], [blockSeed]))
        h = keccak256(encodeAbiParameters([{type: 'bytes32'}], [h]))
        h = keccak256(encodeAbiParameters([{type: 'bytes32'}], [h]))
        solution = encodeAbiParameters([{ type: 'uint256' }], [BigInt(h)])
      } else if (vopType === 'FibHash') {
        let a = BigInt(blockSeed) >> 128n, b = BigInt(blockSeed) & ((1n << 128n) - 1n)
        for (let i = 0; i < 10; i++) { const next = a + b; a = b; b = next }
        solution = encodeAbiParameters([{ type: 'uint256' }], [b])
      } else if (vopType === 'BitwiseNot') {
        solution = encodeAbiParameters([{ type: 'uint256' }], [(((1n << 256n) - 1n) ^ BigInt(blockSeed))])
      } else if (vopType === 'HashPreimage') {
        const zeroes = 8 + (commitBlockNumber % 4)
        for(let i = 0n; i < 2000000n; i++) {
          if ((BigInt(keccak256(encodeAbiParameters([{type: 'bytes32'}, {type: 'uint256'}], [blockSeed, i]))) >> BigInt(256 - zeroes)) === 0n) {
            solution = encodeAbiParameters([{ type: 'uint256' }], [i]); break
          }
        }
      } else if (vopType === 'KeywordHash' && extraction?.keyword) {
        const kw = extraction.keyword.toLowerCase()
        if (keccak256(encodeAbiParameters([{type: 'string'}], [kw])) === instanceCommit) {
           solution = encodeAbiParameters([{type: 'uint256'}, {type: 'string'}], [BigInt(keccak256(encodeAbiParameters([{type: 'string'}, {type: 'bytes32'}], [kw, blockSeed]))), kw])
        }
      } else if (vopType === 'PhraseHash' && extraction?.phrase) {
        const p = extraction.phrase.toLowerCase()
        if (keccak256(encodeAbiParameters([{type: 'string'}], [p])) === instanceCommit) {
           solution = encodeAbiParameters([{type: 'uint256'}, {type: 'string'}], [BigInt(keccak256(encodeAbiParameters([{type:'string'},{type:'bytes32'},{type:'uint256'}], [p, blockSeed, BigInt(p.length)]))), p])
        }
      } else if (vopType === 'Coordinate' && extraction?.x1 !== undefined && extraction?.y1 !== undefined) {
         if (keccak256(encodeAbiParameters([{type:'uint256'},{type:'uint256'},{type:'uint256'},{type:'uint256'}], [BigInt(extraction.x1), BigInt(extraction.y1), BigInt(extraction.x2!), BigInt(extraction.y2!)])) === instanceCommit) {
           const dist = BigInt(Math.abs(extraction.x1 - extraction.x2!) + Math.abs(extraction.y1 - extraction.y2!))
           solution = encodeAbiParameters([{type:'uint256'},{type:'uint256'},{type:'uint256'},{type:'uint256'},{type:'uint256'}], [BigInt(keccak256(encodeAbiParameters([{type:'uint256'},{type:'bytes32'}], [dist, blockSeed]))), BigInt(extraction.x1), BigInt(extraction.y1), BigInt(extraction.x2!), BigInt(extraction.y2!)])
         }
      } else if (vopType === 'Arithmetic' && extraction?.a !== undefined && extraction?.b !== undefined && extraction?.op !== undefined) {
         if (keccak256(encodeAbiParameters([{type:'uint256'},{type:'uint256'},{type:'uint8'}], [BigInt(extraction.a), BigInt(extraction.b), extraction.op])) === instanceCommit) {
           const a = BigInt(extraction.a), b = BigInt(extraction.b), op = extraction.op
           let raw = op === 0 ? a+b : op === 1 ? a*b : op === 2 ? (a>b?a-b:b-a) : op === 3 ? a^b : a%b
           solution = encodeAbiParameters([{type:'uint256'},{type:'uint256'},{type:'uint256'},{type:'uint8'}], [BigInt(keccak256(encodeAbiParameters([{type:'uint256'},{type:'bytes32'}], [raw, blockSeed]))), a, b, op])
         }
      } else if (vopType === 'L1Metadata') {
        try {
          const l1Num = await this.pub.readContract({ address: L1_GAS_ORACLE, abi: L1_GAS_ORACLE_ABI, functionName: 'number' }) as bigint
          const l1Fee = await this.pub.readContract({ address: L1_GAS_ORACLE, abi: L1_GAS_ORACLE_ABI, functionName: 'basefee' }) as bigint
          solution = encodeAbiParameters([{ type: 'uint256' }], [BigInt(keccak256(encodeAbiParameters([{type:'uint64'},{type:'uint256'},{type:'bytes32'}], [l1Num, l1Fee, blockSeed])))])
        } catch { /* safely ignore L1 missing on anvil */ }
      }
    } catch (e) { this.log(`⚠️ VOP formatting error:`, e) }

    if (solution !== '0x') this.log(`🧩 Solved VOP type ${vopType} (idx=${vopIndex})`)
    return { vopClaimedIndex: solution !== '0x' ? vopIndex : 0, solution: solution !== '0x' ? solution : DUMMY_VOP_SOLUTION }
  }
}
