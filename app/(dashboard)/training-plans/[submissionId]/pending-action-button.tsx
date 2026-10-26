"use client";

import { useFormStatus } from "react-dom";

type PendingActionButtonProps = {
  label: string;
  className: string;
  name?: string;
  value?: string;
  formNoValidate?: boolean;
};

export function PendingActionButton({ label, className, name, value, formNoValidate }: PendingActionButtonProps) {
  const { pending, data } = useFormStatus();
  const active = pending && (!name || data?.get(name) === value);

  return (
    <button
      type="submit"
      name={name}
      value={value}
      formNoValidate={formNoValidate}
      disabled={pending}
      aria-busy={active}
      className={`${className} disabled:cursor-wait disabled:opacity-60`}
    >
      {active ? `${label} — Working…` : label}
    </button>
  );
}
