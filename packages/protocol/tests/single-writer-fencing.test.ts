import { describe, expect, it } from 'bun:test';
import { evaluateSubmitFencingGuard } from '../src/single-writer-fencing';

describe('single-writer submit fencing guard', () => {
  it('passes for matching owner, scope, and token', () => {
    const result = evaluateSubmitFencingGuard({
      expectedScopeKey: '84532:0xArena:0xWallet',
      runnerId: 'runner-A',
      heldToken: 42,
      lockState: {
        scopeKey: '84532:0xArena:0xWallet',
        ownerId: 'runner-A',
        activeToken: 42,
        tokenFloor: 40,
      },
    });

    expect(result).toEqual({ allowSubmit: true, reason: 'pass' });
  });

  it('rejects stale token ownership', () => {
    const result = evaluateSubmitFencingGuard({
      expectedScopeKey: '84532:0xArena:0xWallet',
      runnerId: 'runner-A',
      heldToken: 7,
      lockState: {
        scopeKey: '84532:0xArena:0xWallet',
        ownerId: 'runner-B',
        activeToken: 8,
      },
    });

    expect(result).toEqual({ allowSubmit: false, reason: 'stale-fencing-token' });
  });

  it('rejects scope mismatch deterministically', () => {
    const result = evaluateSubmitFencingGuard({
      expectedScopeKey: '84532:0xArena:0xWalletA',
      runnerId: 'runner-A',
      heldToken: 9,
      lockState: {
        scopeKey: '84532:0xArena:0xWalletB',
        ownerId: 'runner-A',
        activeToken: 9,
      },
    });

    expect(result).toEqual({ allowSubmit: false, reason: 'lock-scope-mismatch' });
  });

  it('fails closed on missing state and token regression', () => {
    const missing = evaluateSubmitFencingGuard({
      expectedScopeKey: '84532:0xArena:0xWallet',
      runnerId: 'runner-A',
      heldToken: 1,
      lockState: null,
    });

    const regression = evaluateSubmitFencingGuard({
      expectedScopeKey: '84532:0xArena:0xWallet',
      runnerId: 'runner-A',
      heldToken: 10,
      lockState: {
        scopeKey: '84532:0xArena:0xWallet',
        ownerId: 'runner-A',
        activeToken: 9,
        tokenFloor: 10,
      },
    });

    expect(missing).toEqual({ allowSubmit: false, reason: 'missing-lock-state' });
    expect(regression).toEqual({ allowSubmit: false, reason: 'token-regression-detected' });
  });
});
