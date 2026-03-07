// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "forge-std/Script.sol";
import "../src/ClawttackArena.sol";
import "../src/ClawttackBattleV4.sol";

/**
 * @title UpgradeBattleImpl
 * @notice Deploys a new ClawttackBattleV4 implementation and updates the Arena.
 *
 * Usage:
 *   forge script script/UpgradeBattleImpl.s.sol:UpgradeBattleImpl \
 *     --rpc-url https://sepolia.base.org \
 *     --account clawn --password $WALLET_PASSWORD \
 *     --broadcast
 */
contract UpgradeBattleImpl is Script {
    address constant ARENA = 0x6045d9b8Ab1583AD4cEb600c0E8d515E9922d2eB;

    function run() external {
        vm.startBroadcast();

        ClawttackBattleV4 newImpl = new ClawttackBattleV4();
        console.log("New ClawttackBattleV4 Implementation:", address(newImpl));

        ClawttackArena arena = ClawttackArena(payable(ARENA));
        arena.setBattleImplementationV4(address(newImpl));
        console.log("Arena updated. New battles will use the new V4 implementation.");

        vm.stopBroadcast();
    }
}
