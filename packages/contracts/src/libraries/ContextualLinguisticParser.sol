// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/**
 * @title ContextualLinguisticParser
 * @notice Single-pass multi-constraint narrative validator.
 * @dev Checks target word, poison word, mandatory opponent quote, derived letter constraint,
 *      and ASCII/length — all in one O(n) loop over the narrative.
 *
 * Constraint stack (all verified in one pass):
 *   1. Target word inclusion (whole-word boundary match)
 *   2. Poison word exclusion (substring match)
 *   3. Mandatory quote from opponent's previous narrative (substring, not at edges)
 *   4. Positional letter constraint: char at position P must equal a derived letter
 *   5. ASCII-only, length 64–256
 *
 * Gas target: ≤150K for 256-char narrative with all constraints active.
 */
library ContextualLinguisticParser {

    uint256 internal constant MIN_NARRATIVE_LEN = 64;
    uint256 internal constant MAX_NARRATIVE_LEN = 256;
    uint8   internal constant MAX_ASCII = 127;
    uint8   internal constant CASE_OFFSET = 32;

    // Minimum chars from each edge where the quote must NOT start/end.
    // Forces the quote to be embedded mid-narrative, not trivially prepended/appended.
    uint256 internal constant QUOTE_EDGE_MARGIN = 8;

    // ─── Errors ──────────────────────────────────────────────────────────────

    error NarrativeTooShort();
    error NarrativeTooLong();
    error InvalidASCII();
    error TargetWordMissing();
    error PoisonWordDetected();
    error MandatoryQuoteMissing();
    error QuoteAtEdge();
    error PositionalLetterMismatch();

    // ─── Structs ─────────────────────────────────────────────────────────────

    /// @notice All constraints for a single turn, pre-computed by the caller.
    struct Constraints {
        string targetWord;       // Must include (whole-word boundary)
        string poisonWord;       // Must NOT include (substring)
        string mandatoryQuote;   // Must include (substring, not at edges)
        uint256 constrainedPos;  // Position in narrative to check
        bytes1 requiredLetter;   // Letter required at constrainedPos (lowercased)
        bool hasQuoteConstraint; // Whether quote constraint is active (false on turn 0)
        bool hasPositionalConstraint; // Whether positional constraint is active
    }

    // ─── Main Verifier ───────────────────────────────────────────────────────

    /**
     * @notice Validates all constraints in a single pass over the narrative.
     * @param narrative The submitted narrative text.
     * @param c Pre-computed constraint parameters.
     */
    function verifyAll(string calldata narrative, Constraints memory c) internal pure {
        bytes memory n = bytes(narrative);
        uint256 len = n.length;

        // Length check
        if (len < MIN_NARRATIVE_LEN) revert NarrativeTooShort();
        if (len > MAX_NARRATIVE_LEN) revert NarrativeTooLong();

        bytes memory t = bytes(c.targetWord);
        bytes memory p = bytes(c.poisonWord);
        bytes memory q = bytes(c.mandatoryQuote);

        bool foundTarget = false;
        bool foundQuote = false;
        uint256 quoteFoundAt = 0; // position where quote was found

        // Pre-cache first chars (lowered) for fast rejection
        bytes1 tFirst = t.length > 0 ? _lower(t[0]) : bytes1(0);
        bytes1 pFirst = p.length > 0 ? _lower(p[0]) : bytes1(0);
        bytes1 qFirst = q.length > 0 ? _lower(q[0]) : bytes1(0);

        for (uint256 i = 0; i < len;) {
            bytes1 ch = n[i];

            // ── Constraint 5: ASCII ──
            if (uint8(ch) > MAX_ASCII) revert InvalidASCII();

            bytes1 chLow = _lower(ch);

            // ── Constraint 4: Positional letter ──
            if (c.hasPositionalConstraint && i == c.constrainedPos) {
                if (chLow != c.requiredLetter) revert PositionalLetterMismatch();
            }

            // ── Constraint 2: Poison (substring, immediate revert) ──
            if (p.length > 0 && i + p.length <= len && chLow == pFirst) {
                if (_matchSubstring(n, p, i)) revert PoisonWordDetected();
            }

            // ── Constraint 1: Target (whole-word boundary) ──
            if (!foundTarget && t.length > 0 && i + t.length <= len && chLow == tFirst) {
                bool startBound = (i == 0) || !_isLetter(n[i - 1]);
                bool endBound = (i + t.length == len) || !_isLetter(n[i + t.length]);
                if (startBound && endBound && _matchSubstring(n, t, i)) {
                    foundTarget = true;
                }
            }

            // ── Constraint 3: Mandatory quote (substring) ──
            if (c.hasQuoteConstraint && !foundQuote && q.length > 0 && i + q.length <= len && chLow == qFirst) {
                if (_matchSubstring(n, q, i)) {
                    foundQuote = true;
                    quoteFoundAt = i;
                }
            }

            unchecked { ++i; }
        }

        // ── Post-loop checks ──
        if (!foundTarget) revert TargetWordMissing();

        if (c.hasQuoteConstraint) {
            if (!foundQuote) revert MandatoryQuoteMissing();
            // Quote must not be at the edges (trivial prepend/append defense)
            if (quoteFoundAt < QUOTE_EDGE_MARGIN) revert QuoteAtEdge();
            if (quoteFoundAt + q.length > len - QUOTE_EDGE_MARGIN) revert QuoteAtEdge();
        }
    }

    // ─── View variant (for dry-run, returns bools instead of reverting) ─────

    struct Results {
        bool passesTarget;
        bool passesPoison;
        bool passesQuote;
        bool passesQuotePosition;
        bool passesPositional;
        bool passesAscii;
        bool passesLength;
    }

    function wouldPassAll(string calldata narrative, Constraints memory c) internal pure returns (Results memory r) {
        bytes memory n = bytes(narrative);
        uint256 len = n.length;

        r.passesLength = len >= MIN_NARRATIVE_LEN && len <= MAX_NARRATIVE_LEN;
        r.passesPoison = true;
        r.passesAscii = true;
        r.passesPositional = !c.hasPositionalConstraint; // vacuously true if no constraint

        bytes memory t = bytes(c.targetWord);
        bytes memory p = bytes(c.poisonWord);
        bytes memory q = bytes(c.mandatoryQuote);

        bytes1 tFirst = t.length > 0 ? _lower(t[0]) : bytes1(0);
        bytes1 pFirst = p.length > 0 ? _lower(p[0]) : bytes1(0);
        bytes1 qFirst = q.length > 0 ? _lower(q[0]) : bytes1(0);

        uint256 quoteFoundAt = type(uint256).max;

        for (uint256 i = 0; i < len;) {
            bytes1 ch = n[i];
            if (uint8(ch) > MAX_ASCII) r.passesAscii = false;

            bytes1 chLow = _lower(ch);

            if (c.hasPositionalConstraint && i == c.constrainedPos) {
                r.passesPositional = (chLow == c.requiredLetter);
            }

            if (r.passesPoison && p.length > 0 && i + p.length <= len && chLow == pFirst) {
                if (_matchSubstring(n, p, i)) r.passesPoison = false;
            }

            if (!r.passesTarget && t.length > 0 && i + t.length <= len && chLow == tFirst) {
                bool sb = (i == 0) || !_isLetter(n[i - 1]);
                bool eb = (i + t.length == len) || !_isLetter(n[i + t.length]);
                if (sb && eb && _matchSubstring(n, t, i)) r.passesTarget = true;
            }

            if (c.hasQuoteConstraint && !r.passesQuote && q.length > 0 && i + q.length <= len && chLow == qFirst) {
                if (_matchSubstring(n, q, i)) {
                    r.passesQuote = true;
                    quoteFoundAt = i;
                }
            }

            unchecked { ++i; }
        }

        if (!c.hasQuoteConstraint) {
            r.passesQuote = true;
            r.passesQuotePosition = true;
        } else if (r.passesQuote) {
            r.passesQuotePosition = quoteFoundAt >= QUOTE_EDGE_MARGIN
                && quoteFoundAt + q.length <= len - QUOTE_EDGE_MARGIN;
        }
    }

    // ─── Helpers for quote extraction (called by battle contract) ────────────

    /**
     * @notice Extracts a pseudo-random substring from the opponent's last narrative.
     * @param opponentNarrative The opponent's previous narrative.
     * @param turn Current turn number.
     * @param randomness On-chain randomness (prevrandao + sequenceHash).
     * @param quoteLength Desired quote length in bytes.
     * @return quote The extracted substring.
     */
    function extractQuote(
        string memory opponentNarrative,
        uint32 turn,
        uint256 randomness,
        uint256 quoteLength
    ) internal pure returns (string memory quote) {
        bytes memory src = bytes(opponentNarrative);
        if (src.length <= quoteLength) return opponentNarrative; // edge: short narrative

        uint256 maxStart = src.length - quoteLength;
        uint256 start = uint256(keccak256(abi.encodePacked(
            opponentNarrative, turn, randomness
        ))) % maxStart;

        bytes memory q = new bytes(quoteLength);
        for (uint256 i = 0; i < quoteLength;) {
            q[i] = src[start + i];
            unchecked { ++i; }
        }
        return string(q);
    }

    /**
     * @notice Derives a positional letter constraint from opponent's narrative.
     * @param opponentNarrative The opponent's previous narrative.
     * @param narrativeMaxLen Max narrative length (for position bounds).
     * @param randomness On-chain randomness.
     * @return pos Position in the new narrative to check.
     * @return letter Required lowercase letter at that position.
     */
    function derivePositionalConstraint(
        string memory opponentNarrative,
        uint256 narrativeMaxLen,
        uint256 randomness
    ) internal pure returns (uint256 pos, bytes1 letter) {
        bytes memory src = bytes(opponentNarrative);
        uint256 seed = uint256(keccak256(abi.encodePacked(randomness, src)));

        // Position: somewhere in the middle 60% of the narrative
        uint256 rangeStart = narrativeMaxLen / 5;  // 20% in
        uint256 rangeLen = narrativeMaxLen * 3 / 5; // 60% span
        pos = rangeStart + (seed % rangeLen);

        // Letter: derived from a character in the opponent's narrative
        uint256 srcIdx = (seed >> 128) % src.length;
        bytes1 srcChar = _lower(src[srcIdx]);
        // Ensure it's a letter; if not, default to 'a' + (seed % 26)
        if (!_isLetter(srcChar)) {
            srcChar = bytes1(uint8(0x61) + uint8(seed % 26)); // 'a'..'z'
        }
        letter = srcChar;
    }

    // ─── Internal helpers ────────────────────────────────────────────────────

    function _matchSubstring(bytes memory hay, bytes memory needle, uint256 start) private pure returns (bool) {
        for (uint256 j = 1; j < needle.length;) {
            if (_lower(hay[start + j]) != _lower(needle[j])) return false;
            unchecked { ++j; }
        }
        return true;
    }

    function _lower(bytes1 b) private pure returns (bytes1) {
        return (b >= 0x41 && b <= 0x5A) ? bytes1(uint8(b) + CASE_OFFSET) : b;
    }

    function _isLetter(bytes1 b) private pure returns (bool) {
        return (b >= 0x41 && b <= 0x5A) || (b >= 0x61 && b <= 0x7A);
    }
}
