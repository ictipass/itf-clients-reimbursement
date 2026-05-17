const registryRequirements = [
  "CAC certificate metadata",
  "Tax Clearance Certificate metadata",
  "Audited account evidence",
  "ITF Form 7A registration capture",
  "ITF employer number assignment",
  "Activation and deactivation history",
];

export default function RegistryPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Employer registry</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
        The registry MVP will manage company onboarding without hard deletion, keeping
        evidence metadata, review decisions, and activation history available for audit.
      </p>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {registryRequirements.map((item) => (
          <div
            key={item}
            className="rounded-lg border border-zinc-200 bg-white p-4 text-sm font-medium"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
