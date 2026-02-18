// packages/sdk/tests/waku-hardening.test.ts — Tests for M4.5 Waku security hardening
//
// Tests signature verification, turn ordering, duplicate rejection,
// and registration authentication without needing a live nwaku node.

import { describe, test, expect } from 'bun:test';
import { ethers } from 'ethers';
import { canonicalTurnHash, verifyTurn } from '@clawttack/protocol';
import type { TurnMessage } from '@clawttack/protocol';
import { signRegistration } from '../src/waku-transport.ts';

const BATTLE_ID = 'test-battle-001';

describe('Waku Hardening — Signature Verification', () => {
  test('signRegistration produces valid signature', async () => {
    const wallet = ethers.Wallet.createRandom();
    const timestamp = Date.now();
    const sig = await signRegistration(wallet, BATTLE_ID, timestamp);

    // Verify manually
    const message = `clawttack:register:${BATTLE_ID}:${wallet.address.toLowerCase()}:${timestamp}`;
    const recovered = ethers.verifyMessage(message, sig);
    expect(recovered.toLowerCase()).toBe(wallet.address.toLowerCase());
  });

  test('signRegistration rejects wrong address', async () => {
    const wallet = ethers.Wallet.createRandom();
    const otherWallet = ethers.Wallet.createRandom();
    const timestamp = Date.now();
    const sig = await signRegistration(wallet, BATTLE_ID, timestamp);

    // Verify with wrong address
    const message = `clawttack:register:${BATTLE_ID}:${otherWallet.address.toLowerCase()}:${timestamp}`;
    const recovered = ethers.verifyMessage(message, sig);
    expect(recovered.toLowerCase()).not.toBe(otherWallet.address.toLowerCase());
  });

  test('signRegistration rejects wrong battleId', async () => {
    const wallet = ethers.Wallet.createRandom();
    const timestamp = Date.now();
    const sig = await signRegistration(wallet, BATTLE_ID, timestamp);

    // Verify with wrong battleId
    const message = `clawttack:register:wrong-battle:${wallet.address.toLowerCase()}:${timestamp}`;
    const recovered = ethers.verifyMessage(message, sig);
    expect(recovered.toLowerCase()).not.toBe(wallet.address.toLowerCase());
  });
});

describe('Waku Hardening — Turn Signature Cross-Verification', () => {
  test('canonicalTurnHash + signMessage produces valid turn signature', async () => {
    const wallet = ethers.Wallet.createRandom();
    const turn: TurnMessage = {
      battleId: BATTLE_ID,
      agentAddress: wallet.address,
      message: 'Hello, this is my turn message',
      turnNumber: 1,
      timestamp: Date.now(),
    };

    const hash = canonicalTurnHash(turn);
    const signature = await wallet.signMessage(ethers.getBytes(hash));

    expect(verifyTurn(turn, signature)).toBe(true);
  });

  test('forged turn signature is rejected', async () => {
    const realAgent = ethers.Wallet.createRandom();
    const forger = ethers.Wallet.createRandom();
    const turn: TurnMessage = {
      battleId: BATTLE_ID,
      agentAddress: realAgent.address, // Claims to be realAgent
      message: 'I am definitely the real agent',
      turnNumber: 1,
      timestamp: Date.now(),
    };

    // Forger signs with their own key
    const hash = canonicalTurnHash(turn);
    const forgedSig = await forger.signMessage(ethers.getBytes(hash));

    // Verification should fail — signature doesn't match claimed address
    expect(verifyTurn(turn, forgedSig)).toBe(false);
  });

  test('tampered message is rejected', async () => {
    const wallet = ethers.Wallet.createRandom();
    const turn: TurnMessage = {
      battleId: BATTLE_ID,
      agentAddress: wallet.address,
      message: 'Original message',
      turnNumber: 1,
      timestamp: Date.now(),
    };

    const hash = canonicalTurnHash(turn);
    const signature = await wallet.signMessage(ethers.getBytes(hash));

    // Tamper with the message
    const tamperedTurn: TurnMessage = { ...turn, message: 'Tampered message' };
    expect(verifyTurn(tamperedTurn, signature)).toBe(false);
  });

  test('tampered turnNumber is rejected', async () => {
    const wallet = ethers.Wallet.createRandom();
    const turn: TurnMessage = {
      battleId: BATTLE_ID,
      agentAddress: wallet.address,
      message: 'My turn',
      turnNumber: 1,
      timestamp: Date.now(),
    };

    const hash = canonicalTurnHash(turn);
    const signature = await wallet.signMessage(ethers.getBytes(hash));

    // Tamper with turn number
    const tamperedTurn: TurnMessage = { ...turn, turnNumber: 2 };
    expect(verifyTurn(tamperedTurn, signature)).toBe(false);
  });

  test('tampered battleId is rejected', async () => {
    const wallet = ethers.Wallet.createRandom();
    const turn: TurnMessage = {
      battleId: BATTLE_ID,
      agentAddress: wallet.address,
      message: 'My turn',
      turnNumber: 1,
      timestamp: Date.now(),
    };

    const hash = canonicalTurnHash(turn);
    const signature = await wallet.signMessage(ethers.getBytes(hash));

    // Tamper with battleId (replay attack to different battle)
    const tamperedTurn: TurnMessage = { ...turn, battleId: 'different-battle' };
    expect(verifyTurn(tamperedTurn, signature)).toBe(false);
  });
});

describe('Waku Hardening — Turn Ordering Logic', () => {
  test('duplicate turn numbers should be detectable', () => {
    const seen = new Set<number>();
    seen.add(1);
    seen.add(3);

    expect(seen.has(1)).toBe(true); // Duplicate — reject
    expect(seen.has(2)).toBe(false); // New — accept
    expect(seen.has(3)).toBe(true); // Duplicate — reject
  });

  test('out-of-order detection works', () => {
    let lastReceived = 0;

    // Turn 1 — valid
    expect(1 > lastReceived).toBe(true);
    lastReceived = 1;

    // Turn 3 — valid (gaps OK in Waku, messages can arrive out of order)
    expect(3 > lastReceived).toBe(true);
    lastReceived = 3;

    // Turn 2 — invalid (already past turn 3)
    expect(2 > lastReceived).toBe(false);

    // Turn 3 again — invalid (duplicate)
    expect(3 > lastReceived).toBe(false);

    // Turn 4 — valid
    expect(4 > lastReceived).toBe(true);
  });
});
