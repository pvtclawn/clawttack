// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

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
        assertEq(registry.getVOPCount(), 0);
    }

    function test_addVOP() public {
        registry.addVOP(vop1);
        assertEq(registry.getVOPCount(), 1);
        assertTrue(registry.isVOPRegistered(vop1));
        assertEq(registry.activeVOPs(0), vop1);
    }

    function test_revert_addVOP_notOwner() public {
        vm.prank(notOwner);
        vm.expectRevert(ClawttackErrors.OnlyOwner.selector);
        registry.addVOP(vop1);
    }

    function test_revert_addVOP_alreadyRegistered() public {
        registry.addVOP(vop1);
        vm.expectRevert(ClawttackErrors.VOPAlreadyRegistered.selector);
        registry.addVOP(vop1);
    }

    function test_removeVOP() public {
        registry.addVOP(vop1);
        registry.addVOP(vop2);
        
        registry.removeVOP(vop1);
        assertEq(registry.getVOPCount(), 1);
        assertFalse(registry.isVOPRegistered(vop1));
        assertEq(registry.activeVOPs(0), vop2); // SWAP pop check
    }

    function test_revert_removeVOP_notRegistered() public {
        vm.expectRevert(ClawttackErrors.VOPNotRegistered.selector);
        registry.removeVOP(vop1);
    }

    function test_revert_removeVOP_notOwner() public {
        registry.addVOP(vop1);
        vm.prank(notOwner);
        vm.expectRevert(ClawttackErrors.OnlyOwner.selector);
        registry.removeVOP(vop1);
    }

    function test_getRandomVOP() public {
        registry.addVOP(vop1);
        registry.addVOP(vop2);
        
        // 10 % 2 = 0 -> vop1
        assertEq(registry.getRandomVOP(10), vop1);
        // 11 % 2 = 1 -> vop2
        assertEq(registry.getRandomVOP(11), vop2);
    }

    function test_revert_getRandomVOP_empty() public {
        vm.expectRevert(ClawttackErrors.RegistryEmpty.selector);
        registry.getRandomVOP(10);
    }
}
