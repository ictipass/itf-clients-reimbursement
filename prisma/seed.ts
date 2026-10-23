import "dotenv/config";

import { hash } from "argon2";
import pg from "pg";

const { Client } = pg;

type IdRow = {
  id: string;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required to run the seed script.`);
  }

  return value;
}

function optionalEnv(name: string, fallback: string) {
  return process.env[name]?.trim() || fallback;
}

async function hashPassword(password: string) {
  return hash(password, {
    type: 2,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
}

const seed = {
  workspace: {
    id: optionalEnv("SYSTEM_WORKSPACE_ID", "itf-workspace"),
    name: optionalEnv("SYSTEM_WORKSPACE_NAME", "ITF Workspace"),
    slug: optionalEnv("SYSTEM_WORKSPACE_SLUG", "itf-workspace"),
  },
  admin: {
    id: optionalEnv("SYSTEM_ADMIN_ID", "system-admin"),
    name: optionalEnv("SYSTEM_ADMIN_NAME", "System Administrator"),
    email: optionalEnv("SYSTEM_ADMIN_EMAIL", "admin@itf.local").toLowerCase(),
    initialPassword: requiredEnv("SYSTEM_ADMIN_INITIAL_PASSWORD"),
    resetPassword: process.env.SYSTEM_ADMIN_RESET_PASSWORD === "true",
  },
};

const client = new Client({
  connectionString: process.env.DIRECT_URL?.trim() || requiredEnv("DATABASE_URL"),
});

async function main() {
  await client.connect();
  await client.query("begin");

  try {
    const adminPasswordHash = await hashPassword(seed.admin.initialPassword);

    await client.query(
      `
        insert into "Workspace" ("id", "name", "slug", "updatedAt")
        values ($1, $2, $3, now())
        on conflict ("id")
        do update set
          "name" = excluded."name",
          "slug" = excluded."slug",
          "isActive" = true,
          "updatedAt" = now()
      `,
      [seed.workspace.id, seed.workspace.name, seed.workspace.slug],
    );

    await client.query(
      `
        insert into "User" (
          "id",
          "email",
          "name",
          "passwordHash",
          "emailVerifiedAt",
          "authenticationSource",
          "mustChangePassword",
          "isActive",
          "updatedAt"
        )
        values ($1, $2, $3, $4, now(), 'LOCAL', true, true, now())
        on conflict ("email")
        do update set
          "name" = excluded."name",
          "emailVerifiedAt" = coalesce("User"."emailVerifiedAt", excluded."emailVerifiedAt"),
          "authenticationSource" = 'LOCAL',
          "isActive" = true,
          "passwordHash" = case
            when $5::boolean or "User"."passwordHash" is null then excluded."passwordHash"
            else "User"."passwordHash"
          end,
          "mustChangePassword" = case
            when $5::boolean or "User"."passwordHash" is null then true
            else "User"."mustChangePassword"
          end,
          "updatedAt" = now()
      `,
      [
        seed.admin.id,
        seed.admin.email,
        seed.admin.name,
        adminPasswordHash,
        seed.admin.resetPassword,
      ],
    );

    const userResult = await client.query(`select "id" from "User" where "email" = $1 limit 1`, [
      seed.admin.email,
    ]);

    const user = userResult.rows[0] as IdRow | undefined;

    if (!user) {
      throw new Error("Seed failed to create or find the system administrator.");
    }

    await client.query(
      `
        insert into "Membership" (
          "id",
          "userId",
          "workspaceId",
          "organizationId",
          "role",
          "updatedAt"
        )
        values ($1, $2, $3, null, 'SYSTEM_ADMIN', now())
        on conflict ("id")
        do update set
          "userId" = excluded."userId",
          "workspaceId" = excluded."workspaceId",
          "organizationId" = null,
          "role" = 'SYSTEM_ADMIN',
          "isActive" = true,
          "activatedAt" = now(),
          "deactivatedAt" = null,
          "deactivatedById" = null,
          "deactivatedReason" = null,
          "updatedAt" = now()
      `,
      [`${user.id}-system_admin`, user.id, seed.workspace.id],
    );

    await client.query("commit");

    console.log("Seeded system administrator:");
    console.log(`- Workspace: ${seed.workspace.name}`);
    console.log(`- Email: ${seed.admin.email}`);
    console.log("- Role: SYSTEM_ADMIN");
    console.log("- Initial password stored as Argon2id hash.");
    console.log("- First login requires a password change.");
    if (seed.admin.resetPassword) {
      console.log("- Existing admin password was reset because SYSTEM_ADMIN_RESET_PASSWORD=true.");
    }
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
