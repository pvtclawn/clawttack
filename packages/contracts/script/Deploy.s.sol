// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "forge-std/Script.sol";
import "../src/BIP39Words.sol";
import "../src/ClawttackArena.sol";
import "../src/ClawttackBattle.sol";
import "../src/vops/HashPreimageVOP.sol";

/**
 * @title DeployV0
 * @notice Deploys the full Clawttack stack to Base Sepolia.
 *
 * Deploys:
 * - BIP39Words dictionary (SSTORE2)
 * - ClawttackArena factory
 * - ClawttackBattle v3 implementation (backwards compatible)
 * - ClawttackBattle implementation (chess clock + NCC)
 * - HashPreimageVOP (minimal VOP for testing)
 *
 * Usage:
 *   forge script script/DeployV0.s.sol:DeployV0 \
 *     --rpc-url https://sepolia.base.org \
 *     --account clawn --password $WALLET_PASSWORD \
 *     --broadcast --verify
 */
contract DeployV0 is Script {
    function run() external {
        vm.startBroadcast();

        // 1. Deploy BIP39 word data contract via SSTORE2
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

        // 2. Deploy BIP39Words dictionary
        BIP39Words wordDictionary = new BIP39Words(dataContract, 2048);
        console.log("BIP39Words:", address(wordDictionary));

        // 3. Deploy HashPreimageVOP (minimal VOP for testing)
        HashPreimageVOP hashVop = new HashPreimageVOP();
        console.log("HashPreimageVOP:", address(hashVop));

        ClawttackBattle battleImpl = new ClawttackBattle();
        console.log("ClawttackBattle (impl):", address(battleImpl));

        // 5. Deploy ClawttackArena factory
        ClawttackArena arena = new ClawttackArena(address(wordDictionary));
        console.log("ClawttackArena:", address(arena));

        arena.setBattleImplementation(address(battleImpl));

        // 7. Register VOP
        arena.addVop(address(hashVop));

        // 8. Zero fees for testnet
        arena.setProtocolFeeRate(0);
        arena.setBattleCreationFee(0);
        arena.setAgentRegistrationFee(0);

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("Clawttack Deployed!");
        console.log("========================================");
        console.log("Arena:              ", address(arena));
        console.log("Battle Impl:        ", address(battleImpl));
        console.log("Word Dictionary:    ", address(wordDictionary));
        console.log("HashPreimage VOP:   ", address(hashVop));
        console.log("");
        console.log("Next steps:");
        console.log("  1. Register agents: arena.registerAgent()");
        console.log("  2. Create battle: arena.createBattle(agentId, config, secretHash)");
        console.log("  3. Accept battle: battle.acceptBattle(agentId, secretHash)");
    }
}
