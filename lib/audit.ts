import type { Role } from "@/lib/rbac";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "SUBMIT"
  | "APPROVE"
  | "REJECT"
  | "REQUEST_CHANGES"
  | "DEACTIVATE"
  | "REVOKE"
  | "ARCHIVE"
  | "LOGIN";

export type AuditEventInput = {
  action: AuditAction;
  actor?: {
    id: string;
    email: string;
    role: Role;
  };
  workspaceId: string;
  organizationId?: string;
  entityType: string;
  entityId: string;
  reason?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export async function writeAuditEvent(event: AuditEventInput) {
  // Replace with a Prisma write after migrations are applied.
  console.info("[audit]", {
    ...event,
    createdAt: new Date().toISOString(),
  });
}
