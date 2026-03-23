// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {ClawttackArena} from "../src/ClawttackArena.sol";
import {ClawttackBattle} from "../src/ClawttackBattle.sol";
import {ClawttackTypes} from "../src/libraries/ClawttackTypes.sol";
import {ClawttackErrors} from "../src/libraries/ClawttackErrors.sol";
import {HashPreimageVOP} from "../src/vops/HashPreimageVOP.sol";
import {IWordDictionary} from "../src/interfaces/IWordDictionary.sol";
import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";

/// @notice Minimal word dictionary for tests
contract CTFWordDict is IWordDictionary {
    string[] private w;
    constructor() {
        w.push("abandon"); w.push("ability"); w.push("able"); w.push("about");
        w.push("above"); w.push("absent"); w.push("absorb"); w.push("abstract");
        w.push("absurd"); w.push("abuse"); w.push("access"); w.push("accident");
        w.push("account"); w.push("accuse"); w.push("achieve"); w.push("acid");
        w.push("acoustic"); w.push("acquire"); w.push("across"); w.push("act");
    }
    function word(uint16 i) external view override returns (string memory) { return w[i]; }
    function wordCount() external view override returns (uint16) { return uint16(w.length); }
}

/**
 * @title CaptureFlagTest
 * @notice Tests both captureFlag() overloads:
 *   - captureFlag()            → self-call trap (caller loses)
 *   - captureFlag(bytes sig)   → ECDSA compromise (opponent loses)
 */
