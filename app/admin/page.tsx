"use client";

import { useEffect, useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
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
} from "lucide-react";

interface Branch {
  id: string;
  name: string;
  code: string;
}
interface Service {
  id: string;
  name: string;
  duration: string;
}
interface Queue {
  id: string;
  name: string;
  branchId: string;
}
interface Staff {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
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

  const [branches, setBranches] = useState<Branch[]>([
    { id: "b1", name: "Main HQ", code: "HQ01" },
    { id: "b2", name: "Downtown Branch", code: "DT02" },
  ]);

  const [services, setServices] = useState<Service[]>([
    { id: "s1", name: "General Support", duration: "15 mins" },
    { id: "s2", name: "Account Services", duration: "30 mins" },
  ]);

  const [queues, setQueues] = useState<Queue[]>([
    { id: "q1", name: "Priority Counter 1", branchId: "b1" },
    { id: "q2", name: "General Queue A", branchId: "b2" },
  ]);

  const [staff, setStaff] = useState<Staff[]>([]);

  const [isStaffLoading, setIsStaffLoading] = useState(false);
  const [isSavingStaff, setIsSavingStaff] = useState(false);
  const [staffError, setStaffError] = useState("");
  const [newItem, setNewItem] = useState<Record<string, string>>({});
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState({
    name: "",
    username: "",
    email: "",
    code: "",
    role: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<Partial<Branch>>({});

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
        if (!response.ok) throw new Error(result?.error || "Unable to load staff users.");
        setStaff(result?.staffUsers ?? []);
      } catch (error) {
        if (!controller.signal.aborted) {
          setStaffError(error instanceof Error ? error.message : "Unable to load staff users.");
        }
      } finally {
        if (!controller.signal.aborted) setIsStaffLoading(false);
      }
    };

