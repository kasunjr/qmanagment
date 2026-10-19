"use client";

import { useEffect, useState } from "react";
<<<<<<< HEAD
import { CheckCircle, Play, UserCheck } from "lucide-react";
import WalkInTicketForm from "@/components/WalkInTicketForm";
import { DEFAULT_APP_THEME, themeStyle, type AppTheme } from "@/lib/theme-style";
=======
import { AlertTriangle, CheckCircle, Clock3, Play, UserCheck } from "lucide-react";
>>>>>>> 3a4e7ee (Notify to staff page when reach daily ticket limit)

interface AssignedQueue {
  id: string;
  name: string;
  branch_name: string;
}

interface QueueTicket {
  id: string;
  ticket_number: number;
  customer_name: string;
  service_name: string;
  status: "waiting" | "serving" | "completed";
  created_at: string;
}

interface QueueResponse {
  queue: AssignedQueue | null;
  tickets: QueueTicket[];
  daily_limit_reached?: boolean;
  error?: string;
}

function formatWaitTime(createdAt: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000));
  return minutes < 1 ? "<1 min" : `${minutes} min`;
}

export default function StaffPage() {
  const [queue, setQueue] = useState<AssignedQueue | null>(null);
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCallingNext, setIsCallingNext] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [callError, setCallError] = useState("");
<<<<<<< HEAD
  const [theme, setTheme] = useState<AppTheme | null>(null);
