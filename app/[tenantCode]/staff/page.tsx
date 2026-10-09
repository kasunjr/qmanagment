"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, UserRound } from "lucide-react";

export default function StaffLoginPage({
  params,
}: {
  params: { tenantCode: string };
}) {
  const router = useRouter();
  const tenantCode = params.tenantCode.toUpperCase();
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <div className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-md items-center justify-center py-10">
      <section className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-7 py-6">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
            <UserRound className="h-5 w-5" />
          </div>
          <p className="text-xs font-semibold uppercase text-emerald-400">Staff access</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-100">Sign in to your counter</h1>
        </div>

        <form className="space-y-5 p-7" onSubmit={signIn}>

          <label className="block space-y-2 text-sm font-medium text-slate-300">
            Username
            <input
              autoComplete="username"
              className="w-full rounded-lg border border-slate-700 px-3 py-2.5 text-sm"
              name="username"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter your username"
              required
              value={username}
            />
          </label>

          <label className="block space-y-2 text-sm font-medium text-slate-300">
            Staff code
            <span className="relative block">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-700 py-2.5 pl-10 pr-3 text-sm"
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
            className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
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
