import Link from "next/link";
import { notFound } from "next/navigation";

import { createComplianceYearAction } from "@/app/(dashboard)/registry/[companyId]/compliance/actions";
import { getEmployerCompany } from "@/lib/registry";

export default async function NewComplianceYearPage({
  params,
}: Readonly<{
  params: Promise<{ companyId: string }>;
}>) {
  const { companyId } = await params;
  const company = await getEmployerCompany(companyId);

  if (!company) {
    notFound();
  }

  const action = createComplianceYearAction.bind(null, company.id);
  const currentYear = new Date().getFullYear();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
      <div className="mb-6">
        <Link href={`/registry/${company.id}`} className="text-sm font-semibold text-[#800020]">
          Back to company
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Create compliance year</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
          Capture the annual statutory compliance return for {company.legalName}. Evidence
          documents such as contribution receipts and annual training plans will attach in a later
          slice.
        </p>
      </div>

      <form action={action} className="grid gap-6 rounded-lg border border-zinc-200 bg-white p-6">
        <section className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-medium">
            Compliance year
            <input
              name="year"
              type="number"
              min="2000"
              max={currentYear + 1}
              required
              defaultValue={currentYear}
              className="min-h-11 rounded-md border border-zinc-300 px-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Nigerian employees
            <input
              name="nigerianEmployeeCount"
              type="number"
              min="0"
              className="min-h-11 rounded-md border border-zinc-300 px-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Expatriate employees
            <input
              name="expatriateEmployeeCount"
              type="number"
              min="0"
              className="min-h-11 rounded-md border border-zinc-300 px-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Total employees
            <input
              name="totalEmployeeCount"
              type="number"
              min="0"
              className="min-h-11 rounded-md border border-zinc-300 px-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Turnover
            <input
              name="turnover"
              inputMode="decimal"
              className="min-h-11 rounded-md border border-zinc-300 px-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Annual payroll total
            <input
              name="payrollTotal"
              inputMode="decimal"
              className="min-h-11 rounded-md border border-zinc-300 px-3"
            />
          </label>
        </section>

        <section className="grid gap-4 border-t border-zinc-100 pt-6 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Contribution assessed
            <input
              name="contributionAmount"
              inputMode="decimal"
              className="min-h-11 rounded-md border border-zinc-300 px-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Amount paid
            <input
              name="amountPaid"
              inputMode="decimal"
              className="min-h-11 rounded-md border border-zinc-300 px-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium md:col-span-2">
            Amount paid in words
            <input
              name="amountPaidInWords"
              className="min-h-11 rounded-md border border-zinc-300 px-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Payment mode
            <input name="paymentMode" className="min-h-11 rounded-md border border-zinc-300 px-3" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Contribution paid date
            <input
              name="contributionPaidAt"
              type="date"
              className="min-h-11 rounded-md border border-zinc-300 px-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Annual plan submitted date
            <input
              name="annualPlanSubmittedAt"
              type="date"
              className="min-h-11 rounded-md border border-zinc-300 px-3"
            />
          </label>
        </section>

        <section className="grid gap-4 border-t border-zinc-100 pt-6 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Declaration name
            <input
              name="declarationName"
              className="min-h-11 rounded-md border border-zinc-300 px-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Declaration position
            <input
              name="declarationPosition"
              className="min-h-11 rounded-md border border-zinc-300 px-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Declaration phone
            <input
              name="declarationPhone"
              className="min-h-11 rounded-md border border-zinc-300 px-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Declaration date
            <input
              name="declaredAt"
              type="date"
              className="min-h-11 rounded-md border border-zinc-300 px-3"
            />
          </label>
        </section>

        <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-100 pt-5">
          <Link
            href={`/registry/${company.id}`}
            className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold"
          >
            Cancel
          </Link>
          <button className="min-h-11 rounded-md bg-[#800020] px-5 text-sm font-semibold text-white">
            Create compliance year
          </button>
        </div>
      </form>
    </div>
  );
}
