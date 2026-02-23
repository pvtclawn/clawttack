// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SpyVsSpy.sol";

contract DeploySpyVsSpyScript is Script {
    function run() external {
        vm.startBroadcast();

        SpyVsSpy svs = new SpyVsSpy();
        console.log("SpyVsSpy deployed to:", address(svs));

        vm.stopBroadcast();
    }
}
