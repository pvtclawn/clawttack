import { describe, it, expect } from 'bun:test';
import { sanitizeDefenderResponse } from '../src/strategies/gateway.ts';

describe('sanitizeDefenderResponse', () => {
  it('should pass through normal responses', () => {
    expect(sanitizeDefenderResponse('Hello! How can I help you?')).toBe('Hello! How can I help you?');
    expect(sanitizeDefenderResponse("I'm PrivateClawn, an AI agent.")).toBe("I'm PrivateClawn, an AI agent.");
    expect(sanitizeDefenderResponse('')).toBe('');
  });

  it('should sanitize LLM request rejected errors', () => {
    const error = 'LLM request rejected: messages.1.content.0.thinking.signature: Field required';
    expect(sanitizeDefenderResponse(error)).toBe('[Defender is processing — please continue.]');
  });

  it('should sanitize thinking.signature errors', () => {
    const error = 'Something about thinking.signature validation failed';
    expect(sanitizeDefenderResponse(error)).toBe('[Defender is processing — please continue.]');
  });

  it('should sanitize Field required errors', () => {
    expect(sanitizeDefenderResponse('Field required for some parameter'))
      .toBe('[Defender is processing — please continue.]');
  });

  it('should sanitize raw JSON error objects', () => {
    const jsonError = '{"error": {"message": "Invalid API key", "code": 401}}';
    expect(sanitizeDefenderResponse(jsonError)).toBe('[Defender is processing — please continue.]');
  });

  it('should sanitize rate limit errors', () => {
    expect(sanitizeDefenderResponse('rate_limit_exceeded: too many requests'))
      .toBe('[Defender is processing — please continue.]');
  });

  it('should sanitize model not found errors', () => {
    expect(sanitizeDefenderResponse('model_not_found: gpt-4-turbo'))
      .toBe('[Defender is processing — please continue.]');
  });

  it('should sanitize context length errors', () => {
    expect(sanitizeDefenderResponse('context_length_exceeded: max 128k tokens'))
      .toBe('[Defender is processing — please continue.]');
  });

  it('should sanitize content filter errors', () => {
    expect(sanitizeDefenderResponse('content_filter triggered by policy'))
      .toBe('[Defender is processing — please continue.]');
  });

  it('should sanitize internal server error', () => {
    expect(sanitizeDefenderResponse('Internal server error'))
      .toBe('[Defender is processing — please continue.]');
  });

  it('should NOT sanitize responses that mention errors in context', () => {
    // Agent talking ABOUT errors should be allowed
    expect(sanitizeDefenderResponse('I can help you debug that error in your code'))
      .toBe('I can help you debug that error in your code');
    expect(sanitizeDefenderResponse('The error handling in Rust is great'))
      .toBe('The error handling in Rust is great');
  });
});
