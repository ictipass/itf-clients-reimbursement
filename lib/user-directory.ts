import { getDb } from "@/lib/db";
import { generateTemporaryPassword, hashTemporaryPassword } from "@/lib/officer-provisioning";
import { writeAuditEvent } from "@/lib/audit";
import { can, roles, type Role } from "@/lib/rbac";
import { maxUploadBytes, sanitizeFileName } from "@/lib/storage/security";
import { getAreaOfficeOfficerRoles, getHeadquartersOfficerRoles } from "@/lib/area-office-management";
import { assertConfiguredStaffValues, getStaffWorkspace, listStaffDirectoryOptions } from "@/lib/staff-directory-options";

const userCsvColumns = [
  "full name",
  "staff number",
  "email address",
  "phone number",
  "office",
  "role",
  "department",
  "job title",
] as const;

export type CreateDirectoryUserInput = {
  requesterRole: Role;
  name: string;
  staffNumber?: string;
  email: string;
  phoneNumber?: string;
  department?: string;
  jobTitle?: string;
};

export type UpdateDirectoryUserInput = CreateDirectoryUserInput & {
  userId: string;
};

export type ImportDirectoryUsersInput = {
  requesterRole: Role;
  file: File;
};

type ParsedUserCsvRow = {
  name: string;
  staffNumber?: string;
  email: string;
  phoneNumber?: string;
  department?: string;
  jobTitle?: string;
  office?: string;
  role?: string;
};

export function getUserCsvTemplate() {
  return `${userCsvColumns.join(",")}\n`;
}

export async function listDirectoryUsers(input: {
  requesterRole: Role;
  query?: string;
  role?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to manage users.");
  }

  const query = input.query?.trim();
  const pageSize = Math.min(Math.max(input.pageSize ?? 20, 5), 100);
  const page = Math.max(input.page ?? 1, 1);
  const role = roles.includes(input.role as Role) ? (input.role as Role) : undefined;
  const isActive =
    input.status === "active" ? true : input.status === "inactive" ? false : undefined;
  const where = {
    ...(typeof isActive === "boolean" ? { isActive } : {}),
    ...(role ? { memberships: { some: { role } } } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { email: { contains: query, mode: "insensitive" as const } },
            { staffNumber: { contains: query, mode: "insensitive" as const } },
            { department: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const db = getDb();
  const total = await db.user.count({ where });
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const currentPage = Math.min(page, totalPages);
  const items = await db.user.findMany({
    where,
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      staffNumber: true,
      email: true,
      phoneNumber: true,
      department: true,
      jobTitle: true,
      isActive: true,
      isManagement: true,
      authenticationSource: true,
      mustChangePassword: true,
      provisionedAt: true,
      welcomeEmailSentAt: true,
      lastSignedInAt: true,
      updatedAt: true,
      memberships: {
        select: {
          id: true,
          role: true,
          isActive: true,
          activatedAt: true,
          deactivatedAt: true,
          areaOffice: {
            select: {
              name: true,
            },
          },
          organization: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          role: "asc",
        },
      },
    },
  });

  return { items, total, page: currentPage, pageSize, totalPages };
}

export async function resetDirectoryUserLocalAccess(input: {
  requesterRole: Role;
  userId: string;
}) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to reset officer access.");
  }
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashTemporaryPassword(temporaryPassword);
  const user = await getDb().user.update({
    where: { id: input.userId },
    data: {
      passwordHash,
      authenticationSource: "LOCAL",
      mustChangePassword: true,
      provisionedAt: new Date(),
      welcomeEmailSentAt: null,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
    select: { id: true, email: true, name: true },
  });
  return { ...user, temporaryPassword };
}

export async function createDirectoryUser(input: CreateDirectoryUserInput) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to create users.");
  }

  const normalized = normalizeDirectoryUser(input);
  await assertConfiguredStaffValues(normalized);

  await assertStaffNumberAvailable(normalized.staffNumber, normalized.email);

  const db = getDb();
  const existing = await db.user.findUnique({
    where: { email: normalized.email },
    select: { id: true },
  });

  if (existing) {
    throw new Error("A user already exists with this email address. Edit the existing user instead.");
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashTemporaryPassword(temporaryPassword);
  const user = await db.user.create({
    data: {
      email: normalized.email,
      name: normalized.name,
      staffNumber: normalized.staffNumber,
      phoneNumber: normalized.phoneNumber,
      department: normalized.department,
      jobTitle: normalized.jobTitle,
      passwordHash,
      emailVerifiedAt: new Date(),
      authenticationSource: "LOCAL",
      mustChangePassword: true,
      provisionedAt: new Date(),
      isActive: true,
    },
    select: { id: true, email: true, name: true },
  });

  return { ...user, temporaryPassword };
}

