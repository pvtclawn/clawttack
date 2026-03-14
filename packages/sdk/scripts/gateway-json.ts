export function extractBalancedJsonCandidates(raw: string): string[] {
  const candidates: string[] = []
  let start = -1
  let depth = 0
  let inString = false
  let escapeNext = false

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]

    if (start < 0) {
      if (ch === '{') {
        start = i
        depth = 1
        inString = false
        escapeNext = false
      }
      continue
    }

    if (inString) {
      if (escapeNext) {
        escapeNext = false
      } else if (ch === '\\') {
        escapeNext = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === '{' || ch === '[') depth++
    if (ch === '}' || ch === ']') depth--

    if (depth === 0) {
      candidates.push(raw.slice(start, i + 1))
      start = -1
    }
  }

  return candidates
}

export function extractJsonObject(raw: string, stage: string, validate?: (parsed: any) => boolean): any {
  const preview = raw.slice(0, 240).replace(/\s+/g, ' ')
  console.log(`[gateway-parse] stage=${stage} raw-bytes=${Buffer.byteLength(raw, 'utf8')} preview=${preview}`)

  const direct = raw.trim()
  if (direct.startsWith('{') || direct.startsWith('[')) {
    try {
      const parsed = JSON.parse(direct)
      if (!validate || validate(parsed)) {
        console.log(`[gateway-parse] stage=${stage} mode=direct status=ok`)
        return parsed
      }
      console.log(`[gateway-parse] stage=${stage} mode=direct status=reject validation=false`)
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.log(`[gateway-parse] stage=${stage} mode=direct status=fail reason=${reason}`)
    }
  }

  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  for (const line of lines) {
    if (!line.startsWith('{') && !line.startsWith('[')) continue
    try {
      const parsed = JSON.parse(line)
      if (!validate || validate(parsed)) {
        console.log(`[gateway-parse] stage=${stage} mode=line status=ok`)
        return parsed
      }
    } catch {
      // keep scanning
    }
  }

  const balancedCandidates = extractBalancedJsonCandidates(raw)
  for (let idx = balancedCandidates.length - 1; idx >= 0; idx--) {
    const candidate = balancedCandidates[idx]
    try {
      const parsed = JSON.parse(candidate)
      if (!validate || validate(parsed)) {
        console.log(`[gateway-parse] stage=${stage} mode=balanced status=ok index=${idx}`)
        return parsed
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.log(`[gateway-parse] stage=${stage} mode=balanced status=fail index=${idx} reason=${reason}`)
    }
  }

  throw new Error(`[gateway-parse] stage=${stage} failed to extract valid JSON object. preview=${preview}`)
}
