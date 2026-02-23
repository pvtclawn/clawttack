// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ClawttackRegistry.sol";
import "../src/InjectionCTF.sol";

contract DeployScript is Script {
    function run() external {
        // FEE_RECIPIENT env var allows explicit control over fee recipient.
        // In forge script, msg.sender/tx.origin don't match the broadcast signer.
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");

        vm.startBroadcast();

        // Deploy InjectionCTF scenario
        InjectionCTF ctf = new InjectionCTF();
        console.log("InjectionCTF deployed to:", address(ctf));

        // Deploy ClawttackRegistry with explicit fee recipient
        ClawttackRegistry registry = new ClawttackRegistry(feeRecipient);
        console.log("ClawttackRegistry deployed to:", address(registry));
        console.log("Fee recipient:", feeRecipient);

        vm.stopBroadcast();
    }
}
