import Link from "next/link";
import Image from "next/image";

import { appName } from "@/lib/domain";

const entryLinks = [
  { href: "/sign-in", label: "Sign in" },
  { href: "/verify", label: "Verify certificate" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/registry", label: "Employer registry" },
];

const statutoryWorkflows = [
  {
    href: "/registry",
    title: "Employer registration",
    scope: "Form 7A, Area Office review, contribution recommendation, receipt verification, HQ completion.",
  },
  {
    href: "/compliance",
    title: "Annual compliance",
    scope: "Contribution year records, statutory returns, L&D records, training plan evidence.",
  },
  {
    href: "/dashboard",
    title: "Desk attention items",
    scope: "Role-specific work items for Area Office and Headquarters officers.",
  },
  {
    href: "/claims",
    title: "Reimbursement claims",
    scope: "Claim package, supporting evidence, review trail, and settlement preparation.",
  },
];

const rolePaths = [
  "Employer",
  "Area Manager",
  "HORIC",
  "Revenue Accountant",
  "Reimbursement Officer",
  "Director FSD",
  "Head of Division",
  "HQ Reimbursement Officer",
];

const quickLinks = [
  { href: "/registry/new", label: "Create employer profile" },
  { href: "/registry", label: "Open registry queue" },
  { href: "/dashboard", label: "Open attention queue" },
  { href: "/sign-in", label: "Role test login" },
];

const testAccounts = [
  "am@itf.local",
  "horic@itf.local",
  "ra@itf.local",
  "dfsd@itf.local",
  "employer@itf.local",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <section
        className="border-b border-zinc-800 bg-zinc-950 text-white"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(9,9,11,0.94), rgba(9,9,11,0.78), rgba(9,9,11,0.42)), url('https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1800&q=80')",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <header className="border-b border-white/15">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 lg:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <Image
                  src="/favicon.ico"
                  alt="Industrial Training Fund logo"
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-full bg-white p-1"
                />
                <div>
                  <p className="text-sm font-semibold uppercase text-rose-100">
                    Industrial Training Fund
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight">{appName}</h1>
                </div>
              </div>
              <nav className="flex flex-wrap gap-2">
                {entryLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inline-flex min-h-10 items-center rounded-md border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white transition hover:bg-white hover:text-zinc-950"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 lg:grid-cols-[0.72fr_1.28fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase text-rose-100">Statutory workflow</p>
            <h2 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight">
              Registration, compliance, training approval, and reimbursement processing.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-100">
              This portal supports employers of labour and ITF officers involved in the
              reimbursement scheme workflow. Access is based on assigned role, organization, Area
              Office, and Headquarters responsibility.
            </p>
          </div>
          <div className="grid content-start gap-3 rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur">
            <p className="text-sm font-semibold text-white">Primary actions</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {quickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex min-h-11 items-center justify-between rounded-md border border-white/20 bg-white px-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
                >
                  {item.label}
                  <span aria-hidden="true">-&gt;</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-[#800020]">Workflow areas</p>
              <h2 className="mt-2 text-2xl font-semibold">Operational modules</h2>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            {statutoryWorkflows.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="grid gap-2 rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-[#800020]/50"
              >
                <p className="text-lg font-semibold text-zinc-950">{item.title}</p>
                <p className="text-sm leading-6 text-zinc-600">{item.scope}</p>
              </Link>
            ))}
          </div>
        </div>

        <aside className="grid content-start gap-5">
          <section className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-sm font-semibold uppercase text-[#800020]">User paths</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {rolePaths.map((role) => (
                <span
                  key={role}
                  className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700"
                >
                  {role}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-sm font-semibold uppercase text-[#800020]">Local test access</p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Use seeded role accounts for workflow testing. Shared local password:
              <span className="ml-1 font-mono font-semibold text-zinc-950">password123</span>.
            </p>
            <div className="mt-4 grid gap-2">
              {testAccounts.map((account) => (
                <span
                  key={account}
                  className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs font-semibold text-zinc-700"
                >
                  {account}
                </span>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
