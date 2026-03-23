#!/usr/bin/env bun
/**
 * E2E Battle Test — Full lifecycle with actual turns against local Anvil
 *
 * Prerequisites: Run `bun run dev` first to deploy contracts.
 *
 * Flow: register agents → create battle → accept → wait warmup →
 *       play 6 turns with NCC commit/defend/reveal + VOP commit/solve/reveal →
 *       timeout → claim win → verify settlement + Elo.
 */

import { createPublicClient, createWalletClient, http, encodePacked, keccak256, encodeAbiParameters, parseAbiParameters, toHex, type Address, type Hex } from 'viem'
import { foundry } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { clawttackArenaAbi, clawttackBattleAbi } from '../packages/abi/abi'
import localDeployment from '../packages/abi/deployments/local.json'

// ─── Setup ──────────────────────────────────────────────────────────────────

const RPC = localDeployment.rpc
const ARENA = localDeployment.contracts.arena as Address

// Anvil default accounts
const ACCOUNT_A = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
const ACCOUNT_B = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')

const publicClient = createPublicClient({ chain: foundry, transport: http(RPC) })
const walletA = createWalletClient({ account: ACCOUNT_A, chain: foundry, transport: http(RPC) })
const walletB = createWalletClient({ account: ACCOUNT_B, chain: foundry, transport: http(RPC) })

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(phase: string, msg: string) {
  console.log(`  ${phase} ${msg}`)
}

