"use client";

import { useEffect, useState } from "react";
import { Ticket, Clock, CheckCircle2 } from "lucide-react";

interface Branch {
  id: string;
  name: string;
  code: string;
}
interface Service {
  id: string;
  name: string;
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

export default function CustomerPage({
  params,
}: {
  params: { tenantCode: string };
}) {
  const tenantCode = params.tenantCode.toUpperCase();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [name, setName] = useState("");
  const [branchId, setBranchId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [ticket, setTicket] = useState<QueueTicket | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bookError, setBookError] = useState("");

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
    <div className="max-w-lg mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
        <Ticket className="w-8 h-8 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Customer Queue Portal</h1>
          <p className="text-sm text-slate-500">Get a digital queue ticket instantly</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading booking options...</p>
      ) : loadError ? (
        <p className="text-sm text-red-500" role="alert">{loadError}</p>
      ) : branches.length === 0 || services.length === 0 ? (
        <p className="text-sm text-slate-500">Booking is not available yet.</p>
      ) : !ticket ? (
        <form onSubmit={handleBook} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Your Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Branch</label>
            <select
              required
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setServiceId("");
              }}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Service</label>
            <select
              required
              disabled={!branchId}
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">{branchId ? "Select a service" : "Select a branch first"}</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {bookError && <p className="text-sm text-red-500" role="alert">{bookError}</p>}

          <button
            type="submit"
            disabled={isBooking}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBooking ? "Getting ticket..." : "Get Queue Ticket"}
          </button>
        </form>
      ) : (
        <div className="text-center space-y-6">
          <div className="p-6 bg-indigo-50 border border-indigo-200 rounded-xl">
            <span className="text-xs uppercase tracking-widest text-indigo-600 font-bold">Your Ticket Number</span>
            <div className="text-5xl font-extrabold text-indigo-900 my-2">
              A {String(ticket.ticket_number).padStart(3, "0")}
            </div>
            <p className="text-sm text-indigo-700 font-medium">Name: {ticket.customer_name}</p>
            <p className="text-sm text-indigo-700 font-medium">Branch: {ticket.branch_name}</p>
            <p className="text-sm text-indigo-700 font-medium">Service: {ticket.service_name}</p>
            <p className="text-sm text-indigo-700 font-medium">Queue: {ticket.queue_name}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border border-slate-200 rounded-lg text-center">
              <Clock className="w-5 h-5 text-slate-400 mx-auto mb-1" />
              <div className="text-xs text-slate-500">People Ahead</div>
              <div className="text-xl font-bold text-slate-800">{ticket.people_ahead}</div>
            </div>
            <div className="p-4 border border-slate-200 rounded-lg text-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              <div className="text-xs text-slate-500">Status</div>
              <div className="text-sm font-bold text-emerald-600 capitalize">{ticket.status}</div>
            </div>
          </div>

          {ticket.status === "completed" && (
            <button
              onClick={bookAnother}
              className="text-xs text-slate-500 underline hover:text-slate-800"
            >
              Book Another Ticket
            </button>
          )}
        </div>
      )}
    </div>
  );
}
