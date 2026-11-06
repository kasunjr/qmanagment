"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Building2, Check, CheckCircle2, ChevronDown, Clock, Search, Ticket, UserRound, XCircle } from "lucide-react";
import {
  DEFAULT_APP_THEME,
  themeStyle,
  type AppTheme,
} from "@/lib/theme-style";

interface Branch {
  id: string;
  name: string;
  code: string;
  service_ids: string[];
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
  // Set once a counter calls the ticket, if that counter has a name.
  counter_name: string | null;
  people_ahead: number;
}

const DAILY_LIMIT_MESSAGE =
  "No more tickets are available today. Please try again tomorrow.";

interface DropdownOption {
  value: string;
  label: string;
}

function ThemeDropdown({
  id,
  label,
  value,
  options,
  placeholder,
  disabled = false,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: DropdownOption[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const hasEnoughOptionsToFilter = options.length > 3;
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(search.trim().toLowerCase()),
  );

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      requestAnimationFrame(() => {
        if (hasEnoughOptionsToFilter) searchRef.current?.focus();
        else optionRefs.current[0]?.focus();
      });
    }
  }, [hasEnoughOptionsToFilter, isOpen]);

  const selectOption = (option: DropdownOption) => {
    onChange(option.value);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-sm font-semibold text-theme-text/80" htmlFor={id}>
        {label}
      </label>
      <div className="relative" ref={rootRef}>
        <button
          id={id}
          ref={triggerRef}
          aria-controls={`${id}-options`}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label={label}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-theme border border-theme-text/20 bg-theme-surface px-3 py-2.5 text-left text-sm text-theme-text shadow-sm transition hover:border-theme-primary/50 focus:border-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary/25 disabled:cursor-not-allowed disabled:opacity-55"
          disabled={disabled}
          onClick={() => setIsOpen((open) => !open)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setIsOpen(true);
            }
          }}
          type="button"
        >
          <span className={selectedOption ? "truncate" : "truncate text-theme-text/45"}>
            {selectedOption?.label ?? placeholder}
          </span>
          <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-theme-text/60 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-theme-lg border border-theme-text/15 bg-theme-surface shadow-xl">
            {hasEnoughOptionsToFilter && (
              <div className="border-b border-theme-text/10 p-2">
                <div className="relative">
                  <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-text/45" />
                  <input
                    ref={searchRef}
                    aria-label={`Filter ${label.toLowerCase()} options`}
                    className="w-full rounded-theme border border-theme-text/15 bg-theme-bg py-2 pl-9 pr-3 text-sm text-theme-text placeholder:text-theme-text/40 focus:border-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary/20"
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown" && filteredOptions.length) {
                        event.preventDefault();
                        optionRefs.current[0]?.focus();
                      }
                      if (event.key === "Enter" && filteredOptions.length) {
                        event.preventDefault();
                        selectOption(filteredOptions[0]);
                      }
                    }}
                    placeholder={`Search ${label.toLowerCase()}`}
                    type="search"
                    value={search}
                  />
                </div>
              </div>
            )}
            <ul id={`${id}-options`} aria-label={`${label} options`} className="max-h-56 overflow-y-auto p-1" role="listbox">
              {filteredOptions.length ? filteredOptions.map((option, index) => (
                <li key={option.value} role="presentation">
                  <button
                    ref={(element) => { optionRefs.current[index] = element; }}
                    aria-selected={value === option.value}
                    className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-theme px-3 py-2 text-left text-sm transition ${value === option.value ? "bg-theme-primary text-theme-on-primary" : "text-theme-text hover:bg-theme-primary/10"}`}
                    onClick={() => selectOption(option)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        optionRefs.current[(index + 1) % filteredOptions.length]?.focus();
                      }
                      if (event.key === "ArrowUp") {
                        event.preventDefault();
                        if (index === 0) {
                          if (hasEnoughOptionsToFilter) searchRef.current?.focus();
                          else triggerRef.current?.focus();
                        }
                        else optionRefs.current[index - 1]?.focus();
                      }
                    }}
                    role="option"
                    type="button"
                  >
                    <span className="truncate">{option.label}</span>
                    {value === option.value && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
                  </button>
                </li>
              )) : (
                <li className="px-3 py-4 text-center text-sm text-theme-text/55">No matches found.</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomerPage({
  params,
}: {
  params: { tenantCode: string };
}) {
  const tenantCode = params.tenantCode.toUpperCase();
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_APP_THEME);
  const [isThemeLoading, setIsThemeLoading] = useState(true);
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
  const [isRemovingTicket, setIsRemovingTicket] = useState(false);
  const [removeTicketError, setRemoveTicketError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/public/${tenantCode}/theme`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as {
          theme?: AppTheme;
        } | null;
        const loadedTheme = response.ok && result?.theme ? result.theme : DEFAULT_APP_THEME;
        if (!controller.signal.aborted) {
          document.body.style.backgroundColor = loadedTheme.background_color;
          document.body.style.color = loadedTheme.text_color;
          setTheme(loadedTheme);
          setIsThemeLoading(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          document.body.style.backgroundColor = DEFAULT_APP_THEME.background_color;
          document.body.style.color = DEFAULT_APP_THEME.text_color;
          setTheme(DEFAULT_APP_THEME);
          setIsThemeLoading(false);
        }
      });
    return () => controller.abort();
  }, [tenantCode]);

  useEffect(() => {
    if (isThemeLoading) return;
    document.body.style.backgroundColor = theme.background_color;
    document.body.style.color = theme.text_color;
    return () => {
      document.body.style.backgroundColor = "";
      document.body.style.color = "";
    };
  }, [isThemeLoading, theme]);

  useEffect(() => {
    const controller = new AbortController();

    const loadOptions = async () => {
      setIsLoading(true);
      setLoadError("");
      try {
        const response = await fetch(
          `/api/public/${tenantCode}/booking-options`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
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
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load booking options.",
          );
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
  // Only services added to a queue in the selected branch can be booked there.
  const branchServiceIds =
    branches.find((b) => b.id === branchId)?.service_ids ?? [];
  const branchServices = services.filter((s) =>
    branchServiceIds.includes(s.id),
  );

  // Local storage can be unavailable (private mode, blocked site data); the page works without it.
  const storeTicket = (value: QueueTicket | null) => {
    try {
      if (value)
        window.localStorage.setItem(ticketStorageKey, JSON.stringify(value));
      else window.localStorage.removeItem(ticketStorageKey);
    } catch {
      // Ignored: the ticket is still shown, it just will not survive a reload.
    }
  };

  useEffect(() => {
    setTicket(null);
    let saved: QueueTicket | null = null;
    try {
      saved = JSON.parse(
        window.localStorage.getItem(ticketStorageKey) ?? "null",
      ) as QueueTicket | null;
    } catch {
      saved = null;
    }
    if (!saved || typeof saved.id !== "string") return;

    setTicket(saved);
  }, [tenantCode]);

  const activeTicketId = ticket?.status === "completed" ? null : ticket?.id;

  useEffect(() => {
    if (!activeTicketId) return;
    const controller = new AbortController();
    let refreshInFlight = false;
    let refreshPending = false;

    const refreshTicket = async () => {
      if (controller.signal.aborted) return;
      if (refreshInFlight) {
        refreshPending = true;
        return;
      }
      refreshInFlight = true;
      refreshPending = false;
      try {
        const response = await fetch(
          `/api/public/${tenantCode}/tickets/${activeTicketId}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const result = (await response.json().catch(() => null)) as {
          ticket?: QueueTicket;
        } | null;
        if (controller.signal.aborted) return;

        // Gone or from a previous day: forget it and show the form again.
        if (response.status === 404) {
          storeTicket(null);
          setTicket((current) =>
            current?.id === activeTicketId ? null : current,
          );
        } else if (response.ok && result?.ticket) {
          const fresh = result.ticket;
          // A completed ticket is shown this once but no longer kept.
          storeTicket(fresh.status === "completed" ? null : fresh);
          setTicket((current) =>
            current?.id === activeTicketId ? fresh : current,
          );
        }
      } catch {
        // Offline or server error: keep showing the saved ticket.
      } finally {
        refreshInFlight = false;
        if (refreshPending && !controller.signal.aborted) void refreshTicket();
      }
    };

    void refreshTicket();
    const events = new EventSource(
      `/api/public/${tenantCode}/tickets/${activeTicketId}/events`,
    );
    events.addEventListener("open", refreshTicket);
    events.addEventListener("tickets-updated", refreshTicket);
    const refreshInterval = window.setInterval(refreshTicket, 60_000);
    return () => {
      controller.abort();
      events.close();
      window.clearInterval(refreshInterval);
    };
  }, [tenantCode, activeTicketId]);

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
      setBookError(
        error instanceof Error ? error.message : "Unable to create ticket.",
      );
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

  const removeFromQueue = async () => {
    if (!ticket || ticket.status !== "waiting" || isRemovingTicket) return;
    if (!window.confirm("Remove this ticket from the queue? This cannot be undone.")) return;

    setIsRemovingTicket(true);
    setRemoveTicketError("");
    try {
      const response = await fetch(`/api/public/${tenantCode}/tickets/${ticket.id}`, {
        method: "DELETE",
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "Unable to remove the ticket.");
      storeTicket(null);
      setTicket(null);
    } catch (error) {
      setRemoveTicketError(error instanceof Error ? error.message : "Unable to remove the ticket.");
    } finally {
      setIsRemovingTicket(false);
    }
  };

  if (isThemeLoading) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center"
        style={{ backgroundColor: DEFAULT_APP_THEME.background_color }}
        role="status"
        aria-label="Loading customer portal"
      >
        <span
          aria-hidden="true"
          className="h-8 w-8 animate-spin rounded-full border-4 motion-reduce:animate-none"
          style={{ borderColor: `${DEFAULT_APP_THEME.primary_color}33`, borderTopColor: DEFAULT_APP_THEME.primary_color }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl py-3 sm:py-5">
      <section
        aria-labelledby="customer-portal-title"
        className="grid grid-cols-[5px_minmax(0,1fr)_3px] overflow-visible rounded-theme-lg border border-theme-text/10 bg-theme-surface shadow-xl"
        style={themeStyle(theme)}
      >
        <div aria-hidden="true" className="bg-theme-primary" />

        <div className="min-w-0 p-4 sm:p-6 md:p-8">
          <div className="w-full">
            <header className="mb-5 border-b border-theme-text/10 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {theme.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className="h-11 w-11 shrink-0 rounded-theme object-contain" src={theme.logo_url} />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-theme bg-theme-primary/10 text-theme-primary">
                      <UserRound aria-hidden="true" className="h-5 w-5" />
                    </span>
                  )}
                  <span className="min-w-0 truncate text-xl font-bold text-theme-text sm:text-2xl">{theme.app_name}</span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-4">
                <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-theme-secondary">Customer portal</p>
                <h1 className="mt-1.5 text-2xl font-bold text-theme-text sm:text-3xl" id="customer-portal-title">
                  {ticket ? "Your ticket" : "Get a queue ticket"}
                </h1>
                <p className="mt-1.5 text-sm text-theme-text/60">
                  {ticket ? "Keep this ticket number for your visit." : "Choose your branch and service to join the waiting list."}
                </p>
                </div>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-theme bg-theme-primary/10 text-theme-primary sm:h-12 sm:w-12">
                  <Ticket aria-hidden="true" className="h-5 w-5 sm:h-6 sm:w-6" />
                </span>
              </div>
            </header>

      {isLoading ? (
        <div className="flex items-center gap-3 py-8 text-sm text-theme-text/60" role="status">
          <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-theme-primary/20 border-t-theme-primary motion-reduce:animate-none" />
          Loading booking options...
        </div>
      ) : loadError ? (
        <p className="rounded-theme border border-theme-secondary/25 bg-theme-secondary/10 p-4 text-sm text-theme-text" role="alert">
          {loadError}
        </p>
      ) : branches.length === 0 || services.length === 0 ? (
        <div className="flex items-center gap-3 rounded-theme border border-theme-text/10 bg-theme-bg p-4 text-sm text-theme-text/70">
          <Ticket aria-hidden="true" className="h-5 w-5 shrink-0 text-theme-primary" />
          Booking is not available yet.
        </div>
      ) : !ticket && !acceptingTickets ? (
        <div
          className="rounded-theme border border-theme-secondary/25 bg-theme-secondary/10 p-4 text-center text-theme-text"
          role="status"
        >
          <Clock className="mx-auto mb-2 h-6 w-6 text-theme-secondary" />
          <p className="text-sm font-medium">
            {DAILY_LIMIT_MESSAGE}
          </p>
        </div>
      ) : !ticket ? (
        <form onSubmit={handleBook} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-theme-text/80" htmlFor="customer-name">
              Your name
            </label>
            <input
              id="customer-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full rounded-theme border border-theme-text/20 bg-theme-surface p-2.5 text-sm text-theme-text placeholder:text-theme-text/40 focus:border-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary/30"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ThemeDropdown
              id="customer-branch"
              label="Branch"
              value={branchId}
              options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
              placeholder="Select a branch"
              onChange={(value) => {
                setBranchId(value);
                setServiceId("");
              }}
            />
            <div className="min-w-0">
              <ThemeDropdown
                id="customer-service"
                label="Service"
                value={serviceId}
                options={branchServices.map((service) => ({ value: service.id, label: service.name }))}
                placeholder={branchId ? "Select a service" : "Select a branch first"}
                disabled={!branchId}
                onChange={setServiceId}
              />
            {selectedService?.description && (
              <p className="mt-2 whitespace-pre-line text-sm text-theme-text/70">
                {selectedService.description}
              </p>
            )}
          </div>
          </div>

          {bookError && (
            <p className="rounded-theme border border-theme-secondary/25 bg-theme-secondary/10 p-3 text-sm text-theme-text" role="alert">
              {bookError}
            </p>
          )}

          <button
            type="submit"
            disabled={isBooking}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-theme bg-theme-primary px-4 py-3 font-semibold text-theme-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBooking ? "Getting ticket..." : "Get Queue Ticket"}
            {!isBooking && <ArrowRight aria-hidden="true" className="h-4 w-4" />}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <section aria-label="Your queue ticket" className="overflow-hidden rounded-theme-lg border border-theme-primary/20 bg-theme-bg">
            <div className="flex items-center justify-between gap-4 bg-theme-primary/10 p-4 sm:p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-theme-primary">Your ticket number</p>
                <p className="mt-1 text-5xl font-extrabold leading-none text-theme-primary sm:text-6xl">
                  A {String(ticket.ticket_number).padStart(3, "0")}
                </p>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-theme bg-theme-surface text-theme-primary">
                <Ticket aria-hidden="true" className="h-6 w-6" />
              </span>
            </div>
            <dl className="grid gap-x-5 gap-y-2 border-t border-theme-text/10 bg-theme-surface p-4 sm:grid-cols-2 sm:p-5">
              <div>
                <dt className="text-xs font-medium text-theme-text/55">Name</dt>
                <dd className="mt-0.5 break-words text-sm font-semibold text-theme-text">{ticket.customer_name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-theme-text/55">Branch</dt>
                <dd className="mt-0.5 break-words text-sm font-semibold text-theme-text">{ticket.branch_name}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-theme-text/55">Service</dt>
                <dd className="mt-0.5 break-words text-sm font-semibold text-theme-text">{ticket.service_name}</dd>
              </div>
            </dl>
          </section>

          {ticket.status === "serving" && (
            <div
              className="rounded-theme-lg bg-theme-secondary p-3 text-theme-on-secondary"
              role="status"
            >
              <p className="text-lg font-bold">
                {ticket.counter_name
                  ? `Please go to ${ticket.counter_name}`
                  : "It's your turn"}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-theme border border-theme-text/10 bg-theme-surface p-3 text-center">
              <div aria-hidden="true" className="mb-1 flex min-h-5 items-center justify-center gap-1 text-theme-primary">
                {ticket.people_ahead === 0 ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <>
                    {Array.from({ length: Math.min(ticket.people_ahead, 4) }, (_, index) => (
                      <UserRound key={index} className="h-4 w-4" />
                    ))}
                    {ticket.people_ahead > 4 && (
                      <span className="ml-1 text-xs font-semibold">+{ticket.people_ahead - 4}</span>
                    )}
                  </>
                )}
              </div>
              <div className="text-xs text-theme-text/60">People ahead</div>
              <div className="text-xl font-bold text-theme-text">
                {ticket.people_ahead}
              </div>
            </div>
            <div className="rounded-theme border border-theme-text/10 bg-theme-surface p-3 text-center">
              <CheckCircle2 aria-hidden="true" className="mx-auto mb-1 h-5 w-5 text-theme-secondary" />
              <div className="text-xs text-theme-text/60">Status</div>
              <div className="text-sm font-bold capitalize text-theme-text">
                {ticket.status}
              </div>
            </div>
          </div>

          {ticket.status === "waiting" && (
            <div className="space-y-2">
              <button
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-theme border border-theme-text/15 bg-theme-surface px-4 py-2 text-sm font-medium text-theme-text/70 transition hover:border-theme-secondary/30 hover:bg-theme-secondary/10 hover:text-theme-text disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isRemovingTicket}
                onClick={() => void removeFromQueue()}
                type="button"
              >
                <XCircle aria-hidden="true" className="h-4 w-4" />
                {isRemovingTicket ? "Removing ticket..." : "Leave from queue"}
              </button>
              {removeTicketError && (
                <p className="rounded-theme border border-theme-secondary/25 bg-theme-secondary/10 p-3 text-sm text-theme-text" role="alert">
                  {removeTicketError}
                </p>
              )}
            </div>
          )}

          {ticket.status === "completed" && (
            <button
              onClick={bookAnother}
              className="mx-auto flex min-h-11 items-center justify-center gap-2 rounded-theme bg-theme-primary px-4 py-2 text-sm font-semibold text-theme-on-primary hover:opacity-90"
            >
              Book another ticket <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
          </div>
        </div>
        <div aria-hidden="true" className="bg-theme-primary/20" />
      </section>
    </div>
  );
}
