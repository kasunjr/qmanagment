"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { DEFAULT_APP_THEME, themeStyle, type AppTheme } from "@/lib/theme-style";
import styles from "./Navbar.module.css";
import logo from "@/app/assets/logo.png";

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLDivElement>(null);

  useEffect(() => setIsMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const desktop = window.matchMedia("(min-width: 640px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setIsMenuOpen(false);
    };
    closeOnDesktop();
    if (!desktop.matches) navigationRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !navigationRef.current?.contains(event.target) && !menuButtonRef.current?.contains(event.target)) setIsMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [isMenuOpen]);

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Pricing", href: "/pricing" },
    { name: "Admin Portal", href: "/admin" },
  ];

  useEffect(() => {
    if (!isStaffRoute || pathname === "/staff") {
      setIsStaffAuthenticated(false);
      setStaffBrand(null);
      return;
    }

    const controller = new AbortController();
    const publicThemeRequest = staffTenantCode
      ? fetch(`/api/public/${staffTenantCode}/theme`, {
          cache: "no-store",
          signal: controller.signal,
        }).catch(() => null)
      : null;
    fetch("/api/staff-auth/me", {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        setIsStaffAuthenticated(response.ok);
        const themeResponse = staffTenantCode
          ? await publicThemeRequest
          : response.ok
            ? await fetch("/api/staff/theme", {
                cache: "no-store",
                signal: controller.signal,
              })
            : null;
        if (!themeResponse) {
          setStaffBrand(staffTenantCode ? DEFAULT_APP_THEME : null);
          return;
        }
        const result = (await themeResponse.json().catch(() => null)) as { theme?: AppTheme } | null;
        setStaffBrand(themeResponse.ok && result?.theme ? result.theme : staffTenantCode ? DEFAULT_APP_THEME : null);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setIsStaffAuthenticated(false);
          if (staffTenantCode) setStaffBrand(DEFAULT_APP_THEME);
        }
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
        if (!controller.signal.aborted) setCustomerBrand(response.ok && result?.theme ? result.theme : DEFAULT_APP_THEME);
      })
      .catch(() => {
        if (!controller.signal.aborted) setCustomerBrand(DEFAULT_APP_THEME);
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
  const isPublicNav = !isStaffRoute && !customerTenantCode;
  const isTenantBrandLoading = Boolean((staffTenantCode && !staffBrand) || (customerTenantCode && !customerBrand));

  if (pathname === "/staff" || customerTenantCode) return null;

  return (
    <nav
      className={`${isTenantBrandLoading ? "invisible" : ""} sticky top-0 z-50 border-b ${
        tenantBrand
          ? "border-theme-text/10 bg-theme-surface text-theme-text"
          : isPublicNav
            ? styles.publicNav
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
            <Link href="/" aria-label="MyTurn home" className={`${styles.brand} ${isPublicNav ? "" : styles.brandOnDark}`}>
              <Image src={logo} alt="MyTurn" className={styles.brandLogo} sizes="(max-width: 639px) 96px, 160px" priority />
            </Link>
          )}
          {isPublicNav && (
            <button
              ref={menuButtonRef}
              type="button"
              className={styles.menuToggle}
              aria-expanded={isMenuOpen}
              aria-controls="public-navigation"
              aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              {isMenuOpen ? <X size={23} /> : <Menu size={23} />}
            </button>
          )}
          <div
            ref={navigationRef}
            id="public-navigation"
            className={`flex items-center space-x-2 sm:space-x-4 ${styles.navLinks} ${isMenuOpen ? styles.menuOpen : ""}`}
            onClick={(event) => {
              if (event.target instanceof Element && event.target.closest("a")) setIsMenuOpen(false);
            }}
          >
            {navLinks
              .filter(() => !isStaffRoute && !customerTenantCode)
              .map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                      isActive
                        ? tenantBrand
                          ? "bg-theme-primary text-theme-on-primary"
                          : styles.activeLink
                        : tenantBrand
                          ? "text-theme-text/70 hover:bg-theme-text/5 hover:text-theme-text"
                          : styles.publicLink
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
                    className={`px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${
                      tenantBrand
                        ? "text-theme-text/70 hover:bg-theme-text/5 hover:text-theme-text"
                        : isPublicNav
                          ? styles.publicLink
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
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
                      tenantBrand
                        ? "text-theme-text/70 hover:bg-theme-text/5 hover:text-theme-text"
                        : isPublicNav
                          ? styles.signIn
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                    aria-current={pathname === "/login" ? "page" : undefined}
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
