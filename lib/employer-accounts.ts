import { createHash, randomBytes } from "node:crypto";

import { hash, verify } from "argon2";

import { getDb } from "@/lib/db";

export type RegisterEmployerAccountInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function getActiveWorkspaceId() {
  const workspace = await getDb().workspace.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  if (!workspace) throw new Error("The ITF workspace is not available.");
  return workspace.id;
}

export async function ensureEmployerMembership(userId: string) {
  const db = getDb();
  const workspaceId = await getActiveWorkspaceId();
  const existing = await db.membership.findFirst({
    where: { userId, workspaceId, organizationId: null, role: "EMPLOYER_ADMIN" },
    select: { id: true, isActive: true },
  });

  if (existing && !existing.isActive) {
    await db.membership.update({
      where: { id: existing.id },
      data: {
        isActive: true,
        activatedAt: new Date(),
        deactivatedAt: null,
        deactivatedById: null,
        deactivatedReason: null,
      },
    });
  } else if (!existing) {
    await db.membership.create({
      data: { userId, workspaceId, role: "EMPLOYER_ADMIN" },
    });
  }
}

export async function registerEmployerAccount(input: RegisterEmployerAccountInput) {
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  const name = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();
  const existingUser = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    throw new Error("An account already exists for this email address. Continue to sign in.");
  }

  const passwordHash = await hash(input.password, {
    type: 2,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const user = await db.user.create({
    data: { email, name, passwordHash, isActive: false },
    select: { id: true },
  });

  await db.emailVerificationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  await db.emailVerificationToken.create({
    data: { userId: user.id, tokenHash: tokenHash(token), expiresAt },
  });

  return { token, expiresAt };
}

export async function verifyEmployerEmail(token: string) {
  const db = getDb();
  const record = await db.emailVerificationToken.findUnique({
    where: { tokenHash: tokenHash(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    throw new Error("This verification link is invalid or has expired.");
  }

  await db.$transaction([
    db.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    db.user.update({
      where: { id: record.userId },
      data: { isActive: true, emailVerifiedAt: new Date() },
    }),
  ]);
  await ensureEmployerMembership(record.userId);
}

export async function createReplacementVerificationToken(email: string) {
  const db = getDb();
  const user = await db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true, name: true, emailVerifiedAt: true },
  });
  if (!user || user.emailVerifiedAt) return null;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.$transaction([
    db.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    db.emailVerificationToken.create({
      data: { userId: user.id, tokenHash: tokenHash(token), expiresAt },
    }),
  ]);
  return { token, email: user.email, name: user.name };
}

export async function authenticatePortalAccount(email: string, password: string) {
  const user = await getDb().user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      emailVerifiedAt: true,
      isActive: true,
      mustChangePassword: true,
      memberships: { where: { isActive: true }, select: { role: true }, take: 1 },
    },
  });

  if (!user?.passwordHash || !user.emailVerifiedAt || !user.isActive || !user.memberships[0]) return null;
  if (!(await verify(user.passwordHash, password))) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.memberships[0].role,
    mustChangePassword: user.mustChangePassword,
  };
}

export async function provisionVerifiedGoogleEmployer(email: string, name: string) {
  const db = getDb();
  const normalizedEmail = email.toLowerCase();
  const existing = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      isActive: true,
      memberships: { where: { isActive: true }, select: { id: true }, take: 1 },
    },
  });

  if (existing) {
    if (!existing.isActive || !existing.memberships[0]) {
      throw new Error("This existing account is not authorized to sign in.");
    }

    await db.user.update({
      where: { id: existing.id },
      data: {
        emailVerifiedAt: new Date(),
        authenticationSource: "GOOGLE",
        mustChangePassword: false,
      },
    });
    return;
  }

  const user = await db.user.create({
    data: {
      email: normalizedEmail,
      name,
      isActive: true,
      emailVerifiedAt: new Date(),
      authenticationSource: "GOOGLE",
    },
    select: { id: true },
  });
  await ensureEmployerMembership(user.id);
}
