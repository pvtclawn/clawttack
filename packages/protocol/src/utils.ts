/**
 * Sanitizes JSON Schema for tool parameters to be compatible with strict LLM
 * providers (like Google Antigravity). Recursively removes unsupported keywords:
 * patternProperties, const, anyOf, oneOf, allOf, not.
 */
export function sanitizeSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map(sanitizeSchema);
  }

  const sanitized = { ...schema };

  // Remove unsupported keywords
  delete sanitized.patternProperties;
  delete sanitized.const;
  delete sanitized.anyOf;
  delete sanitized.oneOf;
  delete sanitized.allOf;
  delete sanitized.not;

  // Recursively sanitize properties
  if (sanitized.properties && typeof sanitized.properties === 'object') {
    const properties: Record<string, any> = {};
    for (const [key, value] of Object.entries(sanitized.properties)) {
      properties[key] = sanitizeSchema(value);
    }
    sanitized.properties = properties;
  }

  // Recursively sanitize array items
  if (sanitized.items && typeof sanitized.items === 'object') {
    sanitized.items = sanitizeSchema(sanitized.items);
  }

  // Handle additionalProperties (must be boolean or object)
  if (sanitized.additionalProperties && typeof sanitized.additionalProperties === 'object') {
    sanitized.additionalProperties = sanitizeSchema(sanitized.additionalProperties);
  }

  return sanitized;
}

/**
 * Calculates the Shannon Entropy (bits per byte) of a byte array.
 * Useful for distinguishing high-entropy logic (hashes) from low-entropy narrative.
 */
export function calculateShannonEntropy(bytes: Uint8Array | number[]): number {
  if (bytes.length === 0) return 0;

  const frequencies = new Map<number, number>();
  for (const byte of bytes) {
    frequencies.set(byte, (frequencies.get(byte) || 0) + 1);
  }

  let entropy = 0;
  const len = bytes.length;

  for (const count of frequencies.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}
