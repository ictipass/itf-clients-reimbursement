import ExcelJS from "exceljs";

import { getDb } from "@/lib/db";
import { assertUploadRateLimit } from "@/lib/rate-limit";
import { can, isItfRole, type Role } from "@/lib/rbac";
import { uploadObject } from "@/lib/storage";
import { maxUploadBytes, sanitizeFileName, validateUpload } from "@/lib/storage/security";

const trainingPlanEvidenceKinds = ["TRAINING_PLAN_DOCUMENT", "LD_PERSONNEL_CV"] as const;
const requiredTrainingPlanCsvColumns = [
  "name of staff",
  "department",
  "gap identified",
  "training title",
  "estimated cost",
  "date",
  "location",
  "trainer",
] as const;

export type TrainingPlanEvidenceKind = (typeof trainingPlanEvidenceKinds)[number];

export type TrainingPlanPersonnelInput = {
  name: string;
  position?: string;
  email?: string;
  phone?: string;
};

export type CreateTrainingPlanSubmissionInput = {
  companyId: string;
  requesterEmail: string;
  requesterRole: Role;
  year: number;
  personnel: TrainingPlanPersonnelInput[];
  trainingPlanSummary?: string;
};

export type SubmitTrainingPlanSubmissionInput = {
  companyId: string;
  submissionId: string;
  requesterEmail: string;
  requesterRole: Role;
  note?: string;
};

const trainingPlanDeskTransitions = [
  "am_to_hot",
  "hot_to_ro",
  "ro_to_hot",
  "hot_to_am",
  "am_to_company",
  "hot_to_company",
  "ro_to_company",
  "am_approve",
] as const;

export type TrainingPlanDeskTransition = (typeof trainingPlanDeskTransitions)[number];

export type RouteTrainingPlanSubmissionInput = {
  companyId: string;
  submissionId: string;
  requesterEmail: string;
  requesterRole: Role;
  transition: TrainingPlanDeskTransition;
  note?: string;
  recommendation?: "APPROVE" | "REJECT";
  assigneeUserId?: string;
};

export async function listAssignableTrainingPlanReimbursementOfficers(workspaceId: string, areaOfficeId: string | null) {
  if (!areaOfficeId) return [];
  return getDb().user.findMany({
    where: {
      isActive: true,
      memberships: { some: { isActive: true, role: "REIMBURSEMENT_OFFICER", workspaceId, areaOfficeId } },
    },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
}

export function resolveTrainingPlanOfficerAssignment(officers: readonly { id: string }[], requestedId?: string) {
  if (!officers.length) throw new Error("No active Reimbursement Officer is assigned to this Area Office.");
  if (!requestedId && officers.length > 1) throw new Error("Select the Reimbursement Officer who will receive this Training Plan.");
  const officer = officers.find((candidate) => candidate.id === (requestedId ?? officers[0].id));
  if (!officer) throw new Error("The selected Reimbursement Officer is not active in this Area Office.");
  return officer.id;
}

export type UploadTrainingPlanEvidenceInput = {
  companyId: string;
  submissionId: string;
  uploadedByEmail: string;
  requesterRole: Role;
  kind: TrainingPlanEvidenceKind;
  file: File;
};

export type ImportTrainingPlanCsvInput = {
  companyId: string;
  submissionId: string;
  requesterEmail: string;
  requesterRole: Role;
  file: File;
};

export function getTrainingPlanEvidenceKinds() {
  return trainingPlanEvidenceKinds;
}

export function getTrainingPlanCsvTemplate() {
  return [
    requiredTrainingPlanCsvColumns.join(","),
    "Ada Okafor,Finance,Advanced spreadsheet analysis,Financial modelling,250000,2026-08-15,Lagos,Example Training Ltd",
    "Musa Bello,Operations,Supervisory skills,Frontline leadership,180000,2026-09-10,Abuja,Example Learning Hub",
    "",
  ].join("\n");
}

export function parseTrainingPlanDate(value: string): Date | null {
  if (!value) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const excel = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!iso && !excel) throw new Error("Use YYYY-MM-DD or DD/MM/YYYY for training dates.");
  const year = Number(iso?.[1] ?? excel?.[3]);
  const month = Number(iso?.[2] ?? excel?.[2]);
  const day = Number(iso?.[3] ?? excel?.[1]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error("Training date is not a valid calendar date.");
  }
  return date;
}

export function getTrainingPlanDeskTransitions() {
  return trainingPlanDeskTransitions;
}

function normalizeTrainingPlanReviewDesk(desk: string | null | undefined) {
  if (
    desk === "AREA_MANAGER" ||
    desk === "HEAD_OF_TRAINING" ||
    desk === "REIMBURSEMENT_OFFICER"
  ) {
    return desk;
  }

  return "AREA_MANAGER";
}

function normalizeTrainingPlanReviewStatus(status: string | null | undefined) {
  return status === "IN_REVIEW" ? "IN_REVIEW" : "SUBMITTED";
}

function getTrainingPlanDeskWorkItem(desk: "AREA_MANAGER" | "HEAD_OF_TRAINING" | "REIMBURSEMENT_OFFICER") {
  if (desk === "HEAD_OF_TRAINING") {
    return {
      assignedRole: "HEAD_OF_TRAINING" as const,
      sourceSuffix: "head-of-training-review",
      title: "Resume Training Plan and L&D review",
      summary: "resubmitted Training Plan and L&D corrections for Head of Training review.",
    };
  }

  if (desk === "REIMBURSEMENT_OFFICER") {
    return {
      assignedRole: "REIMBURSEMENT_OFFICER" as const,
      sourceSuffix: "reimbursement_officer",
      title: "Resume Training Plan and L&D evidence review",
      summary: "resubmitted Training Plan and L&D corrections for Reimbursement Officer review.",
    };
  }

  return {
    assignedRole: "AREA_MANAGER" as const,
    sourceSuffix: "area-manager-review",
    title: "Review Training Plan and L&D submission",
    summary: "resubmitted Training Plan and L&D corrections for Area Manager review.",
  };
}

function parseTrainingPlanCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one training plan row.");
  }

  const headers = parseCsvLine(lines[0]).map(normalizeCsvHeader);
  const records = lines.slice(1).map((line, index) => ({
    rowNumber: index + 2,
    values: parseCsvLine(line).map((value) => value.trim()),
  }));

  return parseTrainingPlanRows(headers, records, "CSV");
}

