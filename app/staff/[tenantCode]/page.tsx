"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, UserRound } from "lucide-react";
import { DEFAULT_APP_THEME, themeStyle, type AppTheme } from "@/lib/theme-style";

export default function StaffLoginPage({
  params,
}: {
  params: { tenantCode: string };
}) {
  const router = useRouter();
  const tenantCode = params.tenantCode.toUpperCase();
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_APP_THEME);
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/public/${tenantCode}/theme`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as { theme?: AppTheme } | null;
        if (response.ok && result?.theme) setTheme(result.theme);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [tenantCode]);

  useEffect(() => {
    document.body.style.backgroundColor = theme.background_color;
    document.body.style.color = theme.text_color;
    return () => {
      document.body.style.backgroundColor = "";
      document.body.style.color = "";
    };
  }, [theme]);

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

  return (
    <div
      className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-md items-center justify-center py-10 text-theme-text"
      style={themeStyle(theme)}
    >
      <section className="w-full overflow-hidden rounded-theme-lg border border-theme-text/10 bg-theme-surface shadow-2xl">
        <div className="border-b border-theme-text/10 px-7 py-6">
          {theme.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="mb-5 h-11 w-11 rounded-theme object-contain" src={theme.logo_url} />
          ) : (
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-theme bg-theme-primary/10 text-theme-primary">
              <UserRound className="h-5 w-5" />
            </div>
          )}
          <p className="text-xs font-semibold uppercase text-theme-secondary">{theme.app_name}</p>
          <h1 className="mt-2 text-2xl font-bold">Sign in to your counter</h1>
        </div>

        <form className="space-y-5 p-7" onSubmit={signIn}>

          <label className="block space-y-2 text-sm font-medium text-theme-text/80">
            Username
            <input
              autoComplete="username"
              className="w-full rounded-theme border border-theme-text/20 bg-theme-surface px-3 py-2.5 text-sm text-theme-text placeholder:text-theme-text/40 focus:border-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary/30"
              name="username"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter your username"
              required
              value={username}
            />
          </label>

          <label className="block space-y-2 text-sm font-medium text-theme-text/80">
            Staff code
            <span className="relative block">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-text/40" />
              <input
                autoComplete="current-password"
                className="w-full rounded-theme border border-theme-text/20 bg-theme-surface py-2.5 pl-10 pr-3 text-sm text-theme-text placeholder:text-theme-text/40 focus:border-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary/30"
                name="code"
                onChange={(event) => setCode(event.target.value)}
                placeholder="Enter your staff code"
                required
                type="password"
                value={code}
              />
            </span>
          </label>

          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

          <button
            className="w-full rounded-theme bg-theme-primary px-4 py-3 text-sm font-semibold text-theme-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </div>
  );
}
