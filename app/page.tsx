import Link from "next/link";
import { Users, UserCheck, Settings } from "lucide-react";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div className="p-8 bg-white rounded-xl shadow-sm border border-slate-200">
        <h1 className="text-3xl font-bold mb-2 text-slate-900">Queue Management System</h1>
        <p className="text-slate-600">
          Welcome! Access Customer Queue Booking, Staff Counter Control, or Admin Settings below.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Link href="/customer" className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-indigo-500 transition group">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition">
            <Users className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold mb-2 text-slate-800">Customer Portal</h2>
          <p className="text-sm text-slate-500">Get queue ticket, view position, and estimate wait times.</p>
        </Link>

        <Link href="/staff" className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-indigo-500 transition group">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition">
            <UserCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold mb-2 text-slate-800">Staff Counter</h2>
          <p className="text-sm text-slate-500">Serve tickets, call next customer, and manage active service status.</p>
        </Link>

        <Link href="/admin" className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-indigo-500 transition group">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition">
            <Settings className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold mb-2 text-slate-800">Admin Portal</h2>
          <p className="text-sm text-slate-500">Configure branches, services, staff, and generate QR codes.</p>
        </Link>
      </div>
    </div>
  );
}