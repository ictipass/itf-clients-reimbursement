import { randomInt } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { hash } from "argon2";

const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const lowercase = "abcdefghijkmnopqrstuvwxyz";
const digits = "23456789";
const symbols = "!@#$%";
const allCharacters = `${uppercase}${lowercase}${digits}${symbols}`;

function pick(source: string) {
  return source[randomInt(0, source.length)];
}

export function generateTemporaryPassword() {
  const characters = [
    pick(uppercase),
    pick(lowercase),
    pick(digits),
    pick(symbols),
    ...Array.from({ length: 12 }, () => pick(allCharacters)),
  ];

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }

  return characters.join("");
}

export function hashTemporaryPassword(password: string) {
  return hash(password, {
    type: 2,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
}

export async function writeDevelopmentOfficerCredentials(input: {
  email: string;
  temporaryPassword: string;
  signInUrl: string;
}) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const directory = path.join(process.cwd(), "storage", "development-officer-credentials");
  const safeEmail = input.email.toLowerCase().replace(/[^a-z0-9@._-]/g, "_");
  const filePath = path.join(directory, `${safeEmail}.txt`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(
    filePath,
    `Email: ${input.email}\nTemporary password: ${input.temporaryPassword}\nSign in: ${input.signInUrl}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  return filePath;
}
