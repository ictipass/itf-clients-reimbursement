"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { EMPLOYER_SUBMISSION_ACKNOWLEDGEMENT } from "@/lib/submission-acknowledgement";

type Props = {
  label: string;
  subject: string;
  disabled?: boolean;
  className?: string;
};

export function EmployerSubmissionConfirm({ label, subject, disabled, className }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const acknowledgement = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const { pending } = useFormStatus();

  useEffect(() => {
    const form = trigger.current?.form;
    if (!form) return;
    const requireConfirmation = (event: Event) => {
      if (disabled) { event.preventDefault(); return; }
      if (acknowledgement.current?.value === "yes") return;
      event.preventDefault();
      if (!dialog.current?.open) dialog.current?.showModal();
    };
    form.addEventListener("submit", requireConfirmation, true);
    return () => form.removeEventListener("submit", requireConfirmation, true);
  }, [disabled]);

  function confirm() {
    if (!acknowledgement.current || !trigger.current) return;
    acknowledgement.current.value = "yes";
    dialog.current?.close();
    trigger.current.form?.requestSubmit();
  }

  return (
    <>
      <input ref={acknowledgement} type="hidden" name={EMPLOYER_SUBMISSION_ACKNOWLEDGEMENT} defaultValue="" />
      <button
        ref={trigger}
        type="button"
        disabled={disabled || pending}
        className={className}
        onClick={() => dialog.current?.showModal()}
      >
        {pending ? "Submitting…" : label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="submission-disclaimer-title"
        className="w-[min(36rem,calc(100%-2rem))] rounded-xl border-2 border-[#800020] bg-white p-0 shadow-2xl backdrop:bg-zinc-950/70"
      >
        <div className="border-b border-[#800020]/20 bg-[#800020]/10 px-6 py-5">
          <h2 id="submission-disclaimer-title" className="text-xl font-bold text-[#800020]">
            Confirm your {subject} submission
          </h2>
        </div>
        <div className="space-y-4 px-6 py-5 text-sm leading-6 text-zinc-800">
          <p>Check every entry and document before submitting. You are responsible for the accuracy, completeness, and legibility of the information and files you provide.</p>
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 font-semibold text-amber-950">
            ITF will not be responsible for errors or processing outcomes caused by incorrect information or documents you submit.
          </p>
          <p>By continuing, you confirm that you have reviewed this {subject} and its supporting documents.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-200 px-6 py-4">
          <button type="button" className="min-h-10 rounded-md border border-zinc-300 px-4 font-semibold" onClick={() => dialog.current?.close()}>
            Go back and review
          </button>
          <button type="button" className="min-h-10 rounded-md bg-[#800020] px-4 font-semibold text-white" onClick={confirm}>
            I confirm — submit {subject}
          </button>
        </div>
      </dialog>
    </>
  );
}
