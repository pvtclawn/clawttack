// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PrisonersDilemma.sol";

contract DeployPDScript is Script {
    function run() external {
        vm.startBroadcast();

        PrisonersDilemma pd = new PrisonersDilemma();
        console.log("PrisonersDilemma deployed to:", address(pd));

        vm.stopBroadcast();
    }
}
