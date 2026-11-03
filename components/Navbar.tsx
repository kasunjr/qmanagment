"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { themeStyle, type AppTheme } from "@/lib/theme-style";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, signOut } = useAuth();
  const isStaffRoute =
    pathname === "/staff" || /^\/staff\/[A-F0-9]{7}(?:\/|$)/i.test(pathname);
  const staffTenantCode = pathname.match(/^\/staff\/([A-F0-9]{7})(?:\/|$)/i)?.[1];
  const customerTenantCode = pathname.match(/^\/customer\/([A-F0-9]{7})(?:\/|$)/i)?.[1];
  const [isStaffAuthenticated, setIsStaffAuthenticated] = useState(false);
  const [isStaffSigningOut, setIsStaffSigningOut] = useState(false);
  const [staffBrand, setStaffBrand] = useState<AppTheme | null>(null);
  const [customerBrand, setCustomerBrand] = useState<AppTheme | null>(null);

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Pricing", href: "/pricing" },
    { name: "Admin Portal", href: "/admin" },
  ];

  useEffect(() => {
    if (!isStaffRoute) {
      setIsStaffAuthenticated(false);
      setStaffBrand(null);
      return;
    }

    const controller = new AbortController();
    fetch("/api/staff-auth/me", {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        setIsStaffAuthenticated(response.ok);
        const themeUrl = response.ok
          ? "/api/staff/theme"
          : staffTenantCode
            ? `/api/public/${staffTenantCode}/theme`
            : null;
        if (!themeUrl) {
          setStaffBrand(null);
          return;
        }
        const themeResponse = await fetch(themeUrl, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await themeResponse.json().catch(() => null)) as { theme?: AppTheme } | null;
        setStaffBrand(themeResponse.ok && result?.theme ? result.theme : null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setIsStaffAuthenticated(false);
      });

    return () => controller.abort();
  }, [isStaffRoute, pathname, staffTenantCode]);

  useEffect(() => {
    if (!customerTenantCode) {
      setCustomerBrand(null);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/public/${customerTenantCode}/theme`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as { theme?: AppTheme } | null;
        setCustomerBrand(response.ok && result?.theme ? result.theme : null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setCustomerBrand(null);
      });
    return () => controller.abort();
  }, [customerTenantCode]);

  const signOutStaff = async () => {
    setIsStaffSigningOut(true);
    try {
      const response = await fetch("/api/staff-auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      const result = (await response.json().catch(() => null)) as {
        tenantCode?: string;
      } | null;
      if (!response.ok) throw new Error("Unable to sign out staff user.");

      setIsStaffAuthenticated(false);
      setStaffBrand(null);
      const tenantCode = result?.tenantCode;
      router.replace(
        tenantCode && /^[A-F0-9]{7}$/i.test(tenantCode)
          ? `/staff/${tenantCode}`
          : "/",
      );
    } catch (error) {
      console.error("Staff sign out failed:", error);
    } finally {
      setIsStaffSigningOut(false);
    }
  };

  const tenantBrand = isStaffRoute ? staffBrand : customerBrand;

  return (
    <nav
      className={`sticky top-0 z-50 border-b ${
        tenantBrand
          ? "border-theme-text/10 bg-theme-surface text-theme-text"
          : "border-slate-800 bg-slate-900 text-white"
      }`}
      style={tenantBrand ? { ...themeStyle(tenantBrand), backgroundColor: tenantBrand.surface_color } : undefined}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {tenantBrand ? (
            <div className="flex min-w-0 items-center gap-3">
              {tenantBrand.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className="h-9 w-9 shrink-0 rounded object-contain" src={tenantBrand.logo_url} />
              )}
              <span className="truncate text-lg font-bold">{tenantBrand.app_name}</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 font-bold text-xl tracking-wide">
              <span className="bg-teal-500 text-zinc-950 px-2 py-1 rounded">
                My
              </span>
              <span>Turn</span>
            </div>
          )}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {navLinks
              .filter(() => !isStaffRoute && !customerTenantCode)
              .map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                      isActive
                        ? tenantBrand
                          ? "bg-theme-primary text-theme-on-primary"
                          : "bg-teal-500 text-zinc-950"
                        : tenantBrand
                          ? "text-theme-text/70 hover:bg-theme-text/5 hover:text-theme-text"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            {isStaffRoute
              ? isStaffAuthenticated && (
                  <button
                    className={`px-3 py-2 text-xs font-medium transition-colors disabled:opacity-60 sm:text-sm ${
                      tenantBrand
                        ? "text-theme-text/70 hover:bg-theme-text/5 hover:text-theme-text"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                    disabled={isStaffSigningOut}
                    onClick={() => void signOutStaff()}
                    type="button"
                  >
                    {isStaffSigningOut ? "Signing out..." : "Sign out"}
                  </button>
                )
              : !isLoading &&
                (user ? (
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
