import { getDb } from "@/lib/db";
import { can, isItfRole, type Role } from "@/lib/rbac";

async function getActor(email: string) {
  const actor = await getDb().user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      memberships: {
        where: { isActive: true },
        select: { organizationId: true, areaOfficeId: true, role: true },
      },
    },
  });
  if (!actor) throw new Error("User account was not found.");
  return actor;
}

export async function createJurisdictionChangeRequest(input: {
  companyId: string;
  toAreaOfficeId: string;
  reason: string;
  requesterEmail: string;
  requesterRole: Role;
}) {
  if (!can(input.requesterRole, "company:manage")) {
    throw new Error("You do not have permission to request a jurisdiction change.");
  }

  const db = getDb();
  const [actor, company] = await Promise.all([
    getActor(input.requesterEmail),
    db.company.findFirst({
      where: { id: input.companyId, recordTier: "HOT", isActive: true },
      select: { id: true, organizationId: true, areaOfficeId: true },
    }),
  ]);
  if (!company) throw new Error("Company was not found.");
  if (!isItfRole(input.requesterRole) && !actor.memberships.some((item) => item.organizationId === company.organizationId)) {
    throw new Error("You do not have access to this company.");
  }
  if (company.areaOfficeId === input.toAreaOfficeId) {
    throw new Error("Select a different Area Office.");
  }

  const destination = await db.areaOffice.findFirst({
    where: { id: input.toAreaOfficeId, isActive: true },
    select: { id: true },
  });
  if (!destination) throw new Error("Destination Area Office was not found.");

  const existing = await db.jurisdictionChangeRequest.findFirst({
    where: { companyId: company.id, status: "PENDING" },
    select: { id: true },
  });
  if (existing) throw new Error("This company already has a pending jurisdiction request.");

  return db.jurisdictionChangeRequest.create({
    data: {
      companyId: company.id,
      fromAreaOfficeId: company.areaOfficeId,
      toAreaOfficeId: destination.id,
      requestedById: actor.id,
      reason: input.reason.trim(),
    },
  });
}

export async function decideJurisdictionChangeRequest(input: {
  requestId: string;
  decision: "APPROVED" | "REJECTED";
  reviewNote?: string;
  requesterEmail: string;
  requesterRole: Role;
}) {
  if (input.requesterRole !== "AREA_MANAGER" && !can(input.requesterRole, "workspace:manage")) {
    throw new Error("Only an Area Manager can decide jurisdiction requests.");
  }

  const db = getDb();
  const [actor, request] = await Promise.all([
    getActor(input.requesterEmail),
    db.jurisdictionChangeRequest.findFirst({
      where: { id: input.requestId, status: "PENDING" },
      select: { id: true, companyId: true, fromAreaOfficeId: true, toAreaOfficeId: true },
    }),
  ]);
  if (!request) throw new Error("Pending jurisdiction request was not found.");

  const adminOverride = can(input.requesterRole, "workspace:manage");
  const hasOfficeAccess = actor.memberships.some(
    (item) => item.role === "AREA_MANAGER" && item.areaOfficeId === request.fromAreaOfficeId,
  );
  if (!adminOverride && !hasOfficeAccess) {
    throw new Error("This request belongs to another Area Office.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.jurisdictionChangeRequest.update({
      where: { id: request.id },
      data: {
        status: input.decision,
        reviewNote: input.reviewNote?.trim() || null,
        reviewedById: actor.id,
        reviewedAt: new Date(),
      },
    });
    if (input.decision === "APPROVED") {
      await tx.company.update({
        where: { id: request.companyId },
        data: { areaOfficeId: request.toAreaOfficeId },
      });
    }
    return updated;
  });
}

export async function listJurisdictionChangeData(input: {
  requesterEmail: string;
  requesterRole: Role;
}) {
  const db = getDb();
  const actor = await getActor(input.requesterEmail);
  const organizationIds = actor.memberships
    .map((item) => item.organizationId)
    .filter((value): value is string => Boolean(value));
  const areaOfficeIds = actor.memberships
    .map((item) => item.areaOfficeId)
    .filter((value): value is string => Boolean(value));
  const isAdmin = can(input.requesterRole, "workspace:manage");
  const isEmployer = !isItfRole(input.requesterRole);

  const [offices, companies, requests] = await Promise.all([
    db.areaOffice.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.company.findMany({
      where: {
        recordTier: "HOT",
        isActive: true,
        ...(isEmployer ? { organizationId: { in: organizationIds } } : {}),
      },
      select: { id: true, legalName: true, areaOfficeId: true, areaOffice: { select: { name: true } } },
      orderBy: { legalName: "asc" },
    }),
    db.jurisdictionChangeRequest.findMany({
      where: isEmployer
        ? { company: { organizationId: { in: organizationIds } } }
        : isAdmin
          ? {}
          : { fromAreaOfficeId: { in: areaOfficeIds } },
      select: {
        id: true,
        reason: true,
        reviewNote: true,
        status: true,
        requestedAt: true,
        company: { select: { legalName: true } },
        fromAreaOffice: { select: { name: true } },
        toAreaOffice: { select: { name: true } },
        requestedBy: { select: { name: true } },
      },
      orderBy: { requestedAt: "desc" },
      take: 100,
    }),
  ]);

  return { offices, companies, requests, canRequest: can(input.requesterRole, "company:manage"), canReview: input.requesterRole === "AREA_MANAGER" || isAdmin };
}
