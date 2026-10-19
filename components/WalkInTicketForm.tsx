"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, Ticket, UserPlus, X } from "lucide-react";

interface QueueService {
  id: string;
  name: string;
  duration_minutes: number;
}

interface IssuedTicket {
  id: string;
  ticket_number: number;
  customer_name: string;
  service_name: string;
  people_ahead: number;
}

const formatNumber = (value: number) => String(value).padStart(3, "0");

export default function WalkInTicketForm() {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [services, setServices] = useState<QueueService[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [servicesError, setServicesError] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; service?: string }>({});
  const [submitError, setSubmitError] = useState("");
  const [issuedTickets, setIssuedTickets] = useState<IssuedTicket[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch("/api/staff/queue/services", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => null)) as
          | { services?: QueueService[]; error?: string }
          | null;
        if (!response.ok || !result?.services) {
          throw new Error(result?.error || "Unable to load services.");
        }
        setServices(result.services);
        setServicesError("");
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setServicesError(loadError instanceof Error ? loadError.message : "Unable to load services.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoadingServices(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const selectedService = services.find((service) => service.id === serviceId);
  const filteredServices = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return services;
    return services.filter((service) => service.name.toLowerCase().includes(term));
  }, [search, services]);
  const latestTicket = issuedTickets[0];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    const name = customerName.trim();
    const nextErrors = {
      name: name ? undefined : "Enter the customer's name.",
      service: selectedService ? undefined : "Select a service.",
    };
    setErrors(nextErrors);
    setSubmitError("");
    if (nextErrors.name || nextErrors.service || !selectedService) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/staff/queue/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_name: name, service_id: selectedService.id }),
      });
      const result = (await response.json().catch(() => null)) as
        | { ticket?: IssuedTicket; error?: string }
        | null;
      if (!response.ok || !result?.ticket) {
        throw new Error(result?.error || "Unable to issue ticket.");
      }
      setIssuedTickets((current) => [result.ticket!, ...current].slice(0, 5));
      setCustomerName("");
      setServiceId("");
      setSearch("");
      nameInputRef.current?.focus();
    } catch (issueError) {
      setSubmitError(issueError instanceof Error ? issueError.message : "Unable to issue ticket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="walk-in-title" className="overflow-hidden rounded-theme-lg border border-theme-text/10 bg-theme-surface text-theme-text">
      <h2 id="walk-in-title">
        <button
          aria-controls="walk-in-panel"
          aria-expanded={isOpen}
          className={`flex w-full flex-wrap items-center justify-between gap-3 bg-theme-text/[0.03] px-5 py-4 text-left hover:bg-theme-text/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme-primary/50 sm:px-7 ${
            isOpen ? "border-b border-theme-text/10" : ""
          }`}
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-theme bg-theme-primary/10">
              <UserPlus className="h-5 w-5 text-theme-primary" />
            </span>
            <span>
              <span className="block text-lg font-bold">Walk-in ticket</span>
              <span className="block text-sm font-normal text-theme-text/60">Issue a ticket for a customer at the counter</span>
            </span>
          </span>
          <span className="flex items-center gap-3 text-sm font-normal text-theme-text/60">
            {issuedTickets.length > 0 && <span>{issuedTickets.length} issued</span>}
            <ChevronDown
              aria-hidden="true"
              className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </span>
        </button>
      </h2>

      <div hidden={!isOpen} id="walk-in-panel">
      <form
        className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
        noValidate
        onSubmit={(event) => void handleSubmit(event)}
      >
        <fieldset aria-describedby={errors.service ? "walk-in-service-error" : undefined} className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-3">
            <legend className="text-sm font-semibold text-theme-text/80">Service</legend>
            <span className="text-xs text-theme-text/60">{services.length} available</span>
          </div>

          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-text/40" />
            <input
              aria-label="Search services"
              className="w-full rounded-theme border border-theme-text/20 bg-theme-surface py-2 pl-9 pr-9 text-sm text-theme-text placeholder:text-theme-text/40 focus:border-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary/30"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search services"
              type="search"
              value={search}
            />
            {search && (
              <button
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-theme-text/40 hover:text-theme-text/70"
                onClick={() => setSearch("")}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div
            className={`max-h-72 overflow-y-auto rounded-theme border ${
              errors.service ? "border-red-400" : "border-theme-text/10"
            }`}
          >
            {isLoadingServices ? (
              <p className="px-4 py-8 text-center text-sm text-theme-text/60" role="status">Loading services...</p>
            ) : servicesError ? (
              <p className="px-4 py-8 text-center text-sm text-red-600" role="alert">{servicesError}</p>
            ) : services.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-theme-text/60">No services are assigned to your queue.</p>
            ) : filteredServices.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-theme-text/60">No services match "{search}".</p>
            ) : (
              <ul className="divide-y divide-theme-text/10">
                {filteredServices.map((service) => {
                  const isSelected = service.id === serviceId;
                  return (
                    <li key={service.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors focus-within:bg-theme-primary/10 ${
                          isSelected ? "bg-theme-primary/10" : "hover:bg-theme-text/5"
                        }`}
                      >
                        <input
                          checked={isSelected}
                          className="sr-only"
                          name="walk-in-service"
                          onChange={() => {
                            setServiceId(service.id);
                            setErrors((current) => ({ ...current, service: undefined }));
                          }}
                          type="radio"
                          value={service.id}
                        />
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            isSelected ? "border-theme-primary bg-theme-primary" : "border-theme-text/30"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 text-theme-on-primary" />}
                        </span>
                        <span className="min-w-0">
                          <span className={`block truncate text-sm ${isSelected ? "font-semibold text-theme-primary" : "font-medium"}`}>
                            {service.name}
                          </span>
                          <span className="block truncate text-xs text-theme-text/60">About {service.duration_minutes} min</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {errors.service && (
            <p className="mt-1.5 text-sm text-red-600" id="walk-in-service-error">{errors.service}</p>
          )}
        </fieldset>

        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <label className="mb-1 block text-sm font-semibold text-theme-text/80" htmlFor="walk-in-name">
              Customer name
            </label>
            <input
              aria-describedby={errors.name ? "walk-in-name-error" : undefined}
              aria-invalid={Boolean(errors.name)}
              autoComplete="off"
              className={`w-full rounded-theme border bg-theme-surface px-3 py-2.5 text-sm text-theme-text placeholder:text-theme-text/40 focus:outline-none focus:ring-2 ${
                errors.name
                  ? "border-red-400 focus:border-red-500 focus:ring-red-500/30"
                  : "border-theme-text/20 focus:border-theme-primary focus:ring-theme-primary/30"
              }`}
              id="walk-in-name"
              maxLength={120}
              onChange={(event) => {
                setCustomerName(event.target.value);
                if (errors.name) setErrors((current) => ({ ...current, name: undefined }));
              }}
              placeholder="e.g. Nimal Perera"
              ref={nameInputRef}
              value={customerName}
            />
            {errors.name && <p className="mt-1.5 text-sm text-red-600" id="walk-in-name-error">{errors.name}</p>}
          </div>

          <div className="rounded-theme border border-dashed border-theme-text/20 bg-theme-text/[0.03] p-4 text-sm">
            <p className="text-xs font-bold uppercase text-theme-text/60">Summary</p>
            <dl className="mt-2 space-y-1.5">
              <div className="flex justify-between gap-3">
                <dt className="text-theme-text/60">Customer</dt>
                <dd className="truncate font-medium">{customerName.trim() || "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-theme-text/60">Service</dt>
                <dd className="truncate font-medium">{selectedService?.name ?? "—"}</dd>
              </div>
            </dl>
          </div>

          {submitError && (
            <p className="rounded-theme border border-red-300 bg-red-50 p-3 text-sm text-red-700" role="alert">
              {submitError}
            </p>
          )}

          <button
            className="mt-auto flex min-h-12 w-full items-center justify-center gap-2 rounded-theme bg-theme-primary px-5 py-3 text-sm font-bold text-theme-on-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting || isLoadingServices || services.length === 0}
            type="submit"
          >
            <Ticket className="h-5 w-5" />
            {isSubmitting ? "Issuing..." : "Issue ticket"}
          </button>
        </div>
      </form>

      <div aria-live="polite">
        {latestTicket && (
          <div className="border-t border-theme-text/10 px-5 py-4 sm:px-7">
            <div className="flex items-center justify-between gap-4 rounded-theme border border-theme-secondary/40 bg-theme-secondary/10 p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Ticket issued — added to the waiting queue</p>
                <p className="truncate text-sm text-theme-text/80">
                  {latestTicket.customer_name} · {latestTicket.service_name}
                </p>
                <p className="text-xs text-theme-text/70">
                  {latestTicket.people_ahead === 0
                    ? "Next in line"
                    : `${latestTicket.people_ahead} ${latestTicket.people_ahead === 1 ? "person" : "people"} ahead`}
                </p>
              </div>
              <p className="shrink-0 text-3xl font-extrabold text-theme-secondary">
                {formatNumber(latestTicket.ticket_number)}
              </p>
            </div>

            {issuedTickets.length > 1 && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-bold uppercase text-theme-text/60">Recently issued</p>
                <ul className="divide-y divide-theme-text/10 text-sm text-theme-text/70">
                  {issuedTickets.slice(1).map((ticket) => (
                    <li key={ticket.id} className="flex justify-between gap-3 py-1.5">
                      <span className="truncate">{ticket.customer_name} · {ticket.service_name}</span>
                      <span className="shrink-0 font-semibold">{formatNumber(ticket.ticket_number)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </section>
  );
}
