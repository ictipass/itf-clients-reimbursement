import { getDb } from "@/lib/db";
import { sendWorkflowAttentionEmail } from "@/lib/email";

export async function dispatchPendingWorkflowEmails(limit = 50) {
  const db = getDb();
  const items = await db.workItem.findMany({
    where: { status: "OPEN", emailNotifiedAt: null, recordTier: "HOT" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let delivered = 0;
  for (const item of items) {
    const users = item.assignedUserId
      ? await db.user.findMany({ where: { id: item.assignedUserId, isActive: true, workflowEmailNotifications: true }, select: { email: true, name: true } })
      : item.assignedRole
        ? await db.user.findMany({
            where: {
              isActive: true,
              workflowEmailNotifications: true,
              memberships: { some: {
                isActive: true,
                role: item.assignedRole,
                ...(item.areaOfficeId ? { areaOfficeId: item.areaOfficeId } : {}),
                ...(item.organizationId ? { organizationId: item.organizationId } : {}),
              } },
            },
            select: { email: true, name: true },
          })
        : [];
    for (const user of users) {
      await sendWorkflowAttentionEmail({ to: user.email, name: user.name, title: item.title, summary: item.summary, targetHref: item.targetHref });
      delivered += 1;
    }
    await db.workItem.update({ where: { id: item.id }, data: { emailNotifiedAt: new Date() } });
  }
  return { processed: items.length, delivered };
}
