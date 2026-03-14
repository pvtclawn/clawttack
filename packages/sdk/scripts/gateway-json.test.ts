import { describe, expect, test } from 'bun:test'
import { extractBalancedJsonCandidates, extractJsonObject } from './gateway-json'

describe('gateway-json', () => {
  test('extracts direct JSON object', () => {
    const parsed = extractJsonObject('{"narrative":"hello world"}', 'direct', (value) => typeof value?.narrative === 'string')
    expect(parsed.narrative).toBe('hello world')
  })

  test('extracts JSON after noisy prefix lines', () => {
    const raw = [
      'Warning: plugin xyz',
      'Another non-json line',
      '{"result":{"payloads":[{"text":"{\\"narrative\\":\\"At dawn we brief the team and build carefully around the artefact.\\"}"}]}}',
    ].join('\n')

    const envelope = extractJsonObject(raw, 'gateway-envelope', (value) => Boolean(value?.result?.payloads?.[0]?.text))
    const payload = extractJsonObject(String(envelope.result.payloads[0].text), 'gateway-payload', (value) => typeof value?.narrative === 'string')
    expect(payload.narrative).toContain('brief')
  })

  test('extracts the last balanced object when earlier objects do not validate', () => {
    const raw = 'preamble {"junk":true} trailer {"narrative":"We begin with a brief pact and build around the artefact without ember."}'
    const parsed = extractJsonObject(raw, 'balanced', (value) => typeof value?.narrative === 'string')
    expect(parsed.narrative).toContain('brief pact')
  })

  test('collects balanced object candidates across noisy text', () => {
    const raw = 'warn {"a":1} more text {"b":{"c":[1,2,3]}} end'
    expect(extractBalancedJsonCandidates(raw)).toEqual([
      '{"a":1}',
      '{"b":{"c":[1,2,3]}}',
    ])
  })
})
