// NCC Proof-of-Concept (minimal): Prove a word exists in text
// Reduced sizes for quick PoC proving

fn main(
    word: [u8; 16],        // padded word (max 16 bytes)
    word_len: u32,
    word_position: u32,
    narrative: [u8; 128],  // padded narrative (max 128 bytes)
    narrative_len: u32,

    context_hash: pub [u8; 32],
    narrative_hash: pub [u8; 32],
) {
    // 1. Substring check
    assert(word_position + word_len <= narrative_len);
    for i in 0..16 {
        if (i as u32) < word_len {
            assert(narrative[word_position + i as u32] == word[i]);
        }
    }

    // 2. context_hash == blake2s(word)
    let computed_context = std::hash::blake2s(word);
    assert(computed_context == context_hash);

    // 3. narrative_hash == blake2s(narrative)
    let computed_narrative = std::hash::blake2s(narrative);
    assert(computed_narrative == narrative_hash);
}
