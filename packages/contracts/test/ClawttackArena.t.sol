// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ClawttackArena.sol";

contract ClawttackArenaTest is Test {
    ClawttackArena arena;

    address challenger = address(0x1001);
    address opponent = address(0x2002);
    address nobody = address(0x3003);
    address feeCollector = address(0xFEE1);

    string seedA = "crimson lighthouse";
    string seedB = "velvet thunder";
    bytes32 commitA;
    bytes32 commitB;
    bytes32 battleId = keccak256("test-battle-1");

    function setUp() public {
        arena = new ClawttackArena();
        arena.setFeeRecipient(feeCollector);
        commitA = keccak256(abi.encodePacked(seedA));
        commitB = keccak256(abi.encodePacked(seedB));

        vm.deal(challenger, 10 ether);
        vm.deal(opponent, 10 ether);
        vm.deal(nobody, 10 ether);
    }

    receive() external payable {}

    // --- Helpers to read battle struct fields ---

    function _phase(bytes32 id) internal view returns (ClawttackArena.BattlePhase) {
        (, , , ClawttackArena.BattlePhase p, , , ) = arena.getBattleCore(id);
        return p;
    }

    function _turn(bytes32 id) internal view returns (uint8) {
        (, , , , uint8 t, , ) = arena.getBattleCore(id);
        return t;
    }

    function _winner(bytes32 id) internal view returns (address) {
        (, , , , , , address w) = arena.getBattleCore(id);
        return w;
    }

    function _stake(bytes32 id) internal view returns (uint256) {
        (, , uint256 s, , , , ) = arena.getBattleCore(id);
        return s;
    }

    function _opponent(bytes32 id) internal view returns (address) {
        (, address o, , , , , ) = arena.getBattleCore(id);
        return o;
    }

    function _challenger(bytes32 id) internal view returns (address) {
        (address c, , , , , , ) = arena.getBattleCore(id);
        return c;
    }

    function _maxTurns(bytes32 id) internal view returns (uint8) {
        (, , , , , uint8 mt, ) = arena.getBattleCore(id);
        return mt;
    }

    /// @dev Uppercase helper (renamed to avoid forge-std collision)
    function _uppercase(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        for (uint i = 0; i < b.length; i++) {
            if (b[i] >= 0x61 && b[i] <= 0x7A) {
                b[i] = bytes1(uint8(b[i]) - 32);
            }
        }
        return string(b);
    }

    // --- Challenge Creation ---

    function test_createChallenge() public {
        vm.prank(challenger);
        arena.createChallenge{value: 0.1 ether}(battleId, commitA, 0, 0);

        assertEq(_challenger(battleId), challenger);
        assertEq(_opponent(battleId), address(0));
        assertEq(_stake(battleId), 0.1 ether);
        assertEq(uint8(_phase(battleId)), uint8(ClawttackArena.BattlePhase.Open));
    }

    function test_createChallenge_freeStake() public {
        vm.prank(challenger);
        arena.createChallenge(battleId, commitA, 10, 60);

        assertEq(_stake(battleId), 0);
        assertEq(_maxTurns(battleId), 10);
    }

    function test_revert_duplicateBattle() public {
        vm.prank(challenger);
        arena.createChallenge(battleId, commitA, 0, 0);

        vm.prank(opponent);
        vm.expectRevert(ClawttackArena.BattleExists.selector);
        arena.createChallenge(battleId, commitB, 0, 0);
    }

    // --- Challenge Acceptance ---

    function test_acceptChallenge() public {
        vm.prank(challenger);
        arena.createChallenge{value: 0.1 ether}(battleId, commitA, 0, 0);

        vm.prank(opponent);
        arena.acceptChallenge{value: 0.1 ether}(battleId, commitB);

        assertEq(_opponent(battleId), opponent);
        assertEq(uint8(_phase(battleId)), uint8(ClawttackArena.BattlePhase.Committed));
    }

    function test_revert_acceptInsufficientStake() public {
        vm.prank(challenger);
        arena.createChallenge{value: 0.1 ether}(battleId, commitA, 0, 0);

        vm.prank(opponent);
        vm.expectRevert(ClawttackArena.InsufficientStake.selector);
        arena.acceptChallenge{value: 0.05 ether}(battleId, commitB);
    }

    function test_revert_acceptOwnChallenge() public {
        vm.prank(challenger);
        arena.createChallenge{value: 0.1 ether}(battleId, commitA, 0, 0);

        vm.prank(challenger);
        vm.expectRevert(ClawttackArena.NotParticipant.selector);
        arena.acceptChallenge{value: 0.1 ether}(battleId, commitB);
    }

    function test_acceptExcessRefund() public {
        vm.prank(challenger);
        arena.createChallenge{value: 0.1 ether}(battleId, commitA, 0, 0);

        uint256 balBefore = opponent.balance;
        vm.prank(opponent);
        arena.acceptChallenge{value: 0.5 ether}(battleId, commitB);
        uint256 balAfter = opponent.balance;

        assertEq(balBefore - balAfter, 0.1 ether);
    }

    // --- Seed Reveal ---

    function test_revealSeeds() public {
        _setupCommitted();

        vm.prank(challenger);
        arena.revealSeeds(battleId, seedA, seedB);

        assertEq(uint8(_phase(battleId)), uint8(ClawttackArena.BattlePhase.Active));
        assertEq(_turn(battleId), 1);
    }

    function test_revert_revealWrongSeed() public {
        _setupCommitted();

        vm.prank(challenger);
        vm.expectRevert(ClawttackArena.InvalidSeed.selector);
        arena.revealSeeds(battleId, "wrong seed", seedB);
    }

    // --- Turn Submission ---

    function test_submitTurn_withWord() public {
        _setupActive();

        string memory word = arena.getChallengeWord(battleId, 1);

        vm.prank(challenger);
        arena.submitTurn(battleId, string.concat("I say ", word, " here"));

        assertEq(uint8(_phase(battleId)), uint8(ClawttackArena.BattlePhase.Active));
        assertEq(_turn(battleId), 2);
    }

    function test_submitTurn_missedWord_loses() public {
        _setupActive();

        vm.prank(challenger);
        arena.submitTurn(battleId, "I forgot the required word");

        assertEq(uint8(_phase(battleId)), uint8(ClawttackArena.BattlePhase.Settled));
        assertEq(_winner(battleId), opponent);
    }

    function test_revert_notYourTurn() public {
        _setupActive();

        vm.prank(opponent);
        vm.expectRevert(ClawttackArena.NotYourTurn.selector);
        arena.submitTurn(battleId, "nope");
    }

    function test_revert_deadlineExpired() public {
        _setupActive();

        vm.warp(block.timestamp + 200);

        vm.prank(challenger);
        vm.expectRevert(ClawttackArena.DeadlineExpired.selector);
        arena.submitTurn(battleId, "too late");
    }

    function test_fullBattle_maxTurns_draw() public {
        _setupActive();

        for (uint8 i = 1; i <= 20; i++) {
            string memory word = arena.getChallengeWord(battleId, i);
            address agent = (i % 2 == 1) ? challenger : opponent;

            vm.prank(agent);
            arena.submitTurn(battleId, string.concat("t ", word));
        }

        assertEq(uint8(_phase(battleId)), uint8(ClawttackArena.BattlePhase.Settled));
        assertEq(_winner(battleId), address(0)); // draw
    }

    function test_fullBattle_payout() public {
        _setupActive();

        uint256 opBalBefore = opponent.balance;
        uint256 feeBalBefore = feeCollector.balance;

        vm.prank(challenger);
        arena.submitTurn(battleId, "no word here");

        uint256 opBalAfter = opponent.balance;
        uint256 feeBalAfter = feeCollector.balance;

        // Total pool = 0.2 ETH, fee = 5% = 0.01, payout = 0.19
        assertEq(opBalAfter - opBalBefore, 0.19 ether);
        assertEq(feeBalAfter - feeBalBefore, 0.01 ether);
    }

    // --- Timeout ---

    function test_claimTimeout() public {
        _setupActive();

        vm.warp(block.timestamp + 200);

        vm.prank(opponent);
        arena.claimTimeout(battleId);

        assertEq(uint8(_phase(battleId)), uint8(ClawttackArena.BattlePhase.Settled));
        assertEq(_winner(battleId), opponent);
    }

    function test_revert_claimTimeoutTooEarly() public {
        _setupActive();

        vm.prank(opponent);
        vm.expectRevert(ClawttackArena.DeadlineNotExpired.selector);
        arena.claimTimeout(battleId);
    }

    // --- Challenge Cancellation ---

    function test_cancelChallenge() public {
        vm.prank(challenger);
        arena.createChallenge{value: 0.1 ether}(battleId, commitA, 0, 0);

        uint256 balBefore = challenger.balance;
        vm.prank(challenger);
        arena.cancelChallenge(battleId);

        assertEq(challenger.balance - balBefore, 0.1 ether);
        assertEq(uint8(_phase(battleId)), uint8(ClawttackArena.BattlePhase.Cancelled));
    }

    function test_reclaimExpired() public {
        vm.prank(challenger);
        arena.createChallenge{value: 0.1 ether}(battleId, commitA, 0, 0);

        vm.warp(block.timestamp + 2 hours);

        uint256 balBefore = challenger.balance;
        vm.prank(nobody);
        arena.reclaimExpired(battleId);

        assertEq(challenger.balance - balBefore, 0.1 ether);
    }

    // --- Decreasing Timer ---

    function test_decreasingTimer() public view {
        assertEq(arena.getTurnTimeout(120, 1), 120);
        assertEq(arena.getTurnTimeout(120, 2), 60);
        assertEq(arena.getTurnTimeout(120, 3), 30);
        assertEq(arena.getTurnTimeout(120, 4), 15);
        assertEq(arena.getTurnTimeout(120, 5), 7);
        assertEq(arena.getTurnTimeout(120, 6), 5); // clamped to MIN_TIMEOUT
        assertEq(arena.getTurnTimeout(120, 10), 5);
    }

    // --- Challenge Word ---

    function test_challengeWordDeterministic() public {
        _setupActive();

        string memory word1a = arena.getChallengeWord(battleId, 1);
        string memory word1b = arena.getChallengeWord(battleId, 1);
        assertEq(keccak256(bytes(word1a)), keccak256(bytes(word1b)));

        string memory word2 = arena.getChallengeWord(battleId, 2);
        assertTrue(bytes(word1a).length > 0);
        assertTrue(bytes(word2).length > 0);
    }

    function test_containsWordCaseInsensitive() public {
        _setupActive();

        string memory word = arena.getChallengeWord(battleId, 1);

        vm.prank(challenger);
        arena.submitTurn(battleId, string.concat("MY RESPONSE ", _uppercase(word), " OK"));

        assertEq(uint8(_phase(battleId)), uint8(ClawttackArena.BattlePhase.Active));
        assertEq(_turn(battleId), 2);
    }

    // --- Elo ---

    function test_eloUpdatedOnWin() public {
        _setupActive();

        vm.prank(challenger);
        arena.submitTurn(battleId, "no word");

        (uint32 eloA, , uint32 lossesA, ) = arena.agents(challenger);
        (uint32 eloB, uint32 winsB, , ) = arena.agents(opponent);

        assertEq(lossesA, 1);
        assertEq(winsB, 1);
        assertTrue(eloB > 1200);
        assertTrue(eloA < 1200);
    }

    function test_eloUpdatedOnDraw() public {
        _setupActiveCustom(2);

        string memory word1 = arena.getChallengeWord(battleId, 1);
        vm.prank(challenger);
        arena.submitTurn(battleId, string.concat("w ", word1));

        string memory word2 = arena.getChallengeWord(battleId, 2);
        vm.prank(opponent);
        arena.submitTurn(battleId, string.concat("w ", word2));

        (, , , uint32 drawsA) = arena.agents(challenger);
        (, , , uint32 drawsB) = arena.agents(opponent);
        assertEq(drawsA, 1);
        assertEq(drawsB, 1);
    }

    // --- View Functions ---

    function test_whoseTurn() public {
        _setupActive();
        assertEq(arena.whoseTurn(battleId), challenger);

        string memory word = arena.getChallengeWord(battleId, 1);
        vm.prank(challenger);
        arena.submitTurn(battleId, string.concat("w ", word));

        assertEq(arena.whoseTurn(battleId), opponent);
    }

    function test_timeRemaining() public {
        _setupActive();
        uint64 remaining = arena.timeRemaining(battleId);
        assertTrue(remaining > 0 && remaining <= 120);
    }

    // --- Admin ---

    function test_setProtocolFeeRate() public {
        arena.setProtocolFeeRate(300);
        assertEq(arena.protocolFeeRate(), 300);
    }

    function test_revert_feeRateTooHigh() public {
        vm.expectRevert("Max 10%");
        arena.setProtocolFeeRate(1500);
    }

    // --- Setup Helpers ---

    function _setupCommitted() internal {
        vm.prank(challenger);
        arena.createChallenge{value: 0.1 ether}(battleId, commitA, 0, 0);
        vm.prank(opponent);
        arena.acceptChallenge{value: 0.1 ether}(battleId, commitB);
    }

    function _setupActive() internal {
        _setupCommitted();
        vm.prank(challenger);
        arena.revealSeeds(battleId, seedA, seedB);
    }

    function _setupActiveCustom(uint8 maxTurns) internal {
        vm.prank(challenger);
        arena.createChallenge{value: 0.1 ether}(battleId, commitA, maxTurns, 0);
        vm.prank(opponent);
        arena.acceptChallenge{value: 0.1 ether}(battleId, commitB);
        vm.prank(challenger);
        arena.revealSeeds(battleId, seedA, seedB);
    }
}
