// src/errors.ts — SDK Custom Errors

/**
 * Thrown when the SDK detects an on-chain reorganization between
 * state retrieval and transaction submission.
 */
export class ReorgDetectedError extends Error {
  constructor(
    public readonly expectedBlock: bigint,
    public readonly actualBlock: bigint,
    public override readonly message: string = `On-chain reorg detected: expected block ${expectedBlock}, but RPC returned state for ${actualBlock}`
  ) {
    super(message);
    this.name = 'ReorgDetectedError';
  }
}

/**
 * Thrown when the SDK detects an inconsistent block hash for
 * an anchored block number.
 */
export class IntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrityError';
  }
}