function parseTrainingPlanRows(
  headers: string[],
  records: Array<{ rowNumber: number; values: string[] }>,
  source: "CSV" | "Excel",
) {
  const missingColumns = requiredTrainingPlanCsvColumns.filter((column) => !headers.includes(column));

  if (missingColumns.length > 0) {
    throw new Error(`Missing required ${source} column(s): ${missingColumns.join(", ")}.`);
  }

  return records.map(({ rowNumber, values }) => {
    if (values.length !== headers.length) {
      throw new Error(`${source} row ${rowNumber} has ${values.length} columns instead of ${headers.length}.`);
    }

    const row = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex]]));
    const estimatedCost = Number(row["estimated cost"]);
    let plannedDate: Date | null;
    try {
      plannedDate = parseTrainingPlanDate(row.date);
    } catch {
      throw new Error(`${source} row ${rowNumber} has an invalid date. Use YYYY-MM-DD or DD/MM/YYYY.`);
    }

    if (!Number.isFinite(estimatedCost) || estimatedCost < 0) {
      throw new Error(`${source} row ${rowNumber} has an invalid estimated cost.`);
    }

    return {
      staffName: row["name of staff"],
      department: row.department,
      gapIdentified: row["gap identified"],
      trainingTitle: row["training title"],
      estimatedCost,
      plannedDate,
      location: row.location,
      trainer: row.trainer,
      rowNumber,
    };
  });
}

async function parseTrainingPlanXlsx(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    throw new Error("Training plan Excel workbook could not be opened. Save it as a valid .xlsx file.");
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    throw new Error("Excel workbook must contain a header row and at least one training plan row on its first sheet.");
  }

  const headerRow = sheet.getRow(1);
  const headers = Array.from({ length: headerRow.cellCount }, (_, index) =>
    normalizeCsvHeader(readTrainingPlanCell(headerRow.getCell(index + 1).value, index + 1, "header", workbook.properties.date1904)),
  );
  const records: Array<{ rowNumber: number; values: string[] }> = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    for (let column = headers.length + 1; column <= row.cellCount; column += 1) {
      const extraValue = row.getCell(column).value;
      if (extraValue !== null && extraValue !== undefined && extraValue !== "") {
        throw new Error(`Excel row ${rowNumber} has a value beyond the header columns.`);
      }
    }
    const values = headers.map((header, index) =>
      readTrainingPlanCell(row.getCell(index + 1).value, rowNumber, header, workbook.properties.date1904),
    );
    if (values.some(Boolean)) {
      records.push({ rowNumber, values });
    }
  }

  if (records.length === 0) {
    throw new Error("Excel workbook must contain at least one training plan row on its first sheet.");
  }

  return parseTrainingPlanRows(headers, records, "Excel");
}

export async function parseTrainingPlanDocument(buffer: Buffer, fileName: string, mimeType: string) {
  const validated = validateTrainingPlanDocumentUpload(buffer, fileName, mimeType);
  const rows = validated.extension === ".xlsx"
    ? await parseTrainingPlanXlsx(buffer)
    : parseTrainingPlanCsv(buffer.toString("utf8").replace(/^\uFEFF/, ""));
  return { validated, rows };
}

function readTrainingPlanCell(value: ExcelJS.CellValue, rowNumber: number, column: string, date1904?: boolean) {
  if (value === null || value === undefined) return "";

  if (value instanceof Date) {
    if (column !== "date") throw new Error(`Excel row ${rowNumber}: ${column} must be text or a number.`);
    return value.toISOString().slice(0, 10);
  }

  if (column === "date" && typeof value === "number") {
    if (!Number.isInteger(value) || value < 1 || value > 2958465) {
      throw new Error(`Excel row ${rowNumber} has an invalid date.`);
    }
    const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
    return new Date(epoch + value * 86_400_000).toISOString().slice(0, 10);
  }

  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  throw new Error(`Excel row ${rowNumber}: ${column} must be a plain value, not a formula or formatted object.`);
}

