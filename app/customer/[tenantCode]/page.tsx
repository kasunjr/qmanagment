"use client";

import { useEffect, useState } from "react";
import { Ticket, Clock, CheckCircle2 } from "lucide-react";
import { DEFAULT_APP_THEME, themeStyle, type AppTheme } from "@/lib/theme-style";

interface Branch {
  id: string;
  name: string;
  code: string;
}
interface Service {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
}
interface QueueTicket {
  id: string;
  ticket_number: number;
  customer_name: string;
  status: string;
  branch_name: string;
  service_name: string;
  queue_name: string;
  people_ahead: number;
}

const DAILY_LIMIT_MESSAGE = "No more tickets are available today. Please try again tomorrow.";

export default function CustomerPage({
  params,
}: {
  params: { tenantCode: string };
}) {
  const tenantCode = params.tenantCode.toUpperCase();
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_APP_THEME);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [acceptingTickets, setAcceptingTickets] = useState(true);

  const [name, setName] = useState("");
  const [branchId, setBranchId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [ticket, setTicket] = useState<QueueTicket | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bookError, setBookError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/public/${tenantCode}/theme`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as { theme?: AppTheme } | null;
        if (response.ok && result?.theme) setTheme(result.theme);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [tenantCode]);

  useEffect(() => {
    document.body.style.backgroundColor = theme.background_color;
    document.body.style.color = theme.text_color;
    return () => {
      document.body.style.backgroundColor = "";
      document.body.style.color = "";
    };
  }, [theme]);

  useEffect(() => {
    const controller = new AbortController();

    const loadOptions = async () => {
      setIsLoading(true);
      setLoadError("");
      try {
        const response = await fetch(`/api/public/${tenantCode}/booking-options`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => null)) as {
          branches?: Branch[];
          services?: Service[];
          accepting_tickets?: boolean;
          error?: string;
        } | null;
        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "This booking link is not valid."
              : result?.error || "Unable to load booking options.",
          );
        }
        setBranches(result?.branches ?? []);
        setServices(result?.services ?? []);
        setAcceptingTickets(result?.accepting_tickets ?? true);
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(error instanceof Error ? error.message : "Unable to load booking options.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void loadOptions();
    return () => controller.abort();
  }, [tenantCode]);

  const ticketStorageKey = `qms_ticket_${tenantCode}`;
  const selectedService = services.find((s) => s.id === serviceId);

  // Local storage can be unavailable (private mode, blocked site data); the page works without it.
  const storeTicket = (value: QueueTicket | null) => {
    try {
      if (value) window.localStorage.setItem(ticketStorageKey, JSON.stringify(value));
      else window.localStorage.removeItem(ticketStorageKey);
    } catch {
      // Ignored: the ticket is still shown, it just will not survive a reload.
    }
  };

  // Restores the ticket saved by this browser, then refreshes it from the server.
  useEffect(() => {
    let saved: QueueTicket | null = null;
    try {
      saved = JSON.parse(window.localStorage.getItem(ticketStorageKey) ?? "null") as QueueTicket | null;
    } catch {
      saved = null;
    }
    if (!saved || typeof saved.id !== "string") return;

    const savedId = saved.id;
    setTicket(saved);
    const controller = new AbortController();

    const refreshTicket = async () => {
      try {
        const response = await fetch(`/api/public/${tenantCode}/tickets/${savedId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => null)) as {
          ticket?: QueueTicket;
        } | null;

        // Gone or from a previous day: forget it and show the form again.
        if (response.status === 404) {
          storeTicket(null);
          setTicket((current) => (current?.id === savedId ? null : current));
        } else if (response.ok && result?.ticket) {
          const fresh = result.ticket;
          // A completed ticket is shown this once but no longer kept.
          storeTicket(fresh.status === "completed" ? null : fresh);
          setTicket((current) => (current?.id === savedId ? fresh : current));
        }
      } catch {
        // Offline or server error: keep showing the saved ticket.
      }
    };

    void refreshTicket();
    return () => controller.abort();
  }, [tenantCode]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsBooking(true);
    setBookError("");
    try {
      const response = await fetch(`/api/public/${tenantCode}/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: name.trim(),
          branch_id: branchId,
          service_id: serviceId,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        ticket?: QueueTicket;
        error?: string;
      } | null;
      if (response.status === 429) {
        setAcceptingTickets(false);
        return;
      }
      if (!response.ok || !result?.ticket) {
        throw new Error(result?.error || "Unable to create ticket.");
      }
      setTicket(result.ticket);
      storeTicket(result.ticket);
    } catch (error) {
      setBookError(error instanceof Error ? error.message : "Unable to create ticket.");
    } finally {
      setIsBooking(false);
    }
  };

  const bookAnother = () => {
    setTicket(null);
    storeTicket(null);
    setName("");
    setBranchId("");
    setServiceId("");
    setBookError("");
  };

  return (
    <div
      className="mx-auto max-w-lg rounded-theme-lg border border-theme-text/10 bg-theme-surface p-6 shadow-sm"
      style={themeStyle(theme)}
    >
      <div className="mb-6 flex items-center gap-3 border-b border-theme-text/10 pb-4">
        {theme.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="h-9 w-9 shrink-0 rounded-theme object-contain" src={theme.logo_url} />
        ) : (
          <Ticket className="h-8 w-8 shrink-0 text-theme-primary" />
        )}
        <div>
          <h1 className="text-2xl font-bold text-theme-text">Customer Queue Portal</h1>
          <p className="text-sm text-theme-text/60">Get a digital queue ticket instantly</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-theme-text/60">Loading booking options...</p>
      ) : loadError ? (
        <p className="text-sm text-red-500" role="alert">{loadError}</p>
      ) : branches.length === 0 || services.length === 0 ? (
        <p className="text-sm text-slate-500">Booking is not available yet.</p>
      ) : !ticket && !acceptingTickets ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center" role="status">
          <Clock className="w-6 h-6 text-amber-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-amber-800">{DAILY_LIMIT_MESSAGE}</p>
        </div>
      ) : !ticket ? (
        <form onSubmit={handleBook} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-theme-text/80">Your Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full rounded-theme border border-theme-text/20 bg-theme-surface p-2.5 text-sm text-theme-text placeholder:text-theme-text/40 focus:border-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary/30"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-theme-text/80">Select Branch</label>
            <select
              required
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setServiceId("");
              }}
              className="w-full rounded-theme border border-theme-text/20 bg-theme-surface p-2.5 text-sm text-theme-text focus:border-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary/30"
            >
              <option value="">Select a branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-theme-text/80">Select Service</label>
            <select
              required
              disabled={!branchId}
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full rounded-theme border border-theme-text/20 bg-theme-surface p-2.5 text-sm text-theme-text focus:border-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">{branchId ? "Select a service" : "Select a branch first"}</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {selectedService?.description && (
              <p className="mt-2 whitespace-pre-line text-sm text-theme-text/70">
                {selectedService.description}
              </p>
            )}
          </div>

          {bookError && <p className="text-sm text-red-500" role="alert">{bookError}</p>}

          <button
            type="submit"
            disabled={isBooking}
            className="w-full rounded-theme bg-theme-primary py-3 font-semibold text-theme-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBooking ? "Getting ticket..." : "Get Queue Ticket"}
          </button>
        </form>
      ) : (
        <div className="text-center space-y-6">
          <div className="rounded-theme-lg border border-theme-primary/25 bg-theme-primary/10 p-6">
            <span className="text-xs font-bold uppercase tracking-widest text-theme-primary">Your Ticket Number</span>
            <div className="my-2 text-5xl font-extrabold text-theme-primary">
              A {String(ticket.ticket_number).padStart(3, "0")}
            </div>
            <p className="text-sm font-medium text-theme-text">Name: {ticket.customer_name}</p>
            <p className="text-sm font-medium text-theme-text">Branch: {ticket.branch_name}</p>
            <p className="text-sm font-medium text-theme-text">Service: {ticket.service_name}</p>
            <p className="text-sm font-medium text-theme-text">Queue: {ticket.queue_name}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-theme border border-theme-text/10 bg-theme-surface p-4 text-center">
              <Clock className="mx-auto mb-1 h-5 w-5 text-theme-text/40" />
              <div className="text-xs text-theme-text/60">People Ahead</div>
              <div className="text-xl font-bold text-theme-text">{ticket.people_ahead}</div>
            </div>
            <div className="rounded-theme border border-theme-text/10 bg-theme-surface p-4 text-center">
              <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-theme-secondary" />
              <div className="text-xs text-theme-text/60">Status</div>
              <div className="text-sm font-bold capitalize text-theme-secondary">{ticket.status}</div>
            </div>
          </div>

          {ticket.status === "completed" && (
            <button
              onClick={bookAnother}
              className="text-xs text-theme-primary underline hover:opacity-80"
            >
              Book Another Ticket
            </button>
          )}
        </div>
      )}
    </div>
  );
}
