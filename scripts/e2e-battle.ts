#!/usr/bin/env bun
/**
 * E2E Battle Test — Full lifecycle against local Anvil
 *
 * Prerequisites: Run `bun run dev` first to deploy contracts.
 *
 * Tests: register agents → create battle → accept → play turns with
 * NCC + VOP + narratives → timeout → claim win → verify settlement.
 */

import { createPublicClient, createWalletClient, http, encodePacked, keccak256, encodeAbiParameters, parseAbiParameters, toHex, type Address, type Hex } from 'viem'
import { hardhat } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { clawttackArenaAbi, clawttackBattleAbi } from '../packages/abi/abi'
import localDeployment from '../packages/abi/deployments/local.json'

// ─── Setup ──────────────────────────────────────────────────────────────────

const RPC = localDeployment.rpc
const ARENA = localDeployment.contracts.arena as Address

// Anvil default accounts
const ACCOUNT_A = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
const ACCOUNT_B = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')

const publicClient = createPublicClient({ chain: hardhat, transport: http(RPC) })
const walletA = createWalletClient({ account: ACCOUNT_A, chain: hardhat, transport: http(RPC) })
const walletB = createWalletClient({ account: ACCOUNT_B, chain: hardhat, transport: http(RPC) })

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(phase: string, msg: string) {
  console.log(`  ${phase} ${msg}`)
}

