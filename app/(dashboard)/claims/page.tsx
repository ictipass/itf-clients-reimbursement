const evidenceGroups = [
  "Claim cover letter",
  "Forms 1A, 1B, 2A, 2B, 3A, 4A, and 5A",
  "Attendance sheets",
  "Payment receipts",
  "Training reports",
  "Photographs and certificates",
];

export default function ClaimsPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Reimbursement claims</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
        The claims module will package post-training evidence, calculate recommended
        eligibility, and route reimbursement decisions through reviewer and approver roles.
      </p>
      <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white">
        {evidenceGroups.map((group) => (
          <div
            key={group}
            className="border-b border-zinc-100 px-5 py-4 text-sm font-medium last:border-b-0"
          >
            {group}
          </div>
        ))}
      </div>
    </div>
  );
}
