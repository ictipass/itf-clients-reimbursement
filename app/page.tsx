const readinessMetrics = [
  { label: "Registration dossier", value: "4", detail: "CAC, TCC, audit, Form 7A" },
  { label: "Claim evidence groups", value: "9", detail: "Forms, receipts, reports, proof" },
  { label: "Deadline controls", value: "2", detail: "31 Mar plan, May claim close" },
  { label: "Governance model", value: "RBAC", detail: "Workspace-ready access control" },
];

const lifecycleStages = [
  {
    stage: "01",
    title: "Employer onboarding",
    description:
      "Capture legal identity, payroll basis, ITF employer number, registration documents, validation history, and company activation state.",
    controls: ["No hard deletion", "Workspace organization link", "Document expiry tracking"],
  },
  {
    stage: "02",
    title: "Annual compliance",
    description:
      "Track statutory contribution payment, L&D policy, training policy, annual training plan, and deadline acceptance evidence.",
    controls: ["31 March control", "Signed and stamped evidence", "Contribution eligibility gate"],
  },
  {
    stage: "03",
    title: "Pre-training approval",
    description:
      "Package Form 4A requests before training begins, including provider, venue, participants, expected costs, and approval duplicates.",
    controls: ["Prior approval required", "Versioned forms", "Reviewer decision trail"],
  },
  {
    stage: "04",
    title: "Reimbursement claim",
    description:
      "Assemble post-training evidence, ITF Forms 1A to 5A where applicable, receipts, attendance sheets, reports, photos, and certificates.",
    controls: ["May submission target", "Completeness scoring", "Duplicate office records"],
  },
  {
    stage: "05",
    title: "Review and settlement",
    description:
      "Route claims through institutional review, exception handling, approval, reimbursement calculation, and final archive.",
    controls: ["Segregation of duties", "Up to 50 percent eligibility", "Audit export"],
  },
];

const mvpChecklist = [
  "Workspace-aware identity boundary and RBAC roles",
  "Company registry with soft deactivation",
  "Document vault metadata and expiry checks",
  "Annual compliance cycle setup",
  "Training plan and Form 4A workflow",
  "Reimbursement claim checklist engine",
  "Review queue, decisions, comments, and audit trail",
  "Operational dashboards for management oversight",
];

const recommendedName = "ITF Reimbursement Gateway";

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(128,0,32,0.12),_transparent_32rem),linear-gradient(180deg,#ffffff_0%,#f7f4f5_46%,#ffffff_100%)] text-zinc-950">
      <section className="border-b border-zinc-200/80 bg-white/85">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-8 lg:px-8">
          <header className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
                Industrial Training Fund
              </p>
              <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
                {recommendedName}
              </h1>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Enterprise posture
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-900">
                Centralized governance, audit-first records, Workspace-ready access
              </p>
            </div>
          </header>

          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-xl leading-8 text-zinc-700">
                A government-grade platform for registering employers, controlling ITF
                compliance evidence, approving training requests, and packaging
                reimbursement claims with complete institutional traceability.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#workflow"
                  className="inline-flex min-h-11 items-center rounded-full bg-[#800020] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#65001a]"
                >
                  View workflow model
                </a>
                <a
                  href="#roadmap"
                  className="inline-flex min-h-11 items-center rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-zinc-900 transition hover:border-zinc-500"
                >
                  MVP checklist
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {readinessMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-2xl font-semibold text-[#800020]">{metric.value}</p>
                  <p className="mt-2 text-sm font-semibold text-zinc-950">{metric.label}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-600">{metric.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
              Operating workflow
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
              From registration to reimbursed claim
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-zinc-600">
            Each stage should become a stateful workflow with assignments, due dates,
            evidence requirements, validation rules, and immutable audit events.
          </p>
        </div>

        <div className="grid gap-4">
          {lifecycleStages.map((item) => (
            <article
              key={item.stage}
              className="grid gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm md:grid-cols-[5rem_1fr_19rem]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-950 text-sm font-semibold text-white">
                {item.stage}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-zinc-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-650">{item.description}</p>
              </div>
              <ul className="grid gap-2">
                {item.controls.map((control) => (
                  <li
                    key={control}
                    className="rounded-full border border-[#800020]/15 bg-[#800020]/5 px-3 py-2 text-xs font-semibold text-[#65001a]"
                  >
                    {control}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="roadmap" className="border-y border-zinc-200 bg-zinc-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-200">
              Build direction
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              MVP scope with production-grade foundations
            </h2>
            <p className="mt-4 text-sm leading-6 text-zinc-300">
              PostgreSQL is appropriate for core transactional workflow, audit metadata,
              RBAC, claims, approvals, and compliance records. Store document binaries
              in object storage and keep hashes, classifications, expiry dates, and
              retention metadata in PostgreSQL.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {mvpChecklist.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-sm font-medium leading-6 text-zinc-100"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
