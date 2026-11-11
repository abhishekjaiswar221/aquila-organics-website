import { randomInt } from "node:crypto";

// One-time passwords for new and reset admin users. Pure apart from the CSPRNG.
// No ambiguous characters (0 O 1 l I) so a password read aloud or from a screen
// is copied correctly.
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_=+?";
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

export const GENERATED_PASSWORD_LENGTH = 20;

const pick = (chars: string) => chars[randomInt(chars.length)];

/** 20 characters, at least one upper, lower, digit and symbol, shuffled with a CSPRNG Fisher-Yates. */
export function generatePassword(): string {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < GENERATED_PASSWORD_LENGTH) chars.push(pick(ALL));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
