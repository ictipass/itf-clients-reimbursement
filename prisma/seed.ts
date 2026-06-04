import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

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
  "AREA_MANAGER",
  "HORIC",
  "REVENUE_ACCOUNTANT",
  "HEAD_OF_TRAINING",
  "REIMBURSEMENT_OFFICER",
  "DIRECTOR_FSD",
  "HEAD_OF_DIVISION",
  "HQ_REIMBURSEMENT_OFFICER",
  "HQ_REVENUE_ACCOUNTANT",
  "EMPLOYER_ADMIN",
  "EMPLOYER_SUBMITTER",
  "EMPLOYER_VIEWER",
] as const;

type Role = (typeof roles)[number];

type IdRow = {
  id: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required to run the seed script.`);
  }

  return value;
}

function resolveRole(value: string | undefined): Role {
  if (value && roles.includes(value as Role)) {
    return value as Role;
  }

  return "SYSTEM_ADMIN";
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function readAreaOfficeNames() {
  const filePath = path.join(process.cwd(), "data", "ao.txt");
  const content = await fs.readFile(filePath, "utf8");
  const names = content
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean);

  return Array.from(new Set(names));
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
  employerOrganization: {
    id: process.env.SEED_EMPLOYER_ORGANIZATION_ID ?? "demo-employer",
    name: process.env.SEED_EMPLOYER_ORGANIZATION_NAME ?? "Demo Employer Organization",
    slug: process.env.SEED_EMPLOYER_ORGANIZATION_SLUG ?? "demo-employer",
  },
  admin: {
    id: process.env.BOOTSTRAP_ADMIN_ID ?? "system-admin",
    name: process.env.BOOTSTRAP_ADMIN_NAME ?? "System Administrator",
    email: process.env.BOOTSTRAP_ADMIN_EMAIL ?? "admin@itf.local",
    role: resolveRole(process.env.BOOTSTRAP_ADMIN_ROLE),
  },
};

const testUsers: {
  id: string;
  email: string;
  name: string;
  role: Role;
  scope: "itf" | "area-office" | "employer";
  requestedLabel?: string;
}[] = [
  {
    id: "test-am",
    email: "am@itf.local",
    name: "Area Manager",
    role: "AREA_MANAGER",
    scope: "area-office",
  },
  {
    id: "test-horic",
    email: "horic@itf.local",
    name: "HORIC",
    role: "HORIC",
    scope: "area-office",
  },
  {
    id: "test-ra",
    email: "ra@itf.local",
    name: "Revenue Accountant",
    role: "REVENUE_ACCOUNTANT",
    scope: "area-office",
  },
  {
    id: "test-ro",
    email: "ro@itf.local",
    name: "Reimbursement Officer",
    role: "REIMBURSEMENT_OFFICER",
    scope: "area-office",
    requestedLabel: "REVENUE_OFFICER",
  },
  {
    id: "test-hqro",
    email: "hqro@itf.local",
    name: "HQ Reimbursement Officer",
    role: "HQ_REIMBURSEMENT_OFFICER",
    scope: "itf",
    requestedLabel: "HQ_REVENUE_OFFICER",
  },
  {
    id: "test-hqra",
    email: "hqra@itf.local",
    name: "HQ Revenue Accountant",
    role: "HQ_REVENUE_ACCOUNTANT",
    scope: "itf",
  },
  {
    id: "test-hqhod",
    email: "hqhod@itf.local",
    name: "Head of Reimbursement Division",
    role: "HEAD_OF_DIVISION",
    scope: "itf",
    requestedLabel: "HEAD_REIMBURSEMENT_DIVISION",
  },
  {
    id: "test-dfsd",
    email: "dfsd@itf.local",
    name: "Director FSD",
    role: "DIRECTOR_FSD",
    scope: "itf",
  },
  {
    id: "test-employer",
    email: "employer@itf.local",
    name: "Employer Admin",
    role: "EMPLOYER_ADMIN",
    scope: "employer",
  },
];

const client = new Client({
  connectionString: requiredEnv("DATABASE_URL"),
});

async function main() {
  await client.connect();
  await client.query("begin");

  try {
    const areaOfficeNames = await readAreaOfficeNames();

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
        insert into "CertificateTemplate" (
          "id", "workspaceId", "name", "code", "version", "status", "effectiveFrom", "notes", "updatedAt"
        )
        values (
          'certificate-template-employer-registration-2026-1',
          $1,
          'ITF Employer Registration Certificate',
          'EMPLOYER_REGISTRATION',
          '2026.1',
          'ACTIVE',
          date '2026-01-01',
          'Default active employer registration certificate template seeded for local workflow testing.',
          now()
        )
        on conflict ("workspaceId", "code", "version")
        do update set
          "name" = excluded."name",
          "status" = excluded."status",
          "effectiveFrom" = excluded."effectiveFrom",
          "notes" = excluded."notes",
          "updatedAt" = now()
      `,
      [seed.workspace.id],
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

    const organization = organizationResult.rows[0] as IdRow | undefined;

    if (!organization) {
      throw new Error("Seed failed to create or find the ITF organization.");
    }

    const organizationId = organization.id;
    let defaultAreaOfficeId: string | undefined;

    for (const name of areaOfficeNames) {
      const slug = slugify(name);
      const areaOfficeId = `area-office-${slug}`;

      defaultAreaOfficeId ??= areaOfficeId;

      await client.query(
        `
          insert into "AreaOffice" ("id", "workspaceId", "name", "slug", "updatedAt")
          values ($1, $2, $3, $4, now())
          on conflict ("workspaceId", "slug")
          do update set
            "name" = excluded."name",
            "isActive" = true,
            "updatedAt" = now()
        `,
        [areaOfficeId, seed.workspace.id, name, slug],
      );
    }

    await client.query(
      `
        insert into "Organization" (
          "id", "workspaceId", "name", "slug", "organizationType", "updatedAt"
        )
        values ($1, $2, $3, $4, 'EMPLOYER', now())
        on conflict ("workspaceId", "slug")
        do update set
          "name" = excluded."name",
          "organizationType" = excluded."organizationType",
          "updatedAt" = now()
      `,
      [
        seed.employerOrganization.id,
        seed.workspace.id,
        seed.employerOrganization.name,
        seed.employerOrganization.slug,
      ],
    );

    const employerOrganizationResult = await client.query(
      `select "id" from "Organization" where "workspaceId" = $1 and "slug" = $2 limit 1`,
      [seed.workspace.id, seed.employerOrganization.slug],
    );

    const employerOrganization = employerOrganizationResult.rows[0] as IdRow | undefined;

    if (!employerOrganization) {
      throw new Error("Seed failed to create or find the demo employer organization.");
    }

    const employerOrganizationId = employerOrganization.id;

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

    const user = userResult.rows[0] as IdRow | undefined;

    if (!user) {
      throw new Error("Seed failed to create or find the bootstrap admin user.");
    }

    const userId = user.id;

    await client.query(
      `
        insert into "Membership" ("id", "userId", "workspaceId", "organizationId", "role")
        values ($1, $2, $3, $4, $5)
        on conflict ("userId", "workspaceId", "organizationId", "role")
        do nothing
      `,
      [`${userId}-${seed.admin.role.toLowerCase()}`, userId, seed.workspace.id, organizationId, seed.admin.role],
    );

    for (const testUser of testUsers) {
      await client.query(
        `
          insert into "User" ("id", "email", "name", "updatedAt")
          values ($1, $2, $3, now())
          on conflict ("email")
          do update set "name" = excluded."name", "updatedAt" = now()
        `,
        [testUser.id, testUser.email, testUser.name],
      );

      const testUserResult = await client.query(
        `select "id" from "User" where "email" = $1 limit 1`,
        [testUser.email],
      );
      const seededTestUser = testUserResult.rows[0] as IdRow | undefined;

      if (!seededTestUser) {
        throw new Error(`Seed failed to create or find ${testUser.email}.`);
      }

      const membershipOrganizationId =
        testUser.scope === "employer" ? employerOrganizationId : organizationId;
      const membershipAreaOfficeId =
        testUser.scope === "area-office" ? (defaultAreaOfficeId ?? null) : null;
      const membershipId = `${seededTestUser.id}-${testUser.role.toLowerCase()}`;

      await client.query(
        `
          insert into "Membership" (
            "id", "userId", "workspaceId", "organizationId", "areaOfficeId", "role"
          )
          values ($1, $2, $3, $4, $5, $6)
          on conflict ("userId", "workspaceId", "organizationId", "role")
          do update set "areaOfficeId" = excluded."areaOfficeId"
        `,
        [
          membershipId,
          seededTestUser.id,
          seed.workspace.id,
          membershipOrganizationId,
          membershipAreaOfficeId,
          testUser.role,
        ],
      );
    }

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
    console.log(`- Demo employer organization: ${seed.employerOrganization.name}`);
    console.log(`- Area offices: ${areaOfficeNames.length}`);
    console.log(`- Bootstrap admin: ${seed.admin.email}`);
    console.log(`- Role: ${seed.admin.role}`);
    console.log(`- Test users: ${testUsers.length}`);
    console.log("- Certificate template: ITF Employer Registration Certificate v2026.1");
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
