"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import type { TenantUsage } from "@/lib/plans";
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
  Building2,
  ClipboardList,
  Layers,
  Users,
  Ticket,
  ArrowUpRight,
  AlertTriangle,
} from "lucide-react";

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
interface Queue {
  id: string;
  name: string;
  branch_id: string;
  is_default: boolean;
  service_ids: string[];
}
interface Staff {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  queue_id: string | null;
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

type UsageLevel = "ok" | "near" | "full";

// "near" from 80% of the limit, "full" at or over it; a null limit is unlimited.
function usageLevel(used: number, limit: number | null): UsageLevel {
  if (limit === null) return "ok";
  if (used >= limit) return "full";
  if (used >= limit * 0.8) return "near";
  return "ok";
}

const usageStyles: Record<UsageLevel, { value: string; bar: string; card: string }> = {
  ok: { value: "text-slate-900", bar: "bg-indigo-500", card: "border-slate-200" },
  near: { value: "text-amber-600", bar: "bg-amber-500", card: "border-amber-200" },
  full: { value: "text-red-600", bar: "bg-red-500", card: "border-red-200" },
};

function PlanExpiredBanner({ subscription, planName }: {
  subscription: TenantUsage["subscription"];
  planName: string;
}) {
  const expiredOn = subscription.expires_at
    ? new Date(subscription.expires_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="text-sm text-amber-900">
          <p className="font-semibold">
            Your {subscription.plan_name} plan {expiredOn ? `expired on ${expiredOn}` : "has expired"}.
          </p>
          <p className="mt-0.5 text-amber-800">
            Your account is now on the {planName} plan and its limits apply. Existing branches, queues and staff
            are kept, but you can&apos;t add more until you renew.
          </p>
        </div>
      </div>
      <Link
        href="/pricing"
        className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-700"
      >
        Renew plan <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function PlanUsageStrip({ planUsage }: { planUsage: TenantUsage }) {
  const { limits, usage } = planUsage;
  const items = [
    { label: "Branches", icon: Building2, used: usage.branches, limit: limits.branches },
    { label: "Services", icon: ClipboardList, used: usage.services, limit: limits.services },
    { label: "Queues", icon: Layers, used: usage.queues, limit: limits.queues },
    { label: "Staff", icon: Users, used: usage.staff_users, limit: limits.staff_users },
    { label: "Tickets today", icon: Ticket, used: usage.tickets_today, limit: limits.tickets_per_day },
  ];

  return (
    <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
      {planUsage.subscription.expired && (
        <PlanExpiredBanner subscription={planUsage.subscription} planName={planUsage.plan_name} />
      )}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Plan &amp; usage</h2>
          <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map(({ label, icon: Icon, used, limit }) => {
          const level = usageLevel(used, limit);
          const styles = usageStyles[level];
          const percent = limit === null ? 0 : limit === 0 ? 100 : Math.min(100, (used / limit) * 100);
          return (
            <div key={label} className={`rounded-lg border p-3 ${styles.card}`}>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Icon className="h-3.5 w-3.5" /> {label}
              </div>
              <p className="mt-1 text-lg font-bold leading-tight">
                <span className={styles.value}>{used}</span>
                <span className="text-sm font-medium text-slate-400">
                  {limit === null ? " · Unlimited" : ` / ${limit}`}
                </span>
              </p>
              {limit !== null && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${styles.bar}`} style={{ width: `${percent}%` }} />
                </div>
              )}
              {level === "full" && (
                <p className="mt-1.5 text-xs font-medium text-red-600">
                  {used > (limit ?? 0) ? "Over limit" : "Limit reached"}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AdminDashboard() {
  const { user, accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<"qr" | "config" | "analytics">(
    "qr",
  );

  const [staffUrl, setStaffUrl] = useState("http://localhost:3000/staff");
  const [customerUrl, setCustomerUrl] = useState(
    "http://localhost:3000/customer",
  );

  useEffect(() => {
    if (!user?.tenant_code) return;
    setStaffUrl(`http://localhost:3000/${user.tenant_code}/staff`);
    setCustomerUrl(`http://localhost:3000/${user.tenant_code}/customer`);
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
    "branches" | "services" | "queues" | "staff"
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
  const [serviceForm, setServiceForm] = useState({ name: "", duration: "15" });
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceEdit, setServiceEdit] = useState({ name: "", duration: "" });

  const [queues, setQueues] = useState<Queue[]>([]);
  const [isQueuesLoading, setIsQueuesLoading] = useState(false);
  const [isSavingQueue, setIsSavingQueue] = useState(false);
  const [queueError, setQueueError] = useState("");
  const [queueName, setQueueName] = useState("");
  const [editingQueueId, setEditingQueueId] = useState<string | null>(null);
  const [queueEditName, setQueueEditName] = useState("");
  const [addingServiceQueueId, setAddingServiceQueueId] = useState<
    string | null
  >(null);
  const [serviceToAdd, setServiceToAdd] = useState("");
  const [isAssigningService, setIsAssigningService] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  // Falls back to the first branch until one is picked, or if the picked one was deleted.
  const queueBranch =
    branches.find((branch) => branch.id === selectedBranchId) ?? branches[0];
  const branchQueues = queues.filter(
    (queue) => queue.branch_id === queueBranch?.id,
  );

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
    queue_id: null as string | null,
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
      !window.confirm(`Delete ${branch.name}? Its queues will be deleted too.`)
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
    form: { name: string; duration: string },
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
        setServiceForm({ name: "", duration: "15" });
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

  // Reloads when branches or services change: a new branch brings a default queue,
  // and services appear in or leave the default queues.
  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();

    const loadQueues = async () => {
      setIsQueuesLoading(true);
      setQueueError("");
      try {
        const response = await fetch("/api/queues", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => null)) as {
          queues?: Queue[];
          error?: string;
        } | null;
        if (!response.ok)
          throw new Error(result?.error || "Unable to load queues.");
        setQueues(result?.queues ?? []);
      } catch (error) {
        if (!controller.signal.aborted) {
          setQueueError(
            error instanceof Error ? error.message : "Unable to load queues.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setIsQueuesLoading(false);
      }
    };

    void loadQueues();
    return () => controller.abort();
  }, [accessToken, branches, services]);

  const addQueue = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !queueBranch) return;

    setIsSavingQueue(true);
    setQueueError("");
    try {
      const response = await fetch("/api/queues", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: queueName.trim(),
          branch_id: queueBranch.id,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        queue?: Queue;
        error?: string;
      } | null;
      if (!response.ok || !result?.queue) {
        throw new Error(result?.error || "Unable to create queue.");
      }

      setQueues((currentQueues) => [...currentQueues, result.queue!]);
      setQueueName("");
      void loadUsage();
    } catch (error) {
      setQueueError(
        error instanceof Error ? error.message : "Unable to create queue.",
      );
    } finally {
      setIsSavingQueue(false);
    }
  };

  const deleteQueue = async (queue: Queue) => {
    if (!accessToken || !window.confirm(`Delete ${queue.name}?`)) return;
    setQueueError("");
    try {
      const response = await fetch(`/api/queues/${queue.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(result?.error || "Unable to delete queue.");
      setQueues((currentQueues) =>
        currentQueues.filter((item) => item.id !== queue.id),
      );
      void loadUsage();
    } catch (error) {
      setQueueError(
        error instanceof Error ? error.message : "Unable to delete queue.",
      );
    }
  };

  const renameQueue = async (queue: Queue) => {
    if (!accessToken) return;

    setIsSavingQueue(true);
    setQueueError("");
    try {
      const response = await fetch(`/api/queues/${queue.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: queueEditName.trim() }),
      });
      const result = (await response.json().catch(() => null)) as {
        queue?: Queue;
        error?: string;
      } | null;
      if (!response.ok || !result?.queue) {
        throw new Error(result?.error || "Unable to update queue.");
      }

      setQueues((currentQueues) =>
        currentQueues.map((item) =>
          item.id === queue.id ? result.queue! : item,
        ),
      );
      setEditingQueueId(null);
    } catch (error) {
      setQueueError(
        error instanceof Error ? error.message : "Unable to update queue.",
      );
    } finally {
      setIsSavingQueue(false);
    }
  };

  const addServiceToQueue = async (queue: Queue, serviceId: string) => {
    if (!accessToken || !serviceId) return;

    setIsAssigningService(true);
    setQueueError("");
    try {
      const response = await fetch(
        `/api/queues/${queue.id}/services/${serviceId}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const result = (await response.json().catch(() => null)) as {
        queue?: Queue;
        error?: string;
      } | null;
      if (!response.ok || !result?.queue) {
        throw new Error(result?.error || "Unable to add service to queue.");
      }

      // A service has one queue per branch, so it leaves the branch's other queues.
      setQueues((currentQueues) =>
        currentQueues.map((item) => {
          if (item.id === queue.id) return result.queue!;
          if (item.branch_id !== queue.branch_id) return item;
          return {
            ...item,
            service_ids: item.service_ids.filter((id) => id !== serviceId),
          };
        }),
      );
      setAddingServiceQueueId(null);
      setServiceToAdd("");
    } catch (error) {
      setQueueError(
        error instanceof Error
          ? error.message
          : "Unable to add service to queue.",
      );
    } finally {
      setIsAssigningService(false);
    }
  };

  const resetStaffForm = () => {
    setStaffForm({
      name: "",
      username: "",
      email: "",
      code: "",
      role: "",
      queue_id: null,
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
      queue_id: staffForm.queue_id,
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">Admin Portal</h1>
        {planUsage && <PlanUsageStrip planUsage={planUsage} />}
        <div className="flex space-x-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("qr")}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-all ${
              activeTab === "qr"
                ? "border-indigo-600 text-indigo-600 bg-white rounded-t-lg"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <QrCode className="w-4 h-4" /> App QR Codes
          </button>
          <button
            onClick={() => setActiveTab("config")}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-all ${
              activeTab === "config"
                ? "border-indigo-600 text-indigo-600 bg-white rounded-t-lg"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Settings className="w-4 h-4" /> Configuration
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-all ${
              activeTab === "analytics"
                ? "border-indigo-600 text-indigo-600 bg-white rounded-t-lg"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <BarChart3 className="w-4 h-4" /> Analytics Data
          </button>
        </div>
      </div>

      <div className="p-6">
        {activeTab === "qr" && (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-6 border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col items-center">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                Staff Counter QR Code
              </h3>
              <p className="text-sm text-slate-500 mb-4 text-center">
                Scan or download the QR code for staff counter portal.
              </p>
              <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-4">
                <QRCodeSVG ref={staffQrRef} value={staffUrl} size={180} />
              </div>
              <input
                type="text"
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
            </div>

            <div className="p-6 border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col items-center">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                Customer App QR Code
              </h3>
              <p className="text-sm text-slate-500 mb-4 text-center">
                Scan or download the QR code for customer queue booking.
              </p>
              <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-4">
                <QRCodeSVG ref={customerQrRef} value={customerUrl} size={180} />
              </div>
              <input
                type="text"
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
            </div>
          </div>
        )}

        {activeTab === "config" && (
          <div>
            <div className="flex space-x-2 mb-6 border-b border-slate-200 pb-2">
              {(["branches", "services", "queues", "staff"] as const).map(
                (cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setConfigSubTab(cat);
                      setEditingBranchId(null);
                      setEditingServiceId(null);
                      setEditingQueueId(null);
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
                <form className="flex gap-2 mb-6 max-w-xl" onSubmit={addBranch}>
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
                  className="flex gap-2 mb-6 max-w-xl"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveService(serviceForm, null);
                  }}
                >
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
                  <button
                    type="submit"
                    disabled={isSavingService}
                    className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
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
                        <div className="flex gap-2 w-full mr-4">
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
                      ) : (
                        <div>
                          <p className="font-semibold text-slate-800">
                            {item.name}
                          </p>
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

            {configSubTab === "queues" && (
              <div>
                {!queueBranch ? (
                  <p className="text-sm text-slate-500">
                    {isBranchesLoading
                      ? "Loading branches..."
                      : "Create a branch first. Each branch gets a default queue automatically."}
                  </p>
                ) : (
                  <>
                    <label className="mb-6 block max-w-xl space-y-1.5 text-sm font-medium text-slate-700">
                      Branch
                      <select
                        value={queueBranch.id}
                        onChange={(e) => {
                          setQueueError("");
                          setSelectedBranchId(e.target.value);
                        }}
                        className="w-full p-2 text-sm font-normal border rounded"
                      >
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.code})
                          </option>
                        ))}
                      </select>
                    </label>

                    <form
                      className="flex gap-2 max-w-xl mb-6"
                      onSubmit={addQueue}
                    >
                      <input
                        type="text"
                        placeholder="Queue Name"
                        value={queueName}
                        onChange={(e) => setQueueName(e.target.value)}
                        required
                        className="p-2 text-sm border rounded w-1/2"
                      />
                      <input
                        type="text"
                        aria-label="Branch"
                        value={`${queueBranch.name} (${queueBranch.code})`}
                        readOnly
                        className="p-2 text-sm border rounded w-1/2 bg-slate-50 text-slate-500"
                      />
                      <button
                        type="submit"
                        disabled={isSavingQueue}
                        className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Plus className="w-4 h-4" /> Add
                      </button>
                    </form>

                    {queueError && (
                      <p className="mb-4 text-sm text-red-500" role="alert">
                        {queueError}
                      </p>
                    )}
                    {isQueuesLoading && (
                      <p className="mb-4 text-sm text-slate-500">
                        Loading queues...
                      </p>
                    )}

                    <ul className="divide-y border rounded-lg mb-6">
                      {!isQueuesLoading && branchQueues.length === 0 && (
                        <li className="p-4 text-sm text-slate-500">
                          No queues for this branch.
                        </li>
                      )}
                      {branchQueues.map((item) => {
                        const addableServices = services.filter(
                          (s) => !item.service_ids.includes(s.id),
                        );
                        return (
                          <li key={item.id} className="p-4 hover:bg-slate-50">
                            <div className="flex items-center justify-between">
                              <div
                                className={
                                  editingQueueId === item.id
                                    ? "w-full mr-4"
                                    : undefined
                                }
                              >
                                {editingQueueId === item.id ? (
                                  <input
                                    type="text"
                                    aria-label="Queue name"
                                    value={queueEditName}
                                    onChange={(e) =>
                                      setQueueEditName(e.target.value)
                                    }
                                    className="mb-1 p-1 border rounded text-sm w-1/2"
                                  />
                                ) : (
                                  <p className="font-semibold text-slate-800">
                                    {item.name}
                                    {item.is_default && (
                                      <span className="ml-2 rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                        Default
                                      </span>
                                    )}
                                  </p>
                                )}
                                <p className="text-xs text-slate-500">
                                  Services:{" "}
                                  {services
                                    .filter((s) =>
                                      item.service_ids.includes(s.id),
                                    )
                                    .map((s) => s.name)
                                    .join(", ") || "None"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  disabled={addableServices.length === 0}
                                  onClick={() => {
                                    setQueueError("");
                                    setServiceToAdd("");
                                    setAddingServiceQueueId(item.id);
                                  }}
                                  className="flex items-center gap-1 rounded border border-indigo-200 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Plus className="w-3 h-3" /> Add service
                                </button>
                                {editingQueueId === item.id ? (
                                  <>
                                    <button
                                      aria-label={`Save ${item.name}`}
                                      disabled={isSavingQueue}
                                      onClick={() => void renameQueue(item)}
                                      className="p-1 text-green-600 hover:bg-green-50 rounded disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                      aria-label="Cancel edit"
                                      onClick={() => {
                                        setQueueError("");
                                        setEditingQueueId(null);
                                      }}
                                      className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </>
                                ) : item.is_default ? (
                                  <span aria-hidden="true" className="w-6" />
                                ) : (
                                  <button
                                    aria-label={`Edit ${item.name}`}
                                    onClick={() => {
                                      setQueueError("");
                                      setEditingQueueId(item.id);
                                      setQueueEditName(item.name);
                                    }}
                                    className="p-1 text-slate-600 hover:bg-slate-100 rounded"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                )}
                                {editingQueueId ===
                                item.id ? null : item.is_default ? (
                                  // Keeps "Add service" aligned with rows that have a delete button.
                                  <span aria-hidden="true" className="w-6" />
                                ) : (
                                  <button
                                    aria-label={`Delete ${item.name}`}
                                    onClick={() => void deleteQueue(item)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {addingServiceQueueId === item.id && (
                              <form
                                className="mt-3 flex gap-2 max-w-xl"
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  void addServiceToQueue(item, serviceToAdd);
                                }}
                              >
                                <select
                                  aria-label={`Service to add to ${item.name}`}
                                  value={serviceToAdd}
                                  onChange={(e) =>
                                    setServiceToAdd(e.target.value)
                                  }
                                  required
                                  className="p-1 text-sm border rounded w-full"
                                >
                                  <option value="">Select a service</option>
                                  {addableServices.map((s) => {
                                    const currentQueue = branchQueues.find(
                                      (q) => q.service_ids.includes(s.id),
                                    );
                                    return (
                                      <option key={s.id} value={s.id}>
                                        {s.name}
                                        {currentQueue
                                          ? ` (in ${currentQueue.name})`
                                          : ""}
                                      </option>
                                    );
                                  })}
                                </select>
                                <button
                                  type="submit"
                                  disabled={isAssigningService}
                                  className="rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Add
                                </button>
                                <button
                                  type="button"
                                  aria-label="Cancel adding service"
                                  onClick={() => setAddingServiceQueueId(null)}
                                  className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </form>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
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
                          Queue:{" "}
                          {queues.find((queue) => queue.id === item.queue_id)?.name ?? "None assigned"}
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
                              queue_id: item.queue_id ?? null,
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
                      className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-2xl"
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

                        <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                          Assigned queue
                          {isQueuesLoading ? (
                            <p className="text-sm text-slate-500">
                              Loading queues...
                            </p>
                          ) : queues.length === 0 ? (
                            <p className="text-sm text-slate-500">
                              Create a queue before assigning it to staff.
                            </p>
                          ) : (
                            <select
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-normal"
                              onChange={(event) =>
                                setStaffForm((current) => ({
                                  ...current,
                                  queue_id: event.target.value || null,
                                }))
                              }
                              value={staffForm.queue_id ?? ""}
                            >
                              <option value="">No queue assigned</option>
                              {queues.map((queue) => {
                                const branchName = branches.find(
                                  (branch) => branch.id === queue.branch_id,
                                )?.name;
                                const assignedStaff = staff.find(
                                  (staffUser) =>
                                    staffUser.id !== editingStaffId &&
                                    staffUser.queue_id === queue.id,
                                );
                                return (
                                  <option
                                    key={queue.id}
                                    value={queue.id}
                                    disabled={Boolean(assignedStaff)}
                                  >
                                    {branchName ? `${branchName}: ` : ""}
                                    {queue.name}
                                    {queue.is_default ? " (default)" : ""}
                                    {assignedStaff
                                      ? ` (assigned to ${assignedStaff.name})`
                                      : ""}
                                  </option>
                                );
                              })}
                            </select>
                          )}
                        </label>

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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  Queues
                </p>
                <p className="text-3xl font-bold text-slate-800">
                  {queues.length}
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
        className="fixed inset-0 z-40 flex items-center justify-center"
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
