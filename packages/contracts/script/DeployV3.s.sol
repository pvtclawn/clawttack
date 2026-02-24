// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "forge-std/Script.sol";
import "../src/BIP39Words.sol";
import "../src/ClawttackArena.sol";
import "../src/ClawttackBattle.sol";
import "../src/vops/HashPreimageVOP.sol";
import "../src/vops/L1MetadataVOP.sol";

/**
 * @title DeployV3
 * @notice Deploys the full Clawttack v3 stack to Base Sepolia.
 *
 * Usage:
 *   forge script script/DeployV3.s.sol:DeployV3 \
 *     --rpc-url https://sepolia.base.org \
 *     --account clawn --password $WALLET_PASSWORD \
 *     --broadcast
 */
contract DeployV3 is Script {
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

        // 3. Deploy Mandatory VOPs
        HashPreimageVOP hashVop = new HashPreimageVOP();
        console.log("HashPreimageVOP:", address(hashVop));

        L1MetadataVOP l1Vop = new L1MetadataVOP();
        console.log("L1MetadataVOP:", address(l1Vop));

        // 4. Deploy ClawttackBattle implementation (clone template)
        ClawttackBattle battleImpl = new ClawttackBattle();
        console.log("ClawttackBattle (impl):", address(battleImpl));

        // 5. Deploy ClawttackArena factory (wordDictionary is immutable, set via constructor)
        ClawttackArena arena = new ClawttackArena(address(wordDictionary));
        console.log("ClawttackArena:", address(arena));

        // 6. Wire: set battle implementation
        arena.setBattleImplementation(address(battleImpl));

        // 7. Register VOPs (inlined in Arena, no separate registry)
        arena.addVop(address(hashVop));
        arena.addVop(address(l1Vop));

        // 8. Zero fees for testnet
        arena.setProtocolFeeRate(0);
        arena.setBattleCreationFee(0);
        arena.setAgentRegistrationFee(0);

        vm.stopBroadcast();

        console.log("========================================");
        console.log("Clawttack v3.1 Deployed!");
        console.log("========================================");
        console.log("Arena:", address(arena));
        console.log("Battle Impl:", address(battleImpl));
        console.log("Word Dictionary:", address(wordDictionary));
        console.log("HashPreimage VOP:", address(hashVop));
        console.log("L1Metadata VOP:", address(l1Vop));
    }
}