export async function updateDirectoryUser(input: UpdateDirectoryUserInput) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to update users.");
  }

  const normalized = normalizeDirectoryUser(input);
  const previous = await getDb().user.findUnique({ where: { id: input.userId }, select: { department: true, jobTitle: true } });
  await assertConfiguredStaffValues({
    department: normalized.department === previous?.department ? undefined : normalized.department,
    jobTitle: normalized.jobTitle === previous?.jobTitle ? undefined : normalized.jobTitle,
  });

  await assertUserExists(input.userId);
  await assertEmailAvailable(normalized.email, input.userId);
  await assertStaffNumberAvailableForUser(normalized.staffNumber, input.userId);

  return getDb().user.update({
    where: {
      id: input.userId,
    },
    data: {
      email: normalized.email,
      name: normalized.name,
      staffNumber: normalized.staffNumber ?? null,
      phoneNumber: normalized.phoneNumber ?? null,
      department: normalized.department ?? null,
      jobTitle: normalized.jobTitle ?? null,
    },
    select: {
      id: true,
    },
  });
}

export async function updateDirectoryUserStatus(input: {
  requesterEmail: string;
  requesterRole: Role;
  userId: string;
  isActive: boolean;
}) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to update user status.");
  }
  const db = getDb();
  const [requester, user] = await Promise.all([
    db.user.findUnique({
      where: { email: input.requesterEmail.toLowerCase() },
      select: { id: true, email: true, memberships: { where: { isActive: true }, select: { workspaceId: true }, take: 1 } },
    }),
    db.user.findUnique({
      where: { id: input.userId },
      select: { id: true, email: true, isActive: true, memberships: { where: { isActive: true, role: "EMPLOYER_ADMIN", organizationId: { not: null } }, select: { organizationId: true } } },
    }),
  ]);
  if (!requester || !user) throw new Error("Selected user was not found.");
  if (!input.isActive && requester.id === user.id) throw new Error("You cannot deactivate your own account.");
  if (!input.isActive) {
    for (const membership of user.memberships) {
      const administrators = await db.membership.count({
        where: { organizationId: membership.organizationId, role: "EMPLOYER_ADMIN", isActive: true, user: { isActive: true } },
      });
      if (administrators <= 1) throw new Error("Assign another active employer administrator before deactivating this user.");
    }
  }
  if (user.isActive === input.isActive) return;
  await db.user.update({ where: { id: user.id }, data: { isActive: input.isActive } });
  const workspaceId = requester.memberships[0]?.workspaceId;
  if (workspaceId) {
    await writeAuditEvent({
      action: "UPDATE",
      actor: { id: requester.id, email: requester.email, role: input.requesterRole },
      workspaceId,
      entityType: "User",
      entityId: user.id,
      reason: input.isActive ? "Directory user account reactivated." : "Directory user account deactivated.",
      metadata: { targetEmail: user.email, isActive: input.isActive },
    });
  }
}

export async function updateDirectoryUserManagementStatus(input: {
  requesterRole: Role;
  userId: string;
  isManagement: boolean;
}) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to update management status.");
  }
  const user = await getDb().user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      memberships: {
        where: { isActive: true },
        select: { organization: { select: { organizationType: true } }, areaOfficeId: true },
      },
    },
  });
  if (!user) throw new Error("Selected user was not found.");
  const isItfStaff = user.memberships.some(
    (membership) => membership.organization?.organizationType === "ITF_INTERNAL" || membership.areaOfficeId,
  );
  if (input.isManagement && !isItfStaff) {
    throw new Error("Assign the user to Headquarters or an Area Office before enabling management access.");
  }
  await getDb().user.update({
    where: { id: user.id },
    data: { isManagement: input.isManagement },
  });
}

