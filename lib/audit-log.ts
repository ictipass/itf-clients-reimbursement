import { getDb } from "@/lib/db";
import { can, type Role } from "@/lib/rbac";

export type AuditLogFilters = {
  action?: string;
  actor?: string;
  entityType?: string;
  eventType?: string;
  page?: number;
};

const pageSize = 25;

export async function listAuditEvents(input: {
  requesterRole: Role;
  filters: AuditLogFilters;
}) {
  if (!can(input.requesterRole, "audit:read")) {
    throw new Error("You do not have permission to read audit events.");
  }

  const db = getDb();
  const page = Math.max(1, input.filters.page ?? 1);
  const where = {
    ...(input.filters.action ? { action: input.filters.action as never } : {}),
    ...(input.filters.entityType
      ? { entityType: { contains: input.filters.entityType, mode: "insensitive" as const } }
      : {}),
    ...(input.filters.eventType
      ? { metadata: { path: ["securityEventType"], equals: input.filters.eventType } }
      : {}),
    ...(input.filters.actor
      ? {
          actor: {
            is: {
              OR: [
                { name: { contains: input.filters.actor, mode: "insensitive" as const } },
                { email: { contains: input.filters.actor, mode: "insensitive" as const } },
              ],
            },
          },
        }
      : {}),
  };
  const [events, total] = await Promise.all([
    db.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        reason: true,
        metadata: true,
        createdAt: true,
        actor: { select: { name: true, email: true } },
        organization: { select: { name: true } },
      },
    }),
    db.auditEvent.count({ where }),
  ]);

  return { events, page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) };
}
