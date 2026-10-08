"use client";

import { useState } from "react";
import { Ticket, Clock, CheckCircle2 } from "lucide-react";

export default function CustomerPage() {
  const [name, setName] = useState("");
  const [service, setService] = useState("General Support");
  const [ticket, setTicket] = useState<{ number: string; position: number } | null>(null);

  const handleBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const randomNum = "A-" + Math.floor(100 + Math.random() * 900);
    setTicket({ number: randomNum, position: Math.floor(Math.random() * 5) + 1 });
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

      {!ticket ? (
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Service</label>
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="General Support">General Support</option>
              <option value="Account Verification">Account Verification</option>
              <option value="Billing Enquiry">Billing Enquiry</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
          >
            Get Queue Ticket
          </button>
        </form>
      ) : (
        <div className="text-center space-y-6">
          <div className="p-6 bg-indigo-50 border border-indigo-200 rounded-xl">
            <span className="text-xs uppercase tracking-widest text-indigo-600 font-bold">Your Ticket Number</span>
            <div className="text-5xl font-extrabold text-indigo-900 my-2">{ticket.number}</div>
            <p className="text-sm text-indigo-700 font-medium">Service: {service}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border border-slate-200 rounded-lg text-center">
              <Clock className="w-5 h-5 text-slate-400 mx-auto mb-1" />
              <div className="text-xs text-slate-500">People Ahead</div>
              <div className="text-xl font-bold text-slate-800">{ticket.position - 1}</div>
            </div>
            <div className="p-4 border border-slate-200 rounded-lg text-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              <div className="text-xs text-slate-500">Status</div>
              <div className="text-sm font-bold text-emerald-600">Waiting</div>
            </div>
          </div>

          <button
            onClick={() => setTicket(null)}
            className="text-xs text-slate-500 underline hover:text-slate-800"
          >
            Book Another Ticket
          </button>
        </div>
      )}
    </div>
  );
}