export async function importDirectoryUsers(input: ImportDirectoryUsersInput) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to import users.");
  }

  const parsedRows = await parseUserCsvFile(input.file);
  const db = getDb();
  const workspace = await getStaffWorkspace();
  const organization = await db.organization.findFirst({ where: { workspaceId: workspace.id, organizationType: "ITF_INTERNAL", isActive: true }, select: { id: true } });
  if (!organization) throw new Error("Create the ITF Headquarters organization before importing staff.");
  const [offices, options] = await Promise.all([
    db.areaOffice.findMany({ where: { workspaceId: workspace.id, isActive: true }, select: { id: true, name: true, code: true, slug: true } }),
    listStaffDirectoryOptions(input.requesterRole),
  ]);
  const assignments = parsedRows.map((row, index) => {
    const officeName = row.office?.toLowerCase();
    const headquarters = officeName === "headquarters" || officeName === "hq";
    const office = headquarters ? null : offices.find((item) => [item.name, item.code, item.slug].some((value) => value?.toLowerCase() === officeName));
    if (!headquarters && !office) throw new Error(`Row ${index + 2}: office “${row.office}” was not found among active Area Offices.`);
    const allowedRoles: readonly string[] = headquarters ? getHeadquartersOfficerRoles() : getAreaOfficeOfficerRoles();
    if (!row.role || !allowedRoles.includes(row.role)) throw new Error(`Row ${index + 2}: role “${row.role}” is not valid for ${headquarters ? "Headquarters" : "an Area Office"}.`);
    for (const [kind, value] of [["DEPARTMENT", row.department], ["JOB_TITLE", row.jobTitle]] as const) {
      if (value && !options.some((item) => item.kind === kind && item.isActive && item.key === value.toLowerCase())) {
        throw new Error(`Row ${index + 2}: ${kind === "DEPARTMENT" ? "department" : "job title"} “${value}” is not configured.`);
      }
    }
    return { officeId: office?.id ?? null, role: row.role as Role };
  });
  const credentials: { row: ParsedUserCsvRow; temporaryPassword: string; passwordHash: string }[] = [];
  for (let index = 0; index < parsedRows.length; index += 4) {
    credentials.push(...await Promise.all(parsedRows.slice(index, index + 4).map(async (row) => {
      const temporaryPassword = generateTemporaryPassword();
      return { row, temporaryPassword, passwordHash: await hashTemporaryPassword(temporaryPassword) };
    })));
  }

  return db.$transaction(async (tx) => {
    const existing = await tx.user.findMany({
      where: { email: { in: parsedRows.map((row) => row.email) } },
      select: { email: true },
    });
    if (existing.length > 0) {
      throw new Error(`User already exists: ${existing.map((user) => user.email).join(", ")}.`);
    }

    const provisioned = [];
    for (const [index, credential] of credentials.entries()) {
      await assertStaffNumberAvailable(credential.row.staffNumber, credential.row.email);
      const user = await tx.user.create({
        data: {
          email: credential.row.email,
          name: credential.row.name,
          staffNumber: credential.row.staffNumber,
          phoneNumber: credential.row.phoneNumber,
          department: credential.row.department,
          jobTitle: credential.row.jobTitle,
          passwordHash: credential.passwordHash,
          emailVerifiedAt: new Date(),
          authenticationSource: "LOCAL",
          mustChangePassword: true,
          provisionedAt: new Date(),
          isActive: true,
        },
        select: { id: true, email: true, name: true },
      });
      const assignment = assignments[index];
      await tx.membership.create({ data: {
        userId: user.id,
        workspaceId: workspace.id,
        organizationId: organization.id,
        areaOfficeId: assignment.officeId,
        role: assignment.role,
      } });
      provisioned.push({ ...user, temporaryPassword: credential.temporaryPassword });
    }

    return {
      imported: parsedRows.length,
      provisioned,
    };
  }, { timeout: 30_000 });
}

