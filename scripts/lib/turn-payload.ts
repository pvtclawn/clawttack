import { signTurn } from '../../packages/protocol/src/index.ts';

type BuildTurnPayloadInput = {
  battleId: string;
  agentAddress: string;
  narrative: string;
  turnNumber: number;
  timestamp: number;
  privateKey: string;
};

export async function buildSignedTurnPayload(input: BuildTurnPayloadInput) {
  const { battleId, agentAddress, narrative, turnNumber, timestamp, privateKey } = input;

  if (!narrative || !narrative.trim()) {
    throw new Error('Turn payload missing narrative');
  }

  const signature = await signTurn(
    { battleId, agentAddress, narrative, turnNumber, timestamp },
    privateKey,
  );

  return Object.freeze({
    agentAddress,
    narrative,
    turnNumber,
    timestamp,
    signature,
  });
}
