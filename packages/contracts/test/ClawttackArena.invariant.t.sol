// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {ClawttackArena} from "../src/ClawttackArena.sol";
import {ClawttackTypes} from "../src/libraries/ClawttackTypes.sol";
import {VOPRegistry} from "../src/VOPRegistry.sol";
import {BIP39Words} from "../src/BIP39Words.sol";

contract ArenaHandler is Test {
    ClawttackArena public arena;
    
    address[3] public users = [address(0x111), address(0x222), address(0x333)];
    uint64[3] public agentIds = [1, 2, 3];
    
    uint256 public expectedBalance;
    
    constructor(ClawttackArena _arena) {
        arena = _arena;
        for(uint256 i = 0; i < 3; i++) {
            vm.deal(users[i], 1000 ether);
            vm.prank(users[i]);
            arena.registerAgent(agentIds[i], users[i]);
        }
    }

    function createBattle(uint256 actorIndex, uint256 stake) public {
        actorIndex = actorIndex % 3;
        stake = bound(stake, 0.01 ether, 10 ether);
        
        address user = users[actorIndex];
        uint256 agentId = agentIds[actorIndex];
        
        vm.prank(user);
        try arena.createBattle{value: stake}(agentId) returns (uint256) {
            expectedBalance += stake;
        } catch {
            // Expected revert (e.g. not enough ETH provided, though bounded above)
        }
    }

    function acceptBattle(uint256 actorIndex, uint256 battleId) public {
        actorIndex = actorIndex % 3;
        address user = users[actorIndex];
        uint256 agentId = agentIds[actorIndex];
        
        // Ensure valid battle ID
        if (battleId == 0 || battleId >= arena.nextBattleId()) return;
        
        ClawttackTypes.Battle memory b = arena.getBattle(battleId);
        if (uint8(b.state) != uint8(ClawttackTypes.BattleState.Open)) return;
        if (b.agentA == agentId) return; // Cant accept own battle
        
        uint256 stake = b.stakePerAgent;
        
        vm.prank(user);
        try arena.acceptBattle{value: stake}(battleId, agentId) {
            expectedBalance += stake;
        } catch {
            
        }
    }
    
    function cancelBattle(uint256 actorIndex, uint256 battleId) public {
        actorIndex = actorIndex % 3;
        address user = users[actorIndex];
        
        if (battleId == 0 || battleId >= arena.nextBattleId()) return;
        
        ClawttackTypes.Battle memory b = arena.getBattle(battleId);
        if (uint8(b.state) != uint8(ClawttackTypes.BattleState.Open)) return;
        if (b.ownerA != user) return;
        
        uint256 stake = b.stakePerAgent;
        
        vm.prank(user);
        try arena.cancelBattle(battleId) {
            expectedBalance -= stake;
        } catch {
        }
    }
}

contract ClawttackArenaInvariantTest is Test {
    ClawttackArena public arena;
    ArenaHandler public handler;
    VOPRegistry public registry;
    BIP39Words public dict;
    
    function setUp() public {
        registry = new VOPRegistry();
        
        // Mock BIP39 Data
        bytes memory packedData = abi.encodePacked(uint8(4), "blue", uint8(4), "dark", uint8(4), "fire", uint8(4), "gold");
        address dataLoc;
        assembly {
            let p := mload(0x40)
            mstore(p, add(mload(packedData), 32))
            let length := mload(packedData)
            for { let i := 0 } lt(i, length) { i := add(i, 32) } {
                mstore(add(add(p, 32), i), mload(add(add(packedData, 32), i)))
            }
            dataLoc := create(0, p, add(length, 32))
        }
        dict = new BIP39Words(dataLoc, 4);
        
        arena = new ClawttackArena(address(registry), address(dict));
        handler = new ArenaHandler(arena);
    }
    
    function invariant_BalanceMatchesExpected() public {
        assertEq(address(arena).balance, handler.expectedBalance(), "Invariant violated: ETH accounting mismatch");
    }
}
