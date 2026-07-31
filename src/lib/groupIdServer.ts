import { randomBytes } from "crypto";

// Same alphabet as friend codes — avoids visually ambiguous characters.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateGroupId(length = 8): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}
