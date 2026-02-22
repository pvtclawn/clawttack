// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "forge-std/Test.sol";
import "../src/VOPRegistry.sol";
import "../src/libraries/ClawttackErrors.sol";

contract VOPRegistryTest is Test {
    VOPRegistry registry;
    address owner = address(this);
    address notOwner = address(0x1);

    address vop1 = address(0x10);
    address vop2 = address(0x20);

    function setUp() public {
        registry = new VOPRegistry();
    }

    function test_initialState() public {
        assertEq(registry.owner(), owner);
        assertEq(registry.getVopCount(), 0);
    }

    function test_addVop() public {
        registry.addVop(vop1);
        assertEq(registry.getVopCount(), 1);
        assertTrue(registry.isVopRegistered(vop1));
        assertEq(registry.activeVOPs(0), vop1);
    }

    function test_revert_addVop_notOwner() public {
        vm.prank(notOwner);
        vm.expectRevert(ClawttackErrors.OnlyOwner.selector);
        registry.addVop(vop1);
    }

    function test_revert_addVop_alreadyRegistered() public {
        registry.addVop(vop1);
        vm.expectRevert(ClawttackErrors.VOPAlreadyRegistered.selector);
        registry.addVop(vop1);
    }

    function test_removeVop() public {
        registry.addVop(vop1);
        registry.addVop(vop2);

        registry.removeVop(vop1);
        assertEq(registry.getVopCount(), 1);
        assertFalse(registry.isVopRegistered(vop1));
        assertEq(registry.activeVOPs(0), vop2); // SWAP pop check
    }

    function test_revert_removeVop_notRegistered() public {
        vm.expectRevert(ClawttackErrors.VOPNotRegistered.selector);
        registry.removeVop(vop1);
    }

    function test_revert_removeVop_notOwner() public {
        registry.addVop(vop1);
        vm.prank(notOwner);
        vm.expectRevert(ClawttackErrors.OnlyOwner.selector);
        registry.removeVop(vop1);
    }

    function test_getRandomVop() public {
        registry.addVop(vop1);
        registry.addVop(vop2);

        // 10 % 2 = 0 -> vop1
        assertEq(registry.getRandomVop(10), vop1);
        // 11 % 2 = 1 -> vop2
        assertEq(registry.getRandomVop(11), vop2);
    }

    function test_revert_getRandomVop_empty() public {
        vm.expectRevert(ClawttackErrors.RegistryEmpty.selector);
        registry.getRandomVop(10);
    }
}