contract CaptureFlagTest is Test {
    ClawttackArena arena;
    ClawttackBattle battleImpl;
    CTFWordDict wordDict;
    HashPreimageVOP hashVop;

    uint256 aliceKey = 0xA11CE;
    uint256 bobKey = 0xB0B;
    address alice;
    address bob;

    function setUp() public {
        alice = vm.addr(aliceKey);
        bob = vm.addr(bobKey);

        wordDict = new CTFWordDict();
        hashVop = new HashPreimageVOP();
        battleImpl = new ClawttackBattle();

        arena = new ClawttackArena(address(wordDict));
        arena.setBattleImplementation(address(battleImpl));
        arena.addVop(address(hashVop));
        arena.setProtocolFeeRate(0);
        arena.setBattleCreationFee(0);
        arena.setAgentRegistrationFee(0);

        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    /// @dev Helper: register both agents, create and accept a battle, return the battle contract
    function _setupActiveBattle() internal returns (ClawttackBattle battle, uint256 aliceId, uint256 bobId) {
        vm.prank(alice);
        aliceId = arena.registerAgent();

        vm.prank(bob);
        bobId = arena.registerAgent();

        ClawttackTypes.BattleConfig memory config = ClawttackTypes.BattleConfig({
            stake: 0.01 ether,
            targetAgentId: 0,
            inviteHash: bytes32(0)
        });

        vm.prank(alice);
        address battleAddr = arena.createBattle{value: 0.01 ether}(aliceId, config);

        vm.prank(bob);
        battle = ClawttackBattle(payable(battleAddr));
        battle.acceptBattle{value: 0.01 ether}(bobId, bytes32(0));

        // Skip warmup
        vm.roll(block.number + 20);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Self-Call Trap: captureFlag()
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice When Alice calls captureFlag(), she LOSES (Bob wins)
    function test_selfCallTrap_callerLoses() public {
        (ClawttackBattle battle,,) = _setupActiveBattle();

        // Alice is tricked into calling captureFlag()
        vm.prank(alice);
        battle.captureFlag();

        // Alice lost — battle is settled
        (ClawttackBattle.BattlePhase phase,,,,,) = battle.getBattleState();
        assertEq(uint8(phase), 2, "Battle should be Settled");
    }

    /// @notice When Bob calls captureFlag(), he LOSES (Alice wins)
    function test_selfCallTrap_bobCallerLoses() public {
        (ClawttackBattle battle,,) = _setupActiveBattle();

        // Bob is tricked into calling captureFlag()
        vm.prank(bob);
        battle.captureFlag();

        (ClawttackBattle.BattlePhase phase,,,,,) = battle.getBattleState();
        assertEq(uint8(phase), 2, "Battle should be Settled");
    }

    /// @notice Non-participant cannot call captureFlag()
    function test_selfCallTrap_nonParticipantReverts() public {
        (ClawttackBattle battle,,) = _setupActiveBattle();

        address charlie = makeAddr("charlie");
        vm.prank(charlie);
        vm.expectRevert(ClawttackErrors.NotParticipant.selector);
        battle.captureFlag();
    }

    /// @notice captureFlag() reverts if battle is not active
    function test_selfCallTrap_notActiveReverts() public {
        // Create but don't accept — battle is still Open
        vm.prank(alice);
        uint256 aliceId = arena.registerAgent();

        ClawttackTypes.BattleConfig memory config = ClawttackTypes.BattleConfig({ stake: 0, targetAgentId: 0, inviteHash: bytes32(0)});

        vm.prank(alice);
        address battleAddr = arena.createBattle(aliceId, config);
        ClawttackBattle battle = ClawttackBattle(payable(battleAddr));

        vm.prank(alice);
        vm.expectRevert(ClawttackErrors.BattleNotActive.selector);
        battle.captureFlag();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ECDSA Compromise: captureFlag(bytes signature)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Alice submits Bob's signature → Alice wins
    function test_ecdsaCompromise_validSignature() public {
        (ClawttackBattle battle,,) = _setupActiveBattle();
        uint256 battleId = battle.battleId();

        // Alice somehow obtained Bob's private key and signs the compromise message
        bytes32 messageHash = keccak256(abi.encode(block.chainid, address(battle), battleId, "COMPROMISE"));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(bobKey, ethSignedMessageHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        // Alice submits Bob's signature
        vm.prank(alice);
        battle.captureFlag(sig);

        // Alice wins
        (ClawttackBattle.BattlePhase phase,,,,,) = battle.getBattleState();
        assertEq(uint8(phase), 2, "Battle should be Settled");
    }

    /// @notice Bob submits Alice's signature → Bob wins
    function test_ecdsaCompromise_bobSubmitsAliceSig() public {
        (ClawttackBattle battle,,) = _setupActiveBattle();
        uint256 battleId = battle.battleId();

        // Bob obtained Alice's signing ability
        bytes32 messageHash = keccak256(abi.encode(block.chainid, address(battle), battleId, "COMPROMISE"));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(aliceKey, ethSignedMessageHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(bob);
        battle.captureFlag(sig);

        (ClawttackBattle.BattlePhase phase,,,,,) = battle.getBattleState();
        assertEq(uint8(phase), 2, "Battle should be Settled");
    }

    /// @notice Submitting your OWN signature reverts (can't compromise yourself)
    function test_ecdsaCompromise_ownSignatureReverts() public {
        (ClawttackBattle battle,,) = _setupActiveBattle();
        uint256 battleId = battle.battleId();

        // Alice signs with her OWN key
        bytes32 messageHash = keccak256(abi.encode(block.chainid, address(battle), battleId, "COMPROMISE"));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(aliceKey, ethSignedMessageHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        // Alice submits her OWN signature — recovered address == alice, not bob
        vm.prank(alice);
        vm.expectRevert(ClawttackErrors.InvalidCompromiseSignature.selector);
        battle.captureFlag(sig);
    }

    /// @notice Random signature from non-participant reverts
    function test_ecdsaCompromise_randomSignatureReverts() public {
        (ClawttackBattle battle,,) = _setupActiveBattle();
        uint256 battleId = battle.battleId();

        // Some random key
        uint256 charlieKey = 0xC0FFEE;
        bytes32 messageHash = keccak256(abi.encode(block.chainid, address(battle), battleId, "COMPROMISE"));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(charlieKey, ethSignedMessageHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(alice);
        vm.expectRevert(ClawttackErrors.InvalidCompromiseSignature.selector);
        battle.captureFlag(sig);
    }

    /// @notice Non-participant cannot submit captureFlag(sig)
    function test_ecdsaCompromise_nonParticipantReverts() public {
        (ClawttackBattle battle,,) = _setupActiveBattle();
        uint256 battleId = battle.battleId();

        bytes32 messageHash = keccak256(abi.encode(block.chainid, address(battle), battleId, "COMPROMISE"));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(bobKey, ethSignedMessageHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        address charlie = makeAddr("charlie");
        vm.prank(charlie);
        vm.expectRevert(ClawttackErrors.NotParticipant.selector);
        battle.captureFlag(sig);
    }
}
