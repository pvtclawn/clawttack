import { ethers } from 'ethers';
import { createNccAttack } from '../packages/sdk/src/ncc-helper.ts';
import { solveHashPreimage } from '../packages/sdk/src/vop-solver.ts';

const RPC='https://sepolia.base.org';
const ARENA='0xe090C149A5990E1F7F3C32faf0beA05F9a5ebdA3';
const BATTLE='0x9c40B6E51673dFfc5B480e6EAEcbbF8099f802bb';

async function main() {
  const key = (await Bun.file('/tmp/batch_opponent_key').text()).trim(); // agent 3 owner
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(key, provider);

  const battleAbi=[
    'function getBattleState() view returns (uint8 phase, uint32 currentTurn, uint128 bankA, uint128 bankB, bytes32 sequenceHash, uint256 battleId)',
    'function targetWordIndex() view returns (uint16)',
    'function poisonWord() view returns (string)',
    'function currentVopParams() view returns (bytes)',
    'function submitTurn((string narrative, uint256 solution, string customPoisonWord, (uint16[4] candidateWordIndices, uint16[4] candidateOffsets, bytes32 nccCommitment) nccAttack, (uint8 guessIdx) nccDefense, (bytes32 salt, uint8 intendedIdx) nccReveal) payload)'
  ];
  const arenaAbi=['function wordDictionary() view returns (address)'];
  const dictAbi=['function word(uint16 index) view returns (string)'];

  const battle=new ethers.Contract(BATTLE,battleAbi,wallet);
  const arena=new ethers.Contract(ARENA,arenaAbi,provider);

  const [phase, turn] = await battle.getBattleState();
  if (Number(phase)!==1) throw new Error(`battle not active phase=${phase}`);
  const targetIdx = Number(await battle.targetWordIndex());
  const poison = String(await battle.poisonWord());
  const vopParams = await battle.currentVopParams();

  const dict = new ethers.Contract(await arena.wordDictionary(), dictAbi, provider);
  const targetWord = String(await dict.word(targetIdx));

  let narrative = `Agent signal ${targetWord} abandon ability able about arc path.`;
  if (poison && poison.length>0) {
    const re = new RegExp(poison, 'ig');
    narrative = narrative.replace(re, 'safe');
  }

  const candidates: any = [
    {word:'abandon', index:0},
    {word:'ability', index:1},
    {word:'able', index:2},
    {word:'about', index:3},
  ];
  const {attack, salt, intendedIdx} = createNccAttack(narrative, candidates, 0);

  let solution = 0n;
  if (vopParams && vopParams !== '0x') {
    const r = solveHashPreimage(vopParams);
    solution = r.solution;
  }

  const payload={
    narrative,
    solution,
    customPoisonWord:'abandon',
    nccAttack: attack,
    nccDefense:{guessIdx:0},
    nccReveal:{salt: ethers.ZeroHash, intendedIdx:0}
  };

  console.log(JSON.stringify({wallet:wallet.address, phase:Number(phase), turn:Number(turn), targetIdx, targetWord, poison, narrative, solution:String(solution)}));
  const tx = await battle.submitTurn(payload, {gasLimit: 2500000});
  console.log(`tx=${tx.hash}`);
  const rc = await tx.wait();
  console.log(`status=${rc?.status} gas=${rc?.gasUsed?.toString()}`);
  console.log(`reveal_salt=${salt} intendedIdx=${intendedIdx}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
