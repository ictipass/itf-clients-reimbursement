import Image from "next/image";
import Link from "next/link";

import { getDb } from "@/lib/db";
import { getAppNameForMode } from "@/lib/domain";
import {
  DEFAULT_REVENUE_WORKFLOW_MODE,
  usesInAppRevenueWorkflow,
} from "@/lib/revenue-workflow";

const statutoryWorkflows = [
  {
    title: "Employer registration",
    scope: "Submit employer registration details and supporting evidence through the selected ITF Area Office.",
  },
  {
    title: "Contribution assessment and payment",
    scope: "Receive contribution recommendations, download invoices, make payments, and retain verified payment evidence.",
  },
  {
    title: "Annual compliance",
    scope: "File annual contribution records, payment evidence, and receive downloadable compliance certificates.",
  },
  {
    title: "Training administration",
    scope: "Submit annual training plans, request training approval, and support programme monitoring.",
  },
  {
    title: "Reimbursement claims",
    scope: "Prepare reimbursement claims, supporting evidence, review records, and award calculations.",
  },
];

export default async function Home() {
  const workspace = await getDb().workspace.findFirst({
    where: {
      isActive: true,
    },
    select: {
      revenueWorkflowMode: true,
    },
    orderBy: {
      name: "asc",
    },
  });
  const revenueWorkflowMode = workspace?.revenueWorkflowMode ?? DEFAULT_REVENUE_WORKFLOW_MODE;
  const usesInAppRevenue = usesInAppRevenueWorkflow(revenueWorkflowMode);
  const visibleWorkflows = usesInAppRevenue
    ? statutoryWorkflows
    : statutoryWorkflows.filter((workflow) =>
        workflow.title === "Training administration" || workflow.title === "Reimbursement claims",
      );

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <section
        className="border-b border-zinc-800 bg-zinc-950 text-white"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(9,9,11,0.95), rgba(9,9,11,0.8), rgba(9,9,11,0.45)), url('https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1800&q=80')",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <header className="border-b border-white/15">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between lg:px-8">
            <div className="flex items-center gap-3">
              <Image src="/favicon.ico" alt="Industrial Training Fund logo" width={56} height={56} className="h-14 w-14 rounded-full bg-white p-1" />
              <div>
                <p className="text-sm font-semibold uppercase text-rose-100">Industrial Training Fund</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">{getAppNameForMode(revenueWorkflowMode)}</h1>
              </div>
            </div>
            <nav className="flex flex-wrap gap-2">
              {usesInAppRevenue ? <Link href="/verify" className="inline-flex min-h-10 items-center rounded-md border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white">Verify certificate</Link> : null}
              <Link href="/sign-in" className="inline-flex min-h-10 items-center rounded-md border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white">Sign in</Link>
              <Link href="/get-started" className="inline-flex min-h-10 items-center rounded-md bg-white px-4 text-sm font-semibold text-zinc-950">Get started</Link>
            </nav>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 lg:grid-cols-[1fr_0.75fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase text-rose-100">
              {usesInAppRevenue
                ? "Integrated employer contribution and reimbursement services"
                : "Employer training and reimbursement services"}
            </p>
            <h2 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight">
              {usesInAppRevenue
                ? "From employer registration and contribution payment to training governance and reimbursement claims."
                : "Manage training and reimbursement claims for employers already registered with ITF."}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-100">
              {usesInAppRevenue
                ? "Secure access for employers of labour and authorized Industrial Training Fund officers managing contribution, compliance, training, monitoring, and reimbursement workflows."
                : "Secure access for employers and ITF officers managing training, monitoring, and reimbursement. Annual compliance is verified through the existing platform."}
            </p>
          </div>
          <div className="grid content-start gap-3 rounded-lg border border-white/15 bg-black/25 p-5 backdrop-blur">
            <p className="text-sm font-semibold text-white">Portal access</p>
            <Link href="/get-started" className="inline-flex min-h-11 items-center justify-between rounded-md bg-white px-4 text-sm font-semibold text-zinc-950">
              {usesInAppRevenue ? "Begin employer registration" : "Create a reimbursement account"} <span aria-hidden="true">-&gt;</span>
            </Link>
            <Link href="/sign-in" className="inline-flex min-h-11 items-center justify-between rounded-md border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white">
              Sign in to your workspace <span aria-hidden="true">-&gt;</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <p className="text-sm font-semibold uppercase text-[#800020]">
          {usesInAppRevenue ? "Integrated employer services" : "Reimbursement services"}
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Operational workflows</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {visibleWorkflows.map((item) => (
            <article key={item.title} className="grid gap-2 rounded-lg border border-zinc-200 bg-white p-5">
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="text-sm leading-6 text-zinc-600">{item.scope}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
