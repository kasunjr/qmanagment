import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  QrCode,
  Settings,
  UserCheck,
  Users,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="space-y-12 pb-10">
      <section className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 px-7 py-10 sm:px-10 sm:py-14">
        <div className="absolute right-0 top-0 hidden h-full w-1/3 border-l border-zinc-800/70 lg:block" />
        <div className="relative max-w-3xl">
          <p className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-teal-400">
            <span className="h-2 w-2 rounded-full bg-teal-400" /> Queue
            operations / Overview
          </p>
          <h1 className="max-w-2xl text-4xl font-bold leading-tight text-zinc-50 sm:text-5xl">
            A clearer way to move every queue forward.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">
            MyTurn connects branch setup, customer bookings, and staff counters
            in one workflow. Customers join remotely, staff call the next
            ticket, and admins keep services and teams organized.
          </p>
          <p className="mt-4 max-w-2xl border-l-2 border-teal-500 pl-3 text-sm leading-6 text-zinc-500">
            MyTurn: MyTurn makes managing queues simple and efficient. Your
            Queue Management system is on your fingertips.
          </p>
          <Link
            href="/admin"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-teal-400 px-5 py-3 text-sm font-bold text-zinc-950 transition hover:bg-teal-300"
          >
            Join with MyTurn <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="relative mt-10 grid max-w-3xl grid-cols-3 border-t border-zinc-800 pt-5 text-xs text-zinc-500 sm:mt-12">
          <span>01 / Configure</span>
          <span>02 / Join</span>
          <span>03 / Serve</span>
        </div>
      </section>

      <section aria-labelledby="workflow-title">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-400">
              How it works
            </p>
            <h2
              id="workflow-title"
              className="mt-2 text-2xl font-bold text-zinc-100"
            >
              One queue, from setup to service
            </h2>
          </div>
          <ArrowDownRight className="mb-1 hidden h-5 w-5 text-zinc-600 sm:block" />
        </div>
        <div className="grid gap-px overflow-hidden rounded-xl border border-zinc-800 bg-zinc-800 md:grid-cols-4">
          {[
            {
              number: "01",
              icon: Settings,
              title: "Set up your operation",
              description:
                "Admins add branches, define services and queues, assign staff, and create QR codes for access the customer portal and staff portal.",
            },
            {
              number: "02",
              icon: QrCode,
              title: "Customers join",
              description:
                "A customer opens the customer portal, enters their name, chooses a branch/service, and receives a queue ticket.",
            },
            {
              number: "03",
              icon: ClipboardList,
              title: "Staff call the next ticket",
              description:
                "At the counter, staff call the next waiting customer and see who is currently being served.",
            },
            {
              number: "04",
              icon: CheckCircle2,
              title: "Complete the service",
              description:
                "When service is finished, staff mark the ticket complete so the queue is ready to move on.",
            },
          ].map((step) => {
            const Icon = step.icon;
            return (
              <article key={step.number} className="bg-zinc-900 p-5 sm:p-6">
                <div className="mb-7 flex items-center justify-between">
                  <span className="text-xs font-bold tabular-nums text-zinc-600">
                    {step.number}
                  </span>
                  <Icon className="h-5 w-5 text-teal-400" />
                </div>
                <h3 className="text-base font-semibold text-zinc-100">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {step.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="portals-title">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-400">
            Choose your workspace
          </p>
          <h2
            id="portals-title"
            className="mt-2 text-2xl font-bold text-zinc-100"
          >
            Go to your portal
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href="/admin"
            className="group rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-teal-500/70 hover:bg-zinc-900/80"
          >
            <div className="mb-7 flex h-10 w-10 items-center justify-center rounded-lg bg-teal-400/10 text-teal-400">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100">Customer portal</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Book a service and receive a ticket with your place in line.
            </p>
          </Link>

          <Link
            href="/admin"
            className="group rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-teal-500/70 hover:bg-zinc-900/80"
          >
            <div className="mb-7 flex h-10 w-10 items-center justify-center rounded-lg bg-teal-400/10 text-teal-400">
              <UserCheck className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100">Staff counter</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Work through the waiting queue and update ticket status.
            </p>
          </Link>

          <Link
            href="/admin"
            className="group rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-teal-500/70 hover:bg-zinc-900/80"
          >
            <div className="mb-7 flex h-10 w-10 items-center justify-center rounded-lg bg-teal-400/10 text-teal-400">
              <Settings className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100">Admin portal</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Manage branches, services, queues, staff, and access QR codes.
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
