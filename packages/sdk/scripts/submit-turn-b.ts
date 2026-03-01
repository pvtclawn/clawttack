/**
 * Submit opponent's turn (Agent B) to the v4 battle.
 * Usage: bun run scripts/submit-turn-b.ts
 */

import { ethers } from 'ethers';
import { createNccAttack, createNccDefense } from '../src/ncc-helper.ts';
import { scanForBip39Words } from '../src/bip39-scanner.ts';
import { solveHashPreimage } from '../src/vop-solver.ts';

const BATTLE = '0xF9405Bb54925a7920Bbe7B1386b055405380495c';
const DICT = '0x081838531Bb3377ba4766eE9D0D32eE2bb0A341f';
const RPC = 'https://sepolia.base.org';
const OPPONENT_KEY = '0xc95322cdf12e05f99ed21244b0f9d7ffbf1e4ffa72ca3c0482cb36d186ffcf3c';

const BATTLE_ABI = [
  'function submitTurn((string narrative, uint256 solution, string customPoisonWord, (uint16[4] candidateWordIndices, uint16[4] candidateOffsets, bytes32 nccCommitment) nccAttack, (uint8 guessIdx) nccDefense, (bytes32 salt, uint8 intendedIdx) nccReveal) payload)',
  'function getBattleState() view returns (uint8 phase, uint32 currentTurn, uint128 bankA, uint128 bankB, bytes32 sequenceHash, uint256 battleId)',
  'function targetWordIndex() view returns (uint16)',
  'function poisonWord() view returns (string)',
  'function currentVopParams() view returns (bytes)',
];

// First 20 BIP39 words (verified matching on-chain dictionary)
const BIP39_FIRST_20 = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
  'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
  'acoustic', 'acquire', 'across', 'act',
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(OPPONENT_KEY, provider);
  const battle = new ethers.Contract(BATTLE, BATTLE_ABI, wallet);

  console.log(`🔑 Agent B: ${wallet.address}`);

  const [phase, turn, bankA, bankB] = await battle.getBattleState();
  console.log(`📊 Phase: ${phase}, Turn: ${turn}, Banks: ${bankA}/${bankB}`);

  if (Number(turn) !== 1) {
    console.log(`⏳ Not Agent B's turn yet (turn=${turn})`);
    return;
  }

  // Get target word
  const targetIdx = Number(await battle.targetWordIndex());
  const dictABI = ['function word(uint16 index) view returns (string)'];
  const dict = new ethers.Contract(DICT, dictABI, provider);
  const targetWord = await dict.word(targetIdx);
  const poisonWord = await battle.poisonWord();
  const vopParams = await battle.currentVopParams();

  console.log(`🎯 Target: "${targetWord}" (idx=${targetIdx}), Poison: "${poisonWord}"`);

  // Write narrative with target word + BIP39 words
  const narrative = `On this ${targetWord} we abandon fear and gain ability to absorb abstract knowledge, able to act across boundaries about the nature of all things.`;
  console.log(`📝 Narrative (${narrative.length} chars)`);

  // Scan for BIP39 words
  const scan = scanForBip39Words(narrative, BIP39_FIRST_20, [targetWord]);
  console.log(`🔍 Found: ${scan.matches.map(m => m.word).join(', ')}`);

  if (!scan.candidates || scan.candidates.length < 4) {
    console.error('❌ Not enough BIP39 words!');
    process.exit(1);
  }

  // Build NCC attack
  const candidates = scan.candidates;
  const bip39Candidates = candidates.map(c => ({ word: c.word, index: c.wordIndex }));
  const { attack, salt, intendedIdx } = createNccAttack(
    narrative,
    bip39Candidates as any,
    1, // second candidate is the answer
  );

  // NCC defense: guess Agent A's riddle answer
  // A's candidates were [abandon, absorb, able, about], intended=0 (abandon)
  // As a "smart" agent, B guesses correctly: 0
  const defense = createNccDefense(0);

  // Solve VOP
  let solution = 0n;
  if (vopParams && vopParams !== '0x') {
    const vopResult = solveHashPreimage(vopParams);
    solution = vopResult.solution;
    console.log(`🧩 VOP solved: ${solution} (${vopResult.attempts} attempts)`);
  }

  // Check if target word is in first 20 BIP39 — if not, it won't be in our list
  // and we need a different approach for the target word check
  const targetInList = BIP39_FIRST_20.includes(targetWord.toLowerCase());
  console.log(`🎯 Target "${targetWord}" in BIP39 list: ${targetInList}`);

  const payload = {
    narrative,
    solution,
    customPoisonWord: 'castle',
    nccAttack: {
      candidateWordIndices: attack.candidateWordIndices,
      candidateOffsets: attack.candidateOffsets,
      nccCommitment: attack.nccCommitment,
    },
    nccDefense: defense,
    nccReveal: { salt: ethers.ZeroHash, intendedIdx: 0 }, // no reveal on turn 1
  };

  console.log('\n📤 Submitting turn 1...');
  try {
    const tx = await battle.submitTurn(payload);
    console.log(`📡 TX: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Turn 1 submitted! Gas: ${receipt.gasUsed}`);

    console.log(`\n💾 SAVE: Salt=${salt}, IntendedIdx=${intendedIdx}`);

    // Check new state
    const [, newTurn, newBankA, newBankB] = await battle.getBattleState();
    console.log(`📊 After: Turn=${newTurn}, Banks: ${newBankA}/${newBankB}`);
  } catch (err: any) {
    console.error(`❌ Failed:`, err.shortMessage || err.message);
    if (err.data) console.error(`   Data: ${err.data}`);
  }
}

main().catch(console.error);
