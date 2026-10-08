"use client";

import { useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, Plus, Trash2, Edit2, Check, X, QrCode, Settings, BarChart3 } from "lucide-react";

interface Branch { id: string; name: string; code: string }
interface Service { id: string; name: string; duration: string }
interface Queue { id: string; name: string; branchId: string }
interface Staff { id: string; name: string; role: string; branchId: string }

export default function AdminPortal() {
  const [activeTab, setActiveTab] = useState<"qr" | "config" | "analytics">("qr");

  const [staffUrl, setStaffUrl] = useState("http://localhost:3000/staff");
  const [customerUrl, setCustomerUrl] = useState("http://localhost:3000/customer");
  const staffQrRef = useRef<SVGSVGElement>(null);
  const customerQrRef = useRef<SVGSVGElement>(null);

  const downloadQR = (ref: React.RefObject<SVGSVGElement | null>, filename: string) => {
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

  const [configSubTab, setConfigSubTab] = useState<"branches" | "services" | "queues" | "staff">("branches");

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

  const [staff, setStaff] = useState<Staff[]>([
    { id: "u1", name: "Alice Johnson", role: "Manager", branchId: "b1" },
    { id: "u2", name: "Bob Smith", role: "Agent", branchId: "b2" },
  ]);

  const [newItem, setNewItem] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<Record<string, string>>({});

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
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Staff Counter QR Code</h3>
              <p className="text-sm text-slate-500 mb-4 text-center">Scan or download the QR code for staff counter portal.</p>
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
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Customer App QR Code</h3>
              <p className="text-sm text-slate-500 mb-4 text-center">Scan or download the QR code for customer queue booking.</p>
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
              {(["branches", "services", "queues", "staff"] as const).map((cat) => (
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
              ))}
            </div>

            {configSubTab === "branches" && (
              <div>
                <div className="flex gap-2 mb-6 max-w-xl">
                  <input
                    type="text"
                    placeholder="Branch Name"
                    value={newItem.name || ""}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    className="p-2 text-sm border rounded w-1/2"
                  />
                  <input
                    type="text"
                    placeholder="Branch Code"
                    value={newItem.code || ""}
                    onChange={(e) => setNewItem({ ...newItem, code: e.target.value })}
                    className="p-2 text-sm border rounded w-1/2"
                  />
                  <button
                    onClick={() => {
                      if (newItem.name && newItem.code) {
                        setBranches([...branches, { id: Date.now().toString(), name: newItem.name, code: newItem.code }]);
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
                    <li key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                      {editingId === item.id ? (
                        <div className="flex gap-2 w-full mr-4">
                          <input
                            type="text"
                            value={editItem.name || item.name}
                            onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                            className="p-1 border rounded text-sm w-1/2"
                          />
                          <input
                            type="text"
                            value={editItem.code || item.code}
                            onChange={(e) => setEditItem({ ...editItem, code: e.target.value })}
                            className="p-1 border rounded text-sm w-1/2"
                          />
                        </div>
                      ) : (
                        <div>
                          <p className="font-semibold text-slate-800">{item.name}</p>
                          <p className="text-xs text-slate-500">Code: {item.code}</p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        {editingId === item.id ? (
                          <>
                            <button
                              onClick={() => {
                                setBranches(branches.map(b => b.id === item.id ? { ...b, name: editItem.name ?? b.name, code: editItem.code ?? b.code } : b));
                                setEditingId(null);
                              }}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditingId(item.id); setEditItem(item); }} className="p-1 text-slate-600 hover:bg-slate-100 rounded">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setBranches(branches.filter(b => b.id !== item.id))} className="p-1 text-red-600 hover:bg-red-50 rounded">
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
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    className="p-2 text-sm border rounded w-1/2"
                  />
                  <input
                    type="text"
                    placeholder="Duration (e.g. 15 mins)"
                    value={newItem.duration || ""}
                    onChange={(e) => setNewItem({ ...newItem, duration: e.target.value })}
                    className="p-2 text-sm border rounded w-1/2"
                  />
                  <button
                    onClick={() => {
                      if (newItem.name) {
                        setServices([...services, { id: Date.now().toString(), name: newItem.name, duration: newItem.duration || "15 mins" }]);
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
                    <li key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <p className="font-semibold text-slate-800">{item.name}</p>
                        <p className="text-xs text-slate-500">Duration: {item.duration}</p>
                      </div>
                      <button onClick={() => setServices(services.filter(s => s.id !== item.id))} className="p-1 text-red-600 hover:bg-red-50 rounded">
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
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    className="p-2 text-sm border rounded w-1/2"
                  />
                  <select
                    value={newItem.branchId || ""}
                    onChange={(e) => setNewItem({ ...newItem, branchId: e.target.value })}
                    className="p-2 text-sm border rounded w-1/2"
                  >
                    <option value="">Select Branch</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <button
                    onClick={() => {
                      if (newItem.name && newItem.branchId) {
                        setQueues([...queues, { id: Date.now().toString(), name: newItem.name, branchId: newItem.branchId }]);
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
                    <li key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <p className="font-semibold text-slate-800">{item.name}</p>
                        <p className="text-xs text-slate-500">Branch: {branches.find(b => b.id === item.branchId)?.name || "N/A"}</p>
                      </div>
                      <button onClick={() => setQueues(queues.filter(q => q.id !== item.id))} className="p-1 text-red-600 hover:bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {configSubTab === "staff" && (
              <div>
                <div className="flex gap-2 mb-6 max-w-2xl">
                  <input
                    type="text"
                    placeholder="Staff Full Name"
                    value={newItem.name || ""}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    className="p-2 text-sm border rounded w-1/3"
                  />
                  <input
                    type="text"
                    placeholder="Role (e.g. Agent)"
                    value={newItem.role || ""}
                    onChange={(e) => setNewItem({ ...newItem, role: e.target.value })}
                    className="p-2 text-sm border rounded w-1/3"
                  />
                  <select
                    value={newItem.branchId || ""}
                    onChange={(e) => setNewItem({ ...newItem, branchId: e.target.value })}
                    className="p-2 text-sm border rounded w-1/3"
                  >
                    <option value="">Select Branch</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <button
                    onClick={() => {
                      if (newItem.name && newItem.branchId) {
                        setStaff([...staff, { id: Date.now().toString(), name: newItem.name, role: newItem.role || "Agent", branchId: newItem.branchId }]);
                        setNewItem({});
                      }
                    }}
                    className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>

                <ul className="divide-y border rounded-lg">
                  {staff.map((item) => (
                    <li key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <p className="font-semibold text-slate-800">{item.name}</p>
                        <p className="text-xs text-slate-500">Role: {item.role} | Branch: {branches.find(b => b.id === item.branchId)?.name || "N/A"}</p>
                      </div>
                      <button onClick={() => setStaff(staff.filter(u => u.id !== item.id))} className="p-1 text-red-600 hover:bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-800">Operational Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase">Branches</p>
                <p className="text-3xl font-bold text-slate-800">{branches.length}</p>
              </div>
              <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase">Services</p>
                <p className="text-3xl font-bold text-slate-800">{services.length}</p>
              </div>
              <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase">Queues</p>
                <p className="text-3xl font-bold text-slate-800">{queues.length}</p>
              </div>
              <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase">Staff Users</p>
                <p className="text-3xl font-bold text-slate-800">{staff.length}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}