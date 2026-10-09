"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

type AuthMode = "login" | "signup";

interface AuthFormProps {
  mode: AuthMode;
}

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { user, acceptSession, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSignup = mode === "signup";

  useEffect(() => {
    if (!isLoading && user) router.replace("/admin");
  }, [isLoading, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Authentication failed. Please try again.");
        return;
      }

      acceptSession(result.user, result.accessToken);
      const requestedPath = new URLSearchParams(window.location.search).get("next");
      const destination = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
        ? requestedPath
        : "/admin";
      router.replace(destination);
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || user) {
    return <p className="py-16 text-center text-sm text-slate-500">Checking your session...</p>;
  }

  return (
    <section className="mx-auto grid min-h-[calc(100vh-10rem)] max-w-5xl items-center gap-10 py-10 md:grid-cols-[1fr_400px]">
      <div className="hidden border-l-4 border-emerald-500 pl-7 md:block">
        <p className="mb-3 text-sm font-semibold uppercase text-emerald-700">Queue Management System</p>
        <h1 className="max-w-lg text-4xl font-bold leading-tight text-slate-900">
          {isSignup ? "Create your workspace account." : "Your operations, in sequence."}
        </h1>
        <p className="mt-4 max-w-md text-base leading-7 text-slate-600">
          Sign in to manage branches, services, counters, and queue operations.
        </p>
      </div>

      <div className="w-full border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <div className="mb-7 flex h-11 w-11 items-center justify-center bg-emerald-50 text-emerald-700">
          <KeyRound aria-hidden="true" className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">{isSignup ? "Create account" : "Welcome back"}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {isSignup ? "Use your email to create an account." : "Sign in to continue to the admin dashboard."}
        </p>

        <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">Email address</label>
            <input
              autoComplete="email"
              className="w-full border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              id="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
            <input
              autoComplete={isSignup ? "new-password" : "current-password"}
              className="w-full border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              id="password"
              minLength={isSignup ? 12 : undefined}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            {isSignup && <p className="mt-1.5 text-xs text-slate-500">Use at least 12 characters.</p>}
          </div>

          {error && <p aria-live="polite" className="border-l-2 border-rose-600 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

          <button
            className="flex w-full items-center justify-center gap-2 bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Please wait..." : isSignup ? "Create account" : "Sign in"}
            {!isSubmitting && <ArrowRight aria-hidden="true" className="h-4 w-4" />}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          {isSignup ? "Already have an account? " : "New to Queue? "}
          <Link className="font-semibold text-emerald-700 hover:text-emerald-800" href={isSignup ? "/login" : "/signup"}>
            {isSignup ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </div>
    </section>
  );
}