=======
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
>>>>>>> 3a4e7ee (Notify to staff page when reach daily ticket limit)
  const servingTicket = tickets.find((ticket) => ticket.status === "serving");
  const waitingTickets = tickets.filter((ticket) => ticket.status === "waiting");
  const completedTickets = tickets.filter((ticket) => ticket.status === "completed");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/staff/theme", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as { theme?: AppTheme } | null;
        setTheme(response.ok && result?.theme ? result.theme : DEFAULT_APP_THEME);
      })
      .catch(() => {
        if (!controller.signal.aborted) setTheme(DEFAULT_APP_THEME);
      });
    return () => controller.abort();
  }, []);

  // The page background sits outside this component, so the theme is applied to <body> too.
  useEffect(() => {
    if (!theme) return;
    const { style } = document.body;
    style.backgroundColor = theme.background_color;
    style.color = theme.text_color;
    return () => {
      style.backgroundColor = "";
      style.color = "";
    };
  }, [theme]);

  useEffect(() => {
    const controller = new AbortController();

    const loadQueue = async () => {
      try {
        const response = await fetch("/api/staff/queue", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => null)) as QueueResponse | null;
        if (!response.ok || !result) {
          throw new Error(result?.error || "Unable to load assigned queue.");
        }
        setQueue(result.queue);
        setTickets(result.tickets);
        setDailyLimitReached(result.daily_limit_reached === true);
        setError("");
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load assigned queue.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void loadQueue();
    const events = new EventSource("/api/staff/queue/events");
    events.addEventListener("open", () => void loadQueue());
    events.addEventListener("tickets-updated", () => void loadQueue());
    events.addEventListener("daily-limit-changed", () => void loadQueue());
    const refreshInterval = window.setInterval(() => void loadQueue(), 60_000);
    return () => {
      controller.abort();
      events.close();
      window.clearInterval(refreshInterval);
    };
  }, []);

  const callNext = async () => {
    if (!queue || servingTicket || isCallingNext) return;

    setIsCallingNext(true);
    setCallError("");
    try {
      const response = await fetch("/api/staff/queue/next", { method: "POST" });
      const result = (await response.json().catch(() => null)) as
        | { ticket?: QueueTicket; error?: string }
        | null;
      if (!response.ok || !result?.ticket) {
        throw new Error(result?.error || "Unable to call the next customer.");
      }
      setTickets((current) => [
        result.ticket!,
        ...current.filter((ticket) => ticket.id !== result.ticket!.id),
      ]);
    } catch (callError) {
      setCallError(callError instanceof Error ? callError.message : "Unable to call the next customer.");
    } finally {
      setIsCallingNext(false);
    }
  };

  const completeServing = async () => {
    if (!queue || !servingTicket || isCompleting) return;

    setIsCompleting(true);
    setCallError("");
    try {
      const response = await fetch("/api/staff/queue/complete", { method: "POST" });
      const result = (await response.json().catch(() => null)) as
        | { completedTicket?: QueueTicket; calledTicket?: QueueTicket | null; error?: string }
        | null;
      if (!response.ok || !result?.completedTicket) {
        throw new Error(result?.error || "Unable to complete the serving ticket.");
      }
      setTickets((current) => {
        const remaining = current.filter(
          (ticket) => ticket.id !== result.completedTicket!.id && ticket.id !== result.calledTicket?.id,
        );
        return [
          ...(result.calledTicket ? [result.calledTicket] : []),
          result.completedTicket!,
          ...remaining,
        ];
      });
    } catch (completeError) {
      setCallError(completeError instanceof Error ? completeError.message : "Unable to complete the serving ticket.");
    } finally {
      setIsCompleting(false);
    }
  };

  if (!theme) {
    return <p className="py-10 text-center text-sm text-slate-500" role="status">Loading staff counter...</p>;
  }

  return (
    <div className="space-y-6 text-theme-text" style={themeStyle(theme)}>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-theme-text/10 pb-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-theme bg-theme-primary/10">
            <UserCheck className="h-6 w-6 text-theme-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">Staff counter</h1>
            <p className="truncate text-sm text-theme-text/60">
              {queue ? `${queue.branch_name} · ${queue.name}` : "Assigned queue"}
            </p>
          </div>
        </div>
        {queue && (
          <div className="flex items-center gap-2 rounded-full border border-theme-text/20 bg-theme-surface px-3 py-1.5 text-sm font-semibold">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            {waitingTickets.length} waiting
          </div>
        )}
      </header>

<<<<<<< HEAD
      {error && <p className="rounded-theme border border-red-300 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {callError && <p className="rounded-theme border border-red-300 bg-red-50 p-3 text-sm text-red-700" role="alert">{callError}</p>}
=======
      {error && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {callError && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700" role="alert">{callError}</p>}
      {queue && dailyLimitReached && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800" role="status">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="font-semibold">Today&apos;s ticket limit has been reached.</p>
            <p className="mt-0.5">
              Customers can&apos;t book new tickets until tomorrow. You can still serve the tickets already in your queue.
            </p>
          </div>
        </div>
      )}
>>>>>>> 3a4e7ee (Notify to staff page when reach daily ticket limit)

      {isLoading ? (
        <p className="py-10 text-center text-sm text-theme-text/60" role="status">Loading assigned queue...</p>
      ) : !queue ? (
        <div className="border-y border-theme-text/10 py-12 text-center">
          <p className="text-lg font-semibold">No queue assigned</p>
          <p className="mt-1 text-sm text-theme-text/60">Ask an administrator to assign a queue to your staff account.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {servingTicket ? (
            <section
              aria-labelledby="serving-ticket-title"
              className="overflow-hidden rounded-theme-lg bg-theme-secondary text-theme-on-secondary shadow-lg"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-theme-on-secondary/20 px-5 py-4 sm:px-7">
                <div className="flex items-center gap-2 text-sm font-bold uppercase text-theme-on-secondary/80">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-theme-on-secondary" />
                  <h2 id="serving-ticket-title">Now serving</h2>
                </div>
                <span className="text-sm text-theme-on-secondary/80">{queue.branch_name} · {queue.name}</span>
              </div>
              <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(180px,0.7fr)_minmax(0,1.5fr)_auto] lg:items-center">
                <p className="text-6xl font-extrabold leading-none sm:text-7xl">
                  {String(servingTicket.ticket_number).padStart(3, "0")}
                </p>
                <div className="min-w-0">
                  <p className="truncate text-2xl font-bold sm:text-3xl">{servingTicket.customer_name}</p>
                  <p className="mt-2 text-base text-theme-on-secondary/90 sm:text-lg">{servingTicket.service_name}</p>
                  <p className="mt-3 text-sm text-theme-on-secondary/70">Arrived {formatWaitTime(servingTicket.created_at)} ago</p>
                </div>
                <button
                  className="flex min-h-12 items-center justify-center gap-2 rounded-theme bg-theme-on-secondary px-5 py-3 text-sm font-bold text-theme-secondary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isCompleting || isLoading}
                  onClick={() => void completeServing()}
                  type="button"
                >
                  <CheckCircle className="h-5 w-5" />
                  {isCompleting ? "Completing..." : "Complete & call next"}
                </button>
              </div>
            </section>
          ) : (
            <section className="flex flex-wrap items-center justify-between gap-5 rounded-theme-lg border border-theme-text/10 bg-theme-surface p-5 sm:p-7">
              <div>
                <p className="text-sm font-bold uppercase text-theme-text/60">No active customer</p>
                <p className="mt-1 text-xl font-semibold">
                  {waitingTickets.length ? "Ready to call the next ticket" : "Queue is clear"}
                </p>
              </div>
              <button
                className="flex min-h-12 items-center justify-center gap-2 rounded-theme bg-theme-primary px-5 py-3 text-sm font-bold text-theme-on-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isCallingNext || isLoading || waitingTickets.length === 0}
                onClick={() => void callNext()}
                type="button"
              >
                <Play className="h-5 w-5 fill-current" />
                {isCallingNext ? "Calling..." : "Call next customer"}
              </button>
            </section>
          )}

          <WalkInTicketForm />

          <section aria-labelledby="waiting-list-title">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold" id="waiting-list-title">Waiting queue</h2>
                <p className="text-sm text-theme-text/60">First in line is called next</p>
              </div>
              <span className="text-sm font-semibold text-theme-text/60">{waitingTickets.length} tickets</span>
            </div>
            {waitingTickets.length === 0 ? (
              <p className="border-y border-theme-text/10 py-6 text-sm text-theme-text/60">No waiting customers.</p>
            ) : (
              <ol className="divide-y divide-theme-text/10 border-y border-theme-text/10">
                {waitingTickets.map((ticket, index) => (
                  <li key={ticket.id} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 py-4 sm:grid-cols-[3rem_minmax(0,1fr)_8rem] sm:gap-5">
                    <span className="text-sm font-semibold text-theme-text/40">{String(index + 1).padStart(2, "0")}</span>
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold">{ticket.customer_name}</p>
                      <p className="truncate text-sm text-theme-text/60">{ticket.service_name} · Ticket {String(ticket.ticket_number).padStart(3, "0")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-theme-primary">{formatWaitTime(ticket.created_at)}</p>
                      <p className="text-xs text-theme-text/60">waiting</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {completedTickets.length > 0 && (
            <details className="border-t border-theme-text/10 pt-4">
              <summary className="cursor-pointer text-sm font-semibold text-theme-text/70">
                Completed today ({completedTickets.length})
              </summary>
              <ul className="mt-2 divide-y divide-theme-text/10">
                {completedTickets.slice(0, 5).map((ticket) => (
                  <li key={ticket.id} className="flex items-center justify-between gap-4 py-3 text-sm text-theme-text/60">
                    <span className="truncate">{ticket.customer_name} · {ticket.service_name}</span>
                    <span className="shrink-0">{String(ticket.ticket_number).padStart(3, "0")}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}