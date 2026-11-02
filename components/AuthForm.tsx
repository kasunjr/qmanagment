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
  const [verificationCode, setVerificationCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [verificationType, setVerificationType] = useState<"login" | "signup" | null>(null);
  const [loginStep, setLoginStep] = useState<"password" | "code">("password");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const isSignup = mode === "signup";

  useEffect(() => {
    if (!isLoading && user) router.replace("/admin");
  }, [isLoading, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const isCodeStep = loginStep === "code";
      const codePurpose = verificationType ?? mode;
      const endpoint = isCodeStep
        ? `/api/auth/${codePurpose}/verify`
        : `/api/auth/${mode}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(isCodeStep ? { challengeId, code: verificationCode } : { email, password }),
      });
      const result = await response.json();
      if (result.requiresVerification && typeof result.challengeId === "string") {
        setChallengeId(result.challengeId);
        setVerificationType(result.verificationType === "signup" ? "signup" : "login");
        setLoginStep("code");
        setVerificationCode("");
        if (!response.ok) {
          setError(result.error ?? "The verification email could not be sent.");
        }
        return;
      }
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

  async function handleResendCode() {
    setError("");
    setIsResending(true);

    try {
      const response = await fetch(`/api/auth/${verificationType ?? mode}/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ challengeId }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (typeof result.challengeId === "string") setChallengeId(result.challengeId);
        setError(result.error ?? "Unable to send another code.");
        return;
      }
      setChallengeId(result.challengeId);
      setVerificationCode("");
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsResending(false);
    }
  }

  if (isLoading || user) {
    return (
      <div className="flex justify-center py-16" role="status" aria-label="Checking your session">
        <span aria-hidden="true" className="relative h-16 w-16">
          <span className="absolute inset-0 animate-spin rounded-full border-4 border-emerald-400/20 border-t-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.18)] motion-reduce:animate-none" />
          <span className="absolute inset-2 animate-[spin_1.5s_linear_infinite_reverse] rounded-full border-2 border-teal-300/20 border-b-teal-300 motion-reduce:animate-none" />
          <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-emerald-300 motion-reduce:animate-none" />
        </span>
        <span className="sr-only">Checking your session...</span>
      </div>
    );
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
        <h2 className="text-2xl font-bold text-slate-900">{isSignup ? "Create account" : "Sign in"}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {isSignup
            ? loginStep === "code"
              ? `Enter the 6-digit code sent to ${email} to verify your email.`
              : "Use your email to create an account."
            : loginStep === "code" && verificationType === "signup"
              ? `Enter the 6-digit code sent to ${email} to verify your email.`
              : loginStep === "code"
              ? `Enter the 6-digit code sent to ${email} to finish signing in.`
              : "Sign in to continue to the admin dashboard."}
        </p>

        <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
          {loginStep === "code" ? (
            <div>
              <label htmlFor="verification-code" className="mb-1.5 block text-sm font-medium text-slate-700">Email verification code</label>
              <input
                autoComplete="one-time-code"
                className="w-full border border-slate-300 px-3 py-2.5 text-sm tracking-[0.3em] outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                id="verification-code"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                pattern="[0-9]{6}"
                required
                type="text"
                value={verificationCode}
              />
            </div>
          ) : (
            <>
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
            </>
          )}

          {error && <p aria-live="polite" className="border-l-2 border-rose-600 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

          <button
            className="flex w-full items-center justify-center gap-2 bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
            disabled={isSubmitting || isResending}
            type="submit"
          >
            {isSubmitting
              ? "Please wait..."
              : loginStep === "code" && verificationType === "signup"
                ? "Verify email"
                : !isSignup && loginStep === "code"
                ? "Verify and sign in"
                : isSignup ? "Create account" : "Continue"}
            {!isSubmitting && <ArrowRight aria-hidden="true" className="h-4 w-4" />}
          </button>
        </form>

        {loginStep === "code" && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <button
              className="font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-60"
              disabled={isResending || isSubmitting}
              onClick={() => void handleResendCode()}
              type="button"
            >
              {isResending ? "Sending..." : "Resend code"}
            </button>
            {!isSignup && verificationType !== "signup" && (
              <button
                className="text-slate-600 hover:text-slate-900"
                onClick={() => {
                  setError("");
                  setLoginStep("password");
                }}
                type="button"
              >
                Back
              </button>
            )}
          </div>
        )}

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