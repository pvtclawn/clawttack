// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "forge-std/Script.sol";
import "../src/ClawttackArena.sol";
import "../src/ClawttackBattle.sol";

/**
 * @title UpgradeBattleImpl
 * @notice Deploys a new ClawttackBattle implementation and updates the Arena.
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

        // Deploy new Battle implementation with fixes:
        // - P0: Poison word boundary check
        // - P1: MIN_TIMEOUT_FLOOR = 10 blocks
        // - P1: rescueStuckFunds()
        ClawttackBattle newImpl = new ClawttackBattle();
        console.log("New Battle Implementation:", address(newImpl));

        // Update Arena to use new implementation
        ClawttackArena arena = ClawttackArena(payable(ARENA));
        arena.setBattleImplementation(address(newImpl));
        console.log("Arena updated. New battles will use the fixed implementation.");

        // Note: Existing battles are NOT affected (they use the old clone).
        // Only NEW battles created after this point will have the fixes.

        vm.stopBroadcast();
    }
}