    void loadStaff();
    return () => controller.abort();
  }, [accessToken, configSubTab]);

  const resetStaffForm = () => {
    setStaffForm({ name: "", username: "", email: "", code: "", role: "" });
    setEditingStaffId(null);
  };

  const saveStaffUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) return;

    setIsSavingStaff(true);
    setStaffError("");
    const payload: Record<string, string> = {
      name: staffForm.name.trim(),
      username: staffForm.username.trim(),
      email: staffForm.email.trim(),
      role: staffForm.role.trim(),
    };
    if (staffForm.code) payload.code = staffForm.code;

    try {
      const response = await fetch(
        editingStaffId ? `/api/staff-users/${editingStaffId}` : "/api/staff-users",
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
          ? currentStaff.map((item) => item.id === editingStaffId ? result.staffUser! : item)
          : [result.staffUser!, ...currentStaff],
      );
      setIsStaffModalOpen(false);
      resetStaffForm();
    } catch (error) {
      setStaffError(error instanceof Error ? error.message : "Unable to save staff user.");
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
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "Unable to delete staff user.");
      setStaff((currentStaff) => currentStaff.filter((item) => item.id !== staffUser.id));
    } catch (error) {
      setStaffError(error instanceof Error ? error.message : "Unable to delete staff user.");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">Admin Portal</h1>
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
                      setNewItem({});
                      setEditingId(null);
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
                <div className="flex gap-2 mb-6 max-w-xl">
                  <input
                    type="text"
                    placeholder="Branch Name"
                    value={newItem.name || ""}
                    onChange={(e) =>
                      setNewItem({ ...newItem, name: e.target.value })
                    }
                    className="p-2 text-sm border rounded w-1/2"
                  />
                  <input
                    type="text"
                    placeholder="Branch Code"
                    value={newItem.code || ""}
                    onChange={(e) =>
                      setNewItem({ ...newItem, code: e.target.value })
                    }
                    className="p-2 text-sm border rounded w-1/2"
                  />
                  <button
                    onClick={() => {
                      if (newItem.name && newItem.code) {
                        setBranches([
                          ...branches,
                          {
                            id: Date.now().toString(),
                            name: newItem.name,
                            code: newItem.code,
                          },
                        ]);
                        setNewItem({});
                      }
                    }}
                    className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>

                <ul className="divide-y border rounded-lg">
                  {branches.map((item) => (
                    <li
                      key={item.id}
                      className="p-4 flex items-center justify-between hover:bg-slate-50"
                    >
                      {editingId === item.id ? (
                        <div className="flex gap-2 w-full mr-4">
                          <input
                            type="text"
                            value={editItem.name || item.name}
                            onChange={(e) =>
                              setEditItem({ ...editItem, name: e.target.value })
                            }
                            className="p-1 border rounded text-sm w-1/2"
                          />
                          <input
                            type="text"
                            value={editItem.code || item.code}
                            onChange={(e) =>
                              setEditItem({ ...editItem, code: e.target.value })
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
                        {editingId === item.id ? (
                          <>
                            <button
                              onClick={() => {
                                setBranches(
                                  branches.map((b) =>
                                    b.id === item.id
                                      ? {
                                          ...b,
                                          name: editItem.name ?? b.name,
                                          code: editItem.code ?? b.code,
                                        }
                                      : b,
                                  ),
                                );
                                setEditingId(null);
                              }}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditingId(item.id);
                                setEditItem(item);
                              }}
                              className="p-1 text-slate-600 hover:bg-slate-100 rounded"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                setBranches(
                                  branches.filter((b) => b.id !== item.id),
                                )
                              }
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
                <div className="flex gap-2 mb-6 max-w-xl">
                  <input
                    type="text"
                    placeholder="Service Name"
                    value={newItem.name || ""}
                    onChange={(e) =>
                      setNewItem({ ...newItem, name: e.target.value })
                    }
                    className="p-2 text-sm border rounded w-1/2"
                  />
                  <input
                    type="text"
                    placeholder="Duration (e.g. 15 mins)"
                    value={newItem.duration || ""}
                    onChange={(e) =>
                      setNewItem({ ...newItem, duration: e.target.value })
                    }
                    className="p-2 text-sm border rounded w-1/2"
                  />
                  <button
                    onClick={() => {
                      if (newItem.name) {
                        setServices([
                          ...services,
                          {
                            id: Date.now().toString(),
                            name: newItem.name,
                            duration: newItem.duration || "15 mins",
                          },
                        ]);
                        setNewItem({});
                      }
                    }}
                    className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>

                <ul className="divide-y border rounded-lg">
                  {services.map((item) => (
                    <li
                      key={item.id}
                      className="p-4 flex items-center justify-between hover:bg-slate-50"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Duration: {item.duration}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setServices(services.filter((s) => s.id !== item.id))
                        }
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {configSubTab === "queues" && (
              <div>
                <div className="flex gap-2 mb-6 max-w-xl">
                  <input
                    type="text"
                    placeholder="Queue Name"
                    value={newItem.name || ""}
                    onChange={(e) =>
                      setNewItem({ ...newItem, name: e.target.value })
                    }
                    className="p-2 text-sm border rounded w-1/2"
                  />
                  <select
                    value={newItem.branchId || ""}
                    onChange={(e) =>
                      setNewItem({ ...newItem, branchId: e.target.value })
                    }
                    className="p-2 text-sm border rounded w-1/2"
                  >
                    <option value="">Select Branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      if (newItem.name && newItem.branchId) {
                        setQueues([
                          ...queues,
                          {
                            id: Date.now().toString(),
                            name: newItem.name,
                            branchId: newItem.branchId,
                          },
                        ]);
                        setNewItem({});
                      }
                    }}
                    className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>

                <ul className="divide-y border rounded-lg">
                  {queues.map((item) => (
                    <li
                      key={item.id}
                      className="p-4 flex items-center justify-between hover:bg-slate-50"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Branch:{" "}
                          {branches.find((b) => b.id === item.branchId)?.name ||
                            "N/A"}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setQueues(queues.filter((q) => q.id !== item.id))
                        }
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
                  <p className="mb-4 text-sm text-red-500" role="alert">{staffError}</p>
                )}
                {isStaffLoading && <p className="mb-4 text-sm text-slate-500">Loading staff users...</p>}

                <ul className="divide-y border rounded-lg">
                  {!isStaffLoading && staff.length === 0 && (
                    <li className="p-4 text-sm text-slate-500">No staff users yet.</li>
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
                          {editingStaffId ? "Edit staff user" : "Add staff user"}
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

                      <form
                        className="space-y-5 p-6"
                        onSubmit={saveStaffUser}
                      >
                        {staffError && <p className="text-sm text-red-500" role="alert">{staffError}</p>}
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="space-y-1.5 text-sm font-medium text-slate-700">
                            Name
                            <input
                              autoComplete="name"
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              onChange={(event) => setStaffForm({ ...staffForm, name: event.target.value })}
                              required
                              value={staffForm.name}
                            />
                          </label>
                          <label className="space-y-1.5 text-sm font-medium text-slate-700">
                            Username
                            <input
                              autoComplete="username"
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              onChange={(event) => setStaffForm({ ...staffForm, username: event.target.value })}
                              required
                              value={staffForm.username}
                            />
                          </label>
                          <label className="space-y-1.5 text-sm font-medium text-slate-700">
                            Email
                            <input
                              autoComplete="email"
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              onChange={(event) => setStaffForm({ ...staffForm, email: event.target.value })}
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
                              onChange={(event) => setStaffForm({ ...staffForm, code: event.target.value })}
                              required={!editingStaffId}
                              type="password"
                              value={staffForm.code}
                            />
                          </label>
                          <label className="space-y-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
                            Role
                            <input
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              onChange={(event) => setStaffForm({ ...staffForm, role: event.target.value })}
                              placeholder="e.g. Agent or Manager"
                              required
                              value={staffForm.role}
                            />
                          </label>
                        </div>

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
                            disabled={isSavingStaff}
                            type="submit"
                          >
                            <Plus className="h-4 w-4" />
                            {isSavingStaff ? "Saving..." : editingStaffId ? "Update user" : "Add user"}
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
