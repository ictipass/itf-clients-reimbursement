import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const roles = [
  "SYSTEM_ADMIN",
  "WORKSPACE_APP_ADMIN",
  "ITF_REGISTRATION_OFFICER",
  "ITF_COMPLIANCE_OFFICER",
  "ITF_TRAINING_APPROVER",
  "ITF_CLAIMS_REVIEWER",
  "ITF_CLAIMS_APPROVER",
  "ITF_AUDITOR",
  "EMPLOYER_ADMIN",
  "EMPLOYER_SUBMITTER",
  "EMPLOYER_VIEWER",
];

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required to run the seed script.`);
  }

  return value;
}

function resolveRole(value) {
  if (value && roles.includes(value)) {
    return value;
  }

  return "SYSTEM_ADMIN";
}

const seed = {
  workspace: {
    id: process.env.SEED_WORKSPACE_ID ?? "itf-workspace",
    name: process.env.SEED_WORKSPACE_NAME ?? "ITF Workspace",
    slug: process.env.SEED_WORKSPACE_SLUG ?? "itf-workspace",
  },
  organization: {
    id: process.env.SEED_ITF_ORGANIZATION_ID ?? "itf-internal",
    name: process.env.SEED_ITF_ORGANIZATION_NAME ?? "Industrial Training Fund",
    slug: process.env.SEED_ITF_ORGANIZATION_SLUG ?? "itf",
  },
  admin: {
    id: process.env.BOOTSTRAP_ADMIN_ID ?? "system-admin",
    name: process.env.BOOTSTRAP_ADMIN_NAME ?? "System Administrator",
    email: process.env.BOOTSTRAP_ADMIN_EMAIL ?? "admin@itf.local",
    role: resolveRole(process.env.BOOTSTRAP_ADMIN_ROLE),
  },
};

const client = new Client({
  connectionString: requiredEnv("DATABASE_URL"),
});

async function main() {
  await client.connect();
  await client.query("begin");

  try {
    await client.query(
      `
        insert into "Workspace" ("id", "name", "slug", "updatedAt")
        values ($1, $2, $3, now())
        on conflict ("id")
        do update set "name" = excluded."name", "slug" = excluded."slug", "updatedAt" = now()
      `,
      [seed.workspace.id, seed.workspace.name, seed.workspace.slug],
    );

    await client.query(
      `
        insert into "Organization" (
          "id", "workspaceId", "name", "slug", "organizationType", "updatedAt"
        )
        values ($1, $2, $3, $4, 'ITF_INTERNAL', now())
        on conflict ("workspaceId", "slug")
        do update set
          "name" = excluded."name",
          "organizationType" = excluded."organizationType",
          "updatedAt" = now()
      `,
      [seed.organization.id, seed.workspace.id, seed.organization.name, seed.organization.slug],
    );

    const organizationResult = await client.query(
      `select "id" from "Organization" where "workspaceId" = $1 and "slug" = $2 limit 1`,
      [seed.workspace.id, seed.organization.slug],
    );

    const organizationId = organizationResult.rows[0].id;

    await client.query(
      `
        insert into "User" ("id", "email", "name", "updatedAt")
        values ($1, $2, $3, now())
        on conflict ("email")
        do update set "name" = excluded."name", "updatedAt" = now()
      `,
      [seed.admin.id, seed.admin.email, seed.admin.name],
    );

    const userResult = await client.query(`select "id" from "User" where "email" = $1 limit 1`, [
      seed.admin.email,
    ]);

    const userId = userResult.rows[0].id;

    await client.query(
      `
        insert into "Membership" ("id", "userId", "workspaceId", "organizationId", "role")
        values ($1, $2, $3, $4, $5)
        on conflict ("userId", "workspaceId", "organizationId", "role")
        do nothing
      `,
      [`${userId}-${seed.admin.role.toLowerCase()}`, userId, seed.workspace.id, organizationId, seed.admin.role],
    );

    await client.query(
      `
        insert into "AuditEvent" (
          "id", "workspaceId", "organizationId", "actorId", "action", "entityType", "entityId", "reason"
        )
        values ($1, $2, $3, $4, 'CREATE', 'FoundationSeed', $2, 'Seeded foundation workspace, ITF organization, and bootstrap admin.')
        on conflict ("id")
        do nothing
      `,
      ["foundation-seed-audit", seed.workspace.id, organizationId, userId],
    );

    await client.query("commit");

    console.log("Seeded foundation data:");
    console.log(`- Workspace: ${seed.workspace.name}`);
    console.log(`- ITF organization: ${seed.organization.name}`);
    console.log(`- Bootstrap admin: ${seed.admin.email}`);
    console.log(`- Role: ${seed.admin.role}`);
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
