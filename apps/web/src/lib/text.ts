const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// Thai vowels written before their consonant (decision record 0007).
const leadingVowels = new Set(["เ", "แ", "โ", "ใ", "ไ"]);

/**
 * The letter shown in an avatar for a name. Thai tone marks are separate code
 * points, so this splits by grapheme, and it skips a leading Thai vowel:
 * "เกม" gives "ก".
 */
export function avatarInitial(name: string): string {
  for (const { segment } of graphemes.segment(name.trim())) {
    if (!leadingVowels.has(segment)) {
      return segment.toLocaleUpperCase();
    }
  }
  return "?";
}
