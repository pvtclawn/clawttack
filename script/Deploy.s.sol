// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/ClawttackRegistry.sol";
import "../contracts/InjectionCTF.sol";

contract DeployScript is Script {
    function run() external {
        address deployer = msg.sender;

        vm.startBroadcast();

        // Deploy InjectionCTF scenario
        InjectionCTF ctf = new InjectionCTF();
        console.log("InjectionCTF deployed to:", address(ctf));

        // Deploy ClawttackRegistry with deployer as fee recipient
        ClawttackRegistry registry = new ClawttackRegistry(deployer);
        console.log("ClawttackRegistry deployed to:", address(registry));
        console.log("Fee recipient:", deployer);

        vm.stopBroadcast();
    }
}
