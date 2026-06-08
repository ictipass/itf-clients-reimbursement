import { randomInt } from "node:crypto";

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
