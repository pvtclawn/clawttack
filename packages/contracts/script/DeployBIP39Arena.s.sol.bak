// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/BIP39Words.sol";
import "../src/ClawttackArena.sol";

contract DeployBIP39Arena is Script {
    function run() external {
        vm.startBroadcast();

        // 1. Deploy packed BIP39 data contract (SSTORE2 pattern)
        bytes memory packedWords = vm.readFileBinary("script/bip39_packed.bin");
        
        // Build runtime code: STOP + data
        bytes memory runtimeData = abi.encodePacked(hex"00", packedWords);
        uint256 dataLen = runtimeData.length;

        // Init code that returns runtimeData as deployed bytecode
        bytes memory initCode = abi.encodePacked(
            hex"61",           // PUSH2
            uint16(dataLen),   // data length
            hex"80",           // DUP1
            hex"60",           // PUSH1
            uint8(12),         // init code size
            hex"60",           // PUSH1
            uint8(0),          // dest offset
            hex"39",           // CODECOPY
            hex"60",           // PUSH1
            uint8(0),          // offset
            hex"f3",           // RETURN
            runtimeData
        );

        address dataAddr;
        assembly {
            dataAddr := create(0, add(initCode, 32), mload(initCode))
        }
        require(dataAddr != address(0), "Data deploy failed");
        console.log("BIP39 Data Contract:", dataAddr);

        // 2. Deploy BIP39Words (lookup contract)
        BIP39Words bip39 = new BIP39Words(dataAddr, 2048);
        console.log("BIP39Words:", address(bip39));

        // Quick sanity check
        string memory w0 = bip39.word(0);
        string memory w2047 = bip39.word(2047);
        console.log("Word 0:", w0);      // should be "abandon"
        console.log("Word 2047:", w2047); // should be "zoo"

        // 3. Deploy new Arena with BIP39
        ClawttackArena arena = new ClawttackArena(address(bip39));
        console.log("ClawttackArena:", address(arena));

        vm.stopBroadcast();
    }
}
