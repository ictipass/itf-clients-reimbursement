import { getDb } from "@/lib/db";
import { can, type Role } from "@/lib/rbac";

const managedNumberTypes = [
  "ITF_EMPLOYER_NUMBER",
  "REGISTRATION_CERTIFICATE_NUMBER",
] as const;

export type ManagedNumberType = (typeof managedNumberTypes)[number];

export type CreateManagedNumbersInput = {
  requesterEmail: string;
  requesterRole: Role;
  workspaceId: string;
  type: ManagedNumberType;
  values: string[];
  policyCode?: string;
  batchCode?: string;
  notes?: string;
};

export type ListAvailableManagedNumbersInput = {
  requesterRole: Role;
  workspaceId: string;
  type: ManagedNumberType;
};

export function getManagedNumberTypes() {
  return managedNumberTypes;
}

export async function listManagedNumberWorkspaces() {
  const db = getDb();

  return db.workspace.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function listManagedNumbers(input: { requesterRole: Role }) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to manage registration numbers.");
  }

  const db = getDb();

  return db.managedRegistrationNumber.findMany({
    where: {
      recordTier: "HOT",
    },
    select: {
      id: true,
      type: true,
      value: true,
      status: true,
      policyCode: true,
      batchCode: true,
      notes: true,
      issuedAt: true,
      reservedAt: true,
      voidedAt: true,
      voidReason: true,
      createdAt: true,
      workspace: {
        select: {
          name: true,
        },
      },
      assignedCompany: {
        select: {
          id: true,
          legalName: true,
        },
      },
      assignedCertificate: {
        select: {
          id: true,
          certificateNumber: true,
        },
      },
      createdBy: {
        select: {
          name: true,
        },
      },
      issuedBy: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { type: "asc" }, { createdAt: "desc" }],
  });
}

export async function listAvailableManagedNumbers(input: ListAvailableManagedNumbersInput) {
  if (!can(input.requesterRole, "registry:review")) {
    throw new Error("You do not have permission to select registration numbers.");
  }

  const db = getDb();

  return db.managedRegistrationNumber.findMany({
    where: {
      workspaceId: input.workspaceId,
      type: input.type,
      status: "AVAILABLE",
      recordTier: "HOT",
    },
    select: {
      id: true,
      value: true,
      policyCode: true,
      batchCode: true,
    },
    orderBy: [{ policyCode: "asc" }, { batchCode: "asc" }, { value: "asc" }],
    take: 100,
  });
}

export async function createManagedNumbers(input: CreateManagedNumbersInput) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to manage registration numbers.");
  }

  if (!managedNumberTypes.includes(input.type)) {
    throw new Error("Unsupported managed number type.");
  }

  const values = Array.from(new Set(input.values.map(normalizeManagedNumber).filter(Boolean)));

  if (values.length === 0) {
    throw new Error("At least one registration number is required.");
  }

  const db = getDb();
  const [workspace, creator] = await Promise.all([
    db.workspace.findFirst({
      where: {
        id: input.workspaceId,
        isActive: true,
      },
      select: {
        id: true,
      },
    }),
    db.user.findUnique({
      where: {
        email: input.requesterEmail,
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!workspace) {
    throw new Error("Workspace was not found.");
  }

  if (!creator) {
    throw new Error("Creator user was not found.");
  }

  const policyCode = input.policyCode?.trim() || undefined;
  const batchCode = input.batchCode?.trim() || undefined;
  const notes = input.notes?.trim() || undefined;

  return db.$transaction(
    values.map((value) =>
      db.managedRegistrationNumber.upsert({
        where: {
          workspaceId_type_value: {
            workspaceId: workspace.id,
            type: input.type,
            value,
          },
        },
        create: {
          workspaceId: workspace.id,
          type: input.type,
          value,
          policyCode,
          batchCode,
          notes,
          createdById: creator.id,
        },
        update: {
          policyCode,
          batchCode,
          notes,
        },
        select: {
          id: true,
        },
      }),
    ),
  );
}

function normalizeManagedNumber(value: string) {
  return value.trim().replace(/\s+/g, " ");
}
