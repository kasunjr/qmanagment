"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, signOut } = useAuth();
  const isStaffRoute = pathname === "/staff" || /^\/[A-F0-9]{7}\/staff(?:\/|$)/i.test(pathname);
  const [isStaffAuthenticated, setIsStaffAuthenticated] = useState(false);
  const [isStaffSigningOut, setIsStaffSigningOut] = useState(false);

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Pricing", href: "/pricing" },
    { name: "Admin Portal", href: "/admin" },
  ];

  useEffect(() => {
    if (!isStaffRoute) {
      setIsStaffAuthenticated(false);
      return;
    }

    const controller = new AbortController();
    fetch("/api/staff-auth/me", {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => setIsStaffAuthenticated(response.ok))
      .catch(() => {
        if (!controller.signal.aborted) setIsStaffAuthenticated(false);
      });

    return () => controller.abort();
  }, [isStaffRoute, pathname]);

  const signOutStaff = async () => {
    setIsStaffSigningOut(true);
    try {
      const response = await fetch("/api/staff-auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      const result = (await response.json().catch(() => null)) as { tenantCode?: string } | null;
      if (!response.ok) throw new Error("Unable to sign out staff user.");

      setIsStaffAuthenticated(false);
      const tenantCode = result?.tenantCode;
      router.replace(tenantCode && /^[A-F0-9]{7}$/i.test(tenantCode) ? `/${tenantCode}/staff` : "/");
    } catch (error) {
      console.error("Staff sign out failed:", error);
    } finally {
      setIsStaffSigningOut(false);
    }
  };

  return (
    <nav className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2 font-bold text-xl tracking-wide">
            <span className="bg-teal-500 text-zinc-950 px-2 py-1 rounded">
              Queue
            </span>
            <span>App</span>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            {navLinks.filter((link) => !isStaffRoute || link.name !== "Admin Portal").map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-teal-500 text-zinc-950"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
            {isStaffRoute ? (
              isStaffAuthenticated && (
                <button
                  className="px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-60 sm:text-sm"
                  disabled={isStaffSigningOut}
                  onClick={() => void signOutStaff()}
                  type="button"
                >
                  {isStaffSigningOut ? "Signing out..." : "Sign out"}
                </button>
              )
            ) : !isLoading && (user ? (
              <button
                className="px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white sm:text-sm"
                onClick={async () => {
                  await signOut();
                  router.push("/login");
                }}
                type="button"
              >
                Sign out
              </button>
            ) : (
              <Link
                className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  pathname === "/login" || pathname === "/signup"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
                href="/login"
              >
                Sign in
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