function normalizeDirectoryUser(input: CreateDirectoryUserInput): ParsedUserCsvRow {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);

  if (!name) {
    throw new Error("Full name is required.");
  }

  if (!email) {
    throw new Error("Email address is required.");
  }

  return {
    name,
    email,
    staffNumber: normalizeOptionalString(input.staffNumber),
    phoneNumber: normalizeOptionalString(input.phoneNumber),
    department: normalizeOptionalString(input.department),
    jobTitle: normalizeOptionalString(input.jobTitle),
  };
}

async function assertStaffNumberAvailable(staffNumber: string | undefined, email: string) {
  if (!staffNumber) {
    return;
  }

  const existingUser = await getDb().user.findUnique({
    where: {
      staffNumber,
    },
    select: {
      email: true,
    },
  });

  if (existingUser && existingUser.email.toLowerCase() !== email) {
    throw new Error(`Staff number ${staffNumber} already belongs to another user.`);
  }
}

async function assertUserExists(userId: string) {
  const user = await getDb().user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    throw new Error("Selected user was not found.");
  }
}

async function assertEmailAvailable(email: string, userId: string) {
  const existingUser = await getDb().user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });

  if (existingUser && existingUser.id !== userId) {
    throw new Error(`Email address ${email} already belongs to another user.`);
  }
}

async function assertStaffNumberAvailableForUser(staffNumber: string | undefined, userId: string) {
  if (!staffNumber) {
    return;
  }

  const existingUser = await getDb().user.findUnique({
    where: {
      staffNumber,
    },
    select: {
      id: true,
    },
  });

  if (existingUser && existingUser.id !== userId) {
    throw new Error(`Staff number ${staffNumber} already belongs to another user.`);
  }
}

async function parseUserCsvFile(file: File) {
  const safeFileName = sanitizeFileName(file.name);

  if (!safeFileName.toLowerCase().endsWith(".csv")) {
    throw new Error("User import must be a CSV file.");
  }

  if (file.size === 0) {
    throw new Error("User import CSV is empty.");
  }

  if (file.size > maxUploadBytes) {
    throw new Error("User import CSV exceeds the 10 MB limit.");
  }

  const content = Buffer.from(await file.arrayBuffer()).toString("utf8").replace(/^\uFEFF/, "");

  if (content.includes("\uFFFD")) {
    throw new Error("User import CSV must be valid UTF-8 text.");
  }

  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("User import CSV must include a header row and at least one user row.");
  }
  if (lines.length > 51) throw new Error("User import may contain at most 50 staff rows per batch.");

  const headers = parseCsvLine(lines[0]).map(normalizeCsvHeader);
  const missingColumns = userCsvColumns.filter((column) => !headers.includes(column));

  if (missingColumns.length > 0) {
    throw new Error(`User import CSV is missing columns: ${missingColumns.join(", ")}.`);
  }

  const rows = lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex] ?? ""]));
    const parsedRow = normalizeDirectoryUser({
      requesterRole: "SYSTEM_ADMIN",
      name: row["full name"],
      staffNumber: row["staff number"],
      email: row["email address"],
      phoneNumber: row["phone number"],
      department: row.department,
      jobTitle: row["job title"],
    });

    if (!parsedRow.email.includes("@")) {
      throw new Error(`Row ${index + 2} has an invalid email address.`);
    }

    const office = row.office?.trim();
    const role = row.role?.trim().toUpperCase().replace(/\s+/g, "_");
    if (!office || !role) throw new Error(`Row ${index + 2} requires both office and role.`);
    return { ...parsedRow, office, role };
  });

  const seenEmails = new Set<string>();
  const seenStaffNumbers = new Set<string>();

  for (const row of rows) {
    if (seenEmails.has(row.email)) {
      throw new Error(`Duplicate email address in CSV: ${row.email}.`);
    }

    seenEmails.add(row.email);

    if (row.staffNumber) {
      if (seenStaffNumbers.has(row.staffNumber)) {
        throw new Error(`Duplicate staff number in CSV: ${row.staffNumber}.`);
      }

      seenStaffNumbers.add(row.staffNumber);
    }
  }

  return rows;
}

function normalizeEmail(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeOptionalString(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function normalizeCsvHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);

  return values;
}
