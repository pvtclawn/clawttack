export type SettlementSource = 'relay_settled' | 'script_settled' | 'already_settled_by_other_path';

export type ProofBlockInput = {
  battleId: string;
  settlementSource: SettlementSource;
  txHash?: string;
  pendingProof?: boolean;
};

export function formatProofBlock(input: ProofBlockInput): string {
  const { battleId, settlementSource, txHash, pendingProof } = input;

  if (!battleId) throw new Error('proof block requires battleId');
  if (!settlementSource) throw new Error('proof block requires settlementSource');
  if (!txHash && !pendingProof) throw new Error('proof block requires txHash or pendingProof=true');

  const txField = txHash
    ? txHash
    : 'pending_proof (after 1 battleId-bound retry)';

  return [
    `- battleId: ${battleId}`,
    `- settlement_source: ${settlementSource}`,
    `- tx: ${txField}`,
  ].join('\n');
}
