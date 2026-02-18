// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ChallengeWordBattle.sol";

contract DeployCWBScript is Script {
    function run() external {
        vm.startBroadcast();

        ChallengeWordBattle cwb = new ChallengeWordBattle();
        console.log("ChallengeWordBattle deployed to:", address(cwb));

        vm.stopBroadcast();
    }
}
