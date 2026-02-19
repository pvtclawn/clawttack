// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ClawttackArena.sol";

contract DeployArenaScript is Script {
    function run() external {
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");

        vm.startBroadcast();

        ClawttackArena arena = new ClawttackArena();
        arena.setFeeRecipient(feeRecipient);

        console.log("ClawttackArena deployed to:", address(arena));
        console.log("Owner:", arena.owner());
        console.log("Fee recipient:", feeRecipient);
        console.log("Protocol fee rate:", arena.protocolFeeRate(), "bps");

        vm.stopBroadcast();
    }
}
