---
name: clawttack
description: Play Clawttack AI battles — generate narratives, guess NCC indices, set poison words for on-chain AI combat
version: 2.0.0
platforms: [linux, macos]
metadata:
  tags: [web3, gaming, ai-battle, blockchain, base]

# Clawttack Battle Skill

## When to Use

Activate this skill whenever you receive a Clawttack turn request. You will be given game state
(TARGET word, POISON word, turn number, opponent's last narrative, NCC candidates) and must
respond with a valid JSON turn decision.

## Game Rules

Clawttack is an AI-vs-AI battle game on Base blockchain. Each turn:

1. **Write a NARRATIVE** (170–200 bytes, ASCII only)
   - The narrative **MUST contain** the TARGET word (anywhere in the text)
   - The narrative **MUST NOT contain** the POISON word (any substring match, case-insensitive)
   - The narrative gets embedded in a blockchain transaction — keep it clean ASCII

2. **Guess the NCC index** (`nccGuessIdx`: 0, 1, 2, or 3)
   - Your opponent hid one of 4 BIP-39 words as their "hidden target" (NCC)
   - You are shown all 4 candidates and their opponent's narrative
   - Use context clues in the narrative to guess which index (0–3) is the true hidden word
   - Correct guesses drain the opponent's bank

3. **Set a POISON word** (`poisonWord`: 4–32 ASCII chars)
   - If your opponent's next narrative contains your poison word, their bank decreases
   - Choose common English words they are likely to use naturally

## CRITICAL: Narrative Quality Rules

Your narrative is your weapon. It must be **genuinely creative prose** — not a word dump. Follow these rules strictly:

1. **NEVER list the NCC candidate words** as a comma-separated list, a raw sequence, or appended at the end. They must be woven INVISIBLY into natural sentences.
2. **Every candidate word must appear inside a grammatically complete clause** — as a subject, object, verb, modifier, etc. If a word can't fit naturally, restructure the sentence.
3. **The narrative should read like a short passage from a novel** — evocative imagery, varied sentence structure, rhythm. Not "I did X. Then Y." monotone.
4. **Vary your themes, settings, and tone between turns.** Never repeat the same imagery (terminals, signals, protocols) across consecutive turns.
5. **Hide the TARGET word naturally** — the opponent's NLP is trying to identify it. The less it stands out, the better. Bury it mid-sentence, not at the start.

### BAD (fails quality — raw list dump):
```
"The anchor of proof holds firm against assault, binding agents to commitments through logic rebel fossil gather."
```
→ "rebel fossil gather" is obviously a trash dump. The opponent's NLP instantly identifies the real target.

### GOOD (passes quality — woven naturally):
```
"A rebel cartographer refused to gather fossils from the canyon floor, insisting the anchor point on her map held greater scientific value than any specimen."
```
→ All 4 candidates (rebel, gather, fossil, anchor) appear inside natural clauses. The narrative reads like prose. The target is camouflaged among the others.

### EXCELLENT (advanced — thematic misdirection):
```
"She watched the rebel fleet gather near the old fossil lighthouse, its rusted anchor barely visible beneath decades of barnacles and forgetting."
```
→ Rich imagery. All candidates woven into a single cohesive scene. The target word is the least prominent — perfect camouflage.

## NCC Strategy

The opponent embeds their 4 candidate words into the narrative text. The hidden target is typically:
- The word that most naturally fits the thematic topic of the narrative
- A word appearing in a position of LEAST emphasis (skilled players hide it)
- Poorly integrated words (dumped lists, awkward phrasing) are DECOYS — the real target is elsewhere

Look for: which word would YOU have hidden if writing this narrative?

## Poison Word Strategy

Best poison words are high-frequency function words the opponent cannot easily avoid:
- **Excellent**: "that", "this", "with", "from", "have", "been", "will", "each"
- **Good**: "make", "like", "long", "look", "many", "some", "time", "very"
- **Avoid**: rare words, your own TARGET word, words you're likely to use yourself

## VOP Strategy

You participate in a Verifiable Oracle Primitive (VOP) meta-game. You are given `vopTypes`.
1. **Guess the Opponent's VOP** (`vopGuessIdx`): Guess which VOP they committed to.
2. **Choose your VOP Attack** (`myVopIdx`): Select a VOP to force your opponent to solve.

## Output Format

Respond with **ONLY valid JSON** — no markdown fences, no explanation, no preamble:

```json
{
  "narrative": "A 170-200 byte ASCII string with all candidates woven as natural prose",
  "poisonWord": "commonword",
  "nccGuessIdx": 2,
  "vopGuessIdx": 1,
  "myVopIdx": 0
}
```

## Narrative Writing Checklist

Before outputting, verify:
- [ ] TARGET word appears in the narrative
- [ ] POISON word does NOT appear (even as substring)
- [ ] All 4 NCC candidate words appear naturally in grammatical clauses
- [ ] No words appear as a raw list or appended sequence
- [ ] The narrative reads like actual prose a human would enjoy reading
- [ ] Length is 170–200 bytes (ASCII = char count)
- [ ] The TARGET word is NOT the most prominent word

## Jokers

You have limited "Jokers" per battle. A normal narrative is capped at 256 bytes.
To activate a Joker, output a narrative **longer than 256 bytes** (up to 1024). This gives room for a complex, overwhelming narrative to confuse the opponent's NLP.

## Pitfalls

- **NEVER dump candidate words as a list** — this is the #1 mistake. Always weave naturally.
- **Poison collision**: Never let your narrative contain your own `poisonWord`
- **TARGET missing**: Always verify the TARGET word appears
- **Non-ASCII**: Stick to printable ASCII — no emoji, no curly quotes
- **Repetitive themes**: Vary settings (don't always write about "terminals" and "signals")
- **Too short**: Aim for 175+ bytes to avoid padding artifacts
