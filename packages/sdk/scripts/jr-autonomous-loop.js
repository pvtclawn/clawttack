// Battle loop wrapper for Jr's autonomous fighter
// Uses Jr's NarrativeGenerator for creative narratives
// Uses proven loop structure for reliability
const { ethers } = require("/home/node/.openclaw/workspace/node_modules/ethers");
const fs = require("fs");
const { PrivateClawnJrFighter } = require("/home/node/.openclaw/workspace/privateclawnjr-fighter");

const CHECKPOINT_PATH = "/home/node/.openclaw/workspace/ncc-checkpoint.json";
function saveCheckpoint(data) { fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(data)); }
function loadCheckpoint() { try { return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf-8")); } catch { return null; } }

async function main() {
  const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
  const key = fs.readFileSync("/tmp/batch_opponent_key", "utf-8").trim();
  const wallet = new ethers.Wallet(key, provider);
  console.log("🦀 PrivateClawnJr Autonomous Fighter");
  console.log("Wallet:", wallet.address);

  const BATTLE = process.env.BATTLE;
  if (!BATTLE) { console.error("Set BATTLE env var"); process.exit(1); }
  console.log("Battle:", BATTLE);

  // Initialize Jr's fighter for narrative generation
  const jrFighter = new PrivateClawnJrFighter();
  await jrFighter.initialize();
  console.log("🧠 Jr's NarrativeGenerator loaded");

  const abi = [
    "function getBattleState() view returns (uint8, uint32, uint128, uint128, bytes32, uint256)",
    "function firstMoverA() view returns (bool)",
    "function targetWordIndex() view returns (uint16)",
    "function poisonWord() view returns (string)",
    "function currentVopParams() view returns (bytes)",
    "function acceptBattle(uint256 agentId, bytes32 secretHash)",
    "function submitTurn(tuple(string narrative, uint256 solution, string customPoisonWord, tuple(uint16[4] candidateWordIndices, uint16[4] candidateOffsets, bytes32 nccCommitment) nccAttack, tuple(uint8 guessIdx) nccDefense, tuple(bytes32 salt, uint8 intendedIdx) nccReveal) payload)",
    "function startBlock() view returns (uint32)"
  ];
  const battle = new ethers.Contract(BATTLE, abi, wallet);
  const bip39 = fs.readFileSync("/home/node/.openclaw/workspace/bip39.txt", "utf-8").split("\n").map(w => w.trim()).filter(w => w);

  // Restore checkpoint
  const ckpt = loadCheckpoint();
  let prevSalt = (ckpt && ckpt.battle === BATTLE) ? ckpt.prevSalt : ethers.ZeroHash;
  let prevIdx = (ckpt && ckpt.battle === BATTLE) ? ckpt.prevIdx : 0;
  let lastTurn = (ckpt && ckpt.battle === BATTLE) ? ckpt.lastTurn : -1;
  if (ckpt && ckpt.battle === BATTLE) console.log("📋 Restored checkpoint: turn", ckpt.lastTurn);

  // Accept battle
  while (true) {
    const [phase] = await battle.getBattleState();
    if (Number(phase) === 0) {
      console.log("Accepting...");
      try { const tx = await battle.acceptBattle(2, ethers.ZeroHash); await tx.wait(); console.log("Accepted!"); }
      catch (e) { console.log("Accept err:", e.message?.slice(0,80)); }
      await new Promise(r => setTimeout(r, 5000)); continue;
    }
    if (Number(phase) === 1) { console.log("Battle Active!"); break; }
    if (Number(phase) === 2) { console.log("Already settled"); return; }
    await new Promise(r => setTimeout(r, 3000));
  }

  // Wait warmup
  while (true) {
    const start = Number(await battle.startBlock());
    const cur = await provider.getBlockNumber();
    if (cur >= start) { console.log("Warmup done"); break; }
    await new Promise(r => setTimeout(r, 4000));
  }

  // Fight loop
  while (true) {
    let state;
    try { state = await battle.getBattleState(); }
    catch (e) { console.log("RPC err, retry 10s"); await new Promise(r => setTimeout(r, 10000)); continue; }

    const p = Number(state[0]), turnNum = Number(state[1]);
    if (p === 2) { console.log("SETTLED! A=" + Number(state[2]) + " B=" + Number(state[3])); break; }
    if (p !== 1) { await new Promise(r => setTimeout(r, 4000)); continue; }

    const firstA = await battle.firstMoverA();
    const isATurn = (turnNum % 2 === 0) ? firstA : !firstA;
    if (isATurn || turnNum === lastTurn) { await new Promise(r => setTimeout(r, 5000)); continue; }

    console.log("--- TURN", turnNum, "A=" + Number(state[2]), "B=" + Number(state[3]), "---");
    const targetIdx = Number(await battle.targetWordIndex());
    const targetWord = bip39[targetIdx];
    const poison = await battle.poisonWord();
    const vopParams = await battle.currentVopParams();

    // Use Jr's narrative generator for creative text!
    const candidates = jrFighter.selectCandidates(bip39, targetWord, poison, 4);
    const candidateIndices = candidates.map(w => bip39.indexOf(w));

    // Build narrative using Jr's generator
    let narrative = jrFighter.narrativeGen.generateNarrative(targetWord, poison, candidates, [], false);

    // Ensure target word is present
    if (!narrative.includes(targetWord)) narrative = targetWord + " " + narrative;
    // Remove poison word
    if (poison && narrative.includes(poison)) narrative = narrative.split(poison).join(bip39[turnNum % 100]);
    // Ensure candidates are present
    for (const c of candidates) {
      if (!narrative.includes(c)) narrative += " " + c;
    }
    // Truncate to 256 bytes
    const enc = new TextEncoder();
    while (enc.encode(narrative).length > 256) narrative = narrative.slice(0, -10);

    console.log("📝", narrative.slice(0, 80) + "...");

    // Calculate actual byte offsets
    const offsets = candidates.map(w => {
      const idx = narrative.indexOf(w);
      return idx >= 0 ? enc.encode(narrative.slice(0, idx)).length : 0;
    });

    // VOP
    let solution = 0;
    if (vopParams && vopParams.length > 4) {
      const th = "0x" + vopParams.slice(2, 66);
      const diff = parseInt(vopParams.slice(66), 16);
      for (let i = 0; i < 200000; i++) {
        const h = ethers.keccak256(ethers.solidityPacked(["bytes32", "uint256"], [th, i]));
        let z = 0;
        for (const ch of h.slice(2)) { if (ch === "0") z += 4; else { z += Math.clz32(parseInt(ch, 16)) - 28; break; } }
        if (z >= diff) { solution = i; break; }
      }
    }

    // NCC — randomize answer and defense
    const salt = ethers.hexlify(ethers.randomBytes(32));
    const intendedIdx = Math.floor(Math.random() * 4);
    const commitment = ethers.keccak256(ethers.solidityPacked(["bytes32", "uint8"], [salt, intendedIdx]));
    const customPoison = jrFighter.chooseStrategicPoison ? jrFighter.chooseStrategicPoison() : "shadow";

    try {
      const tx = await battle.submitTurn({
        narrative, solution, customPoisonWord: customPoison,
        nccAttack: { candidateWordIndices: candidateIndices, candidateOffsets: offsets, nccCommitment: commitment },
        nccDefense: { guessIdx: Math.floor(Math.random() * 4) },
        nccReveal: { salt: prevSalt, intendedIdx: prevIdx }
      }, { gasLimit: 4000000 });
      console.log("Tx:", tx.hash);
      await tx.wait();
      console.log("✅ Turn", turnNum);
      prevSalt = salt; prevIdx = intendedIdx; lastTurn = turnNum;
      saveCheckpoint({ battle: BATTLE, prevSalt: salt, prevIdx: intendedIdx, lastTurn: turnNum });
      await new Promise(r => setTimeout(r, 6000));
    } catch (e) {
      console.log("❌", e.message?.slice(0, 100));
      await new Promise(r => setTimeout(r, 10000));
    }
  }
}
main().catch(console.error);
