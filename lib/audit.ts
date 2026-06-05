import { getDb } from "@/lib/db";
import type { AuditAction as PrismaAuditAction } from "@/lib/generated/prisma/enums";
import type { Role } from "@/lib/rbac";

export type AuditAction = PrismaAuditAction;

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
  metadata?: Record<string, string | number | boolean | null | string[]>;
};

export async function writeAuditEvent(event: AuditEventInput) {
  const db = getDb();

  return db.auditEvent.create({
    data: {
      workspaceId: event.workspaceId,
      organizationId: event.organizationId,
      actorId: event.actor?.id,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      reason: event.reason,
      metadata: event.metadata,
    },
    select: {
      id: true,
      createdAt: true,
    },
  });
}

export type SecurityAuditEventInput = Omit<AuditEventInput, "entityType" | "action"> & {
  action?: Extract<AuditAction, "LOGIN" | "REJECT" | "REQUEST_CHANGES" | "UPDATE">;
  eventType:
    | "AUTH_ATTEMPT"
    | "ACCESS_DENIED"
    | "RATE_LIMITED"
    | "UPLOAD_REJECTED"
    | "SENSITIVE_SETTING_CHANGED";
};

export async function writeSecurityAuditEvent(event: SecurityAuditEventInput) {
  return writeAuditEvent({
    ...event,
    action: event.action ?? "UPDATE",
    entityType: "SecurityEvent",
    metadata: {
      ...event.metadata,
      securityEventType: event.eventType,
      actorEmail: event.actor?.email ?? null,
      actorRole: event.actor?.role ?? null,
    },
  });
}
