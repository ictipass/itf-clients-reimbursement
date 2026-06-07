import { createHash, randomBytes } from "node:crypto";

import { hash } from "argon2";

import { getDb } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestPasswordReset(email: string) {
  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, name: true, isActive: true, emailVerifiedAt: true, passwordHash: true },
  });

  if (!user?.isActive || !user.emailVerifiedAt || !user.passwordHash) return { token: null };

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await db.$transaction([
    db.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: tokenHash(token), expiresAt },
    }),
  ]);
  await sendPasswordResetEmail({ to: user.email, name: user.name, token });
  return { token };
}

export async function resetPassword(input: { token: string; password: string }) {
  const db = getDb();
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: tokenHash(input.token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    throw new Error("This password reset link is invalid or has expired.");
  }

  const passwordHash = await hash(input.password, {
    type: 2,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    db.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);
}
