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

export type IdentitySecurityAuditEventInput = {
  email?: string;
  action?: SecurityAuditEventInput["action"];
  eventType: SecurityAuditEventInput["eventType"];
  entityId: string;
  reason?: string;
  metadata?: SecurityAuditEventInput["metadata"];
};

export async function writeIdentitySecurityAuditEvent(event: IdentitySecurityAuditEventInput) {
  try {
    const db = getDb();
    const normalizedEmail = event.email?.trim().toLowerCase();
    const user = normalizedEmail
      ? await db.user.findUnique({
          where: {
            email: normalizedEmail,
          },
          select: {
            id: true,
            email: true,
            memberships: {
              select: {
                workspaceId: true,
                organizationId: true,
                role: true,
              },
              take: 1,
            },
          },
        })
      : null;
    const membership = user?.memberships[0];
    const workspaceId =
      membership?.workspaceId ??
      (
        await db.workspace.findFirst({
          where: {
            isActive: true,
          },
          select: {
            id: true,
          },
        })
      )?.id;

    if (!workspaceId) {
      console.warn("[security-audit] No active workspace was available.", {
        eventType: event.eventType,
        entityId: event.entityId,
      });

      return null;
    }

    return writeSecurityAuditEvent({
      workspaceId,
      organizationId: membership?.organizationId ?? undefined,
      actor:
        user && membership
          ? {
              id: user.id,
              email: user.email,
              role: membership.role,
            }
          : undefined,
      action: event.action,
      eventType: event.eventType,
      entityId: event.entityId,
      reason: event.reason,
      metadata: {
        ...event.metadata,
        attemptedEmail: normalizedEmail ?? null,
      },
    });
  } catch (error) {
    console.error("[security-audit] Failed to write security audit event.", error);

    return null;
  }
}
