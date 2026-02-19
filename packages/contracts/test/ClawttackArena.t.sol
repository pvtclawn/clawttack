// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ClawttackArena.sol";
import "../src/BIP39Words.sol";

/// @dev Deploy packed word data as contract bytecode (SSTORE2)
contract WordDataDeployer {
    function deploy(bytes memory data) external returns (address addr) {
        bytes memory runtimeData = abi.encodePacked(hex"00", data);
        uint256 dataLen = runtimeData.length;
        bytes memory initCode = abi.encodePacked(
            hex"61", uint16(dataLen), hex"80", hex"60", uint8(12), hex"60", uint8(0), hex"39", hex"60", uint8(0), hex"f3",
            runtimeData
        );
        assembly {
            addr := create(0, add(initCode, 32), mload(initCode))
        }
    }
}

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
    bytes32 battleId; // set dynamically now

    function setUp() public {
        // Deploy BIP39 wordlist (64 test words)
        WordDataDeployer deployer = new WordDataDeployer();
        bytes memory packed = _packTestWords();
        address dataAddr = deployer.deploy(packed);
        BIP39Words bip39 = new BIP39Words(dataAddr, 64);

        arena = new ClawttackArena(address(bip39));
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
        bytes32 id = arena.createChallenge{value: 0.1 ether}(commitA, 0, 0);

        assertEq(_challenger(id), challenger);
        assertEq(_opponent(id), address(0));
        assertEq(_stake(id), 0.1 ether);
        assertEq(uint8(_phase(id)), uint8(ClawttackArena.BattlePhase.Open));
    }

    function test_createChallenge_returnsDeterministicId() public {
        // battleId = keccak256(sender, commitA, nonce=0)
        bytes32 expected = keccak256(abi.encodePacked(challenger, commitA, uint256(0)));
        vm.prank(challenger);
        bytes32 id = arena.createChallenge{value: 0.1 ether}(commitA, 0, 0);
        assertEq(id, expected);
    }

    function test_createChallenge_freeStake() public {
        vm.prank(challenger);
        bytes32 id = arena.createChallenge(commitA, 10, 60);

        assertEq(_stake(id), 0);
        assertEq(_maxTurns(id), 10);
    }

    function test_createChallenge_uniqueIds() public {
        // Same sender + same commit → different IDs (nonce increments)
        vm.prank(challenger);
        bytes32 id1 = arena.createChallenge(commitA, 0, 0);
        vm.prank(challenger);
        bytes32 id2 = arena.createChallenge(commitA, 0, 0);
        assertTrue(id1 != id2);
    }

    // --- Challenge Acceptance ---

    function test_acceptChallenge() public {
        _setupCommitted();

        assertEq(_opponent(battleId), opponent);
        assertEq(uint8(_phase(battleId)), uint8(ClawttackArena.BattlePhase.Committed));
    }

    function test_revert_acceptInsufficientStake() public {
        vm.prank(challenger);
        battleId = arena.createChallenge{value: 0.1 ether}(commitA, 0, 0);

        vm.prank(opponent);
        vm.expectRevert(ClawttackArena.InsufficientStake.selector);
        arena.acceptChallenge{value: 0.05 ether}(battleId, commitB);
    }

    function test_revert_acceptOwnChallenge() public {
        vm.prank(challenger);
        battleId = arena.createChallenge{value: 0.1 ether}(commitA, 0, 0);

        vm.prank(challenger);
        vm.expectRevert(ClawttackArena.NotParticipant.selector);
        arena.acceptChallenge{value: 0.1 ether}(battleId, commitB);
    }

    function test_acceptExcessRefund() public {
        vm.prank(challenger);
        battleId = arena.createChallenge{value: 0.1 ether}(commitA, 0, 0);

        uint256 balBefore = opponent.balance;
        vm.prank(opponent);
        arena.acceptChallenge{value: 0.5 ether}(battleId, commitB);

        assertEq(balBefore - opponent.balance, 0.1 ether);
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

    function test_revert_revealByNonParticipant() public {
        _setupCommitted();

        vm.prank(nobody);
        vm.expectRevert(ClawttackArena.NotParticipant.selector);
        arena.revealSeeds(battleId, seedA, seedB);
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
        assertEq(_winner(battleId), address(0));
    }

    function test_fullBattle_payout() public {
        _setupActive();

        uint256 opBalBefore = opponent.balance;
        uint256 feeBalBefore = feeCollector.balance;

        vm.prank(challenger);
        arena.submitTurn(battleId, "no word here");

        assertEq(opponent.balance - opBalBefore, 0.19 ether);
        assertEq(feeCollector.balance - feeBalBefore, 0.01 ether);
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
        battleId = arena.createChallenge{value: 0.1 ether}(commitA, 0, 0);

        uint256 balBefore = challenger.balance;
        vm.prank(challenger);
        arena.cancelChallenge(battleId);

        assertEq(challenger.balance - balBefore, 0.1 ether);
        assertEq(uint8(_phase(battleId)), uint8(ClawttackArena.BattlePhase.Cancelled));
    }

    function test_reclaimExpired() public {
        vm.prank(challenger);
        battleId = arena.createChallenge{value: 0.1 ether}(commitA, 0, 0);

        vm.warp(block.timestamp + 2 hours);

        uint256 balBefore = challenger.balance;
        vm.prank(nobody);
        arena.reclaimExpired(battleId);

        assertEq(challenger.balance - balBefore, 0.1 ether);
    }

    // --- NEW: Reclaim Committed (Fix #6 from red-team) ---

    function test_reclaimCommitted() public {
        _setupCommitted();

        // Warp past the committed deadline
        vm.warp(block.timestamp + 2 hours);

        uint256 chBalBefore = challenger.balance;
        uint256 opBalBefore = opponent.balance;

        vm.prank(nobody); // anyone can call
        arena.reclaimCommitted(battleId);

        // Both get their stake back
        assertEq(challenger.balance - chBalBefore, 0.1 ether);
        assertEq(opponent.balance - opBalBefore, 0.1 ether);
        assertEq(uint8(_phase(battleId)), uint8(ClawttackArena.BattlePhase.Cancelled));
    }

    function test_revert_reclaimCommittedTooEarly() public {
        _setupCommitted();

        vm.prank(nobody);
        vm.expectRevert(ClawttackArena.ChallengeNotExpired.selector);
        arena.reclaimCommitted(battleId);
    }

    function test_revert_reclaimCommittedWrongPhase() public {
        _setupActive(); // Active phase, not Committed

        vm.warp(block.timestamp + 2 hours);

        vm.prank(nobody);
        vm.expectRevert(abi.encodeWithSelector(
            ClawttackArena.InvalidPhase.selector,
            ClawttackArena.BattlePhase.Committed,
            ClawttackArena.BattlePhase.Active
        ));
        arena.reclaimCommitted(battleId);
    }

    // --- Decreasing Timer ---

    function test_decreasingTimer() public view {
        assertEq(arena.getTurnTimeout(120, 1), 120);
        assertEq(arena.getTurnTimeout(120, 2), 60);
        assertEq(arena.getTurnTimeout(120, 3), 30);
        assertEq(arena.getTurnTimeout(120, 4), 15);
        assertEq(arena.getTurnTimeout(120, 5), 7);
        assertEq(arena.getTurnTimeout(120, 6), 5);
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

    function test_wordBoundary_wholeWord() public {
        _setupActive();

        string memory word = arena.getChallengeWord(battleId, 1);

        // Whole word with spaces should match
        vm.prank(challenger);
        arena.submitTurn(battleId, string.concat("I like ", word, " very much"));

        assertEq(uint8(_phase(battleId)), uint8(ClawttackArena.BattlePhase.Active));
        assertEq(_turn(battleId), 2);
    }

    function test_wordBoundary_startOfString() public {
        _setupActive();

        string memory word = arena.getChallengeWord(battleId, 1);

        // Word at start of message
        vm.prank(challenger);
        arena.submitTurn(battleId, string.concat(word, " is great"));

        assertEq(uint8(_phase(battleId)), uint8(ClawttackArena.BattlePhase.Active));
        assertEq(_turn(battleId), 2);
    }

    function test_wordBoundary_endOfString() public {
        _setupActive();

        string memory word = arena.getChallengeWord(battleId, 1);

        // Word at end of message
        vm.prank(challenger);
        arena.submitTurn(battleId, string.concat("I said ", word));

        assertEq(uint8(_phase(battleId)), uint8(ClawttackArena.BattlePhase.Active));
        assertEq(_turn(battleId), 2);
    }

    function test_wordBoundary_withPunctuation() public {
        _setupActive();

        string memory word = arena.getChallengeWord(battleId, 1);

        // Word followed by punctuation should match
        vm.prank(challenger);
        arena.submitTurn(battleId, string.concat("Yes, ", word, "! That works."));

        assertEq(uint8(_phase(battleId)), uint8(ClawttackArena.BattlePhase.Active));
        assertEq(_turn(battleId), 2);
    }

    function test_wordBoundary_substringRejects() public {
        _setupActive();

        string memory word = arena.getChallengeWord(battleId, 1);

        // Word embedded inside a longer word should NOT match (word boundary violation)
        // Prepend and append letters to make it a substring
        vm.prank(challenger);
        arena.submitTurn(battleId, string.concat("prefix", word, "suffix is here"));

        // Should be settled as missed_word (loss for challenger)
        assertEq(uint8(_phase(battleId)), uint8(ClawttackArena.BattlePhase.Settled));
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

    function test_transferOwnership() public {
        arena.transferOwnership(challenger);
        assertEq(arena.owner(), challenger);
    }

    function test_zeroStake_noEloUpdate() public {
        // Create and complete a 0-stake battle — Elo should NOT change
        vm.prank(challenger);
        bytes32 freeBattle = arena.createChallenge{value: 0}(commitA, 0, 0);
        vm.prank(opponent);
        arena.acceptChallenge{value: 0}(freeBattle, commitB);
        vm.prank(challenger);
        arena.revealSeeds(freeBattle, seedA, seedB);

        // Get initial Elo
        (uint32 eloA,,,) = arena.agents(challenger);
        (uint32 eloB,,,) = arena.agents(opponent);

        // Challenger submits turn with the word
        string memory word = arena.getChallengeWord(freeBattle, 1);
        vm.prank(challenger);
        arena.submitTurn(freeBattle, string.concat("my message with ", word));

        // Opponent misses on purpose
        vm.prank(opponent);
        arena.submitTurn(freeBattle, "no word here");

        // Elo should be unchanged (0-stake = unrated)
        (uint32 eloA2,,,) = arena.agents(challenger);
        (uint32 eloB2,,,) = arena.agents(opponent);
        assertEq(eloA2, eloA, "Elo should not change for 0-stake");
        assertEq(eloB2, eloB, "Elo should not change for 0-stake");
    }

    function test_safeTransfer_to_contract() public {
        // Verify settlement works (tests _safeTransfer implicitly)
        _setupActive();
        string memory word = arena.getChallengeWord(battleId, 1);
        vm.prank(challenger);
        arena.submitTurn(battleId, string.concat("message with ", word));

        // Opponent misses
        vm.prank(opponent);
        arena.submitTurn(battleId, "no word here oops");

        // Battle settled, winner got paid
        (,,, ClawttackArena.BattlePhase phase,,,address winner) = arena.getBattleCore(battleId);
        assertEq(uint8(phase), uint8(ClawttackArena.BattlePhase.Settled));
        assertEq(winner, challenger);
    }

    // --- Setup Helpers ---

    function _setupCommitted() internal {
        vm.prank(challenger);
        battleId = arena.createChallenge{value: 0.1 ether}(commitA, 0, 0);
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
        battleId = arena.createChallenge{value: 0.1 ether}(commitA, maxTurns, 0);
        vm.prank(opponent);
        arena.acceptChallenge{value: 0.1 ether}(battleId, commitB);
        vm.prank(challenger);
        arena.revealSeeds(battleId, seedA, seedB);
    }

    /// @dev Pack 64 test words in length-prefixed format
    function _packTestWords() internal pure returns (bytes memory) {
        bytes memory result;
        string[64] memory words = [
            "blue", "dark", "fire", "gold", "iron", "jade", "keen", "lime",
            "mint", "navy", "onyx", "pine", "ruby", "sage", "teal", "vine",
            "arch", "bolt", "core", "dawn", "echo", "flux", "glow", "haze",
            "iris", "jolt", "knot", "loom", "mist", "node", "oath", "peak",
            "rift", "silk", "tide", "unit", "vale", "warp", "zero", "apex",
            "band", "cape", "dome", "edge", "fern", "grit", "husk", "isle",
            "jazz", "kite", "lark", "maze", "nest", "opus", "palm", "quay",
            "reed", "spur", "torn", "urge", "veil", "wolf", "yarn", "zest"
        ];
        for (uint i = 0; i < 64; i++) {
            bytes memory w = bytes(words[i]);
            result = abi.encodePacked(result, uint8(w.length), w);
        }
        return result;
    }
}
