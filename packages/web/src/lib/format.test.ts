import { describe, expect, test } from 'bun:test'
import { formatAddress, agentName, formatEth, scenarioName, scenarioEmoji } from './format'

describe('formatAddress', () => {
  test('truncates standard address', () => {
    expect(formatAddress('0xeC6cd01f6fdeaEc192b88Eb7B62f5E72D65719Af'))
      .toBe('0xeC6c…19Af')
  })

  test('handles lowercase address', () => {
    expect(formatAddress('0xabcdef1234567890abcdef1234567890abcdef12'))
      .toBe('0xabcd…ef12')
  })

  test('handles short string gracefully', () => {
    // Edge case: shouldn't crash on short input
    const result = formatAddress('0x1234')
    expect(typeof result).toBe('string')
  })
})

describe('agentName', () => {
  test('returns known agent name for PrivateClawn', () => {
    expect(agentName('0xeC6cd01f6fdeaEc192b88Eb7B62f5E72D65719Af'))
      .toBe('PrivateClawn')
  })

  test('returns known agent name for ClawnJr', () => {
    expect(agentName('0xd1033447b9a7297bdc91265eed761fbe5a3b8961'))
      .toBe('ClawnJr')
  })

  test('is case-insensitive', () => {
    expect(agentName('0xEC6CD01F6FDEAEC192B88EB7B62F5E72D65719AF'))
      .toBe('PrivateClawn')
  })

  test('returns formatted address for unknown agent', () => {
    expect(agentName('0x0000000000000000000000000000000000000000'))
      .toBe('0x0000…0000')
  })
})

describe('formatEth', () => {
  test('formats 1 ETH', () => {
    expect(formatEth(1000000000000000000n)).toBe('1.0000')
  })

  test('formats 0 ETH', () => {
    expect(formatEth(0n)).toBe('0.0000')
  })

  test('formats small amount', () => {
    expect(formatEth(1000000000000000n)).toBe('0.0010')
  })

  test('formats fractional ETH', () => {
    expect(formatEth(500000000000000000n)).toBe('0.5000')
  })

  test('formats large amount', () => {
    expect(formatEth(100000000000000000000n)).toBe('100.0000')
  })
})

describe('scenarioName', () => {
  test('returns known scenario name', () => {
    expect(scenarioName('0xa2df845c10cbe9da434991a91a3f0c3dbc39aaed'))
      .toBe('Challenge Word Battle')
  })

  test('is case-insensitive', () => {
    expect(scenarioName('0xA2DF845C10CBE9DA434991A91A3F0C3DBC39AAED'))
      .toBe('Challenge Word Battle')
  })

  test('returns formatted address for unknown scenario', () => {
    expect(scenarioName('0x0000000000000000000000000000000000000001'))
      .toBe('0x0000…0001')
  })
})

describe('scenarioEmoji', () => {
  test('returns known emoji', () => {
    expect(scenarioEmoji('0xa2df845c10cbe9da434991a91a3f0c3dbc39aaed'))
      .toBe('⏱️')
  })

  test('returns default sword emoji for unknown', () => {
    expect(scenarioEmoji('0x0000000000000000000000000000000000000000'))
      .toBe('⚔️')
  })
})
