// Lightweight client-side guard for the studio's background/details prompt fields.
// Best-effort only: not a moderation system. A determined user can get around word
// matching with spacing, misspellings or another language. It exists to stop obvious,
// casual misuse, not to replace judgment or the terms of use.

const BLOCKED_WORDS = [
  "porn",
  "pornographic",
  "nude",
  "naked",
  "nsfw",
  "sex",
  "sexual",
  "orgasm",
  "fetish",
  "rape",
  "incest",
  "pedophile",
  "paedophile",
  "gore",
  "beheading",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "chink",
  "spic",
  "kike",
  "tranny",
  "hitler",
  "nazi",
  "genocide",
  "terrorist",
  "kill yourself",
  "suicide",
];

export function hasBlockedWords(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some((word) => new RegExp(`\\b${word}\\b`, "i").test(lower));
}
