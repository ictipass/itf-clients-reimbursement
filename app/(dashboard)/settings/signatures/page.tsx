import { getServerSession } from "next-auth";
import Link from "next/link";
import { HostedFileInput } from "@/components/hosted-file-input";

import { uploadSignatureAssetAction } from "@/app/(dashboard)/settings/signatures/actions";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import {
  getSignatureAssetKinds,
  listSignatureAssets,
  listSignatureAssetWorkspaces,
} from "@/lib/signatures";

function formatDate(date: Date | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(date);
}

function formatKind(kind: string) {
  return kind.replaceAll("_", " ");
}

export default async function SignatureAssetsPage() {
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
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Signature assets</h1>
          <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            You do not have permission to manage signature assets.
          </p>
        </section>
      </div>
    );
  }

  const [signatureAssets, workspaces] = await Promise.all([
    listSignatureAssets({ requesterRole: role }),
    listSignatureAssetWorkspaces(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
              Settings
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Signature assets</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              Upload active signatures used by generated employer registration certificates.
            </p>
          </div>
          <Link
            href="/settings/certificates"
            className="w-fit rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800"
          >
            Certificate templates
          </Link>
        </div>

        <form
          action={uploadSignatureAssetAction}
          className="mt-6 grid gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
        >
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Upload signature</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              Uploading a new signature makes the previous active signature for that office
              inactive for future certificate generation.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
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
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Signature kind
              <select
                name="kind"
                required
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              >
                {getSignatureAssetKinds().map((kind) => (
                  <option key={kind} value={kind}>
                    {formatKind(kind)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Label
              <input
                name="label"
                required
                placeholder="DG/CE signature May 2026"
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
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Signature image
              <HostedFileInput hosted={process.env.STORAGE_PROVIDER !== "local" && Boolean(process.env.STORAGE_PROVIDER)}
                name="signature"
                accept="image/png,image/jpeg"
                required
                className="block w-full text-xs text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-zinc-700"
              />
            </label>
            <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
              Upload signature
            </button>
          </div>
        </form>

        {signatureAssets.length === 0 ? (
          <p className="mt-5 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            No signature assets have been uploaded yet.
          </p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Signature</th>
                  <th className="px-4 py-3">Workspace</th>
                  <th className="px-4 py-3">Effective</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">File</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {signatureAssets.map((signatureAsset) => (
                  <tr key={signatureAsset.id}>
                    <td className="px-4 py-4 align-top">
                      <p className="font-semibold text-zinc-950">{signatureAsset.label}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {formatKind(signatureAsset.kind)}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top text-zinc-700">
                      {signatureAsset.workspace.name}
                    </td>
                    <td className="px-4 py-4 align-top text-zinc-700">
                      {formatDate(signatureAsset.effectiveFrom)}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                        {signatureAsset.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top text-zinc-700">
                      <div className="grid gap-2">
                        <span>
                          {signatureAsset.document.fileName} · {signatureAsset.document.mimeType}
                        </span>
                        <Link
                          href={`/settings/signatures/${signatureAsset.id}/image`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-fit text-xs font-semibold text-[#800020]"
                        >
                          View image
                        </Link>
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
