/**
 * Submit first turn to a v4 battle on Base Sepolia.
 * Usage: bun run scripts/submit-turn.ts
 */

import { ethers } from 'ethers';
import { createNccAttack, createNccDefense, createNccReveal } from '../src/ncc-helper.ts';
import { scanForBip39Words } from '../src/bip39-scanner.ts';
import { solveHashPreimage } from '../src/vop-solver.ts';

const BATTLE = '0xF9405Bb54925a7920Bbe7B1386b055405380495c';
const ARENA = '0xFe8Bfd37D941e22d3E21258e2b3D143435Ba793f';
const DICT = '0x081838531Bb3377ba4766eE9D0D32eE2bb0A341f';
const RPC = 'https://sepolia.base.org';

const BATTLE_ABI = [
  'function submitTurn((string narrative, uint256 solution, string customPoisonWord, (uint16[4] candidateWordIndices, uint16[4] candidateOffsets, bytes32 nccCommitment) nccAttack, (uint8 guessIdx) nccDefense, (bytes32 salt, uint8 intendedIdx) nccReveal) payload)',
  'function getBattleState() view returns (uint8 phase, uint32 currentTurn, uint128 bankA, uint128 bankB, bytes32 sequenceHash, uint256 battleId)',
  'function targetWordIndex() view returns (uint16)',
  'function poisonWord() view returns (string)',
  'function currentVopParams() view returns (bytes)',
  'function startBlock() view returns (uint256)',
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);

  // Load wallet from keystore
  const keystorePath = `${process.env.HOME}/.foundry/keystores/clawn`;
  const keystoreJson = await Bun.file(keystorePath).text();
  const password = JSON.parse(await Bun.file(`${process.env.HOME}/.config/pvtclawn/secrets.json`).text()).WALLET_PASSWORD;
  const wallet = (await ethers.Wallet.fromEncryptedJson(keystoreJson, password)).connect(provider);

  console.log(`🔑 Wallet: ${wallet.address}`);

  const battle = new ethers.Contract(BATTLE, BATTLE_ABI, wallet);

  // Get state
  const [phase, turn, bankA, bankB] = await battle.getBattleState();
  console.log(`📊 Phase: ${phase}, Turn: ${turn}, Banks: ${bankA}/${bankB}`);

  const targetIdx = await battle.targetWordIndex();
  console.log(`🎯 Target word index: ${targetIdx}`);

  // Look up target word from dictionary
  const dictABI = ['function word(uint16 index) view returns (string)'];
  const dict = new ethers.Contract(DICT, dictABI, provider);
  const targetWord = await dict.word(Number(targetIdx));
  console.log(`🎯 Target word: "${targetWord}"`);

  const vopParams = await battle.currentVopParams();

  // Use only first 20 BIP39 words (verified to match on-chain dictionary)
  const knownBip39 = [
    'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
    'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
    'acoustic', 'acquire', 'across', 'act',
  ];

  const narrative = `The warrior decided to ${targetWord} every obstacle and abandon the old ways. With raw ability they would absorb new knowledge and act upon it, able to achieve anything about the abstract realm across all dimensions.`;

  console.log(`📝 Narrative (${narrative.length} chars): "${narrative.slice(0, 80)}..."`);

  // Scan for BIP39 words using known list
  const scan = scanForBip39Words(narrative, knownBip39, [targetWord]);
  console.log(`🔍 Found ${scan.matches.length} BIP39 words: ${scan.matches.map(m => m.word).join(', ')}`);

  if (!scan.candidates || scan.candidates.length < 4) {
    console.error('❌ Not enough BIP39 words in narrative!');
    process.exit(1);
  }

  // Build NCC attack
  const candidates = scan.candidates;
  const bip39Candidates = candidates.map(c => ({ word: c.word, index: c.wordIndex }));
  const { attack, salt, intendedIdx } = createNccAttack(
    narrative,
    bip39Candidates as any,
    0, // first candidate is the answer
  );

  console.log(`🎲 NCC Attack: candidates=[${candidates.map(c => c.word)}], intended=${intendedIdx}`);
  console.log(`🔒 Commitment: ${attack.nccCommitment}`);
  console.log(`🔑 Salt (KEEP SECRET): ${salt}`);

  // Solve VOP (empty for turn 0)
  let solution = 0n;
  if (vopParams && vopParams !== '0x') {
    const vopResult = solveHashPreimage(vopParams);
    solution = vopResult.solution;
    console.log(`🧩 VOP solved: ${solution} (${vopResult.attempts} attempts)`);
  } else {
    console.log('🧩 VOP: empty (turn 0)');
  }

  // Build payload
  const payload = {
    narrative,
    solution,
    customPoisonWord: 'dragon', // assign poison word to opponent
    nccAttack: {
      candidateWordIndices: attack.candidateWordIndices,
      candidateOffsets: attack.candidateOffsets,
      nccCommitment: attack.nccCommitment,
    },
    nccDefense: { guessIdx: 0 }, // no defense on turn 0
    nccReveal: { salt: ethers.ZeroHash, intendedIdx: 0 }, // no reveal on turn 0
  };

  console.log('\n📤 Submitting turn...');

  // Wait for warmup if needed
  const startBlock = await battle.startBlock();
  const currentBlock = await provider.getBlockNumber();
  const warmupBlocks = 15;
  if (currentBlock < Number(startBlock) + warmupBlocks) {
    const waitBlocks = Number(startBlock) + warmupBlocks - currentBlock + 5; // +5 for MIN_TURN_INTERVAL
    console.log(`⏳ Waiting ${waitBlocks} blocks for warmup + min interval...`);
    await new Promise(resolve => setTimeout(resolve, waitBlocks * 2000));
  }

  try {
    const tx = await battle.submitTurn(payload);
    console.log(`📡 TX sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Turn submitted! Gas: ${receipt.gasUsed}, Block: ${receipt.blockNumber}`);

    // Save salt for next reveal
    console.log(`\n💾 SAVE FOR NEXT TURN:`);
    console.log(`   Salt: ${salt}`);
    console.log(`   IntendedIdx: ${intendedIdx}`);
  } catch (err: any) {
    console.error(`❌ Failed:`, err.message || err);

    // Try to decode the error
    if (err.data) {
      console.error(`   Error data: ${err.data}`);
    }
  }
}

main().catch(console.error);
