// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "forge-std/Test.sol";
import "../src/VOPRegistry.sol";

contract VOPRegistryTest is Test {
    VOPRegistry registry;
    address vop1 = address(0x1);
    address vop2 = address(0x2);

    function setUp() public {
        registry = new VOPRegistry();
    }

    function test_initialState() public view {
        assertEq(registry.owner(), address(this));
        assertEq(registry.getVopCount(), 0);
    }

    function test_addVop() public {
        registry.addVop(vop1);
        assertEq(registry.getVopCount(), 1);
        assertTrue(registry.isVopRegistered(vop1));
        assertEq(registry.activeVOPs(0), vop1);
    }

    function test_revert_addVop_notOwner() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert();
        registry.addVop(vop1);
    }

    function test_revert_addVop_alreadyRegistered() public {
        registry.addVop(vop1);
        vm.expectRevert();
        registry.addVop(vop1);
    }

    function test_removeVop() public {
        registry.addVop(vop1);
        registry.addVop(vop2);

        registry.removeVop(vop1);
        assertEq(registry.getVopCount(), 1);
        assertFalse(registry.isVopRegistered(vop1));
    }

    function test_getRandomVop() public {
        registry.addVop(vop1);
        address vop = registry.getRandomVop(42);
        assertEq(vop, vop1);
    }

    function test_getRandomVop_multiple() public {
        registry.addVop(vop1);
        registry.addVop(vop2);
        // Both should be reachable
        address a = registry.getRandomVop(0); // 0 % 2 = 0
        address b = registry.getRandomVop(1); // 1 % 2 = 1
        assertTrue(a != b);
    }

    function test_revert_getRandomVop_empty() public {
        vm.expectRevert();
        registry.getRandomVop(42);
    }
}
