"use client";

import { useEffect, useRef, useState } from "react";

export function SelectAllTrainings() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState({ all: false, some: false });

  useEffect(() => {
    const formElement = inputRef.current?.form;
    if (!formElement) return;

    function updateSelection(currentForm: HTMLFormElement) {
      const inputs = Array.from(currentForm.querySelectorAll<HTMLInputElement>('input[name="trainingRequestIds"]'));
      setSelection({
        all: inputs.length > 0 && inputs.every((input) => input.checked),
        some: inputs.some((input) => input.checked),
      });
    }

    const onChange = () => updateSelection(formElement);
    formElement.addEventListener("change", onChange);
    updateSelection(formElement);
    return () => formElement.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = selection.some && !selection.all;
  }, [selection]);

  return (
    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-700">
      <input
        ref={inputRef}
        type="checkbox"
        checked={selection.all}
        onChange={(event) => {
          const checked = event.currentTarget.checked;
          const inputs = event.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[name="trainingRequestIds"]');
          inputs?.forEach((input) => { input.checked = checked; });
          setSelection({ all: checked, some: checked });
        }}
        className="size-4 accent-[#800020]"
      />
      Select all trainings for this company
    </label>
  );
}
