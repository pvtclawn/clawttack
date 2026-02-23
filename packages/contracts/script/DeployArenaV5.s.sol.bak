// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ClawttackArena.sol";

contract DeployArenaV5 is Script {
    function run() external {
        // Reuse existing BIP39Words contract
        address bip39 = 0xD5C760aa0e8af1036D7f85e093d5a84A62e0b461;
        
        vm.startBroadcast();
        ClawttackArena arena = new ClawttackArena(bip39);
        vm.stopBroadcast();
        
        console.log("Arena v5:", address(arena));
    }
}
