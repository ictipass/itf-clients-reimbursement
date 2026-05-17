const controls = [
  { label: "31 March", detail: "Annual training plan deadline control" },
  { label: "Contribution", detail: "Training contribution evidence and eligibility gate" },
  { label: "Policies", detail: "L&D policy and training policy document metadata" },
  { label: "Review", detail: "Compliance officer decision trail and comments" },
];

export default function CompliancePage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Annual compliance</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
        Compliance years connect contribution payments, policy evidence, annual plans,
        statutory deadline warnings, and eligibility decisions before claims proceed.
      </p>
      <div className="mt-6 grid gap-3 md:grid-cols-4">
        {controls.map((control) => (
          <div key={control.label} className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-lg font-semibold text-[#800020]">{control.label}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{control.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
