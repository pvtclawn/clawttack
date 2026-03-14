import { describe, expect, test } from 'bun:test'
import type { BattleInfo, SettledEvent, TurnEvent } from '../hooks/useChain'
import { battleTranscriptFilename, buildBattleTranscriptExport } from './battle-export'

const info: BattleInfo = {
  battleId: 11n,
  address: '0x46E7dE83429FaFf60590696A20241a18F9A41f14',
  state: 2,
  challengerId: 1n,
  acceptorId: 2n,
  challengerOwner: '0xeC6cd01f6fdeaEc192b88Eb7B62f5E72D65719Af',
  acceptorOwner: '0xd1033447b9a7297BDc91265eED761fBe5A3B8961',
  currentTurn: 19,
  maxTurns: 0,
  bankA: 122,
  bankB: 0,
  turnDeadlineBlock: 0n,
  sequenceHash: '0x9d6116cb3aba4c21bdeae10abb1530d85c3f471689f5c7632f2fdf0d022491e7',
  totalPot: 2000000000000000n,
  baseTimeoutBlocks: 0,
  firstMoverA: true,
}

const turns: TurnEvent[] = [
  {
    battleId: 11n,
    turnNumber: 0,
    playerId: 1n,
    sequenceHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
    targetWord: 801,
    poisonWord: '',
    narrative: 'Opening move.',
    blockNumber: 38844662n,
    txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    bankA: 400,
    bankB: 400,
    timestamp: 1773480000,
  },
  {
    battleId: 11n,
    turnNumber: 1,
    playerId: 2n,
    sequenceHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
    targetWord: 21,
    poisonWord: 'ember',
    narrative: 'Counter move.',
    blockNumber: 38844671n,
    txHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    bankA: 373,
    bankB: 400,
    timestamp: 1773480018,
  },
]

const settlement: SettledEvent = {
  battleId: 11n,
  winnerId: 1n,
  loserId: 2n,
  resultType: 5,
  blockNumber: 38844799n,
  txHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
}

describe('battle transcript export', () => {
  test('builds a stable export shape with metadata and turns', () => {
    const exported = buildBattleTranscriptExport({
      origin: 'https://dev.clawttack.com',
      info,
      turns,
      settlement,
      challengerName: 'PrivateClawn',
      acceptorName: 'ClawnJr',
    })

    expect(exported.version).toBe('clawttack-battle-transcript/v1')
    expect(exported.battle.battleId).toBe('11')
    expect(exported.battle.stateLabel).toBe('Settled')
    expect(exported.players.challenger.label).toBe('PrivateClawn')
    expect(exported.players.acceptor.label).toBe('ClawnJr')
    expect(exported.settlement?.resultLabel).toBe('Bank Empty')
    expect(exported.turns).toHaveLength(2)
    expect(exported.turns[0].playerRole).toBe('challenger')
    expect(exported.turns[1].playerRole).toBe('acceptor')
    expect(exported.turns[1].txUrl).toContain('/tx/0xbbbb')
    expect(exported.battle.battleUrl).toBe('https://dev.clawttack.com/battle/11')
  })

  test('builds a deterministic filename', () => {
    expect(battleTranscriptFilename(11n)).toBe('clawttack-battle-11-transcript.json')
  })
})
