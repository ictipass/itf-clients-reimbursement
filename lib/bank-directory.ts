import { getDb } from "@/lib/db";
import { can, type Role } from "@/lib/rbac";

export async function listBankDirectoryWorkspaces(requesterRole: Role) {
  if (!can(requesterRole, "workspace:manage")) throw new Error("You cannot manage bank settings.");
  return getDb().workspace.findMany({
    where: { isActive: true },
    select: { id: true, name: true, bankDirectoryEntries: { orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });
}

export async function listActiveBankOptions(workspaceId: string) {
  return getDb().bankDirectoryEntry.findMany({
    where: { workspaceId, isActive: true },
    select: { id: true, name: true, sortCode: true },
    orderBy: { name: "asc" },
  });
}

export async function saveBankDirectoryEntry(input: {
  requesterRole: Role;
  workspaceId: string;
  name: string;
  sortCode: string;
}) {
  if (!can(input.requesterRole, "workspace:manage")) throw new Error("You cannot manage bank settings.");
  const name = input.name.trim().replace(/\s+/g, " ");
  const sortCode = input.sortCode.trim();
  if (name.length < 2 || name.length > 100) throw new Error("Bank name must contain 2–100 characters.");
  if (!/^\d{3,12}$/.test(sortCode)) throw new Error("Sort code must contain 3–12 digits, including any leading zeroes.");
  const workspace = await getDb().workspace.findFirst({ where: { id: input.workspaceId, isActive: true }, select: { id: true } });
  if (!workspace) throw new Error("Active workspace was not found.");
  return getDb().bankDirectoryEntry.upsert({
    where: { workspaceId_nameKey: { workspaceId: workspace.id, nameKey: name.toLowerCase() } },
    create: { workspaceId: workspace.id, name, nameKey: name.toLowerCase(), sortCode },
    update: { name, sortCode, isActive: true },
  });
}

export async function setBankDirectoryEntryStatus(input: { requesterRole: Role; id: string; isActive: boolean }) {
  if (!can(input.requesterRole, "workspace:manage")) throw new Error("You cannot manage bank settings.");
  return getDb().bankDirectoryEntry.update({ where: { id: input.id }, data: { isActive: input.isActive } });
}
