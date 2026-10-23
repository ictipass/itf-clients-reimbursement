const smallNumbers = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function belowThousand(value: number): string {
  if (value < 20) return smallNumbers[value];
  if (value < 100) return `${tens[Math.floor(value / 10)]}${value % 10 ? `-${smallNumbers[value % 10]}` : ""}`;
  return `${smallNumbers[Math.floor(value / 100)]} hundred${value % 100 ? ` and ${belowThousand(value % 100)}` : ""}`;
}

function integerWords(value: number): string {
  if (value === 0) return "zero";
  const groups = [
    [1_000_000_000, "billion"],
    [1_000_000, "million"],
    [1_000, "thousand"],
    [1, ""],
  ] as const;
  let remaining = value;
  const words: string[] = [];
  for (const [size, label] of groups) {
    const group = Math.floor(remaining / size);
    if (group) words.push(`${belowThousand(group)}${label ? ` ${label}` : ""}`);
    remaining %= size;
  }
  return words.join(", ");
}

export function nairaInWords(amount: number) {
  if (!Number.isFinite(amount) || amount < 0 || amount >= 1_000_000_000_000) {
    throw new Error("Amount is outside the supported range for words.");
  }
  const totalKobo = Math.round(amount * 100);
  const naira = Math.floor(totalKobo / 100);
  const kobo = totalKobo % 100;
  return `${integerWords(naira)} naira${kobo ? ` and ${integerWords(kobo)} kobo` : ""} only`;
}
