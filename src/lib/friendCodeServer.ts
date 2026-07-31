import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

// Avoids visually ambiguous characters (0/O, 1/I/L) since these codes get
// read aloud or copy-pasted between friends.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(length = 8): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

export async function getOrCreateFriendCode(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { friendCode: true } });
  if (user.friendCode) return user.friendCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      await prisma.user.update({ where: { id: userId }, data: { friendCode: code } });
      return code;
    } catch {
      // Unique-constraint collision — vanishingly unlikely, just retry.
    }
  }
  throw new Error("Could not generate a unique friend code");
}
