import { describe, expect, it } from 'bun:test'
import {
  computeNonceLedgerFingerprint,
  evaluateNoncePipelineTask1,
  type NonceLedgerSnapshot,
} from '../src/nonce-pipeline'

const mkSnapshot = (overrides?: Partial<NonceLedgerSnapshot>): NonceLedgerSnapshot => ({
  schemaVersion: 'v1',
  scopeKey: '84532:0x2Ab05EAB902db3FDA647b3Ec798c2D28C7489b7e:0xeC6cd01f6fdeaEc192b88Eb7B62f5E72D65719Af',
  tokenFloor: 10,
  intents: [
    {
      intentId: 'intent-9',
      nonce: 9,
      ownerToken: 10,
      state: 'confirmed',
    },
    {
      intentId: 'intent-10',
      nonce: 10,
      ownerToken: 10,
      state: 'pending',
    },
  ],
  ...overrides,
})

describe('nonce-pipeline task-1', () => {
  it('produces deterministic fingerprint for identical snapshots', () => {
    const a = computeNonceLedgerFingerprint(mkSnapshot())
    const b = computeNonceLedgerFingerprint(mkSnapshot())

    expect(a).toBe(b)
  })

  it('passes monotonic nonce-floor with append-only intents', () => {
    const before = mkSnapshot()
    const after = mkSnapshot({
      tokenFloor: 11,
      intents: [
        ...before.intents,
        {
          intentId: 'intent-11',
          nonce: 11,
          ownerToken: 10,
          state: 'built',
        },
      ],
    })

    const result = evaluateNoncePipelineTask1({
      before,
      after,
      actorToken: 10,
      activeToken: 10,
    })

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('pass')
  })

  it('fails closed on nonce-floor regression', () => {
    const before = mkSnapshot({ tokenFloor: 12 })
    const after = mkSnapshot({ tokenFloor: 11 })

    const result = evaluateNoncePipelineTask1({
      before,
      after,
      actorToken: 10,
      activeToken: 10,
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('nonce-floor-regression')
  })

  it('fails closed on rollback/truncation of prior intent history', () => {
    const before = mkSnapshot()
    const after = mkSnapshot({
      tokenFloor: 10,
      intents: [
        {
          intentId: 'intent-9',
          nonce: 9,
          ownerToken: 10,
          state: 'confirmed',
        },
      ],
    })

    const result = evaluateNoncePipelineTask1({
      before,
      after,
      actorToken: 10,
      activeToken: 10,
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('nonce-ledger-rollback-detected')
    expect(result.rolledBackIntentIds).toEqual(['intent-10'])
  })

  it('fails stale-token owner attempts deterministically', () => {
    const before = mkSnapshot()
    const after = mkSnapshot({
      tokenFloor: 11,
      intents: [
        ...before.intents,
        {
          intentId: 'intent-11',
          nonce: 11,
          ownerToken: 9,
          state: 'built',
        },
      ],
    })

    const result = evaluateNoncePipelineTask1({
      before,
      after,
      actorToken: 9,
      activeToken: 10,
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('stale-owner-token')
  })
})
