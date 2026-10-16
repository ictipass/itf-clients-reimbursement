import ExcelJS from "exceljs";

import { getAreaOfficeOfficerRoles, getHeadquartersOfficerRoles } from "@/lib/area-office-management";
import { getDb } from "@/lib/db";
import { can, type Role } from "@/lib/rbac";

export type StaffOptionKind = "DEPARTMENT" | "JOB_TITLE";

export async function getStaffWorkspace() {
  const workspace = await getDb().workspace.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!workspace) throw new Error("No active workspace was found.");
  return workspace;
}

export async function listStaffDirectoryOptions(requesterRole: Role) {
  if (!can(requesterRole, "workspace:manage")) throw new Error("You do not have permission to manage staff directory options.");
  const workspace = await getStaffWorkspace();
  return getDb().staffDirectoryOption.findMany({ where: { workspaceId: workspace.id }, orderBy: [{ kind: "asc" }, { name: "asc" }] });
}

export async function saveStaffDirectoryOption(input: { requesterRole: Role; kind: StaffOptionKind; name: string }) {
  if (!can(input.requesterRole, "workspace:manage")) throw new Error("You do not have permission to manage staff directory options.");
  if (input.kind !== "DEPARTMENT" && input.kind !== "JOB_TITLE") throw new Error("Unsupported directory option.");
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 100) throw new Error("Name must contain 2–100 characters.");
  const workspace = await getStaffWorkspace();
  return getDb().staffDirectoryOption.upsert({
    where: { workspaceId_kind_key: { workspaceId: workspace.id, kind: input.kind, key: name.toLowerCase() } },
    update: { name, isActive: true },
    create: { workspaceId: workspace.id, kind: input.kind, key: name.toLowerCase(), name },
  });
}

export async function setStaffDirectoryOptionStatus(input: { requesterRole: Role; id: string; isActive: boolean }) {
  if (!can(input.requesterRole, "workspace:manage")) throw new Error("You do not have permission to manage staff directory options.");
  const workspace = await getStaffWorkspace();
  return getDb().staffDirectoryOption.update({ where: { id: input.id, workspaceId: workspace.id }, data: { isActive: input.isActive } });
}

export async function assertConfiguredStaffValues(input: { department?: string; jobTitle?: string }) {
  const workspace = await getStaffWorkspace();
  const requested = [
    { kind: "DEPARTMENT" as const, value: input.department },
    { kind: "JOB_TITLE" as const, value: input.jobTitle },
  ];
  for (const item of requested) {
    if (!item.value) continue;
    const found = await getDb().staffDirectoryOption.findUnique({
      where: { workspaceId_kind_key: { workspaceId: workspace.id, kind: item.kind, key: item.value.trim().toLowerCase() } },
      select: { isActive: true },
    });
    if (!found?.isActive) throw new Error(`${item.kind === "DEPARTMENT" ? "Department" : "Job title"} “${item.value}” is not in the active staff directory catalogue.`);
  }
}

export async function staffDirectoryReferenceWorkbook(requesterRole: Role) {
  const options = await listStaffDirectoryOptions(requesterRole);
  const workspace = await getStaffWorkspace();
  const offices = await getDb().areaOffice.findMany({ where: { workspaceId: workspace.id, isActive: true }, orderBy: { name: "asc" }, select: { name: true, code: true, slug: true } });
  const workbook = new ExcelJS.Workbook();
  const departments = workbook.addWorksheet("Departments");
  departments.addRow(["department"]);
  for (const option of options.filter((item) => item.kind === "DEPARTMENT" && item.isActive)) departments.addRow([option.name]);
  const titles = workbook.addWorksheet("Job Titles");
  titles.addRow(["job title"]);
  for (const option of options.filter((item) => item.kind === "JOB_TITLE" && item.isActive)) titles.addRow([option.name]);
  const officeSheet = workbook.addWorksheet("Offices");
  officeSheet.addRow(["office", "code", "slug"]);
  officeSheet.addRow(["Headquarters", "HQ", "headquarters"]);
  for (const office of offices) officeSheet.addRow([office.name, office.code, office.slug]);
  const roles = workbook.addWorksheet("Assignment Roles");
  roles.addRow(["office scope", "role"]);
  for (const role of getHeadquartersOfficerRoles()) roles.addRow(["Headquarters", role]);
  for (const role of getAreaOfficeOfficerRoles()) roles.addRow(["Area Office", role]);
  for (const sheet of [departments, titles, officeSheet, roles]) {
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((column) => { column.width = 32; });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
