"use client";

import { useRef, useState } from "react";
import { put } from "@vercel/blob/client";

type Props = { name: string; accept: string; className?: string; required?: boolean; hosted: boolean };

export function HostedFileInput({ name, accept, className, required, hosted }: Props) {
  const [reference, setReference] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedName, setSelectedName] = useState("");
  const localInput = useRef<HTMLInputElement>(null);

  async function onChange(file: File | undefined) {
    setReference("");
    setSelectedName(file?.name ?? "");
    if (!file) return;
    if (file.size < 1 || file.size > 10 * 1024 * 1024) { setStatus("Choose a file up to 10 MB."); return; }
    setBusy(true);
    setStatus("Uploading privately…");
    try {
      const response = await fetch("/api/storage/staged-upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start upload.");
      if (data.provider === "s3") {
        const uploaded = await fetch(data.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!uploaded.ok) throw new Error("Storage rejected the upload. Check S3 CORS and try again.");
      } else {
        await put(data.key, file, { access: "private", token: data.token, contentType: file.type });
      }
      setReference(data.reference);
      setStatus(`${file.name} uploaded. You can submit the form.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally { setBusy(false); }
  }

  if (!hosted) return <>
    <input ref={localInput} name={name} type="file" accept={accept} required={required && !selectedName} className={className}
      onChange={(event) => setSelectedName(event.target.files?.[0]?.name ?? "")} />
    {selectedName && <span className="flex items-center gap-3 text-sm"><span className="truncate">{selectedName}</span>
      <button type="button" className="font-semibold text-red-700 underline" onClick={() => { if (localInput.current) localInput.current.value = ""; setSelectedName(""); }}>Remove</button></span>}
  </>;
  return <>
    <input type="file" accept={accept} required={required && !reference} disabled={Boolean(reference)} className={className}
      onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!busy) void onChange(file); }} />
    {reference && <input type="hidden" name={`${name}UploadRef`} value={reference} />}
    {reference && <button type="button" className="text-left text-sm underline" onClick={() => { setReference(""); setSelectedName(""); setStatus(""); }}>Remove {selectedName}</button>}
    {status && <span role="status" className="text-sm text-zinc-600">{status}</span>}
  </>;
}
