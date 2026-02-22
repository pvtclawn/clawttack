import { describe, expect, it } from 'bun:test';
import { sanitizeSchema, calculateShannonEntropy } from '../src/utils';

describe('sanitizeSchema', () => {
  it('removes unsupported JSON Schema keywords recursively', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', const: 'lobster' },
        tags: {
          type: 'array',
          items: {
            anyOf: [{ type: 'string' }, { type: 'number' }],
          },
        },
        metadata: {
          type: 'object',
          patternProperties: {
            '^x-': { type: 'string' },
          },
          additionalProperties: {
            not: { type: 'null' },
          },
        },
      },
      oneOf: [{ required: ['name'] }],
    };

    const sanitized = sanitizeSchema(schema);

    // Root level
    expect(sanitized.oneOf).toBeUndefined();
    
    // Properties
    expect(sanitized.properties.name.const).toBeUndefined();
    expect(sanitized.properties.name.type).toBe('string');

    // Nested array items
    expect(sanitized.properties.tags.items.anyOf).toBeUndefined();

    // Nested object properties
    expect(sanitized.properties.metadata.patternProperties).toBeUndefined();
    expect(sanitized.properties.metadata.additionalProperties.not).toBeUndefined();
  });

  it('handles null and non-object values gracefully', () => {
    expect(sanitizeSchema(null)).toBe(null);
    expect(sanitizeSchema(123)).toBe(123);
    expect(sanitizeSchema('hello')).toBe('hello');
  });

  it('handles arrays at root level', () => {
    const input = [{ const: 1 }, { type: 'string' }];
    const output = sanitizeSchema(input);
    expect(output).toHaveLength(2);
    expect(output[0].const).toBeUndefined();
    expect(output[1].type).toBe('string');
  });
});

describe('calculateShannonEntropy', () => {
  it('calculates 0 entropy for uniform data', () => {
    const data = new Array(32).fill(0xaa);
    expect(calculateShannonEntropy(data)).toBe(0);
  });

  it('calculates 5.0 bits for 32 unique bytes', () => {
    const data = Array.from({ length: 32 }, (_, i) => i);
    expect(calculateShannonEntropy(data)).toBe(5.0);
  });

  it('calculates intermediate entropy for mixed data', () => {
    const data = [0, 0, 1, 1]; // 2 zeros, 2 ones
    // H = - (0.5 * log2(0.5) + 0.5 * log2(0.5)) = - (-0.5 + -0.5) = 1.0
    expect(calculateShannonEntropy(data)).toBe(1.0);
  });

  it('handles empty input', () => {
    expect(calculateShannonEntropy([])).toBe(0);
  });
});
