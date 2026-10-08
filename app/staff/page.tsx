"use client";

import { useState } from "react";
import { UserCheck, Play, CheckCircle } from "lucide-react";

interface QueueItem { id: string; ticket: string; name: string; service: string; status: "waiting" | "serving" | "completed" }

export default function StaffPage() {
  const [queue, setQueue] = useState<QueueItem[]>([
    { id: "1", ticket: "A-101", name: "Alice Cooper", service: "General Support", status: "waiting" },
    { id: "2", ticket: "A-102", name: "Bob Martin", service: "Account Verification", status: "waiting" },
    { id: "3", ticket: "A-103", name: "Charlie Davis", service: "Billing Enquiry", status: "waiting" },
  ]);

  const [currentTicket, setCurrentTicket] = useState<QueueItem | null>(null);

  const callNext = () => {
    const nextItem = queue.find((item) => item.status === "waiting");
    if (!nextItem) return;

    setQueue((prev) =>
      prev.map((item) => (item.id === nextItem.id ? { ...item, status: "serving" } : item))
    );
    setCurrentTicket({ ...nextItem, status: "serving" });
  };

  const completeCurrent = () => {
    if (!currentTicket) return;
    setQueue((prev) =>
      prev.map((item) => (item.id === currentTicket.id ? { ...item, status: "completed" } : item))
    );
    setCurrentTicket(null);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <UserCheck className="w-8 h-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Staff Counter Terminal</h1>
            <p className="text-sm text-slate-500">Counter #01 - Active Queue Operations</p>
          </div>
        </div>
        <button
          onClick={callNext}
          disabled={!queue.some((i) => i.status === "waiting")}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
        >
          <Play className="w-4 h-4 fill-white" /> Call Next Customer
        </button>
      </div>

      {currentTicket && (
        <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs uppercase font-bold text-emerald-700">Currently Serving</span>
            <div className="text-3xl font-extrabold text-emerald-900">{currentTicket.ticket}</div>
            <p className="text-sm text-emerald-800 font-medium">{currentTicket.name} — {currentTicket.service}</p>
          </div>
          <button
            onClick={completeCurrent}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-emerald-700 transition"
          >
            <CheckCircle className="w-4 h-4" /> Mark Completed
          </button>
        </div>
      )}

      <div>
        <h3 className="font-bold text-slate-800 mb-3">Live Waiting Queue</h3>
        <div className="divide-y border border-slate-200 rounded-lg overflow-hidden">
          {queue.map((item) => (
            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
              <div className="flex items-center gap-4">
                <span className="font-bold text-lg text-indigo-600 bg-indigo-50 px-3 py-1 rounded">
                  {item.ticket}
                </span>
                <div>
                  <p className="font-semibold text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.service}</p>
                </div>
              </div>
              <span
                className={`text-xs px-3 py-1 rounded-full font-bold capitalize ${
                  item.status === "serving"
                    ? "bg-emerald-100 text-emerald-700"
                    : item.status === "completed"
                    ? "bg-slate-100 text-slate-500"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}