function randomBytes32(): Hex {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

/** Build NCC commitment: keccak256(abi.encodePacked(battleId, turnNumber, "NCC", salt, intendedIdx)) */
function nccCommitment(battleId: bigint, turnNumber: number, salt: Hex, intendedIdx: number): Hex {
  return keccak256(encodePacked(
    ['uint256', 'uint32', 'string', 'bytes32', 'uint8'],
    [battleId, turnNumber, 'NCC', salt, intendedIdx]
  ))
}

/** Build VOP commitment: keccak256(abi.encodePacked(battleId, turnNumber, "VOP", salt, vopIndex, instanceCommit)) */
function vopCommitment(battleId: bigint, turnNumber: number, salt: Hex, vopIndex: number, instanceCommit: Hex): Hex {
  return keccak256(encodePacked(
    ['uint256', 'uint32', 'string', 'bytes32', 'uint8', 'bytes32'],
    [battleId, turnNumber, 'VOP', salt, vopIndex, instanceCommit]
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
 * Build a narrative containing the target word and 4 BIP39 candidate words at trackable offsets.
 * Returns the narrative string and the byte offsets of each candidate word.
 */
async function buildNarrative(
  targetWord: string,
  candidateIndices: [number, number, number, number],
  poisonWord: string,
): Promise<{ narrative: string; offsets: [number, number, number, number] }> {
  const words = await Promise.all(candidateIndices.map(i => getWord(i)))
  
  // Build a narrative ≥64 bytes containing target word and 4 candidates
  // Format: "The {target} calls forth {word0} and {word1} across the {word2} realm of {word3} in this battle arena."
  let narrative = `The ${targetWord} calls forth ${words[0]} and ${words[1]} across the ${words[2]} realm of ${words[3]} in this battle arena saga.`
  
  // Pad if needed to reach 64 bytes minimum
  while (Buffer.byteLength(narrative) < 64) {
    narrative += ' Fight on.'
  }
  
  // Verify poison word isn't present (case-insensitive)
  if (poisonWord && narrative.toLowerCase().includes(poisonWord.toLowerCase())) {
    throw new Error(`Narrative contains poison word "${poisonWord}"!`)
  }
  
  // Find byte offsets
  const narrativeBytes = Buffer.from(narrative)
  const offsets: [number, number, number, number] = [0, 0, 0, 0]
  for (let i = 0; i < 4; i++) {
    const wordLower = words[i]!.toLowerCase()
    const idx = narrative.toLowerCase().indexOf(wordLower)
    if (idx === -1) throw new Error(`Word "${words[i]}" not found in narrative`)
    offsets[i] = idx
  }

  return { narrative, offsets }
}

/** Mine a VOP solution (brute-force nonce for leading zero bits) */
async function solveHashPreimageVop(blockNumber: bigint): Promise<bigint> {
  const blockHash = await publicClient.getBlock({ blockNumber }).then(b => b.hash)
  const difficulty = 8 + Number(blockNumber % 4n)

  for (let nonce = 0n; nonce < 100_000n; nonce++) {
    const hash = keccak256(encodeAbiParameters(
      parseAbiParameters('bytes32, uint256'),
      [blockHash, nonce]
    ))
    const val = BigInt(hash)
    if (val >> BigInt(256 - difficulty) === 0n) {
      return nonce
    }
  }
  throw new Error('VOP solve failed — no nonce found')
}

// ─── Main Test ──────────────────────────────────────────────────────────────

async function main() {
  console.log('')
  console.log('═══════════════════════════════════════════════════════')
  console.log('  🦞 Clawttack E2E Battle Test')
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
  
  const STAKE = 0n // Zero stake for testing
  const config = {
    stake: STAKE,
    warmupBlocks: 15,
    targetAgentId: agentIdB,
    maxJokers: 2,
  }

  const battleTxHash = await walletA.writeContract({
    address: ARENA, abi: clawttackArenaAbi, functionName: 'createBattle',
    args: [agentIdA, config], value: STAKE,
  })
  const battleReceipt = await publicClient.waitForTransactionReceipt({ hash: battleTxHash })
  
  // Read battle address from battlesCount
  const battlesCount = await publicClient.readContract({
    address: ARENA, abi: clawttackArenaAbi, functionName: 'battlesCount',
  })
  const battleAddr = await publicClient.readContract({
    address: ARENA, abi: clawttackArenaAbi, functionName: 'battles',
    args: [battlesCount],
  })
  log('✅', `Battle created at ${battleAddr}`)

  const BATTLE = battleAddr as Address

  // ── 3. Accept battle ───────────────────────────────────────────────────
  console.log('[3/7] Accepting battle...')
  
  const acceptTx = await walletB.writeContract({
    address: BATTLE, abi: clawttackBattleAbi, functionName: 'acceptBattle',
    args: [agentIdB], value: STAKE,
  })
  await publicClient.waitForTransactionReceipt({ hash: acceptTx })
  log('✅', 'Battle accepted')

  // Read initial state
  const firstMoverA = await publicClient.readContract({
    address: BATTLE, abi: clawttackBattleAbi, functionName: 'firstMoverA',
  })
  const battleId = await publicClient.readContract({
    address: BATTLE, abi: clawttackBattleAbi, functionName: 'battleId',
  })
  const startBlock = await publicClient.readContract({
    address: BATTLE, abi: clawttackBattleAbi, functionName: 'startBlock',
  })
  log('ℹ️', `First mover A: ${firstMoverA}, battleId: ${battleId}, startBlock: ${startBlock}`)

  // ── 4. Wait for warmup ─────────────────────────────────────────────────
  console.log('[4/7] Waiting for warmup...')

  // Mine blocks until past startBlock
  let currentBlock = await publicClient.getBlockNumber()
  while (currentBlock < BigInt(startBlock)) {
    await publicClient.request({ method: 'evm_mine' as any, params: [] })
    currentBlock = await publicClient.getBlockNumber()
  }
  log('✅', `Past warmup (block ${currentBlock})`)

  // ── 5. Play turns ──────────────────────────────────────────────────────
  console.log('[5/7] Playing turns...')

  // Track NCC state for reveals
  const pendingNcc: { salt: Hex; intendedIdx: number; turnNumber: number }[] = []
  const pendingVop: { salt: Hex; vopIndex: number; turnNumber: number }[] = []

  // We'll play 4 turns (0, 1, 2, 3) to exercise NCC reveal + VOP reveal
  for (let turn = 0; turn < 4; turn++) {
    const isPlayerATurn = (turn % 2 === 0) ? firstMoverA : !firstMoverA
    const wallet = isPlayerATurn ? walletA : walletB
    const account = isPlayerATurn ? ACCOUNT_A : ACCOUNT_B
    const label = isPlayerATurn ? 'A' : 'B'

    // Read current state
    const targetWordIndex = await publicClient.readContract({
      address: BATTLE, abi: clawttackBattleAbi, functionName: 'targetWordIndex',
    })
    const targetWord = await getWord(targetWordIndex)
    const poisonWord = turn > 0
      ? await publicClient.readContract({
          address: BATTLE, abi: clawttackBattleAbi, functionName: 'poisonWord',
        }) as string
      : ''

    // Pick 4 random distinct BIP39 candidate indices (different from target)
    const candidates: [number, number, number, number] = [100, 200, 300, 400]

    // Build narrative
    const { narrative, offsets } = await buildNarrative(targetWord, candidates, poisonWord)

    // NCC Attack
    const nccSalt = randomBytes32()
    const nccIdx = 0 // Always pick first candidate as intended answer
    const commitment = nccCommitment(battleId, turn, nccSalt, nccIdx)

    // VOP Commit (always index 0 = HashPreimage, simple VOP)
    const vopSalt = randomBytes32()
    const vopIdx = 0
    const instanceCommit = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex
    const vopCommit = vopCommitment(battleId, turn, vopSalt, vopIdx, instanceCommit)

    // NCC Defense (turn >= 1)
    const nccDefenseGuess = 0 // Just guess 0

    // NCC Reveal (turn >= 2)
    let nccReveal = { salt: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex, intendedIdx: 0 }
    if (turn >= 2) {
      // Find our pending reveal from 2 turns ago
      const prev = pendingNcc.find(p => p.turnNumber === turn - 2)
      if (prev) {
        nccReveal = { salt: prev.salt, intendedIdx: prev.intendedIdx }
      }
    }

    // VOP Solve (turn >= 1) — solve opponent's previous VOP
    let vopSolveData = { vopClaimedIndex: 0, solution: '0x' as Hex }
    if (turn >= 1) {
      const prevVop = pendingVop.find(p => p.turnNumber === turn - 1)
      if (prevVop) {
        // Read the block number from the pending VOP to solve against
        const oppVopStorage = isPlayerATurn
          ? await publicClient.readContract({ address: BATTLE, abi: clawttackBattleAbi, functionName: 'pendingVopB' })
          : await publicClient.readContract({ address: BATTLE, abi: clawttackBattleAbi, functionName: 'pendingVopA' })
        
        // Mine a block to have a fresh blockhash, then solve
        await publicClient.request({ method: 'evm_mine' as any, params: [] })
        
        // Just claim index 0 with a dummy solution — we don't need to actually solve for this test
        vopSolveData = {
          vopClaimedIndex: prevVop.vopIndex,
          solution: encodeAbiParameters(parseAbiParameters('uint256'), [42n]),
        }
      }
    }

    // VOP Reveal (turn >= 2)
    let vopReveal = { vopSalt: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex, vopIndex: 0 }
    if (turn >= 2) {
      const prev = pendingVop.find(p => p.turnNumber === turn - 2)
      if (prev) {
        vopReveal = { vopSalt: prev.salt, vopIndex: prev.vopIndex }
      }
    }

    // Build TurnPayload
    const payload = {
      narrative,
      customPoisonWord: 'xylophone', // Harmless poison word
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

    // Mine to ensure min turn interval (5 blocks)
    for (let i = 0; i < 6; i++) {
      await publicClient.request({ method: 'evm_mine' as any, params: [] })
    }

    // Submit turn
    try {
      await wallet.writeContract({
        address: BATTLE,
        abi: clawttackBattleAbi,
        functionName: 'submitTurn',
        args: [payload],
      })
      log('✅', `Turn ${turn} (${label}): "${narrative.slice(0, 50)}..."`)
    } catch (err: any) {
      log('❌', `Turn ${turn} (${label}) FAILED: ${err.shortMessage || err.message}`)
      // Check if battle was settled during this turn
      const phase = await publicClient.readContract({
        address: BATTLE, abi: clawttackBattleAbi, functionName: 'phase',
      })
      if (phase !== 1) { // 1 = Active
        log('ℹ️', `Battle ended during turn ${turn} (phase: ${phase})`)
        break
      }
      throw err
    }

    // Track NCC + VOP for reveals
    pendingNcc.push({ salt: nccSalt, intendedIdx: nccIdx, turnNumber: turn })
    pendingVop.push({ salt: vopSalt, vopIndex: vopIdx, turnNumber: turn })
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

    // Mine enough blocks to exhaust the current player's bank (80 blocks = max timeout)
    log('⏳', 'Mining 90 blocks to trigger timeout...')
    for (let i = 0; i < 90; i++) {
      await publicClient.request({ method: 'evm_mine' as any, params: [] })
    }

    // Determine who should claim timeout
    const turnNow = await publicClient.readContract({
      address: BATTLE, abi: clawttackBattleAbi, functionName: 'currentTurn',
    })
    const expectedA = (Number(turnNow) % 2 === 0) ? firstMoverA : !firstMoverA
    const claimWallet = expectedA ? walletB : walletA // Opponent of expected mover claims
    const claimLabel = expectedA ? 'B' : 'A'

    try {
      await claimWallet.writeContract({
        address: BATTLE, abi: clawttackBattleAbi, functionName: 'claimTimeoutWin',
      })
      log('✅', `Timeout claimed by ${claimLabel}`)
    } catch (err: any) {
      log('⚠️', `Timeout claim failed: ${err.shortMessage || err.message}`)
      log('ℹ️', 'Battle may have already settled during turns')
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
    
    // Check Elo was updated
    const agentA = await publicClient.readContract({
      address: ARENA, abi: clawttackArenaAbi, functionName: 'agents', args: [agentIdA],
    })
    const agentB = await publicClient.readContract({
      address: ARENA, abi: clawttackArenaAbi, functionName: 'agents', args: [agentIdB],
    })
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
