// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "forge-std/Test.sol";
import "../src/ClawttackArena.sol";
import "../src/libraries/ClawttackErrors.sol";

/**
 * @notice Tests for the VOP management functions, now inlined into ClawttackArena.
 *         (VOPRegistry.sol deleted — logic is owned directly by the Arena.)
 */
contract ArenaVOPTest is Test {
    ClawttackArena arena;
    address owner = address(this);
    address notOwner = address(0x1);

    address vop1 = address(0x10);
    address vop2 = address(0x20);

    function setUp() public {
        arena = new ClawttackArena();
    }

    function test_initialState() public {
        assertEq(arena.owner(), owner);
        assertEq(arena.getVopCount(), 0);
    }

    function test_addVop() public {
        arena.addVop(vop1);
        assertEq(arena.getVopCount(), 1);
        assertTrue(arena.isVopRegistered(vop1));
        assertEq(arena.activeVOPs(0), vop1);
    }

    function test_revert_addVop_notOwner() public {
        vm.prank(notOwner);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", notOwner));
        arena.addVop(vop1);
    }

    function test_revert_addVop_alreadyRegistered() public {
        arena.addVop(vop1);
        vm.expectRevert(ClawttackErrors.VOPAlreadyRegistered.selector);
        arena.addVop(vop1);
    }

    function test_removeVop() public {
        arena.addVop(vop1);
        arena.addVop(vop2);

        arena.removeVop(vop1);
        assertEq(arena.getVopCount(), 1);
        assertFalse(arena.isVopRegistered(vop1));
        assertEq(arena.activeVOPs(0), vop2); // swap-pop: vop2 moved to index 0
    }

    function test_revert_removeVop_notRegistered() public {
        vm.expectRevert(ClawttackErrors.VOPNotRegistered.selector);
        arena.removeVop(vop1);
    }

    function test_revert_removeVop_notOwner() public {
        arena.addVop(vop1);
        vm.prank(notOwner);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", notOwner));
        arena.removeVop(vop1);
    }

    function test_getRandomVop() public {
        arena.addVop(vop1);
        arena.addVop(vop2);

        // 10 % 2 = 0 -> vop1
        assertEq(arena.getRandomVop(10), vop1);
        // 11 % 2 = 1 -> vop2
        assertEq(arena.getRandomVop(11), vop2);
    }

    function test_revert_getRandomVop_empty() public {
        vm.expectRevert(ClawttackErrors.RegistryEmpty.selector);
        arena.getRandomVop(10);
    }
}
