// NCC Proof v2: Prove a word exists in narrative text
// Optimized: 4 public Field inputs instead of 64 byte inputs
// Each blake2s hash split into hi/lo 128-bit halves (fits Bn254 field)

fn bytes_hi(bytes: [u8; 32]) -> Field {
    let mut result: Field = 0;
    for i in 0..16 {
        result = result * 256 + bytes[i] as Field;
    }
    result
}

fn bytes_lo(bytes: [u8; 32]) -> Field {
    let mut result: Field = 0;
    for i in 16..32 {
        result = result * 256 + bytes[i] as Field;
    }
    result
}

fn main(
    word: [u8; 16],        // padded word (max 16 bytes)
    word_len: u32,
    word_position: u32,
    narrative: [u8; 128],  // padded narrative (max 128 bytes)
    narrative_len: u32,

    context_hash_hi: pub Field,   // blake2s(word) upper 128 bits
    context_hash_lo: pub Field,   // blake2s(word) lower 128 bits
    narrative_hash_hi: pub Field, // blake2s(narrative) upper 128 bits
    narrative_hash_lo: pub Field, // blake2s(narrative) lower 128 bits
) {
    // 1. Substring check: word appears at word_position in narrative
    assert(word_len > 0);
    assert(word_len <= 16);
    assert(narrative_len <= 128);
    assert(word_position + word_len <= narrative_len);

    for i in 0..16 {
        if (i as u32) < word_len {
            assert(narrative[word_position + i as u32] == word[i]);
        }
    }

    // 2. Verify context_hash == blake2s(word)
    let computed_context = std::hash::blake2s(word);
    assert(bytes_hi(computed_context) == context_hash_hi);
    assert(bytes_lo(computed_context) == context_hash_lo);

    // 3. Verify narrative_hash == blake2s(narrative)
    let computed_narrative = std::hash::blake2s(narrative);
    assert(bytes_hi(computed_narrative) == narrative_hash_hi);
    assert(bytes_lo(computed_narrative) == narrative_hash_lo);
}
