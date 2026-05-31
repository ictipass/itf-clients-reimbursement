"use client";

import { useState } from "react";

type PersonnelRow = {
  id: number;
};

export function PersonnelFields() {
  const [rows, setRows] = useState<PersonnelRow[]>([{ id: 1 }]);

  return (
    <section className="grid gap-4 border-t border-zinc-100 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">L&amp;D personnel</h2>
        <button
          type="button"
          onClick={() =>
            setRows((currentRows) => [
              ...currentRows,
              { id: Math.max(...currentRows.map((row) => row.id)) + 1 },
            ])
          }
          className="min-h-9 rounded-md border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-900"
        >
          Add personnel
        </button>
      </div>

      <div className="grid gap-4">
        {rows.map((row, index) => (
          <div key={row.id} className="grid gap-3 rounded-md border border-zinc-100 bg-zinc-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Personnel {index + 1}
              </p>
              {rows.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setRows((currentRows) =>
                      currentRows.filter((currentRow) => currentRow.id !== row.id),
                    )
                  }
                  className="min-h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs font-semibold text-zinc-800"
                >
                  Remove
                </button>
              ) : null}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                Name
                <input
                  name="ldPersonnelName"
                  required={index === 0}
                  className="min-h-11 rounded-md border border-zinc-300 bg-white px-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Position
                <input
                  name="ldPersonnelPosition"
                  className="min-h-11 rounded-md border border-zinc-300 bg-white px-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Email
                <input
                  name="ldPersonnelEmail"
                  type="email"
                  className="min-h-11 rounded-md border border-zinc-300 bg-white px-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Phone
                <input
                  name="ldPersonnelPhone"
                  className="min-h-11 rounded-md border border-zinc-300 bg-white px-3"
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
