"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { Outfit } from "next/font/google";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import AdminProfile from "@/components/AdminProfile";
import ThemeCustomization from "@/components/ThemeCustomization";
import type { TenantUsage } from "@/lib/plans";
import styles from "./admin.module.css";
import {
  Download,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  QrCode,
  Settings,
  BarChart3,
  Palette,
  ArrowUpRight,
  AlertTriangle,
  Clock,
  Ticket,
  UserRound,
} from "lucide-react";

const adminFont = Outfit({ subsets: ["latin"], display: "swap", variable: "--font-admin" });

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
interface Staff {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  branch_id: string | null;
  counter_name: string | null;
  service_ids: string[];
}

interface AnalyticsData {
  serving_count: number;
  average_serving_minutes: number;
  waiting_count: number;
  min_wait_minutes: number | null;
  max_wait_minutes: number | null;
  waiting_by_hour: { label: string; customers: number }[];
}

function formatWaitDuration(minutes: number | null): string {
  if (minutes === null) return "--";
  const roundedMinutes = Math.round(minutes);
  if (roundedMinutes < 1) return "<1 min";
  const hours = Math.floor(roundedMinutes / 60);
  const remainingMinutes = roundedMinutes % 60;
  return hours ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes} min`;
}

// Mirrors DEFAULT_PLAN_CODE in lib/plans.ts, which can't be imported here as it pulls in the DB client.
const BASIC_PLAN_CODE = "basic";
const EXPIRY_WARNING_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function formatPlanDate(date: Date): string {
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// Whole calendar days from today to the given date: 0 is today, 1 is tomorrow.
function calendarDaysUntil(date: Date): number {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(date) - startOfDay(new Date())) / DAY_MS);
}

function PricingLink({ label, className }: { label: string; className: string }) {
  return (
    <Link
      href="/pricing"
      className={`flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition ${className}`}
    >
      {label} <ArrowUpRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function PlanExpiredBanner({ subscription, planName }: {
  subscription: TenantUsage["subscription"];
  planName: string;
}) {
  const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : null;
  // A subscription cancelled before its end date counts as expired too, but has no past date to show.
  const ended = expiresAt && expiresAt.getTime() <= Date.now()
    ? `expired on ${formatPlanDate(expiresAt)}`
    : "has ended";

  return (
    <div className="mt-3 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
        <div className="text-sm text-red-900">
          <p className="font-semibold">
            Your {subscription.plan_name} plan {ended}.
          </p>
          <p className="mt-0.5 text-red-800">
            Your account is now on the {planName} plan and its limits apply. Existing branches, services and staff
            are kept, but you can&apos;t add more until you renew.
          </p>
        </div>
      </div>
      <PricingLink label="Renew plan" className="bg-red-600 hover:bg-red-700" />
    </div>
  );
}

function PlanExpiringNotice({ subscription }: { subscription: TenantUsage["subscription"] }) {
  if (subscription.expired || subscription.plan_code === BASIC_PLAN_CODE || !subscription.expires_at) return null;

  const expiresAt = new Date(subscription.expires_at);
  const daysLeft = calendarDaysUntil(expiresAt);
  if (daysLeft < 0 || daysLeft > EXPIRY_WARNING_DAYS) return null;

  const when = daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-center gap-2 text-sm text-amber-900">
        <Clock className="h-4 w-4 shrink-0 text-amber-600" />
        <p>
          Your <span className="font-semibold">{subscription.plan_name}</span> plan expires {when} (
          {formatPlanDate(expiresAt)}). Renew to keep its limits.
        </p>
      </div>
      <PricingLink label="Renew plan" className="bg-amber-600 hover:bg-amber-700" />
    </div>
  );
}

function DailyTicketLimitBanner({ planUsage }: { planUsage: TenantUsage }) {
  const limit = planUsage.limits.tickets_per_day;
  const used = planUsage.usage.tickets_today;
  if (limit === null || used < limit) return null;

  return (
    <div className="mt-3 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
      <div className="flex gap-2">
        <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
        <div className="text-sm text-red-900">
          <p className="font-semibold">
            Daily ticket limit reached ({used}/{limit}).
          </p>
          <p className="mt-0.5 text-red-800">
            Customers can&apos;t book new tickets until tomorrow. Tickets already issued can still be served.
            Upgrade your plan for a higher limit.
          </p>
        </div>
      </div>
      <PricingLink label="Upgrade plan" className="bg-red-600 hover:bg-red-700" />
    </div>
  );
}

function CurrentPlan({ planUsage }: { planUsage: TenantUsage }) {
  return (
    <section className={styles.planSummary} aria-labelledby="admin-plan-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 id="admin-plan-title" className="text-sm font-semibold text-slate-800">Current plan</h2>
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">
            {planUsage.plan_name}
          </span>
        </div>
        <Link
          href="/pricing"
          className="flex items-center gap-1 rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-50"
        >
          Upgrade plan <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <ul className={styles.usageList}>
        {[
          { label: "Branches", used: planUsage.usage.branches, limit: planUsage.limits.branches },
          { label: "Services", used: planUsage.usage.services, limit: planUsage.limits.services },
          { label: "Staff", used: planUsage.usage.staff_users, limit: planUsage.limits.staff_users },
          { label: "Tickets today", used: planUsage.usage.tickets_today, limit: planUsage.limits.tickets_per_day },
        ].map((resource) => <li key={resource.label} className={resource.limit !== null && resource.used >= resource.limit ? styles.atLimit : undefined}><span>{resource.label}</span><strong>{resource.used.toLocaleString("en-US")} <span>/ {resource.limit === null ? "Unlimited" : resource.limit.toLocaleString("en-US")}</span></strong></li>)}
      </ul>
      {planUsage.subscription.expired ? (
        <PlanExpiredBanner subscription={planUsage.subscription} planName={planUsage.plan_name} />
      ) : (
        <PlanExpiringNotice subscription={planUsage.subscription} />
      )}
      <DailyTicketLimitBanner planUsage={planUsage} />
    </section>
  );
}

function AdminDashboard() {
  const { user, accessToken, acceptSession, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<"qr" | "config" | "analytics" | "customization" | "profile">(
    "qr",
  );

  const [staffUrl, setStaffUrl] = useState("http://localhost:3000/staff");
  const [customerUrl, setCustomerUrl] = useState(
    "http://localhost:3000/customer",
  );

  useEffect(() => {
    if (!user?.tenant_code) return;
    setStaffUrl(`http://localhost:3000/staff/${user.tenant_code}`);
    setCustomerUrl(`http://localhost:3000/customer/${user.tenant_code}`);
  }, [user?.tenant_code]);

  // The tenant's plan, its limits and current usage; null until loaded or if loading fails.
  const [planUsage, setPlanUsage] = useState<TenantUsage | null>(null);

  // Called on load and again after anything that changes a count, so the strip stays current.
  const loadUsage = useCallback(
    async (signal?: AbortSignal) => {
      if (!accessToken) return;
      try {
        const response = await fetch("/api/usage", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
          signal,
        });
        const result = (await response.json().catch(() => null)) as TenantUsage | null;
        if (response.ok && result) setPlanUsage(result);
      } catch {
        // Without usage data the dashboard works as before.
      }
    },
    [accessToken],
  );

  // Tickets today changes as customers book, so usage is refreshed every 30s while the tab is visible.
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      if (document.visibilityState === "visible") void loadUsage(controller.signal);
    };

    void loadUsage(controller.signal);
    const interval = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadUsage]);

  const staffQrRef = useRef<SVGSVGElement>(null);
  const customerQrRef = useRef<SVGSVGElement>(null);

  const downloadQR = (
    ref: React.RefObject<SVGSVGElement | null>,
    filename: string,
  ) => {
    if (!ref.current) return;
    const svgData = new XMLSerializer().serializeToString(ref.current);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      if (ctx) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `${filename}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const [configSubTab, setConfigSubTab] = useState<
    "branches" | "services" | "staff"
  >("branches");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [isBranchesLoading, setIsBranchesLoading] = useState(false);
  const [isSavingBranch, setIsSavingBranch] = useState(false);
  const [branchError, setBranchError] = useState("");
  const [branchForm, setBranchForm] = useState({ name: "", code: "" });

  const [services, setServices] = useState<Service[]>([]);
  const [isServicesLoading, setIsServicesLoading] = useState(false);
  const [isSavingService, setIsSavingService] = useState(false);
  const [serviceError, setServiceError] = useState("");
  const [serviceForm, setServiceForm] = useState({ name: "", description: "", duration: "15" });
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceEdit, setServiceEdit] = useState({ name: "", description: "", duration: "" });

  const [staff, setStaff] = useState<Staff[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");

  useEffect(() => {
    if (activeTab !== "analytics" || !accessToken) return;
    const controller = new AbortController();

    const loadAnalytics = async () => {
      setIsAnalyticsLoading(true);
      try {
        const response = await fetch("/api/analytics", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => null)) as
          | (AnalyticsData & { error?: string })
          | null;
        if (!response.ok || !result) {
          throw new Error(result?.error || "Unable to load analytics.");
        }
        setAnalytics(result);
        setAnalyticsError("");
      } catch (error) {
        if (!controller.signal.aborted) {
          setAnalyticsError(
            error instanceof Error
              ? error.message
              : "Unable to load analytics.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setIsAnalyticsLoading(false);
      }
    };

    void loadAnalytics();
    const refreshInterval = window.setInterval(
      () => void loadAnalytics(),
      30_000,
    );
    return () => {
      controller.abort();
      window.clearInterval(refreshInterval);
    };
  }, [accessToken, activeTab]);

  const [isStaffLoading, setIsStaffLoading] = useState(false);
  const [isSavingStaff, setIsSavingStaff] = useState(false);
  const [staffError, setStaffError] = useState("");
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState({
    name: "",
    username: "",
    email: "",
    code: "",
    role: "",
    branch_id: null as string | null,
    counter_name: "",
    service_ids: [] as string[],
  });
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [branchEdit, setBranchEdit] = useState<Partial<Branch>>({});

  useEffect(() => {
    if (configSubTab !== "staff" || !accessToken) return;
    const controller = new AbortController();

    const loadStaff = async () => {
      setIsStaffLoading(true);
      setStaffError("");
      try {
        const response = await fetch("/api/staff-users", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => null)) as {
          staffUsers?: Staff[];
          error?: string;
        } | null;
        if (!response.ok)
          throw new Error(result?.error || "Unable to load staff users.");
        setStaff(result?.staffUsers ?? []);
      } catch (error) {
        if (!controller.signal.aborted) {
          setStaffError(
            error instanceof Error
              ? error.message
              : "Unable to load staff users.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setIsStaffLoading(false);
      }
    };

    void loadStaff();
    return () => controller.abort();
  }, [accessToken, configSubTab]);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();

    const loadBranches = async () => {
      setIsBranchesLoading(true);
      setBranchError("");
      try {
        const response = await fetch("/api/branches", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => null)) as {
          branches?: Branch[];
          error?: string;
        } | null;
        if (!response.ok)
          throw new Error(result?.error || "Unable to load branches.");
        setBranches(result?.branches ?? []);
      } catch (error) {
        if (!controller.signal.aborted) {
          setBranchError(
            error instanceof Error ? error.message : "Unable to load branches.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setIsBranchesLoading(false);
      }
    };

    void loadBranches();
    return () => controller.abort();
  }, [accessToken]);

  const addBranch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) return;

    setIsSavingBranch(true);
    setBranchError("");
    try {
      const response = await fetch("/api/branches", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: branchForm.name.trim(),
          code: branchForm.code.trim(),
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        branch?: Branch;
        error?: string;
      } | null;
      if (!response.ok || !result?.branch) {
        throw new Error(result?.error || "Unable to create branch.");
      }

      setBranches((currentBranches) => [result.branch!, ...currentBranches]);
      setBranchForm({ name: "", code: "" });
      void loadUsage();
    } catch (error) {
      setBranchError(
        error instanceof Error ? error.message : "Unable to create branch.",
      );
    } finally {
      setIsSavingBranch(false);
    }
  };

  const updateBranch = async (branch: Branch) => {
    if (!accessToken) return;

    setIsSavingBranch(true);
    setBranchError("");
    try {
      const response = await fetch(`/api/branches/${branch.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: (branchEdit.name ?? branch.name).trim(),
          code: (branchEdit.code ?? branch.code).trim(),
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        branch?: Branch;
        error?: string;
      } | null;
      if (!response.ok || !result?.branch) {
        throw new Error(result?.error || "Unable to update branch.");
      }

      setBranches((currentBranches) =>
        currentBranches.map((item) =>
          item.id === branch.id ? result.branch! : item,
        ),
      );
      setEditingBranchId(null);
    } catch (error) {
      setBranchError(
        error instanceof Error ? error.message : "Unable to update branch.",
      );
    } finally {
      setIsSavingBranch(false);
    }
  };

  const deleteBranch = async (branch: Branch) => {
    if (
      !accessToken ||
      !window.confirm(`Delete ${branch.name}? Its tickets will be deleted, and its staff users will have no branch.`)
    )
      return;
    setBranchError("");
    try {
      const response = await fetch(`/api/branches/${branch.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(result?.error || "Unable to delete branch.");
      setBranches((currentBranches) =>
        currentBranches.filter((item) => item.id !== branch.id),
      );
      void loadUsage();
    } catch (error) {
      setBranchError(
        error instanceof Error ? error.message : "Unable to delete branch.",
      );
    }
  };

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();

    const loadServices = async () => {
      setIsServicesLoading(true);
      setServiceError("");
      try {
        const response = await fetch("/api/services", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => null)) as {
          services?: Service[];
          error?: string;
        } | null;
        if (!response.ok)
          throw new Error(result?.error || "Unable to load services.");
        setServices(result?.services ?? []);
      } catch (error) {
        if (!controller.signal.aborted) {
          setServiceError(
            error instanceof Error ? error.message : "Unable to load services.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setIsServicesLoading(false);
      }
    };

    void loadServices();
    return () => controller.abort();
  }, [accessToken]);

  const saveService = async (
    form: { name: string; description: string; duration: string },
    serviceId: string | null,
  ) => {
    if (!accessToken) return;

    setIsSavingService(true);
    setServiceError("");
    try {
      const response = await fetch(
        serviceId ? `/api/services/${serviceId}` : "/api/services",
        {
          method: serviceId ? "PATCH" : "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim(),
            duration_minutes: Number(form.duration),
          }),
        },
      );
      const result = (await response.json().catch(() => null)) as {
        service?: Service;
        error?: string;
      } | null;
      if (!response.ok || !result?.service) {
        throw new Error(result?.error || "Unable to save service.");
      }

      setServices((currentServices) =>
        serviceId
          ? currentServices.map((item) =>
              item.id === serviceId ? result.service! : item,
            )
          : [result.service!, ...currentServices],
      );
      if (serviceId) setEditingServiceId(null);
      else {
        setServiceForm({ name: "", description: "", duration: "15" });
        void loadUsage();
      }
    } catch (error) {
      setServiceError(
        error instanceof Error ? error.message : "Unable to save service.",
      );
    } finally {
      setIsSavingService(false);
    }
  };

  const deleteService = async (service: Service) => {
    if (!accessToken || !window.confirm(`Delete ${service.name}?`)) return;
    setServiceError("");
    try {
      const response = await fetch(`/api/services/${service.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(result?.error || "Unable to delete service.");
      setServices((currentServices) =>
        currentServices.filter((item) => item.id !== service.id),
      );
      void loadUsage();
    } catch (error) {
      setServiceError(
        error instanceof Error ? error.message : "Unable to delete service.",
      );
    }
  };

  const resetStaffForm = () => {
    setStaffForm({
      name: "",
      username: "",
      email: "",
      code: "",
      role: "",
      branch_id: null,
      counter_name: "",
      service_ids: [],
    });
    setEditingStaffId(null);
  };

  const saveStaffUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) return;

    setIsSavingStaff(true);
    setStaffError("");
    const payload: Record<string, unknown> = {
      name: staffForm.name.trim(),
      username: staffForm.username.trim(),
      email: staffForm.email.trim(),
      role: staffForm.role.trim(),
      branch_id: staffForm.branch_id,
      counter_name: staffForm.counter_name.trim() || null,
      service_ids: staffForm.service_ids,
    };
    if (staffForm.code) payload.code = staffForm.code;

    try {
      const response = await fetch(
        editingStaffId
          ? `/api/staff-users/${editingStaffId}`
          : "/api/staff-users",
        {
          method: editingStaffId ? "PATCH" : "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json().catch(() => null)) as {
        staffUser?: Staff;
        error?: string;
      } | null;
      if (!response.ok || !result?.staffUser) {
        throw new Error(result?.error || "Unable to save staff user.");
      }

      setStaff((currentStaff) =>
        editingStaffId
          ? currentStaff.map((item) =>
              item.id === editingStaffId ? result.staffUser! : item,
            )
          : [result.staffUser!, ...currentStaff],
      );
      setIsStaffModalOpen(false);
      resetStaffForm();
      if (!editingStaffId) void loadUsage();
    } catch (error) {
      setStaffError(
        error instanceof Error ? error.message : "Unable to save staff user.",
      );
    } finally {
      setIsSavingStaff(false);
    }
  };

  const deleteStaffUser = async (staffUser: Staff) => {
    if (!accessToken || !window.confirm(`Delete ${staffUser.name}?`)) return;
    setStaffError("");
    try {
      const response = await fetch(`/api/staff-users/${staffUser.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(result?.error || "Unable to delete staff user.");
      setStaff((currentStaff) =>
        currentStaff.filter((item) => item.id !== staffUser.id),
      );
      void loadUsage();
    } catch (error) {
      setStaffError(
        error instanceof Error ? error.message : "Unable to delete staff user.",
      );
    }
  };

  return (
    <div className={`${styles.page} ${adminFont.variable}`}>
      <div className={styles.dashboardHeader}>
        <div className={styles.titleRow}><div><p className={styles.eyebrow}>YOUR WORKSPACE</p><h1>Admin Portal</h1></div>{user?.tenant_code && <span className={styles.workspaceCode}>Workspace <strong>{user.tenant_code}</strong></span>}</div>
        {planUsage && <CurrentPlan planUsage={planUsage} />}
        <nav className={styles.tabNav} aria-label="Admin sections">
          <button
            type="button"
            aria-pressed={activeTab === "qr"}
            onClick={() => setActiveTab("qr")}
            className={activeTab === "qr" ? styles.activeTab : styles.tab}
          >
            <QrCode className="w-4 h-4" /> App QR Codes
          </button>
          <button
            type="button"
            aria-pressed={activeTab === "config"}
            onClick={() => setActiveTab("config")}
            className={activeTab === "config" ? styles.activeTab : styles.tab}
          >
            <Settings className="w-4 h-4" /> Configuration
          </button>
          <button
            type="button"
            aria-pressed={activeTab === "analytics"}
            onClick={() => setActiveTab("analytics")}
            className={activeTab === "analytics" ? styles.activeTab : styles.tab}
          >
            <BarChart3 className="w-4 h-4" /> Analytics Data
          </button>
          <button
            type="button"
            aria-pressed={activeTab === "customization"}
            onClick={() => setActiveTab("customization")}
            className={activeTab === "customization" ? styles.activeTab : styles.tab}
          >
            <Palette className="w-4 h-4" /> Customization
          </button>
          <button
            type="button"
            aria-pressed={activeTab === "profile"}
            onClick={() => setActiveTab("profile")}
            className={activeTab === "profile" ? styles.activeTab : styles.tab}
          >
            <UserRound className="w-4 h-4" /> Profile
          </button>
        </nav>
      </div>

      <div className={styles.content}>
        {activeTab === "profile" && (
          <AdminProfile
            user={user}
            accessToken={accessToken}
            acceptSession={acceptSession}
            signOut={signOut}
          />
        )}
        {activeTab === "customization" && <ThemeCustomization accessToken={accessToken!} />}
        {activeTab === "qr" && (
          <div className={styles.qrGrid}>
            <section className={styles.qrSection}>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                Staff Counter QR Code
              </h3>
              <p className="text-sm text-slate-500 mb-4 text-center">
                Scan or download the QR code for staff counter portal.
              </p>
              <div className={styles.qrCanvas}>
                <QRCodeSVG ref={staffQrRef} value={staffUrl} size={180} />
              </div>
              <input
                type="text"
                aria-label="Staff App URL"
                value={staffUrl}
                onChange={(e) => setStaffUrl(e.target.value)}
                className="w-full text-sm p-2 border border-slate-300 rounded mb-4"
                placeholder="Staff App URL"
              />
              <button
                onClick={() => downloadQR(staffQrRef, "staff-app-qr")}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition"
              >
                <Download className="w-4 h-4" /> Download Staff QR Code
              </button>
            </section>

            <section className={styles.qrSection}>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                Customer App QR Code
              </h3>
              <p className="text-sm text-slate-500 mb-4 text-center">
                Scan or download the QR code for customer queue booking.
              </p>
              <div className={styles.qrCanvas}>
                <QRCodeSVG ref={customerQrRef} value={customerUrl} size={180} />
              </div>
              <input
                type="text"
                aria-label="Customer App URL"
                value={customerUrl}
                onChange={(e) => setCustomerUrl(e.target.value)}
                className="w-full text-sm p-2 border border-slate-300 rounded mb-4"
                placeholder="Customer App URL"
              />
              <button
                onClick={() => downloadQR(customerQrRef, "customer-app-qr")}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition"
              >
                <Download className="w-4 h-4" /> Download Customer QR Code
              </button>
            </section>
          </div>
        )}

        {activeTab === "config" && (
          <div>
            <div className={styles.configNav} role="group" aria-label="Configuration sections">
              {(["branches", "services", "staff"] as const).map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={configSubTab === cat}
                    onClick={() => {
                      setConfigSubTab(cat);
                      setEditingBranchId(null);
                      setEditingServiceId(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition ${
                      configSubTab === cat
                        ? "bg-indigo-100 text-indigo-700"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {cat === "staff" ? "Staff Users" : cat}
                  </button>
                ),
              )}
            </div>

            {configSubTab === "branches" && (
              <div>
                <form className={styles.createForm} onSubmit={addBranch}>
                  <label className={styles.field}>
                    Branch name
                  <input
                    type="text"
                    placeholder="Branch Name"
                    value={branchForm.name}
                    onChange={(e) =>
                      setBranchForm({ ...branchForm, name: e.target.value })
                    }
                    required
                    className="p-2 text-sm border rounded w-1/2"
                  />
                  </label>
                  <label className={styles.field}>
                    Branch code
                  <input
                    type="text"
                    placeholder="Branch Code"
                    value={branchForm.code}
                    onChange={(e) =>
                      setBranchForm({ ...branchForm, code: e.target.value })
                    }
                    required
                    className="p-2 text-sm border rounded w-1/2"
                  />
                  </label>
                  <button
                    type="submit"
                    disabled={isSavingBranch}
                    className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </form>

                {branchError && (
                  <p className="mb-4 text-sm text-red-500" role="alert">
                    {branchError}
                  </p>
                )}
                {isBranchesLoading && (
                  <p className="mb-4 text-sm text-slate-500">
                    Loading branches...
                  </p>
                )}

                <ul className="divide-y border rounded-lg">
                  {!isBranchesLoading && branches.length === 0 && (
                    <li className="p-4 text-sm text-slate-500">
                      No branches yet.
                    </li>
                  )}
                  {branches.map((item) => (
                    <li
                      key={item.id}
                      className="p-4 flex items-center justify-between hover:bg-slate-50"
                    >
                      {editingBranchId === item.id ? (
                        <div className="flex gap-2 w-full mr-4">
                          <input
                            type="text"
                            value={branchEdit.name ?? item.name}
                            onChange={(e) =>
                              setBranchEdit({
                                ...branchEdit,
                                name: e.target.value,
                              })
                            }
                            className="p-1 border rounded text-sm w-1/2"
                          />
                          <input
                            type="text"
                            value={branchEdit.code ?? item.code}
                            onChange={(e) =>
                              setBranchEdit({
                                ...branchEdit,
                                code: e.target.value,
                              })
                            }
                            className="p-1 border rounded text-sm w-1/2"
                          />
                        </div>
                      ) : (
                        <div>
                          <p className="font-semibold text-slate-800">
                            {item.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            Code: {item.code}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        {editingBranchId === item.id ? (
                          <>
                            <button
                              aria-label={`Save ${item.name}`}
                              disabled={isSavingBranch}
                              onClick={() => void updateBranch(item)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              aria-label="Cancel edit"
                              onClick={() => {
                                setBranchError("");
                                setEditingBranchId(null);
                              }}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              aria-label={`Edit ${item.name}`}
                              onClick={() => {
                                setBranchError("");
                                setEditingBranchId(item.id);
                                setBranchEdit(item);
                              }}
                              className="p-1 text-slate-600 hover:bg-slate-100 rounded"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              aria-label={`Delete ${item.name}`}
                              onClick={() => void deleteBranch(item)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {configSubTab === "services" && (
              <div>
                <form
                  className={styles.createForm}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveService(serviceForm, null);
                  }}
                >
                  <label className={styles.field}>
                    Service name
                  <input
                    type="text"
                    placeholder="Service Name"
                    value={serviceForm.name}
                    onChange={(e) =>
                      setServiceForm({ ...serviceForm, name: e.target.value })
                    }
                    required
                    className="p-2 text-sm border rounded w-1/2"
                  />
                  </label>
                  <label className={styles.field}>
                    Duration (minutes)
                  <input
                    type="number"
                    aria-label="Duration in minutes"
                    placeholder="Duration (minutes)"
                    min={1}
                    max={1440}
                    step={1}
                    value={serviceForm.duration}
                    onChange={(e) =>
                      setServiceForm({
                        ...serviceForm,
                        duration: e.target.value,
                      })
                    }
                    required
                    className="p-2 text-sm border rounded w-1/2"
                  />
                  </label>
                  <button
                    type="submit"
                    disabled={isSavingService}
                    className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                  <label className={styles.field}>
                    Description (optional)
                  <textarea
                    aria-label="Service description"
                    placeholder="Description (optional)"
                    maxLength={500}
                    rows={2}
                    value={serviceForm.description}
                    onChange={(e) =>
                      setServiceForm({
                        ...serviceForm,
                        description: e.target.value,
                      })
                    }
                    className="mt-2 p-2 text-sm border rounded w-full"
                  />
                  </label>
                </form>

                {serviceError && (
                  <p className="mb-4 text-sm text-red-500" role="alert">
                    {serviceError}
                  </p>
                )}
                {isServicesLoading && (
                  <p className="mb-4 text-sm text-slate-500">
                    Loading services...
                  </p>
                )}

                <ul className="divide-y border rounded-lg">
                  {!isServicesLoading && services.length === 0 && (
                    <li className="p-4 text-sm text-slate-500">
                      No services yet.
                    </li>
                  )}
                  {services.map((item) => (
                    <li
                      key={item.id}
                      className="p-4 flex items-center justify-between hover:bg-slate-50"
                    >
                      {editingServiceId === item.id ? (
                        <div className="w-full mr-4">
                          <div className="flex gap-2">
                          <input
                            type="text"
                            aria-label="Service name"
                            value={serviceEdit.name}
                            onChange={(e) =>
                              setServiceEdit({
                                ...serviceEdit,
                                name: e.target.value,
                              })
                            }
                            className="p-1 border rounded text-sm w-1/2"
                          />
                          <input
                            type="number"
                            aria-label="Duration in minutes"
                            min={1}
                            max={1440}
                            step={1}
                            value={serviceEdit.duration}
                            onChange={(e) =>
                              setServiceEdit({
                                ...serviceEdit,
                                duration: e.target.value,
                              })
                            }
                            className="p-1 border rounded text-sm w-1/2"
                          />
                          </div>
                          <textarea
                            aria-label="Service description"
                            placeholder="Description (optional)"
                            maxLength={500}
                            rows={2}
                            value={serviceEdit.description}
                            onChange={(e) =>
                              setServiceEdit({
                                ...serviceEdit,
                                description: e.target.value,
                              })
                            }
                            className="mt-2 p-1 border rounded text-sm w-full"
                          />
                        </div>
                      ) : (
                        <div>
                          <p className="font-semibold text-slate-800">
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="text-sm text-slate-600 whitespace-pre-line">
                              {item.description}
                            </p>
                          )}
                          <p className="text-xs text-slate-500">
                            Duration: {item.duration_minutes} mins
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        {editingServiceId === item.id ? (
                          <>
                            <button
                              aria-label={`Save ${item.name}`}
                              disabled={isSavingService}
                              onClick={() =>
                                void saveService(serviceEdit, item.id)
                              }
                              className="p-1 text-green-600 hover:bg-green-50 rounded disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              aria-label="Cancel edit"
                              onClick={() => {
                                setServiceError("");
                                setEditingServiceId(null);
                              }}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              aria-label={`Edit ${item.name}`}
                              onClick={() => {
                                setServiceError("");
                                setEditingServiceId(item.id);
                                setServiceEdit({
                                  name: item.name,
                                  description: item.description,
                                  duration: String(item.duration_minutes),
                                });
                              }}
                              className="p-1 text-slate-600 hover:bg-slate-100 rounded"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              aria-label={`Delete ${item.name}`}
                              onClick={() => void deleteService(item)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {configSubTab === "staff" && (
              <div>
                <div className="mb-6 flex justify-end">
                  <button
                    onClick={() => {
                      resetStaffForm();
                      setStaffError("");
                      setIsStaffModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700"
                  >
                    <Plus className="w-4 h-4" /> Add staff user
                  </button>
                </div>

                {staffError && !isStaffModalOpen && (
                  <p className="mb-4 text-sm text-red-500" role="alert">
                    {staffError}
                  </p>
                )}
                {isStaffLoading && (
                  <p className="mb-4 text-sm text-slate-500">
                    Loading staff users...
                  </p>
                )}

                <ul className="divide-y border rounded-lg">
                  {!isStaffLoading && staff.length === 0 && (
                    <li className="p-4 text-sm text-slate-500">
                      No staff users yet.
                    </li>
                  )}
                  {staff.map((item) => (
                    <li
                      key={item.id}
                      className="p-4 flex items-center justify-between hover:bg-slate-50"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          @{item.username} | {item.email} | Role: {item.role}
                        </p>
                        <p className="text-xs text-slate-500">
                          {branches.find((branch) => branch.id === item.branch_id)?.name ?? "No branch"}
                          {" · "}
                          {item.counter_name ?? "No counter name"}
                          {" · "}
                          {services
                            .filter((service) => item.service_ids.includes(service.id))
                            .map((service) => service.name)
                            .join(", ") || "No services"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          aria-label={`Edit ${item.name}`}
                          onClick={() => {
                            setStaffError("");
                            setEditingStaffId(item.id);
                            setStaffForm({
                              name: item.name,
                              username: item.username,
                              email: item.email,
                              code: "",
                              role: item.role,
                              branch_id: item.branch_id,
                              counter_name: item.counter_name ?? "",
                              service_ids: item.service_ids,
                            });
                            setIsStaffModalOpen(true);
                          }}
                          className="p-1 text-slate-600 hover:bg-slate-100 rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          aria-label={`Delete ${item.name}`}
                          onClick={() => void deleteStaffUser(item)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                {isStaffModalOpen && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                    onMouseDown={(event) => {
                      if (event.currentTarget === event.target) {
                        setIsStaffModalOpen(false);
                        resetStaffForm();
                      }
                    }}
                  >
                    <section
                      aria-labelledby="staff-modal-title"
                      aria-modal="true"
                      className={`${styles.staffDialog} w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-2xl`}
                      role="dialog"
                    >
                      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                        <h2
                          className="text-lg font-semibold text-slate-800"
                          id="staff-modal-title"
                        >
                          {editingStaffId
                            ? "Edit staff user"
                            : "Add staff user"}
                        </h2>
                        <button
                          aria-label="Close dialog"
                          className="rounded p-1 text-slate-500 hover:bg-slate-100"
                          onClick={() => {
                            setIsStaffModalOpen(false);
                            resetStaffForm();
                          }}
                          type="button"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </header>

                      <form className="space-y-5 p-6" onSubmit={saveStaffUser}>
                        {staffError && (
                          <p className="text-sm text-red-500" role="alert">
                            {staffError}
                          </p>
                        )}
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="space-y-1.5 text-sm font-medium text-slate-700">
                            Name
                            <input
                              autoComplete="name"
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              onChange={(event) =>
                                setStaffForm({
                                  ...staffForm,
                                  name: event.target.value,
                                })
                              }
                              required
                              value={staffForm.name}
                            />
                          </label>
                          <label className="space-y-1.5 text-sm font-medium text-slate-700">
                            Username
                            <input
                              autoComplete="username"
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              onChange={(event) =>
                                setStaffForm({
                                  ...staffForm,
                                  username: event.target.value,
                                })
                              }
                              required
                              value={staffForm.username}
                            />
                          </label>
                          <label className="space-y-1.5 text-sm font-medium text-slate-700">
                            Email
                            <input
                              autoComplete="email"
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              onChange={(event) =>
                                setStaffForm({
                                  ...staffForm,
                                  email: event.target.value,
                                })
                              }
                              required
                              type="email"
                              value={staffForm.email}
                            />
                          </label>
                          <label className="space-y-1.5 text-sm font-medium text-slate-700">
                            {editingStaffId ? "New code (optional)" : "Code"}
                            <input
                              autoComplete="new-password"
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              onChange={(event) =>
                                setStaffForm({
                                  ...staffForm,
                                  code: event.target.value,
                                })
                              }
                              required={!editingStaffId}
                              type="password"
                              value={staffForm.code}
                            />
                          </label>
                          <label className="space-y-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
                            Role
                            <input
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              onChange={(event) =>
                                setStaffForm({
                                  ...staffForm,
                                  role: event.target.value,
                                })
                              }
                              placeholder="e.g. Agent or Manager"
                              required
                              value={staffForm.role}
                            />
                          </label>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="space-y-1.5 text-sm font-medium text-slate-700">
                            Branch
                            {branches.length === 0 ? (
                              <p className="text-sm font-normal text-slate-500">
                                Create a branch before assigning it to staff.
                              </p>
                            ) : (
                              <select
                                className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-normal"
                                onChange={(event) =>
                                  setStaffForm((current) => ({
                                    ...current,
                                    branch_id: event.target.value || null,
                                  }))
                                }
                                value={staffForm.branch_id ?? ""}
                              >
                                <option value="">No branch assigned</option>
                                {branches.map((branch) => (
                                  <option key={branch.id} value={branch.id}>
                                    {branch.name} ({branch.code})
                                  </option>
                                ))}
                              </select>
                            )}
                          </label>
                          <label className="space-y-1.5 text-sm font-medium text-slate-700">
                            Counter name
                            <input
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              maxLength={60}
                              required
                              onChange={(event) =>
                                setStaffForm({
                                  ...staffForm,
                                  counter_name: event.target.value,
                                })
                              }
                              placeholder="e.g. Counter 1"
                              value={staffForm.counter_name}
                            />
                          </label>
                        </div>

                        <fieldset className="space-y-1.5 text-sm font-medium text-slate-700">
                          <legend>Services served at this counter</legend>
                          {services.length === 0 ? (
                            <p className="text-sm font-normal text-slate-500">
                              Create a service before assigning it to staff.
                            </p>
                          ) : (
                            <div className="grid gap-2 rounded border border-slate-300 p-3 sm:grid-cols-2">
                              {services.map((service) => (
                                <label
                                  key={service.id}
                                  className="flex items-center gap-2 font-normal"
                                >
                                  <input
                                    checked={staffForm.service_ids.includes(service.id)}
                                    onChange={(event) =>
                                      setStaffForm((current) => ({
                                        ...current,
                                        service_ids: event.target.checked
                                          ? [...current.service_ids, service.id]
                                          : current.service_ids.filter((id) => id !== service.id),
                                      }))
                                    }
                                    type="checkbox"
                                  />
                                  {service.name}
                                </label>
                              ))}
                            </div>
                          )}
                        </fieldset>

                        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                          <button
                            className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                            onClick={() => {
                              resetStaffForm();
                              setIsStaffModalOpen(false);
                            }}
                            type="button"
                          >
                            Cancel
                          </button>
                          <button
                            className="flex items-center gap-2 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isSavingStaff || isStaffLoading}
                            type="submit"
                          >
                            <Plus className="h-4 w-4" />
                            {isSavingStaff
                              ? "Saving..."
                              : editingStaffId
                                ? "Update user"
                                : "Add user"}
                          </button>
                        </div>
                      </form>
                    </section>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-800">
              Operational Overview
            </h3>
            {analyticsError && (
              <p
                className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                role="alert"
              >
                {analyticsError}
              </p>
            )}
            {isAnalyticsLoading && !analytics ? (
              <p className="text-sm text-slate-500" role="status">
                Loading ticket analytics...
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  {[
                    {
                      label: "Serving tickets",
                      value: analytics?.serving_count ?? 0,
                    },
                    {
                      label: "Avg. serving time",
                      value:
                        analytics && analytics.serving_count > 0
                          ? formatWaitDuration(
                              analytics.average_serving_minutes,
                            )
                          : "--",
                    },
                    {
                      label: "Waiting customers",
                      value: analytics?.waiting_count ?? 0,
                    },
                    {
                      label: "Shortest wait",
                      value: formatWaitDuration(
                        analytics?.min_wait_minutes ?? null,
                      ),
                    },
                    {
                      label: "Longest wait",
                      value: formatWaitDuration(
                        analytics?.max_wait_minutes ?? null,
                      ),
                    },
                  ].map((metric) => (
                    <div
                      key={metric.label}
                      className="border border-slate-200 rounded-lg bg-white p-4"
                    >
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        {metric.label}
                      </p>
                      <p className="mt-2 text-2xl font-bold text-slate-800">
                        {metric.value}
                      </p>
                      {metric.label === "Avg. serving time" && (
                        <p className="mt-1 text-xs text-slate-500">
                          Based on configured service duration
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <section
                  className="border border-slate-200 rounded-lg bg-white p-5"
                  aria-labelledby="waiting-chart-title"
                >
                  <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                    <h4
                      id="waiting-chart-title"
                      className="font-semibold text-slate-800"
                    >
                      Currently waiting by ticket arrival time
                    </h4>
                    <span className="text-sm text-slate-500">
                      Time of day: 8 AM - 8 PM
                    </span>
                  </div>
                  {analytics?.waiting_by_hour.length ? (
                    <div className="overflow-x-auto pb-2">
                      <div
                        className="grid h-56 min-w-[780px] items-end gap-2 border-b border-l border-slate-200 px-3 pt-4"
                        style={{
                          gridTemplateColumns: `repeat(${analytics.waiting_by_hour.length}, minmax(0, 1fr))`,
                        }}
                        role="img"
                        aria-label="Current waiting customers grouped by ticket arrival hour, from 8 AM to 8 PM"
                      >
                        {analytics.waiting_by_hour.map((bucket) => {
                          const maxCustomers = Math.max(
                            ...analytics.waiting_by_hour.map(
                              (item) => item.customers,
                            ),
                            1,
                          );
                          const height = bucket.customers
                            ? Math.max(
                                (bucket.customers / maxCustomers) * 100,
                                8,
                              )
                            : 0;
                          return (
                            <div
                              key={bucket.label}
                              className="flex h-full min-w-0 flex-col items-center justify-end gap-2"
                            >
                              <span className="text-sm font-semibold text-slate-700">
                                {bucket.customers}
                              </span>
                              <div className="flex h-full w-full items-end">
                                <div
                                  className="w-full rounded-t bg-emerald-600 transition-[height]"
                                  style={{ height: `${height}%` }}
                                />
                              </div>
                              <span className="whitespace-nowrap pb-2 text-xs text-slate-600">
                                {bucket.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No waiting customers right now.
                    </p>
                  )}
                  <p className="mt-2 text-right text-xs text-slate-500">
                    Waiting customers
                  </p>
                </section>
              </>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase">
                  Branches
                </p>
                <p className="text-3xl font-bold text-slate-800">
                  {branches.length}
                </p>
              </div>
              <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase">
                  Services
                </p>
                <p className="text-3xl font-bold text-slate-800">
                  {services.length}
                </p>
              </div>
              <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase">
                  Staff Users
                </p>
                <p className="text-3xl font-bold text-slate-800">
                  {staff.length}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPortal() {
  const router = useRouter();
  const { user, accessToken, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && (!user || !accessToken)) {
      router.replace("/login?next=%2Fadmin");
    }
  }, [accessToken, isLoading, router, user]);

  if (isLoading || !user || !accessToken) {
    return (
      <div
        className={`${styles.page} ${adminFont.variable} fixed inset-0 z-40 flex items-center justify-center`}
        role="status"
        aria-label="Checking your session"
      >
        <span aria-hidden="true" className="relative h-16 w-16">
          <span className="absolute inset-0 animate-spin rounded-full border-4 border-emerald-400/20 border-t-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.18)] motion-reduce:animate-none" />
          <span className="absolute inset-2 animate-[spin_1.5s_linear_infinite_reverse] rounded-full border-2 border-teal-300/20 border-b-teal-300 motion-reduce:animate-none" />
          <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-emerald-300 motion-reduce:animate-none" />
        </span>
        <span className="sr-only">Checking your session...</span>
      </div>
    );
  }

  return <AdminDashboard />;
}
