import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { listCertificateTemplates } from "@/lib/certificates";
import { can } from "@/lib/rbac";

function formatDate(date: Date | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(date);
}

export default async function CertificateTemplatesPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? "SYSTEM_ADMIN";
  const canManageWorkspace = can(role, "workspace:manage");

  if (!canManageWorkspace) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <section className="rounded-lg border border-zinc-200 bg-white p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
            Settings
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Certificate templates
          </h1>
          <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            You do not have permission to view certificate template settings.
          </p>
        </section>
      </div>
    );
  }

  const templates = await listCertificateTemplates();

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
              Settings
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Certificate templates
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              Active and retired certificate designs available to employer registration
              certificates.
            </p>
          </div>
          <span className="w-fit rounded-full bg-[#800020]/10 px-3 py-1 text-sm font-semibold text-[#65001a]">
            {templates.length} templates
          </span>
        </div>

        {templates.length === 0 ? (
          <p className="mt-5 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            No certificate templates have been seeded yet.
          </p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Template</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Effective</th>
                  <th className="px-4 py-3">Design</th>
                  <th className="px-4 py-3">Issued</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td className="px-4 py-4 align-top">
                      <p className="font-semibold text-zinc-950">{template.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {template.code} · v{template.version} · {template.workspace.name}
                      </p>
                      {template.notes ? (
                        <p className="mt-2 max-w-xl text-xs leading-5 text-zinc-600">
                          {template.notes}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                        {template.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top text-zinc-700">
                      {formatDate(template.effectiveFrom)}
                    </td>
                    <td className="px-4 py-4 align-top text-zinc-700">
                      {template.designDocumentId ? "Attached" : "Not attached"}
                    </td>
                    <td className="px-4 py-4 align-top text-zinc-700">
                      {template._count.certificates}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
