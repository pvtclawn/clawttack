/**
 * Submit turn 2 as Agent A (with NCC reveal from turn 0).
 */
import { ethers } from 'ethers';
import { createNccAttack, createNccDefense, createNccReveal } from '../src/ncc-helper.ts';
import { scanForBip39Words } from '../src/bip39-scanner.ts';
import { solveHashPreimage } from '../src/vop-solver.ts';

const BATTLE = '0xF9405Bb54925a7920Bbe7B1386b055405380495c';
const DICT = '0x081838531Bb3377ba4766eE9D0D32eE2bb0A341f';
const RPC = 'https://sepolia.base.org';

// Agent A's previous NCC data (from turn 0)
const PREV_SALT = '0xe4557fefb020f25636eb3d80dbaeefcc818d1ca1bacb2be19bf52ac654901085';
const PREV_INTENDED_IDX = 0;

const BIP39_FIRST_20 = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
  'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
  'acoustic', 'acquire', 'across', 'act',
];

const BATTLE_ABI = [
  'function submitTurn((string narrative, uint256 solution, string customPoisonWord, (uint16[4] candidateWordIndices, uint16[4] candidateOffsets, bytes32 nccCommitment) nccAttack, (uint8 guessIdx) nccDefense, (bytes32 salt, uint8 intendedIdx) nccReveal) payload)',
  'function getBattleState() view returns (uint8 phase, uint32 currentTurn, uint128 bankA, uint128 bankB, bytes32 sequenceHash, uint256 battleId)',
  'function targetWordIndex() view returns (uint16)',
  'function poisonWord() view returns (string)',
  'function currentVopParams() view returns (bytes)',
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const keystoreJson = await Bun.file(`${process.env.HOME}/.foundry/keystores/clawn`).text();
  const password = JSON.parse(await Bun.file(`${process.env.HOME}/.config/pvtclawn/secrets.json`).text()).WALLET_PASSWORD;
  const wallet = (await ethers.Wallet.fromEncryptedJson(keystoreJson, password)).connect(provider);

  const battle = new ethers.Contract(BATTLE, BATTLE_ABI, wallet);
  console.log(`🔑 Agent A: ${wallet.address}`);

  const [phase, turn, bankA, bankB] = await battle.getBattleState();
  console.log(`📊 Turn: ${turn}, Banks: ${bankA}/${bankB}`);

  // Get target word
  const dictABI = ['function word(uint16 index) view returns (string)'];
  const dict = new ethers.Contract(DICT, dictABI, provider);
  const targetIdx = Number(await battle.targetWordIndex());
  const targetWord = await dict.word(targetIdx);
  const poisonWord = await battle.poisonWord();
  const vopParams = await battle.currentVopParams();
  console.log(`🎯 Target: "${targetWord}", Poison: "${poisonWord}"`);

  // Build narrative
  const narrative = `The hero embarks on a ${targetWord} to abandon old patterns and gain ability to absorb abstract wisdom, able to act across every realm about the cosmic truth.`;
  console.log(`📝 Narrative: ${narrative.length} chars`);

  // Scan + build NCC attack
  const scan = scanForBip39Words(narrative, BIP39_FIRST_20, [targetWord]);
  console.log(`🔍 Found: ${scan.matches.map(m => m.word).join(', ')}`);
  if (!scan.candidates) { console.error('❌ Not enough BIP39 words!'); return; }

  const bip39C = scan.candidates.map(c => ({ word: c.word, index: c.wordIndex }));
  const { attack, salt, intendedIdx } = createNccAttack(narrative, bip39C as any, 0);
  console.log(`🎲 NCC: [${scan.candidates.map(c => c.word)}], intended=${intendedIdx}`);

  // NCC defense: guess B's riddle (B's candidates were [abandon, absorb, able, about], intended=1)
  // Agent B intended idx=1 which was "absorb" or whichever was second
  // As a script, guess randomly: 1
  const defense = createNccDefense(1);

  // NCC reveal from turn 0
  const reveal = createNccReveal(PREV_SALT as `0x${string}`, PREV_INTENDED_IDX as 0 | 1 | 2 | 3);
  console.log(`🔓 Revealing: salt=${PREV_SALT.slice(0, 14)}..., idx=${PREV_INTENDED_IDX}`);

  // VOP
  let solution = 0n;
  if (vopParams && vopParams !== '0x') {
    const vopResult = solveHashPreimage(vopParams);
    solution = vopResult.solution;
    console.log(`🧩 VOP: ${solution} (${vopResult.attempts} attempts, ${vopResult.timeMs}ms)`);
  }

  const payload = {
    narrative,
    solution,
    customPoisonWord: 'shadow',
    nccAttack: {
      candidateWordIndices: attack.candidateWordIndices,
      candidateOffsets: attack.candidateOffsets,
      nccCommitment: attack.nccCommitment,
    },
    nccDefense: defense,
    nccReveal: reveal,
  };

  console.log('\n📤 Submitting turn 2...');
  try {
    const tx = await battle.submitTurn(payload);
    console.log(`📡 TX: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Turn 2 submitted! Gas: ${receipt.gasUsed}`);
    console.log(`💾 SAVE: Salt=${salt}, IntendedIdx=${intendedIdx}`);

    const [, newTurn, newA, newB] = await battle.getBattleState();
    console.log(`📊 After: Turn=${newTurn}, Banks: ${newA}/${newB}`);
  } catch (err: any) {
    console.error(`❌ Failed:`, err.shortMessage || err.message);
    if (err.data) console.error(`   Data: ${err.data}`);
  }
}

main().catch(console.error);
