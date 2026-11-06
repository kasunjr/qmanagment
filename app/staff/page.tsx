"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import WalkInTicketForm from "@/components/WalkInTicketForm";
import { DEFAULT_APP_THEME, themeStyle, type AppTheme } from "@/lib/theme-style";
import { AlertTriangle, AtSign, CheckCircle, ClipboardList, Clock3, LogOut, MapPin, Play, UserCheck } from "lucide-react";

// This staff member's counter. Waiting tickets are shared with other counters in the branch
// that serve the same services; serving and completed tickets are this counter's own.
interface Counter {
  name: string | null;
  branch_name: string;
  services: { id: string; name: string }[];
}

interface QueueTicket {
  id: string;
  ticket_number: number;
  customer_name: string;
  service_name: string;
  status: "waiting" | "serving" | "completed";
  created_at: string;
}

interface CounterResponse {
  counter: Counter | null;
  tickets: QueueTicket[];
  daily_limit_reached?: boolean;
  error?: string;
}

interface StaffSession {
  name: string;
  username: string;
  tenant_code: string;
}

function formatWaitTime(createdAt: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000));
  return minutes < 1 ? "<1 min" : `${minutes} min`;
}

export default function StaffPage() {
  const router = useRouter();
  const [counter, setCounter] = useState<Counter | null>(null);
  const [staffUser, setStaffUser] = useState<StaffSession | null>(null);
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCallingNext, setIsCallingNext] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [callError, setCallError] = useState("");
  const [signOutError, setSignOutError] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [theme, setTheme] = useState<AppTheme | null>(null);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
  const servingTicket = tickets.find((ticket) => ticket.status === "serving");
  const waitingTickets = tickets.filter((ticket) => ticket.status === "waiting");
  const completedTickets = tickets.filter((ticket) => ticket.status === "completed");
  const counterLabel = counter ? `${counter.branch_name} · ${counter.name ?? "Unnamed counter"}` : "";
  const hasServices = Boolean(counter?.services.length);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/staff/theme", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as { theme?: AppTheme } | null;
        const loadedTheme = response.ok && result?.theme ? result.theme : DEFAULT_APP_THEME;
        if (!controller.signal.aborted) {
          document.body.style.backgroundColor = loadedTheme.background_color;
          document.body.style.color = loadedTheme.text_color;
          setTheme(loadedTheme);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          document.body.style.backgroundColor = DEFAULT_APP_THEME.background_color;
          document.body.style.color = DEFAULT_APP_THEME.text_color;
          setTheme(DEFAULT_APP_THEME);
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/staff-auth/me", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as { staffUser?: StaffSession } | null;
        if (!controller.signal.aborted && response.ok && result?.staffUser) setStaffUser(result.staffUser);
      })
      .catch(() => {});
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

    const loadCounter = async () => {
      try {
        const response = await fetch("/api/staff/queue", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => null)) as CounterResponse | null;
        if (!response.ok || !result) {
          throw new Error(result?.error || "Unable to load your counter.");
        }
        setCounter(result.counter);
        setTickets(result.tickets);
        setDailyLimitReached(result.daily_limit_reached === true);
        setError("");
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load your counter.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void loadCounter();
    // Fires when any ticket in the branch is created, called or completed, so tickets called
    // by another counter leave this waiting list straight away.
    const events = new EventSource("/api/staff/queue/events");
    events.addEventListener("open", () => void loadCounter());
    events.addEventListener("tickets-updated", () => void loadCounter());
    events.addEventListener("daily-limit-changed", () => void loadCounter());
    const refreshInterval = window.setInterval(() => void loadCounter(), 60_000);
    return () => {
      controller.abort();
      events.close();
      window.clearInterval(refreshInterval);
    };
  }, []);

  const callNext = async () => {
    if (!counter || servingTicket || isCallingNext) return;

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
    if (!counter || !servingTicket || isCompleting) return;

    setIsCompleting(true);
    setCallError("");
    try {
      const response = await fetch("/api/staff/queue/complete", { method: "POST" });
      const result = (await response.json().catch(() => null)) as
        | { completedTicket?: QueueTicket; error?: string }
        | null;
      if (!response.ok || !result?.completedTicket) {
        throw new Error(result?.error || "Unable to complete the serving ticket.");
      }
      // Finishing does not call the next customer; the counter stays free until "Call next".
      setTickets((current) => [
        result.completedTicket!,
        ...current.filter((ticket) => ticket.id !== result.completedTicket!.id),
      ]);
    } catch (completeError) {
      setCallError(completeError instanceof Error ? completeError.message : "Unable to complete the serving ticket.");
    } finally {
      setIsCompleting(false);
    }
  };

  const signOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setSignOutError("");
    try {
      const response = await fetch("/api/staff-auth/logout", { method: "POST" });
      const result = (await response.json().catch(() => null)) as { tenantCode?: string } | null;
      if (!response.ok) throw new Error("Unable to sign out.");
      const tenantCode = result?.tenantCode ?? staffUser?.tenant_code;
      router.replace(tenantCode && /^[A-F0-9]{7}$/i.test(tenantCode) ? `/staff/${tenantCode}` : "/");
      router.refresh();
    } catch (signOutError) {
      setSignOutError(signOutError instanceof Error ? signOutError.message : "Unable to sign out.");
      setIsSigningOut(false);
    }
  };

  if (!theme) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ backgroundColor: DEFAULT_APP_THEME.background_color }} role="status" aria-label="Loading staff counter">
        <span aria-hidden="true" className="h-8 w-8 animate-spin rounded-full border-4 motion-reduce:animate-none" style={{ borderColor: `${DEFAULT_APP_THEME.primary_color}33`, borderTopColor: DEFAULT_APP_THEME.primary_color }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-theme-text" style={themeStyle(theme)}>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-theme-text/10 pb-5">
        <div className="flex min-w-0 items-center gap-3">
          {theme.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="h-11 w-11 shrink-0 rounded-theme object-contain" src={theme.logo_url} />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-theme bg-theme-primary/10">
              <UserCheck className="h-6 w-6 text-theme-primary" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-theme-text/55">{theme.app_name}</p>
            <h1 className="truncate text-xl font-bold sm:text-2xl">{counter?.name ? counter.name : "Your counter"}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasServices && (
            <div className="flex items-center gap-2 rounded-theme border border-theme-text/15 bg-theme-surface px-3 py-2 text-sm font-semibold">
              <Clock3 className="h-4 w-4 text-theme-secondary" />
              {waitingTickets.length} waiting
            </div>
          )}
          <button
            className="flex min-h-10 items-center justify-center gap-2 rounded-theme border border-theme-text/20 bg-theme-surface px-3 py-2 text-sm font-semibold text-theme-text transition hover:bg-theme-text/5 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSigningOut}
            onClick={() => void signOut()}
            type="button"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </header>

      <section aria-label="Staff account and assignments" className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-theme border border-theme-text/10 bg-theme-surface px-3 py-2.5 text-xs sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-theme-primary" />
          <span className="text-theme-text/60">Branch</span>
          <span className="truncate font-medium">{counter?.branch_name ?? "Not assigned"}</span>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <ClipboardList aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-theme-primary" />
          <span className="shrink-0 text-theme-text/60">Services</span>
          <span className="truncate font-medium">{counter?.services.map((service) => service.name).join(", ") || "None assigned"}</span>
        </div>
      </section>

      {signOutError && <p className="rounded-theme border border-theme-secondary/30 bg-theme-secondary/10 p-3 text-sm" role="alert">{signOutError}</p>}
      {error && <p className="rounded-theme border border-theme-secondary/30 bg-theme-secondary/10 p-3 text-sm" role="alert">{error}</p>}
      {callError && <p className="rounded-theme border border-theme-secondary/30 bg-theme-secondary/10 p-3 text-sm" role="alert">{callError}</p>}
      {hasServices && dailyLimitReached && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800" role="status">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="font-semibold">Today&apos;s ticket limit has been reached.</p>
            <p className="mt-0.5">
              Customers can&apos;t book new tickets until tomorrow. You can still serve the tickets already waiting.
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="py-10 text-center text-sm text-theme-text/60" role="status">Loading your counter...</p>
      ) : !counter ? (
        <div className="border-y border-theme-text/10 py-12 text-center">
          <p className="text-lg font-semibold">No branch assigned</p>
          <p className="mt-1 text-sm text-theme-text/60">Ask an administrator to assign a branch to your counter.</p>
        </div>
      ) : !hasServices ? (
        <div className="border-y border-theme-text/10 py-12 text-center">
          <p className="text-lg font-semibold">No services assigned</p>
          <p className="mt-1 text-sm text-theme-text/60">Ask an administrator to choose the services your counter serves.</p>
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
                <span className="text-sm text-theme-on-secondary/80">{counterLabel}</span>
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
                  {isCompleting ? "Finishing..." : "Finish"}
                </button>
              </div>
            </section>
          ) : (
            <section className="flex flex-wrap items-center justify-between gap-5 rounded-theme-lg border border-theme-text/10 bg-theme-surface p-5 sm:p-7">
              <div>
                <p className="text-sm font-bold uppercase text-theme-text/60">No active customer</p>
                <p className="mt-1 text-xl font-semibold">
                  {waitingTickets.length ? "Ready to call the next ticket" : "No one is waiting"}
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
                <h2 className="text-lg font-bold" id="waiting-list-title">Waiting customers</h2>
                <p className="text-sm text-theme-text/60">
                  For your services, shared with other counters. The longest waiting is called next.
                </p>
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