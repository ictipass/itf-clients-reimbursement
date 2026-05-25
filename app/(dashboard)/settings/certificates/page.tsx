import { getServerSession } from "next-auth";
import Link from "next/link";

import {
  activateCertificateTemplateAction,
  createCertificateTemplateAction,
  retireCertificateTemplateAction,
  uploadCertificateTemplateDesignAction,
} from "@/app/(dashboard)/settings/certificates/actions";
import { authOptions } from "@/lib/auth";
import { listCertificateTemplates, listCertificateTemplateWorkspaces } from "@/lib/certificates";
import { can } from "@/lib/rbac";

function formatDate(date: Date | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(date);
}

const requiredPlacementFields = [
  "companyName",
  "itfEmployerNumber",
  "certificateNumber",
  "issuedAt",
] as const;

function hasPlacementMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return requiredPlacementFields.every((field) => Object.hasOwn(value, field));
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

  const [templates, workspaces] = await Promise.all([
    listCertificateTemplates(),
    listCertificateTemplateWorkspaces(),
  ]);

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

        <form
          action={createCertificateTemplateAction}
          className="mt-6 grid gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
        >
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Create template version</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              New templates start as drafts until an admin activates them.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <label className="grid gap-2 text-sm font-medium text-zinc-700 md:col-span-2">
              Name
              <input
                name="name"
                required
                defaultValue="ITF Employer Registration Certificate"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Code
              <input
                name="code"
                required
                defaultValue="EMPLOYER_REGISTRATION"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Version
              <input
                name="version"
                required
                placeholder="2026.2"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Effective date
              <input
                name="effectiveFrom"
                type="date"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Workspace
              <select
                name="workspaceId"
                required
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
              Create draft
            </button>
          </div>
          <label className="grid gap-2 text-sm font-medium text-zinc-700">
            Notes
            <textarea
              name="notes"
              rows={2}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2"
            />
          </label>
        </form>

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
                  <th className="px-4 py-3">Placement</th>
                  <th className="px-4 py-3">Design</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Actions</th>
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
                      {hasPlacementMetadata(template.placementMetadata)
                        ? "Configured"
                        : "Not configured"}
                    </td>
                    <td className="px-4 py-4 align-top text-zinc-700">
                      <div className="grid gap-2">
                        <span>
                          {template.designDocument
                            ? `${template.designDocument.fileName} · ${template.designDocument.mimeType}`
                            : "Not attached"}
                        </span>
                        {template.designDocument ? (
                          <Link
                            href={`/settings/certificates/${template.id}/design`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-fit text-xs font-semibold text-[#800020]"
                          >
                            View design
                          </Link>
                        ) : null}
                        <form
                          action={uploadCertificateTemplateDesignAction}
                          className="grid max-w-xs gap-2"
                        >
                          <input type="hidden" name="templateId" value={template.id} />
                          <input
                            name="design"
                            type="file"
                            accept="application/pdf,image/png,image/jpeg"
                            required
                            className="block w-full text-xs text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-zinc-700"
                          />
                          <button className="min-h-8 w-fit rounded-md bg-[#800020] px-3 text-xs font-semibold text-white">
                            {template.designDocument ? "Replace design" : "Attach design"}
                          </button>
                        </form>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-zinc-700">
                      {template._count.certificates}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        {template.status !== "ACTIVE" ? (
                          <form action={activateCertificateTemplateAction}>
                            <input type="hidden" name="templateId" value={template.id} />
                            <button className="min-h-8 rounded-md bg-[#800020] px-3 text-xs font-semibold text-white">
                              Activate
                            </button>
                          </form>
                        ) : null}
                        {template.status !== "RETIRED" ? (
                          <form action={retireCertificateTemplateAction}>
                            <input type="hidden" name="templateId" value={template.id} />
                            <button className="min-h-8 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800">
                              Retire
                            </button>
                          </form>
                        ) : null}
                      </div>
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
