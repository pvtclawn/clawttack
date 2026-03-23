// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "forge-std/Script.sol";
import "../src/BIP39Words.sol";
import "../src/ClawttackArena.sol";
import "../src/ClawttackBattle.sol";

// Simple VOPs (12)
import "../src/vops/HashPreimageVOP.sol";
import "../src/vops/L1MetadataVOP.sol";
import "../src/vops/MirrorHashVOP.sol";
import "../src/vops/CascadeHashVOP.sol";
import "../src/vops/PrimeModuloVOP.sol";
import "../src/vops/XorFoldVOP.sol";
import "../src/vops/EntropyMixVOP.sol";
import "../src/vops/SequenceHashVOP.sol";
import "../src/vops/TimestampHashVOP.sol";
import "../src/vops/CoinbaseHashVOP.sol";
import "../src/vops/PopCountVOP.sol";
import "../src/vops/FibHashVOP.sol";
import "../src/vops/BitwiseNotVOP.sol";

// Instance-aware VOPs (4)
import "../src/vops/ArithmeticVOP.sol";
import "../src/vops/KeywordHashVOP.sol";
import "../src/vops/CoordinateVOP.sol";
import "../src/vops/PhraseHashVOP.sol";

/**
 * @title DeployV0
 * @notice Deploys the full Clawttack stack to Base Sepolia.
 *
 * Deploys:
 * - BIP39Words dictionary (SSTORE2)
 * - ClawttackBattle implementation (chess clock + NCC + VOP)
 * - ClawttackArena factory
 * - 16 VOPs (12 simple + 4 instance-aware)
 *
 * Usage:
 *   forge script script/Deploy.s.sol:DeployV0 \
 *     --rpc-url https://sepolia.base.org \
 *     --account clawn --password $WALLET_PASSWORD \
 *     --broadcast --verify
 */
contract DeployV0 is Script {
    function run() external {
        vm.startBroadcast();

        // ── 1. BIP39 Word Data (SSTORE2) ──────────────────────────────
        bytes memory packedWords = vm.readFileBinary("script/bip39_packed.bin");
        bytes memory data = abi.encodePacked(hex"00", packedWords);
        uint256 dataLen = data.length;

        bytes memory initCode = abi.encodePacked(
            hex"61",            // PUSH2
            uint16(dataLen),    // data length
            hex"80",            // DUP1
            hex"600C",          // PUSH1 12 (init code length)
            hex"6000",          // PUSH1 0 (memory offset)
            hex"39",            // CODECOPY
            hex"6000",          // PUSH1 0
            hex"f3",            // RETURN
            data                // the actual data
        );

        address dataContract;
        assembly {
            dataContract := create(0, add(initCode, 32), mload(initCode))
        }
        require(dataContract != address(0), "SSTORE2 deploy failed");
        console.log("BIP39 Data Contract:", dataContract);

        // ── 2. BIP39Words Dictionary ──────────────────────────────────
        BIP39Words wordDictionary = new BIP39Words(dataContract, 2048);
        console.log("BIP39Words:", address(wordDictionary));

        // ── 3. Battle Implementation ──────────────────────────────────
        ClawttackBattle battleImpl = new ClawttackBattle();
        console.log("ClawttackBattle (impl):", address(battleImpl));

        // ── 4. Arena Factory ──────────────────────────────────────────
        ClawttackArena arena = new ClawttackArena(address(wordDictionary));
        console.log("ClawttackArena:", address(arena));
        arena.setBattleImplementation(address(battleImpl));

        // ── 5. Deploy & Register 16 VOPs ──────────────────────────────
        address[16] memory vops;

        // Simple VOPs (0-11)
        vops[0]  = address(new L1MetadataVOP());
        vops[1]  = address(new MirrorHashVOP());
        vops[2]  = address(new CascadeHashVOP());
        vops[3]  = address(new PrimeModuloVOP());
        vops[4]  = address(new XorFoldVOP());
        vops[5]  = address(new EntropyMixVOP());
        vops[6]  = address(new SequenceHashVOP());
        vops[7]  = address(new TimestampHashVOP());
        vops[8]  = address(new CoinbaseHashVOP());
        vops[9] = address(new PopCountVOP());
        vops[10] = address(new FibHashVOP());
        vops[11] = address(new BitwiseNotVOP());

        // Instance-aware VOPs (12-15)
        vops[12] = address(new ArithmeticVOP());
        vops[13] = address(new KeywordHashVOP());
        vops[14] = address(new CoordinateVOP());
        vops[15] = address(new PhraseHashVOP());

        string[16] memory names = [
            "L1Metadata", "MirrorHash", "CascadeHash",
            "PrimeModulo", "XorFold", "EntropyMix", "SequenceHash",
            "TimestampHash", "CoinbaseHash", "PopCount", "FibHash", "BitwiseNot",
            "Arithmetic", "KeywordHash", "Coordinate", "PhraseHash"
        ];

        for (uint256 i = 0; i < 16; i++) {
            arena.addVop(vops[i]);
            console.log(string.concat("VOP[", vm.toString(i), "] ", names[i], ":"), vops[i]);
        }

        // ── 6. Zero Fees (testnet) ────────────────────────────────────
        arena.setProtocolFeeRate(0);
        arena.setBattleCreationFee(0);
        arena.setAgentRegistrationFee(0);

        vm.stopBroadcast();

        // ── Summary ─────────────────────────────────────────────────
        console.log("");
        console.log("========================================");
        console.log("Clawttack V0 Deployed!");
        console.log("========================================");
        console.log("Arena:              ", address(arena));
        console.log("Battle Impl:        ", address(battleImpl));
        console.log("Word Dictionary:    ", address(wordDictionary));
        console.log("VOPs registered:     16");
        console.log("  Simple (0-11):     blockhash-derived");
        console.log("  Instance (12-15):  narrative-embedded params");
        console.log("");
        console.log("Next steps:");
        console.log("  1. Register agents: arena.registerAgent()");
        console.log("  2. Create battle: arena.createBattle(agentId, config, secretHash)");
        console.log("  3. Accept battle: battle.acceptBattle(agentId, secretHash)");
    }
}
