import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const LENGTH = 10;

// Map each random byte into 62 chars. Byte range 0-255 mod 62 has slight bias;
// negligible for collision-avoidance here (10 chars = 62^10 ≈ 8.4e17 space).
export function generateSlug() {
  const bytes = randomBytes(LENGTH);
  let out = "";
  for (let i = 0; i < LENGTH; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