function randomBytes32(): Hex {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex
const MIN_TURN_INTERVAL = 5   // must match ChessClockLib.MIN_TURN_INTERVAL

/** Build NCC commitment: keccak256(abi.encodePacked(battleId, turnNumber, "NCC", salt, intendedIdx)) */
function nccCommitment(battleId: bigint, turnNumber: number, salt: Hex, intendedIdx: number): Hex {
  return keccak256(encodePacked(
    ['uint256', 'uint256', 'string', 'bytes32', 'uint8'],
    [battleId, BigInt(turnNumber), 'NCC', salt, intendedIdx]
  ))
}

/** Build VOP commitment: keccak256(abi.encodePacked(battleId, turnNumber, "VOP", salt, vopIndex, instanceCommit)) */
function vopCommitment(battleId: bigint, turnNumber: number, salt: Hex, vopIndex: number, instanceCommit: Hex): Hex {
  return keccak256(encodePacked(
    ['uint256', 'uint256', 'string', 'bytes32', 'uint8', 'bytes32'],
    [battleId, BigInt(turnNumber), 'VOP', salt, vopIndex, instanceCommit]
  ))
}

/** Read a BIP39 word from the dictionary contract */
async function getWord(index: number): Promise<string> {
  const wordDict = localDeployment.contracts.wordDictionary as Address
  return publicClient.readContract({
    address: wordDict,
    abi: [{ name: 'word', type: 'function', inputs: [{ name: 'index', type: 'uint16' }], outputs: [{ name: '', type: 'string' }], stateMutability: 'view' }],
    functionName: 'word',
    args: [index],
  }) as Promise<string>
}

/**
 * Build a narrative containing the target word and 4 candidate BIP39 words at tracked offsets.
 * Narrative must be ≥64 bytes, ≤256 bytes, contain targetWord on word boundary, avoid poisonWord.
 */
async function buildNarrative(
  targetWord: string,
  candidateIndices: [number, number, number, number],
  poisonWord: string,
): Promise<{ narrative: string; offsets: [number, number, number, number] }> {
  const words = await Promise.all(candidateIndices.map(i => getWord(i)))
  
  // Build narrative: "{target} amid {w0} and {w1} across the {w2} realm of {w3} in battle"
  let narrative = `The ${targetWord} amid ${words[0]} and ${words[1]} across the ${words[2]} realm of ${words[3]} in this arena.`
  
  // Pad to ≥64 bytes
  while (Buffer.byteLength(narrative) < 64) {
    narrative += ' Fight on.'
  }
  
  // Truncate to ≤256 bytes
  if (Buffer.byteLength(narrative) > 256) {
    narrative = narrative.slice(0, 256)
  }
  
  // Verify poison word isn't present (case-insensitive)
  if (poisonWord && narrative.toLowerCase().includes(poisonWord.toLowerCase())) {
    // Replace narrative to avoid poison — simple fallback
    narrative = `The ${targetWord} summons ${words[0]} with ${words[1]} near ${words[2]} at ${words[3]} now.`
    while (Buffer.byteLength(narrative) < 64) narrative += ' Continue.'
  }
  
  // Find byte offsets for each candidate word
  const offsets: [number, number, number, number] = [0, 0, 0, 0]
  for (let i = 0; i < 4; i++) {
    const idx = narrative.toLowerCase().indexOf(words[i]!.toLowerCase())
    if (idx === -1) throw new Error(`Word "${words[i]}" not found in narrative: "${narrative}"`)
    offsets[i] = idx
  }

  return { narrative, offsets }
}

/** Mine exactly N blocks on Anvil */
async function mineBlocks(n: number) {
  for (let i = 0; i < n; i++) {
    await publicClient.request({ method: 'evm_mine' as any, params: [] as any })
  }
}

// ─── Per-side NCC/VOP tracking ──────────────────────────────────────────────

interface NccRecord {
  salt: Hex
  intendedIdx: number
  commitTurn: number   // the turn number when this was committed
}

interface VopRecord {
  salt: Hex
  vopIndex: number
  commitTurn: number
}

// Each "side" (A or B) stores their own pending NCC/VOP commits.
// A player reveals their own commit from 2 turns ago on their next turn.
// Turn 0 → Player X (commit), Turn 1 → Player Y (commit), Turn 2 → Player X (reveal Turn 0's commit + new commit), etc.
let sideANcc: NccRecord | null = null
let sideBNcc: NccRecord | null = null
let sideAVop: VopRecord | null = null
let sideBVop: VopRecord | null = null

// ─── Main Test ──────────────────────────────────────────────────────────────

async function main() {
  console.log('')
  console.log('═══════════════════════════════════════════════════════')
  console.log('  🦞 Clawttack E2E Battle Test (with turns)')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  Arena: ${ARENA}`)
  console.log(`  RPC:   ${RPC}`)
  console.log('')

  // ── 1. Register agents ─────────────────────────────────────────────────
  console.log('[1/7] Registering agents...')

  const regATx = await walletA.writeContract({
    address: ARENA, abi: clawttackArenaAbi, functionName: 'registerAgent', value: 0n,
  })
  await publicClient.waitForTransactionReceipt({ hash: regATx })
  const agentIdA = await publicClient.readContract({
    address: ARENA, abi: clawttackArenaAbi, functionName: 'agentsCount',
  })
  log('✅', `Agent A registered (id: ${agentIdA})`)

  const regBTx = await walletB.writeContract({
    address: ARENA, abi: clawttackArenaAbi, functionName: 'registerAgent', value: 0n,
  })
  await publicClient.waitForTransactionReceipt({ hash: regBTx })
  const agentIdB = await publicClient.readContract({
    address: ARENA, abi: clawttackArenaAbi, functionName: 'agentsCount',
  })
  log('✅', `Agent B registered (id: ${agentIdB})`)

  // ── 2. Create battle ───────────────────────────────────────────────────
  console.log('[2/7] Creating battle...')
  
  const STAKE = 0n
  const config = {
    stake: STAKE,
    targetAgentId: agentIdB,
    inviteHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
  }

  const battleTxHash = await walletA.writeContract({
    address: ARENA, abi: clawttackArenaAbi, functionName: 'createBattle',
    args: [agentIdA, config], value: STAKE,
  })
  await publicClient.waitForTransactionReceipt({ hash: battleTxHash })
  
  const battlesCount = await publicClient.readContract({
    address: ARENA, abi: clawttackArenaAbi, functionName: 'battlesCount',
  })
  const battleAddr = await publicClient.readContract({
    address: ARENA, abi: clawttackArenaAbi, functionName: 'battles',
    args: [battlesCount],
  }) as Address
  log('✅', `Battle created at ${battleAddr}`)

  const BATTLE = battleAddr

  // ── 3. Accept battle ───────────────────────────────────────────────────
  console.log('[3/7] Accepting battle...')
  
  const acceptTx = await walletB.writeContract({
    address: BATTLE, abi: clawttackBattleAbi, functionName: 'acceptBattle',
    args: [agentIdB, '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`], value: STAKE,
  })
  await publicClient.waitForTransactionReceipt({ hash: acceptTx })
  log('✅', 'Battle accepted')

  const firstMoverA = await publicClient.readContract({
    address: BATTLE, abi: clawttackBattleAbi, functionName: 'firstMoverA',
  }) as boolean
  const battleId = await publicClient.readContract({
    address: BATTLE, abi: clawttackBattleAbi, functionName: 'battleId',
  }) as bigint
  const startBlock = await publicClient.readContract({
    address: BATTLE, abi: clawttackBattleAbi, functionName: 'startBlock',
  }) as bigint
  log('ℹ️', `First mover A: ${firstMoverA}, battleId: ${battleId}, startBlock: ${startBlock}`)

  // ── 4. Wait for warmup ─────────────────────────────────────────────────
  console.log('[4/7] Waiting for warmup...')

  let currentBlock = await publicClient.getBlockNumber()
  const blocksToMine = Number(startBlock) - Number(currentBlock) + 1
  if (blocksToMine > 0) {
    await mineBlocks(blocksToMine)
  }
  currentBlock = await publicClient.getBlockNumber()
  log('✅', `Past warmup (block ${currentBlock}, startBlock was ${startBlock})`)

  // ── 5. Play turns ──────────────────────────────────────────────────────
  console.log('[5/7] Playing turns...')

  const NUM_TURNS = 6
  const CANDIDATE_SETS: [number, number, number, number][] = [
    [100, 200, 300, 400],
    [500, 600, 700, 800],
    [900, 1000, 1100, 1200],
    [101, 201, 301, 401],
    [501, 601, 701, 801],
    [901, 1001, 1101, 1201],
  ]
  const POISON_WORDS = ['zephyr', 'quantum', 'nebula', 'cipher', 'primal', 'vortex']

  for (let turn = 0; turn < NUM_TURNS; turn++) {
    // Determine whose turn it is
    const isPlayerATurn = (turn % 2 === 0) ? firstMoverA : !firstMoverA
    const wallet = isPlayerATurn ? walletA : walletB
    const label = isPlayerATurn ? 'A' : 'B'

    // Mine exactly MIN_TURN_INTERVAL blocks to satisfy the clock
    await mineBlocks(MIN_TURN_INTERVAL + 1)

    // Read current target word
    const targetWordIndex = await publicClient.readContract({
      address: BATTLE, abi: clawttackBattleAbi, functionName: 'targetWordIndex',
    }) as number
    const targetWord = await getWord(targetWordIndex)
    
    // Read poison word (empty on turn 0)
    const currentPoisonWord = turn > 0
      ? await publicClient.readContract({
          address: BATTLE, abi: clawttackBattleAbi, functionName: 'poisonWord',
        }) as string
      : ''

    // Build narrative
    const candidates = CANDIDATE_SETS[turn]!
    const { narrative, offsets } = await buildNarrative(targetWord, candidates, currentPoisonWord)

    // ── NCC Attack (every turn) ──
    const nccSalt = randomBytes32()
    const nccIdx = turn % 4  // Vary the intended answer
    const commitment = nccCommitment(battleId, turn, nccSalt, nccIdx)

    // ── NCC Reveal (turn ≥ 2, reveal my own commit from 2 turns ago) ──
    let nccReveal = { salt: ZERO_BYTES32, intendedIdx: 0 }
    if (turn >= 2) {
      const myPrevNcc = isPlayerATurn ? sideANcc : sideBNcc
      if (myPrevNcc) {
        nccReveal = { salt: myPrevNcc.salt, intendedIdx: myPrevNcc.intendedIdx }
        log('🔓', `  NCC reveal: turn ${myPrevNcc.commitTurn}'s commit (intendedIdx=${myPrevNcc.intendedIdx})`)
      }
    }

    // ── NCC Defense (turn ≥ 1, guess opponent's intended answer) ──
    const nccDefenseGuess = (turn + 1) % 4  // Just guess something

    // ── VOP Commit (every turn) ──
    const vopSalt = randomBytes32()
    const vopIdx = 0  // Always HashPreimage VOP
    const instanceCommit = ZERO_BYTES32  // Simple VOP
    const vopCommit = vopCommitment(battleId, turn, vopSalt, vopIdx, instanceCommit)

    // ── VOP Solve (turn ≥ 1, attempt to solve opponent's VOP from previous turn) ──
    let vopSolveData = { vopClaimedIndex: 0, solution: '0x' as Hex }
    if (turn >= 1) {
      // We claim the VOP index is 0 (HashPreimage) with a dummy solution
      // The solver won't pass verification, but that's OK — it just costs bank penalty
      vopSolveData = {
        vopClaimedIndex: 0,
        solution: encodeAbiParameters(parseAbiParameters('uint256'), [42n]),
      }
    }

    // ── VOP Reveal (turn ≥ 2, reveal my own VOP commit from 2 turns ago) ──
    let vopReveal = { vopSalt: ZERO_BYTES32, vopIndex: 0 }
    if (turn >= 2) {
      const myPrevVop = isPlayerATurn ? sideAVop : sideBVop
      if (myPrevVop) {
        vopReveal = { vopSalt: myPrevVop.salt, vopIndex: myPrevVop.vopIndex }
        log('🔓', `  VOP reveal: turn ${myPrevVop.commitTurn}'s commit (vopIdx=${myPrevVop.vopIndex})`)
      }
    }

    // Build TurnPayload
    const payload = {
      narrative,
      customPoisonWord: POISON_WORDS[turn]!,
      nccAttack: {
        candidateWordIndices: candidates,
        candidateOffsets: offsets,
        nccCommitment: commitment,
      },
      nccDefense: { guessIdx: nccDefenseGuess },
      nccReveal,
      vopCommit: { vopCommitment: vopCommit, instanceCommit },
      vopSolve: vopSolveData,
      vopReveal,
    }

    // Submit turn
    try {
      const txHash = await wallet.writeContract({
        address: BATTLE,
        abi: clawttackBattleAbi,
        functionName: 'submitTurn',
        args: [payload],
      })
      await publicClient.waitForTransactionReceipt({ hash: txHash })

      // Read updated banks
      const bankA = await publicClient.readContract({
        address: BATTLE, abi: clawttackBattleAbi, functionName: 'getBattleState',
      }) as any[]
      
      log('✅', `Turn ${turn} (${label}): target="${targetWord}" | "${narrative.slice(0, 60)}..."`)
      log('📊', `  Banks: A=${bankA[2]?.toString()}, B=${bankA[3]?.toString()}`)
    } catch (err: any) {
      log('❌', `Turn ${turn} (${label}) FAILED: ${err.shortMessage || err.message}`)
      
      // Check if battle was settled during this turn
      const phase = await publicClient.readContract({
        address: BATTLE, abi: clawttackBattleAbi, functionName: 'phase',
      })
      if (phase !== 1) {
        log('ℹ️', `Battle ended during turn ${turn} (phase: ${phase})`)
        break
      }
      throw err
    }

    // Store NCC + VOP commits for this side to reveal 2 turns later
    if (isPlayerATurn) {
      sideANcc = { salt: nccSalt, intendedIdx: nccIdx, commitTurn: turn }
      sideAVop = { salt: vopSalt, vopIndex: vopIdx, commitTurn: turn }
    } else {
      sideBNcc = { salt: nccSalt, intendedIdx: nccIdx, commitTurn: turn }
      sideBVop = { salt: vopSalt, vopIndex: vopIdx, commitTurn: turn }
    }
  }

  // ── 6. Check state after turns ─────────────────────────────────────────
  console.log('[6/7] Checking state...')
  
  const phase = await publicClient.readContract({
    address: BATTLE, abi: clawttackBattleAbi, functionName: 'phase',
  })
  
  if (phase === 1) { // Still active
    const currentTurn = await publicClient.readContract({
      address: BATTLE, abi: clawttackBattleAbi, functionName: 'currentTurn',
    })
    log('ℹ️', `Battle still active at turn ${currentTurn}`)

    // ── 7. Trigger timeout ───────────────────────────────────────────────
    console.log('[7/7] Testing timeout...')

    log('⏳', 'Mining 90 blocks to trigger timeout...')
    await mineBlocks(90)

    const turnNow = await publicClient.readContract({
      address: BATTLE, abi: clawttackBattleAbi, functionName: 'currentTurn',
    }) as number
    const expectedA = (Number(turnNow) % 2 === 0) ? firstMoverA : !firstMoverA
    const claimWallet = expectedA ? walletB : walletA
    const claimLabel = expectedA ? 'B' : 'A'

    try {
      const claimTx = await claimWallet.writeContract({
        address: BATTLE, abi: clawttackBattleAbi, functionName: 'claimTimeoutWin',
      })
      await publicClient.waitForTransactionReceipt({ hash: claimTx })
      log('✅', `Timeout claimed by ${claimLabel}`)
    } catch (err: any) {
      log('⚠️', `Timeout claim failed: ${err.shortMessage || err.message}`)
    }
  } else {
    log('ℹ️', 'Battle already settled during turns')
  }

  // ── Final verification ─────────────────────────────────────────────────
  const finalPhase = await publicClient.readContract({
    address: BATTLE, abi: clawttackBattleAbi, functionName: 'phase',
  })
  
  console.log('')
  console.log('═══════════════════════════════════════════════════════')
  if (finalPhase === 2) { // Settled
    log('🏆', 'Battle settled successfully!')
    
    const agentA = await publicClient.readContract({
      address: ARENA, abi: clawttackArenaAbi, functionName: 'agents', args: [agentIdA],
    }) as any[]
    const agentB = await publicClient.readContract({
      address: ARENA, abi: clawttackArenaAbi, functionName: 'agents', args: [agentIdB],
    }) as any[]
    log('📊', `Agent A: elo=${agentA[1]}, W=${agentA[2]}, L=${agentA[3]}`)
    log('📊', `Agent B: elo=${agentB[1]}, W=${agentB[2]}, L=${agentB[3]}`)
    console.log('═══════════════════════════════════════════════════════')
    console.log('  ✅ E2E TEST PASSED')
    console.log('═══════════════════════════════════════════════════════')
  } else {
    console.log('═══════════════════════════════════════════════════════')
    console.log(`  ❌ E2E TEST FAILED — unexpected phase: ${finalPhase}`)
    console.log('═══════════════════════════════════════════════════════')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('')
  console.error('❌ E2E test failed:', err.message || err)
  if (err.cause) console.error('  Cause:', err.cause.message || err.cause)
  process.exit(1)
})