export async function createTrainingPlanSubmission(input: CreateTrainingPlanSubmissionInput) {
  if (input.requesterRole !== "EMPLOYER_ADMIN" && input.requesterRole !== "EMPLOYER_SUBMITTER") {
    throw new Error("You do not have permission to create training plan submissions.");
  }

  const db = getDb();
  const company = await db.company.findFirst({
    where: {
      id: input.companyId,
      recordTier: "HOT",
      isActive: true,
      status: "ACTIVE",
      itfEmployerNumber: {
        not: null,
      },
    },
    select: {
      id: true,
      organizationId: true,
    },
  });

  if (!company) {
    throw new Error("A registered active company is required before training plan submission.");
  }

  const requester = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      id: true,
      memberships: {
        where: { isActive: true },
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!requester) {
    throw new Error("User account was not found.");
  }

  const hasOrganizationAccess =
    isItfRole(input.requesterRole) ||
    requester.memberships.some((membership) => membership.organizationId === company.organizationId);

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to this company's training plan submissions.");
  }

  const existingSubmission = await db.trainingPlanSubmission.findUnique({
    where: {
      companyId_year: {
        companyId: company.id,
        year: input.year,
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (existingSubmission) {
    throw new Error(
      `A Training Plan and L&D submission already exists for ${input.year}. Open the existing submission instead of creating another one for the same year.`,
    );
  }


  return db.trainingPlanSubmission.create({
    data: {
      companyId: company.id,
      year: input.year,
      trainingPlanSummary: input.trainingPlanSummary,
      dueDate: getTrainingPlanDueDate(input.year),
      status: "DRAFT",
      personnel: {
        create: input.personnel.map((person) => ({
          name: person.name,
          position: person.position,
          email: person.email,
          phone: person.phone,
        })),
      },
    },
    select: {
      id: true,
    },
  });
}

export async function importTrainingPlanCsv(input: ImportTrainingPlanCsvInput) {
  if (!can(input.requesterRole, "training:submit")) {
    throw new Error("You do not have permission to import training plan rows.");
  }

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const fileName = sanitizeFileName(input.file.name);
  const { rows } = await parseTrainingPlanDocument(buffer, fileName, input.file.type);
  const db = getDb();
  const submission = await db.trainingPlanSubmission.findFirst({
    where: {
      id: input.submissionId,
      companyId: input.companyId,
      recordTier: "HOT",
      status: {
        in: ["DRAFT", "CHANGES_REQUESTED"],
      },
      company: {
        id: input.companyId,
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      company: {
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!submission) {
    throw new Error("Training Plan submission was not found or is no longer editable.");
  }

  const requester = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      memberships: {
        where: { isActive: true },
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!requester) {
    throw new Error("User account was not found.");
  }

  const hasOrganizationAccess =
    isItfRole(input.requesterRole) ||
    requester.memberships.some(
      (membership) => membership.organizationId === submission.company.organizationId,
    );

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to this Training Plan submission.");
  }

  return db.$transaction(async (tx) => {
    await tx.trainingPlanLineItem.deleteMany({
      where: {
        trainingPlanSubmissionId: submission.id,
      },
    });

    await tx.trainingPlanLineItem.createMany({
      data: rows.map((row) => ({
        trainingPlanSubmissionId: submission.id,
        staffName: row.staffName,
        department: row.department,
        gapIdentified: row.gapIdentified,
        trainingTitle: row.trainingTitle,
        estimatedCost: row.estimatedCost,
        plannedDate: row.plannedDate,
        location: row.location,
        trainer: row.trainer,
        rowNumber: row.rowNumber,
      })),
    });

    return {
      importedRows: rows.length,
    };
  });
}

export async function getTrainingPlanSubmissionForUpload(companyId: string, submissionId: string) {
  const db = getDb();

  return db.trainingPlanSubmission.findFirst({
    where: {
      id: submissionId,
      companyId,
      recordTier: "HOT",
      company: {
        id: companyId,
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      year: true,
      status: true,
      company: {
        select: {
          id: true,
          legalName: true,
        },
      },
    },
  });
}

export async function uploadTrainingPlanEvidence(input: UploadTrainingPlanEvidenceInput) {
  return uploadTrainingPlanEvidenceBatch({
    companyId: input.companyId,
    submissionId: input.submissionId,
    uploadedByEmail: input.uploadedByEmail,
    requesterRole: input.requesterRole,
    files: [{ kind: input.kind, file: input.file }],
  });
}

export async function uploadTrainingPlanEvidenceBatch(input: Omit<UploadTrainingPlanEvidenceInput, "kind" | "file"> & {
  files: Array<Pick<UploadTrainingPlanEvidenceInput, "kind" | "file">>;
}) {
  if (!can(input.requesterRole, "training:submit")) {
    throw new Error("You do not have permission to upload training plan evidence.");
  }
  if (input.files.length < 1 || input.files.length > 2 || new Set(input.files.map((item) => item.kind)).size !== input.files.length ||
      input.files.some((item) => !trainingPlanEvidenceKinds.includes(item.kind))) {
    throw new Error("Select one file for each training plan evidence type.");
  }

  await assertUploadRateLimit(input.uploadedByEmail);

  const db = getDb();
  const submission = await db.trainingPlanSubmission.findFirst({
    where: {
      id: input.submissionId,
      companyId: input.companyId,
      recordTier: "HOT",
      status: { in: ["DRAFT", "CHANGES_REQUESTED"] },
      company: {
        id: input.companyId,
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      year: true,
      companyId: true,
      company: {
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!submission) {
    throw new Error("Training plan submission was not found.");
  }

  const user = await db.user.findUnique({
    where: {
      email: input.uploadedByEmail,
    },
    select: {
      id: true,
      memberships: {
        where: { isActive: true },
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("Upload user was not found.");
  }

  const hasOrganizationAccess =
    isItfRole(input.requesterRole) ||
    user.memberships.some((membership) => membership.organizationId === submission.company.organizationId);

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to this training plan submission.");
  }

  const prepared = await Promise.all(input.files.map(async ({ kind, file }) => {
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = sanitizeFileName(file.name);
    const { validated, rows } = kind === "TRAINING_PLAN_DOCUMENT"
      ? await parseTrainingPlanDocument(buffer, fileName, file.type)
      : { validated: validateUpload(buffer, fileName, file.type), rows: null };
    return { kind, buffer, fileName, validated, rows };
  }));
  if (prepared.some((item) => item.rows) && await db.trainingRequest.count({
    where: { trainingPlanLineItem: { trainingPlanSubmissionId: submission.id } },
  }) > 0) {
    throw new Error("Training plan rows are linked to training requests and cannot be replaced.");
  }
  const storedFiles: Array<(typeof prepared)[number] & { stored: Awaited<ReturnType<typeof uploadObject>> }> = [];
  for (const item of prepared) {
    const stored = await uploadObject({
      buffer: item.buffer,
      companyId: submission.companyId,
      extension: item.validated.extension,
      mimeType: item.validated.mimeType,
      namespace: "training-plan-submissions",
    });
    storedFiles.push({ ...item, stored });
  }

  return db.$transaction(async (tx) => {
    const csv = storedFiles.find((item) => item.kind === "TRAINING_PLAN_DOCUMENT");
    if (csv?.rows) {
      await tx.trainingPlanLineItem.deleteMany({ where: { trainingPlanSubmissionId: submission.id } });
      await tx.trainingPlanLineItem.createMany({
        data: csv.rows.map((row) => ({ trainingPlanSubmissionId: submission.id, ...row })),
      });
    }
    const documents = [];
    for (const item of storedFiles) {
      await tx.document.updateMany({
        where: { trainingPlanSubmissionId: submission.id, kind: item.kind, isActive: true },
        data: { isActive: false },
      });
      const stored = item.stored;
      documents.push(await tx.document.create({
        data: {
          organizationId: submission.company.organizationId,
          companyId: submission.companyId,
          trainingPlanSubmissionId: submission.id,
          uploadedById: user.id,
          kind: item.kind,
          fileName: item.fileName,
          storageProvider: stored.storageProvider,
          scanStatus: stored.scanStatus,
          scannedAt: stored.scannedAt,
          scanReason: stored.scanReason,
          bucket: stored.bucket,
          objectKey: stored.objectKey,
          url: stored.url,
          etag: stored.etag,
          versionId: stored.versionId,
          checksum: stored.checksum,
          mimeType: stored.mimeType,
          fileSize: stored.fileSize,
          access: "PRIVATE",
          classification: "OFFICIAL",
        },
        select: { id: true },
      }));
    }
    return documents;
  });
}

export async function submitTrainingPlanSubmission(input: SubmitTrainingPlanSubmissionInput) {
  if (!can(input.requesterRole, "training:submit")) {
    throw new Error("You do not have permission to submit training plans.");
  }

  const db = getDb();
  const submission = await db.trainingPlanSubmission.findFirst({
    where: {
      id: input.submissionId,
      companyId: input.companyId,
      recordTier: "HOT",
      status: {
        in: ["DRAFT", "CHANGES_REQUESTED"],
      },
      company: {
        id: input.companyId,
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      year: true,
      companyId: true,
      dueDate: true,
      correctionReturnDesk: true,
      correctionReturnStatus: true,
      documents: {
        where: {
          isActive: true,
          recordTier: "HOT",
        },
        select: {
          kind: true,
        },
      },
      company: {
        select: {
          organizationId: true,
          areaOfficeId: true,
          legalName: true,
          organization: {
            select: {
              workspaceId: true,
            },
          },
        },
      },
    },
  });

  if (!submission) {
    throw new Error("Draft training plan submission was not found.");
  }

  const submittedKinds = new Set(submission.documents.map((document) => document.kind));
  const missingKinds = trainingPlanEvidenceKinds.filter((kind) => !submittedKinds.has(kind));

  if (missingKinds.length > 0) {
    throw new Error(`Upload required evidence before submission: ${missingKinds.join(", ")}.`);
  }

  const actor = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      id: true,
      memberships: {
        where: { isActive: true },
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!actor) {
    throw new Error("User account was not found.");
  }

  const hasOrganizationAccess =
    isItfRole(input.requesterRole) ||
    actor.memberships.some((membership) => membership.organizationId === submission.company.organizationId);

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to this training plan submission.");
  }


  const submittedAt = new Date();
  const promptSubmissionScore = submittedAt <= submission.dueDate ? "1.00" : "0.00";

  return db.$transaction(async (tx) => {
    const targetDesk = normalizeTrainingPlanReviewDesk(submission.correctionReturnDesk);
    const targetStatus = normalizeTrainingPlanReviewStatus(submission.correctionReturnStatus);
    const workItem = getTrainingPlanDeskWorkItem(targetDesk);
    const workItemSummary = submission.correctionReturnDesk
      ? `${submission.company.legalName} ${workItem.summary}`
      : `${submission.company.legalName} submitted the ${submission.year} Training Plan and L&D package.`;
    const updated = await tx.trainingPlanSubmission.update({
      where: {
        id: submission.id,
      },
      data: {
        status: targetStatus,
        currentDesk: targetDesk,
        correctionReturnDesk: null,
        correctionReturnStatus: null,
        submittedAt,
        promptSubmissionScore,
      },
      select: {
        id: true,
      },
    });

    await tx.decision.create({
      data: {
        actorId: actor.id,
        companyId: submission.companyId,
        trainingPlanSubmissionId: submission.id,
        action: "SUBMIT",
        reason: input.note,
      },
    });

    await tx.workItem.updateMany({
      where: { trainingPlanSubmissionId: submission.id, status: "OPEN" },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });

    await tx.workItem.upsert({
      where: {
        sourceKey: `training-plan:${submission.id}:${workItem.sourceSuffix}`,
      },
      create: {
        workspaceId: submission.company.organization.workspaceId,
        organizationId: submission.company.organizationId,
        areaOfficeId: submission.company.areaOfficeId,
        companyId: submission.companyId,
        trainingPlanSubmissionId: submission.id,
        assignedRole: workItem.assignedRole,
        app: "REIMBURSEMENT",
        kind: "TRAINING_PLAN_REVIEW",
        status: "OPEN",
        priority: "NORMAL",
        title: workItem.title,
        summary: workItemSummary,
        targetHref: `/registry/${submission.companyId}`,
        sourceKey: `training-plan:${submission.id}:${workItem.sourceSuffix}`,
      },
      update: {
        status: "OPEN",
        resolvedAt: null,
        priority: "NORMAL",
        summary: workItemSummary,
        targetHref: `/registry/${submission.companyId}`,
      },
      select: {
        id: true,
      },
    });

    return updated;
  });
}

export async function routeTrainingPlanSubmission(input: RouteTrainingPlanSubmissionInput) {
  if (!can(input.requesterRole, "training:approve")) {
    throw new Error("You do not have permission to route training plan submissions.");
  }

  const transition = resolveTrainingPlanTransition(input.transition);

  if (!hasTrainingPlanRoutingRole(input.requesterRole, transition.allowedRoles)) {
    throw new Error(`Only ${transition.allowedRoles.join(" or ")} can perform this action.`);
  }

  const db = getDb();
  const submission = await db.trainingPlanSubmission.findFirst({
    where: {
      id: input.submissionId,
      companyId: input.companyId,
      recordTier: "HOT",
      status: {
        in: [...transition.allowedStatuses],
      },
      currentDesk: transition.from,
      company: {
        id: input.companyId,
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      year: true,
      companyId: true,
      currentDesk: true,
      status: true,
      company: {
        select: {
          legalName: true,
          organizationId: true,
          areaOfficeId: true,
          organization: {
            select: {
              workspaceId: true,
            },
          },
        },
      },
    },
  });

  if (!submission) {
    throw new Error("A training plan submission awaiting this action was not found.");
  }

  const actor = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      id: true,
      memberships: {
        where: { isActive: true },
        select: {
          areaOfficeId: true,
          role: true,
        },
      },
    },
  });

  if (!actor) {
    throw new Error("User account was not found.");
  }

  if (
    !hasAreaOfficeTrainingPlanAccess({
      requesterRole: input.requesterRole,
      areaOfficeId: submission.company.areaOfficeId,
      memberships: actor.memberships,
    })
  ) {
    throw new Error("You do not have access to this Area Office training plan submission.");
  }

  let assignedRoWorkItemId: string | null = null;
  if (submission.currentDesk === "REIMBURSEMENT_OFFICER" && !["SYSTEM_ADMIN", "WORKSPACE_APP_ADMIN"].includes(input.requesterRole)) {
    const currentWorkItem = await db.workItem.findFirst({
      where: { trainingPlanSubmissionId: submission.id, assignedRole: "REIMBURSEMENT_OFFICER", status: "OPEN", recordTier: "HOT" },
      select: { id: true, assignedUserId: true },
    });
    if (currentWorkItem?.assignedUserId && currentWorkItem.assignedUserId !== actor.id) {
      throw new Error("This Training Plan is assigned to another Reimbursement Officer.");
    }
    if (currentWorkItem?.assignedUserId) assignedRoWorkItemId = currentWorkItem.id;
  }

  const assignedUserId = input.transition === "hot_to_ro"
    ? resolveTrainingPlanOfficerAssignment(
        await listAssignableTrainingPlanReimbursementOfficers(
          submission.company.organization.workspaceId,
          submission.company.areaOfficeId,
        ),
        input.assigneeUserId,
      )
    : null;

  if (input.transition === "ro_to_hot" && !["APPROVE", "REJECT"].includes(input.recommendation ?? "")) {
    throw new Error("Select approval or rejection before returning this Training Plan to HOT.");
  }
  if (input.transition === "ro_to_hot" && input.recommendation === "REJECT" && !input.note?.trim()) {
    throw new Error("Enter a rejection remark before returning this Training Plan to HOT.");
  }
  if (input.transition === "ro_to_company" && !input.note?.trim()) {
    throw new Error("Enter a correction remark before requesting employer correction.");
  }

  return db.$transaction(async (tx) => {
    if (assignedRoWorkItemId) {
      const claimed = await tx.workItem.updateMany({
        where: { id: assignedRoWorkItemId, assignedUserId: actor.id, status: "OPEN" },
        data: { status: "RESOLVED", resolvedAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error("This Training Plan was reassigned or routed by someone else. Reload and try again.");
    }
    const updated = await tx.trainingPlanSubmission.update({
      where: {
        id: submission.id,
      },
      data: {
        currentDesk: transition.to,
        status: transition.nextStatus,
        correctionReturnDesk:
          transition.nextStatus === "CHANGES_REQUESTED" ? transition.from : null,
        correctionReturnStatus:
          transition.nextStatus === "CHANGES_REQUESTED" ? submission.status : null,
        approvedAt: transition.nextStatus === "APPROVED" ? new Date() : undefined,
      },
      select: {
        id: true,
      },
    });

    await tx.decision.create({
      data: {
        actorId: actor.id,
        companyId: submission.companyId,
        trainingPlanSubmissionId: submission.id,
        action: transition.action,
        reason: [transition.reason, input.transition === "ro_to_hot" ? `${input.recommendation} recommendation` : null, input.note].filter(Boolean).join(": "),
      },
    });

    await tx.workItem.updateMany({
      where: {
        trainingPlanSubmissionId: submission.id,
        status: "OPEN",
      },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
      },
    });

    if (transition.assignedRole) {
      await tx.workItem.upsert({
        where: {
          sourceKey: `training-plan:${submission.id}:${transition.to.toLowerCase()}`,
        },
        create: {
          workspaceId: submission.company.organization.workspaceId,
          organizationId: submission.company.organizationId,
          areaOfficeId: submission.company.areaOfficeId,
          companyId: submission.companyId,
          trainingPlanSubmissionId: submission.id,
          assignedRole: transition.assignedRole,
          assignedUserId,
          app: "REIMBURSEMENT",
          kind: "TRAINING_PLAN_REVIEW",
          status: "OPEN",
          priority: transition.priority,
          title: transition.workItemTitle,
          summary: `${submission.company.legalName} ${transition.workItemSummary}`,
          targetHref: `/registry/${submission.companyId}`,
          sourceKey: `training-plan:${submission.id}:${transition.to.toLowerCase()}`,
        },
        update: {
          status: "OPEN",
          assignedUserId,
          resolvedAt: null,
          priority: transition.priority,
          summary: `${submission.company.legalName} ${transition.workItemSummary}`,
          targetHref: `/registry/${submission.companyId}`,
        },
        select: {
          id: true,
        },
      });
    }

    return updated;
  });
}

export async function reassignTrainingPlanReimbursementOfficer(input: {
  submissionId: string;
  requesterEmail: string;
  requesterRole: Role;
  assigneeUserId: string;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (!reason) throw new Error("Record a reason for reassigning this Training Plan.");
  const db = getDb();
  const [submission, actor] = await Promise.all([
    db.trainingPlanSubmission.findFirst({
      where: { id: input.submissionId, recordTier: "HOT", status: "IN_REVIEW", currentDesk: "REIMBURSEMENT_OFFICER" },
      select: { id: true, companyId: true, company: { select: { areaOfficeId: true, organization: { select: { workspaceId: true } } } } },
    }),
    db.user.findUnique({ where: { email: input.requesterEmail }, select: { id: true } }),
  ]);
  if (!submission || !actor) throw new Error("An open Reimbursement Officer Training Plan assignment was not found.");
  const forwardingDecision = await db.decision.findFirst({
    where: { trainingPlanSubmissionId: submission.id, recordTier: "HOT", reason: { startsWith: "HOT forwarded Training Plan and L&D submission to Reimbursement Officer" } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { actorId: true },
  });
  const adminOverride = input.requesterRole === "SYSTEM_ADMIN" || input.requesterRole === "WORKSPACE_APP_ADMIN";
  if (forwardingDecision?.actorId !== actor.id && !adminOverride) {
    throw new Error("Only the HOT who forwarded this Training Plan may reassign it.");
  }
  if (!adminOverride && !await db.membership.findFirst({
    where: { userId: actor.id, isActive: true, role: "HEAD_OF_TRAINING", areaOfficeId: submission.company.areaOfficeId ?? "__no_office__" },
    select: { id: true },
  })) throw new Error("You no longer have access to this Training Plan's Area Office.");
  if (adminOverride) {
    const adminMembership = await db.membership.findFirst({
      where: { userId: actor.id, workspaceId: submission.company.organization.workspaceId, role: input.requesterRole, isActive: true },
      select: { id: true },
    });
    if (!adminMembership) throw new Error("You do not have administrative authority in this workspace.");
  }
  const officers = await listAssignableTrainingPlanReimbursementOfficers(
    submission.company.organization.workspaceId,
    submission.company.areaOfficeId,
  );
  const assigneeId = resolveTrainingPlanOfficerAssignment(officers, input.assigneeUserId);
  const assignee = officers.find((officer) => officer.id === assigneeId)!;
  const workItem = await db.workItem.findFirst({
    where: { trainingPlanSubmissionId: submission.id, assignedRole: "REIMBURSEMENT_OFFICER", status: "OPEN", recordTier: "HOT" },
    select: { id: true, assignedUserId: true },
  });
  if (!workItem) throw new Error("The Reimbursement Officer assignment is no longer open.");
  if (workItem.assignedUserId === assigneeId) throw new Error("Select a different Reimbursement Officer.");
  await db.$transaction(async (tx) => {
    const result = await tx.workItem.updateMany({
      where: { id: workItem.id, status: "OPEN", assignedUserId: workItem.assignedUserId },
      data: { assignedUserId: assigneeId, emailNotifiedAt: null },
    });
    if (result.count !== 1) throw new Error("This Training Plan was reassigned by someone else. Reload and try again.");
    await tx.decision.create({
      data: {
        actorId: actor.id,
        companyId: submission.companyId,
        trainingPlanSubmissionId: submission.id,
        action: "FORWARD",
        reason: `Reassigned Training Plan to ${assignee.name} (${assignee.email}). Reason: ${reason}`,
      },
    });
  });
}

function resolveTrainingPlanTransition(transition: TrainingPlanDeskTransition) {
  const transitions = {
    am_to_hot: {
      from: "AREA_MANAGER",
      to: "HEAD_OF_TRAINING",
      allowedRoles: ["AREA_MANAGER"],
      allowedStatuses: ["SUBMITTED", "IN_REVIEW"],
      nextStatus: "IN_REVIEW",
      assignedRole: "HEAD_OF_TRAINING",
      action: "FORWARD",
      reason: "AM forwarded Training Plan and L&D submission to Head of Training",
      workItemTitle: "Review Training Plan and L&D submission",
      workItemSummary: "is awaiting Head of Training review.",
      priority: "NORMAL",
    },
    hot_to_ro: {
      from: "HEAD_OF_TRAINING",
      to: "REIMBURSEMENT_OFFICER",
      allowedRoles: ["HEAD_OF_TRAINING"],
      allowedStatuses: ["IN_REVIEW"],
      nextStatus: "IN_REVIEW",
      assignedRole: "REIMBURSEMENT_OFFICER",
      action: "FORWARD",
      reason: "HOT forwarded Training Plan and L&D submission to Reimbursement Officer",
      workItemTitle: "Review Training Plan and L&D evidence",
      workItemSummary: "is awaiting Reimbursement Officer review.",
      priority: "NORMAL",
    },
    ro_to_hot: {
      from: "REIMBURSEMENT_OFFICER",
      to: "HEAD_OF_TRAINING",
      allowedRoles: ["REIMBURSEMENT_OFFICER"],
      allowedStatuses: ["IN_REVIEW"],
      nextStatus: "IN_REVIEW",
      assignedRole: "HEAD_OF_TRAINING",
      action: "RECOMMEND",
      reason: "Reimbursement Officer returned Training Plan and L&D submission to HOT",
      workItemTitle: "Confirm Training Plan and L&D recommendation",
      workItemSummary: "has been reviewed by the Reimbursement Officer.",
      priority: "NORMAL",
    },
    hot_to_am: {
      from: "HEAD_OF_TRAINING",
      to: "AREA_MANAGER",
      allowedRoles: ["HEAD_OF_TRAINING"],
      allowedStatuses: ["IN_REVIEW"],
      nextStatus: "IN_REVIEW",
      assignedRole: "AREA_MANAGER",
      action: "FORWARD",
      reason: "HOT returned Training Plan and L&D submission to AM",
      workItemTitle: "Finalize Area Office Training Plan review",
      workItemSummary: "is awaiting Area Manager final Area Office action.",
      priority: "NORMAL",
    },
    am_to_company: {
      from: "AREA_MANAGER",
      to: "COMPANY",
      allowedRoles: ["AREA_MANAGER"],
      allowedStatuses: ["SUBMITTED", "IN_REVIEW"],
      nextStatus: "CHANGES_REQUESTED",
      assignedRole: null,
      action: "REQUEST_CHANGES",
      reason: "AM requested correction on Training Plan and L&D submission",
      workItemTitle: "",
      workItemSummary: "",
      priority: "HIGH",
    },
    hot_to_company: {
      from: "HEAD_OF_TRAINING",
      to: "COMPANY",
      allowedRoles: ["HEAD_OF_TRAINING"],
      allowedStatuses: ["IN_REVIEW"],
      nextStatus: "CHANGES_REQUESTED",
      assignedRole: null,
      action: "REQUEST_CHANGES",
      reason: "HOT requested correction on Training Plan and L&D submission",
      workItemTitle: "",
      workItemSummary: "",
      priority: "HIGH",
    },
    ro_to_company: {
      from: "REIMBURSEMENT_OFFICER",
      to: "COMPANY",
      allowedRoles: ["REIMBURSEMENT_OFFICER"],
      allowedStatuses: ["IN_REVIEW"],
      nextStatus: "CHANGES_REQUESTED",
      assignedRole: null,
      action: "REQUEST_CHANGES",
      reason: "Reimbursement Officer requested correction on Training Plan and L&D submission",
      workItemTitle: "",
      workItemSummary: "",
      priority: "HIGH",
    },
    am_approve: {
      from: "AREA_MANAGER",
      to: "COMPANY",
      allowedRoles: ["AREA_MANAGER"],
      allowedStatuses: ["IN_REVIEW"],
      nextStatus: "APPROVED",
      assignedRole: null,
      action: "APPROVE",
      reason: "AM approved Training Plan and L&D submission",
      workItemTitle: "",
      workItemSummary: "",
      priority: "NORMAL",
    },
  } as const;

  return transitions[transition];
}

function hasTrainingPlanRoutingRole(requesterRole: Role, allowedRoles: readonly Role[]) {
  return (
    requesterRole === "SYSTEM_ADMIN" ||
    requesterRole === "WORKSPACE_APP_ADMIN" ||
    allowedRoles.includes(requesterRole)
  );
}

function hasAreaOfficeTrainingPlanAccess(input: {
  requesterRole: Role;
  areaOfficeId: string | null;
  memberships: { areaOfficeId: string | null; role: Role }[];
}) {
  if (input.requesterRole === "SYSTEM_ADMIN" || input.requesterRole === "WORKSPACE_APP_ADMIN") {
    return true;
  }

  if (!input.areaOfficeId) {
    return false;
  }

  return input.memberships.some((membership) =>
    membership.role === input.requesterRole && membership.areaOfficeId === input.areaOfficeId);
}

function getTrainingPlanDueDate(year: number) {
  return new Date(Date.UTC(year, 2, 31, 23, 59, 59, 999));
}

function validateTrainingPlanDocumentUpload(buffer: Buffer, fileName: string, mimeType: string) {
  if (buffer.byteLength === 0) {
    throw new Error("Uploaded training plan file is empty.");
  }

  if (buffer.byteLength > maxUploadBytes) {
    throw new Error("Uploaded training plan file exceeds the 10 MB limit.");
  }

  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".xlsx")) {
    const acceptedExcelMimeTypes = new Set([
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ]);
    if (mimeType && !acceptedExcelMimeTypes.has(mimeType)) {
      throw new Error("Training plan Excel document must be uploaded as an .xlsx workbook.");
    }
    if (buffer.subarray(0, 2).toString("ascii") !== "PK") {
      throw new Error("Training plan Excel document is not a valid .xlsx workbook.");
    }
    return {
      extension: ".xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  if (!lowerName.endsWith(".csv")) {
    throw new Error("Training plan document must be a CSV or .xlsx file. Save older .xls files as .xlsx.");
  }

  const acceptedMimeTypes = new Set([
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "text/plain",
  ]);

  if (mimeType && !acceptedMimeTypes.has(mimeType)) {
    throw new Error("Training plan document must be uploaded as a CSV file.");
  }

  const content = buffer.toString("utf8").replace(/^\uFEFF/, "");

  if (content.includes("\uFFFD")) {
    throw new Error("Training plan CSV must be valid UTF-8 text.");
  }

  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("Training plan CSV must include a header row and at least one training row.");
  }

  const headers = parseCsvLine(lines[0]).map(normalizeCsvHeader);
  const missingColumns = requiredTrainingPlanCsvColumns.filter(
    (column) => !headers.includes(column),
  );

  if (missingColumns.length > 0) {
    throw new Error(`Training plan CSV is missing columns: ${missingColumns.join(", ")}.`);
  }

  return {
    extension: ".csv",
    mimeType: "text/csv",
  };
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
