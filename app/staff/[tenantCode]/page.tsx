"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, AtSign, KeyRound, UserRound } from "lucide-react";
import { DEFAULT_APP_THEME, themeStyle, type AppTheme } from "@/lib/theme-style";

export default function StaffLoginPage({
  params,
}: {
  params: { tenantCode: string };
}) {
  const router = useRouter();
  const tenantCode = params.tenantCode.toUpperCase();
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_APP_THEME);
  const [isThemeLoading, setIsThemeLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let themeApplied = false;
    fetch(`/api/public/${tenantCode}/theme`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as { theme?: AppTheme } | null;
        if (!controller.signal.aborted && response.ok && result?.theme) {
          themeApplied = true;
          document.body.style.backgroundColor = result.theme.background_color;
          document.body.style.color = result.theme.text_color;
          setTheme(result.theme);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) {
          if (!themeApplied) {
            document.body.style.backgroundColor = DEFAULT_APP_THEME.background_color;
            document.body.style.color = DEFAULT_APP_THEME.text_color;
          }
          setIsThemeLoading(false);
        }
      });
    return () => controller.abort();
  }, [tenantCode]);

  useEffect(() => {
    if (isThemeLoading) return;
    document.body.style.backgroundColor = theme.background_color;
    document.body.style.color = theme.text_color;
    return () => {
      document.body.style.backgroundColor = "";
      document.body.style.color = "";
    };
  }, [isThemeLoading, theme]);

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/staff-auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_code: tenantCode, username, code }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "Unable to sign in.");
      router.replace("/staff");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isThemeLoading) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center"
        style={{ backgroundColor: DEFAULT_APP_THEME.background_color }}
        role="status"
        aria-label="Loading counter sign in"
      >
        <span
          aria-hidden="true"
          className="h-8 w-8 animate-spin rounded-full border-4 motion-reduce:animate-none"
          style={{ borderColor: `${DEFAULT_APP_THEME.primary_color}33`, borderTopColor: DEFAULT_APP_THEME.primary_color }}
        />
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex min-h-0 w-full max-w-5xl items-center justify-center py-4 text-theme-text sm:min-h-[calc(100vh-9rem)] sm:py-12"
      style={themeStyle(theme)}
    >
      <section className="grid w-full overflow-hidden rounded-theme-lg border border-theme-text/10 bg-theme-surface shadow-xl md:grid-cols-[minmax(0,0.9fr)_minmax(360px,1fr)]">
        <aside className="flex min-h-56 flex-col justify-between gap-8 bg-theme-primary p-6 text-theme-on-primary sm:gap-10 sm:p-9 md:min-h-[480px] md:p-11">
          <div>
            <div className="flex items-center gap-3">
              {theme.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-theme object-contain p-1.5"
                  src={theme.logo_url}
                  style={{ backgroundColor: theme.surface_color }}
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-theme bg-theme-on-primary/10">
                  <UserRound aria-hidden="true" className="h-6 w-6" />
                </div>
              )}
              <span className="min-w-0 text-lg font-bold leading-tight">{theme.app_name}</span>
            </div>
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.12em] text-theme-on-primary/70 md:mt-12">Staff portal</p>
            <h1 className="mt-3 max-w-sm text-3xl font-bold leading-tight sm:text-4xl">Sign in to your counter</h1>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-theme-on-primary/20 pt-5 text-sm">
            <span className="text-theme-on-primary/70">Workspace</span>
            <span className="rounded-theme bg-theme-on-primary/10 px-3 py-1.5 font-semibold">{tenantCode}</span>
          </div>
        </aside>

        <div className="flex items-center p-6 sm:p-10 md:p-11">
          <div className="w-full">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-theme-secondary">Staff access</p>
              <h2 className="mt-2 text-2xl font-bold text-theme-text">Sign in to your counter</h2>
              <p className="mt-2 text-sm leading-6 text-theme-text/65">Use your assigned username and staff code.</p>
            </div>

            <form className="space-y-5" onSubmit={signIn}>
              <label className="block space-y-2 text-sm font-semibold text-theme-text">
                Username
                <span className="relative block">
                  <AtSign aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-text/45" />
                  <input
                    autoComplete="username"
                    className="w-full rounded-theme border border-theme-text/20 bg-theme-surface py-3 pl-10 pr-3 text-sm font-normal text-theme-text placeholder:text-theme-text/40 focus:border-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary/25"
                    name="username"
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Enter your username"
                    required
                    value={username}
                  />
                </span>
              </label>

              <label className="block space-y-2 text-sm font-semibold text-theme-text">
                Staff code
                <span className="relative block">
                  <KeyRound aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-text/45" />
                  <input
                    autoComplete="current-password"
                    className="w-full rounded-theme border border-theme-text/20 bg-theme-surface py-3 pl-10 pr-3 text-sm font-normal text-theme-text placeholder:text-theme-text/40 focus:border-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary/25"
                    name="code"
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="Enter your staff code"
                    required
                    type="password"
                    value={code}
                  />
                </span>
              </label>

              {error && (
                <p
                  className="rounded-theme border border-theme-secondary/30 bg-theme-secondary/10 px-3 py-2.5 text-sm text-theme-text"
                  role="alert"
                >
                  {error}
                </p>
              )}

              <button
                className="flex w-full items-center justify-center gap-2 rounded-theme bg-theme-primary px-4 py-3 text-sm font-semibold text-theme-on-primary transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-theme-primary/35 focus:ring-offset-2 focus:ring-offset-theme-surface disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
                {!isSubmitting && <ArrowRight aria-hidden="true" className="h-4 w-4" />}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
