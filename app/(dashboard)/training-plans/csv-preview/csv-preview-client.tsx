"use client";

import { useMemo, useState } from "react";

const requiredColumns = [
  "name of staff",
  "department",
  "gap identified",
  "training title",
  "estimated cost",
  "date",
  "location",
  "trainer",
];

type PreviewState = {
  headers: string[];
  rows: string[][];
  errors: string[];
};

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());

  return values;
}

function parseCsv(text: string): PreviewState {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      headers: [],
      rows: [],
      errors: ["CSV file is empty."],
    };
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const rows = lines.slice(1).map(parseCsvLine);
  const missingColumns = requiredColumns.filter((column) => !headers.includes(column));
  const rowErrors = rows.flatMap((row, index) =>
    row.length !== headers.length
      ? [`Row ${index + 2} has ${row.length} columns instead of ${headers.length}.`]
      : [],
  );

  return {
    headers,
    rows,
    errors: [
      ...missingColumns.map((column) => `Missing required column: ${column}.`),
      ...rowErrors,
    ],
  };
}

export function CsvPreviewClient() {
  const [preview, setPreview] = useState<PreviewState>({
    headers: [],
    rows: [],
    errors: [],
  });
  const previewRows = useMemo(() => preview.rows.slice(0, 10), [preview.rows]);

  async function handleFileChange(file: File | undefined) {
    if (!file) {
      setPreview({ headers: [], rows: [], errors: [] });
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setPreview({
        headers: [],
        rows: [],
        errors: ["Upload a CSV file."],
      });
      return;
    }

    setPreview(parseCsv(await file.text()));
  }

  return (
    <div className="grid gap-6">
      <label className="grid gap-2 text-sm font-medium text-zinc-700">
        Training plan CSV
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => handleFileChange(event.target.files?.[0])}
          className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 py-2"
        />
      </label>

      {preview.errors.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Validation issues</p>
          <ul className="mt-2 grid gap-1">
            {preview.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview.headers.length > 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-100 p-4">
            <p className="font-semibold text-zinc-950">
              {preview.rows.length} row{preview.rows.length === 1 ? "" : "s"} detected
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              Showing the first {previewRows.length} row{previewRows.length === 1 ? "" : "s"}.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  {preview.headers.map((header) => (
                    <th key={header} className="px-4 py-3">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {previewRows.map((row, rowIndex) => (
                  <tr key={`${row.join("-")}-${rowIndex}`}>
                    {preview.headers.map((header, cellIndex) => (
                      <td key={`${header}-${cellIndex}`} className="px-4 py-3">
                        {row[cellIndex] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
