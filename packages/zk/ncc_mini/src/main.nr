// Minimal NCC: just prove substring containment
// No hashing - smallest possible circuit to test proving pipeline

fn main(
    word: [u8; 8],
    word_len: u32,
    word_pos: u32,
    text: [u8; 32],
    text_len: u32,
    commitment: pub Field,
) {
    // 1. Substring check
    assert(word_pos + word_len <= text_len);
    assert(text_len <= 32);
    assert(word_len <= 8);
    assert(word_len > 0);
    
    for i in 0..8 {
        if (i as u32) < word_len {
            assert(text[word_pos + i as u32] == word[i]);
        }
    }
    
    // 2. Simple commitment: hash word bytes into a Field
    let mut acc: Field = 0;
    for i in 0..8 {
        acc = acc * 256 + word[i] as Field;
    }
    assert(acc == commitment);
}
