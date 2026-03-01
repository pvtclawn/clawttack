const { ethers } = require("/home/node/.openclaw/workspace/node_modules/ethers");
const fs = require("fs");

const CHECKPOINT_PATH = "/home/node/.openclaw/workspace/ncc-checkpoint.json";

function saveCheckpoint(data) {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(data));
}

function loadCheckpoint() {
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf-8"));
  } catch { return null; }
}

async function main() {
  const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
  const key = fs.readFileSync("/tmp/batch_opponent_key", "utf-8").trim();
  const wallet = new ethers.Wallet(key, provider);
  console.log("Wallet:", wallet.address);

  const BATTLE = process.env.BATTLE;
  console.log("Battle:", BATTLE);

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
  console.log("Loaded", bip39.length, "words");

  // Restore NCC state from checkpoint (survives crashes!)
  const ckpt = loadCheckpoint();
  let prevSalt = (ckpt && ckpt.battle === BATTLE) ? ckpt.prevSalt : ethers.ZeroHash;
  let prevIdx = (ckpt && ckpt.battle === BATTLE) ? ckpt.prevIdx : 0;
  let lastTurn = (ckpt && ckpt.battle === BATTLE) ? ckpt.lastTurn : -1;
  if (ckpt && ckpt.battle === BATTLE) {
    console.log("Restored checkpoint: turn", ckpt.lastTurn, "salt", ckpt.prevSalt.slice(0, 10) + "...");
  }

  // STEP 1: Accept battle
  while (true) {
    const [phase] = await battle.getBattleState();
    const p = Number(phase);
    if (p === 0) {
      console.log("Accepting...");
      try {
        const tx = await battle.acceptBattle(2, ethers.ZeroHash);
        await tx.wait();
        console.log("Accepted!");
      } catch (e) { console.log("Accept err:", e.message?.slice(0,80)); }
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }
    if (p === 1) { console.log("Battle Active!"); break; }
    if (p === 2) { console.log("Already settled"); return; }
    await new Promise(r => setTimeout(r, 3000));
  }

  // STEP 2: Wait for warmup
  while (true) {
    const start = Number(await battle.startBlock());
    const cur = await provider.getBlockNumber();
    if (cur >= start) { console.log("Warmup done"); break; }
    console.log("Warmup", cur, "<", start);
    await new Promise(r => setTimeout(r, 4000));
  }

  // STEP 3: Fight loop
  while (true) {
    let state;
    try {
      state = await battle.getBattleState();
    } catch (e) {
      console.log("RPC error:", e.message?.slice(0, 60), "— retrying in 10s");
      await new Promise(r => setTimeout(r, 10000));
      continue;
    }
    const p = Number(state[0]);
    const turnNum = Number(state[1]);
    if (p === 2) { console.log("SETTLED! A=" + Number(state[2]) + " B=" + Number(state[3])); break; }
    if (p !== 1) { await new Promise(r => setTimeout(r, 4000)); continue; }

    const firstA = await battle.firstMoverA();
    const isATurn = (turnNum % 2 === 0) ? firstA : !firstA;
    const isMyTurn = !isATurn;

    if (!isMyTurn || turnNum === lastTurn) {
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }

    console.log("--- TURN", turnNum, "A=" + Number(state[2]), "B=" + Number(state[3]), "---");
    const targetIdx = Number(await battle.targetWordIndex());
    const targetWord = bip39[targetIdx];
    const poison = await battle.poisonWord();
    const vopParams = await battle.currentVopParams();

    // Pick 4 candidate words (rotate based on turn number for variety)
    const safe = bip39.filter(w => w !== targetWord && w !== poison && w.length > 3).slice(0, 200);
    const n = turnNum;
    const picks = [safe[n % 200], safe[(n + 50) % 200], safe[(n + 100) % 200], safe[(n + 150) % 200]];

    // Build narrative
    const pad = bip39.filter(w => w !== targetWord && w !== poison && picks.indexOf(w) < 0).slice(0, 6);
    const narrative = picks[0] + " " + picks[1] + " " + targetWord + " " + picks[2] + " " + picks[3] + " " + pad.join(" ") + " battle!";
    console.log("N:", narrative.slice(0, 60));

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

    // NCC attack — randomize intendedIdx for unpredictability
    const salt = ethers.hexlify(ethers.randomBytes(32));
    const intendedIdx = turnNum % 4;
    const commitment = ethers.keccak256(ethers.solidityPacked(["bytes32", "uint8"], [salt, intendedIdx]));
    const enc = new TextEncoder();
    const offsets = picks.map(w => enc.encode(narrative.slice(0, narrative.indexOf(w))).length);
    const indices = picks.map(w => bip39.indexOf(w));

    try {
      const tx = await battle.submitTurn({
        narrative, solution, customPoisonWord: "shadow",
        nccAttack: { candidateWordIndices: indices, candidateOffsets: offsets, nccCommitment: commitment },
        nccDefense: { guessIdx: turnNum % 4 },
        nccReveal: { salt: prevSalt, intendedIdx: prevIdx }
      }, { gasLimit: 4000000 });
      console.log("Tx:", tx.hash);
      await tx.wait();
      console.log("OK turn", turnNum);
      prevSalt = salt;
      prevIdx = intendedIdx;
      lastTurn = turnNum;
      // CHECKPOINT: persist NCC state to disk
      saveCheckpoint({ battle: BATTLE, prevSalt: salt, prevIdx: intendedIdx, lastTurn: turnNum });
      await new Promise(r => setTimeout(r, 6000));
    } catch (e) {
      console.log("Err:", e.message?.slice(0, 100));
      await new Promise(r => setTimeout(r, 10000));
    }
  }
}
main().catch(console.error);
