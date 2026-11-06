"use client";

import Link from "next/link";
import Image from "next/image";
import { Outfit } from "next/font/google";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Mail, Ticket, UserCheck } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import logo from "@/app/assets/logo.png";
import styles from "./AuthForm.module.css";

const authFont = Outfit({ subsets: ["latin"], display: "swap", variable: "--font-auth" });

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
  const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false);
  const [isGoogleVerification, setIsGoogleVerification] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const isSignup = mode === "signup";

  useEffect(() => {
    if (!isLoading && user) router.replace("/admin");
  }, [isLoading, router, user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleChallenge = params.get("google_challenge");
    const googleError = params.get("error");

    if (googleChallenge) {
      setChallengeId(googleChallenge);
      setVerificationType("login");
      setLoginStep("code");
      setIsGoogleVerification(true);
    }
    if (googleError === "google_configuration") {
      setError("Google sign-in is not configured. Add the Google OAuth settings and try again.");
    } else if (googleError) {
      setError("Google sign-in could not be completed. Please try again.");
    }

    if (googleChallenge || googleError) {
      params.delete("google_challenge");
      params.delete("error");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
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
    setNotice("");
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
      setNotice("A new verification code has been sent.");
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsResending(false);
    }
  }

  function startGoogleSignIn() {
    setIsGoogleRedirecting(true);
    const requestedPath = new URLSearchParams(window.location.search).get("next");
    const query = requestedPath ? `?next=${encodeURIComponent(requestedPath)}` : "";
    window.location.assign(`/api/auth/google/start${query}`);
  }

  if (isLoading || user) {
    return (
      <section className={`${styles.page} ${styles.loadingState} ${authFont.variable}`} role="status" aria-label="Checking your session">
        <span className={styles.loadingGraphic} aria-hidden="true"><span /><KeyRound size={23} /></span>
        <p>Checking your session...</p>
      </section>
    );
  }

  return (
    <section className={`${styles.page} ${authFont.variable}`} aria-labelledby="auth-title">
      <div className={styles.intro}>
        <Link href="/" aria-label="MyTurn home" className={styles.brand}><Image src={logo} alt="MyTurn" sizes="180px" /></Link>
        <p className={styles.eyebrow}>{isSignup ? "A SMALL START. A BETTER FLOW." : "A LITTLE LESS WAITING."}</p>
        <h2>{isSignup ? <>Your next chapter.<br /><span>Start with one queue.</span></> : <>A clearer queue.<br /><span>A calmer day.</span></>}</h2>
        <p>{isSignup ? "A small shop, a busy institute, or a growing team. Your first queue starts here." : "Your branches, services, and team, all connected. Pick up where you left off."}</p>
        <div className={styles.authGraphic} aria-hidden="true">
          <div className={styles.graphicRoute} />
          <div className={styles.graphicTicket}><Ticket size={25} strokeWidth={1.6} /><span>YOUR NEXT TURN</span><strong>A-024</strong><div /><span>General queue</span></div>
          <div className={styles.graphicKey}><KeyRound size={31} strokeWidth={1.5} /></div>
          <div className={styles.graphicAccount}><UserCheck size={26} /><div><span>YOUR WORKSPACE</span><strong>Ready for your day.</strong></div><CheckCircle2 size={20} /></div>
        </div>
        <p className={styles.introFootnote}>{isSignup ? <>Start with the free Basic plan. <Link href="/pricing">Usage limits apply.</Link></> : <>Small setup. A smoother day.</>}</p>
      </div>

      <div className={styles.formPanel}>
        <div className={styles.formIcon} aria-hidden="true">
          {loginStep === "code" ? <Mail size={25} /> : isSignup ? <UserCheck size={25} /> : <KeyRound size={25} />}
        </div>
        <p className={styles.formEyebrow}>{loginStep === "code" ? "CHECK YOUR INBOX" : isSignup ? "LET'S GET YOU STARTED" : "WELCOME BACK"}</p>
        <h1 id="auth-title">{loginStep === "code" ? "Verify your email" : isSignup ? "Create account" : "Sign in"}</h1>
        <p className={styles.description}>
          {isSignup
            ? loginStep === "code"
              ? `Enter the 6-digit code sent to ${email} to verify your email.`
              : "Start your free Basic workspace."
            : loginStep === "code" && verificationType === "signup"
              ? `Enter the 6-digit code sent to ${email} to verify your email.`
              : loginStep === "code"
              ? isGoogleVerification
                ? "Enter the 6-digit code sent to your email to finish signing in."
                : `Enter the 6-digit code sent to ${email} to finish signing in.`
              : "Your workspace is ready when you are."}
        </p>

        {loginStep === "password" && (
          <>
            <button
              className={styles.googleButton}
              disabled={isGoogleRedirecting || isSubmitting}
              onClick={startGoogleSignIn}
              type="button"
            >
              <span aria-hidden="true" className={styles.googleMark}>G</span>
              {isGoogleRedirecting ? "Redirecting to Google..." : "Continue with Google"}
            </button>
            <div className={styles.divider}>or continue with email</div>
          </>
        )}

        <form className={styles.form} onSubmit={handleSubmit} aria-busy={isSubmitting}>
          {loginStep === "code" ? (
            <div>
              <label htmlFor="verification-code">Email verification code</label>
              <input
                autoFocus
                autoComplete="one-time-code"
                className={styles.codeInput}
                id="verification-code"
                name="verification-code"
                aria-describedby={error ? "auth-error" : undefined}
                disabled={isSubmitting || isResending}
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                pattern="[0-9]{6}"
                placeholder="Enter 6-digit code"
                required
                type="text"
                value={verificationCode}
              />
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="email">Email address</label>
                <div className={styles.inputWrap}>
                <Mail size={18} aria-hidden="true" />
                <input
                  autoComplete="email"
                  id="email"
                  name="email"
                  aria-describedby={error ? "auth-error" : undefined}
                  disabled={isSubmitting || isGoogleRedirecting}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
                </div>
              </div>
              <div>
                <label htmlFor="password">Password</label>
                <div className={styles.inputWrap}>
                <KeyRound size={18} aria-hidden="true" />
                <input
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  className={styles.passwordInput}
                  id="password"
                  name="password"
                  aria-describedby={[isSignup && "password-hint", error && "auth-error"].filter(Boolean).join(" ") || undefined}
                  disabled={isSubmitting || isGoogleRedirecting}
                  minLength={isSignup ? 12 : undefined}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isSignup ? "At least 12 characters" : "Your password"}
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button type="button" className={styles.passwordToggle} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} title={showPassword ? "Hide password" : "Show password"} disabled={isSubmitting || isGoogleRedirecting} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
                </div>
                {isSignup && <p className={styles.fieldHint} id="password-hint">Use at least 12 characters.</p>}
              </div>
            </>
          )}

          {error && <p id="auth-error" role="alert" className={styles.error}>{error}</p>}
          {notice && <p role="status" className={styles.notice}>{notice}</p>}

          <button
            className={styles.submitButton}
            disabled={isSubmitting || isResending || isGoogleRedirecting}
            type="submit"
          >
            {isSubmitting
              ? "Please wait..."
              : loginStep === "code" && verificationType === "signup"
                ? "Verify email"
                : !isSignup && loginStep === "code"
                ? "Verify and sign in"
                : isSignup ? "Create account" : "Continue"}
            {!isSubmitting && <ArrowRight aria-hidden="true" size={18} />}
          </button>
        </form>

        {loginStep === "code" && (
          <div className={styles.codeActions}>
            <button
              className={styles.resendButton}
              disabled={isResending || isSubmitting}
              onClick={() => void handleResendCode()}
              type="button"
            >
              {isResending ? "Sending..." : "Resend code"}
            </button>
            {!isSignup && verificationType !== "signup" && (
              <button
                className={styles.backButton}
                disabled={isSubmitting || isResending}
                onClick={() => {
                  setError("");
                  setNotice("");
                  setShowPassword(false);
                  setLoginStep("password");
                  setIsGoogleVerification(false);
                }}
                type="button"
              >
                Back
              </button>
            )}
          </div>
        )}

        <p className={styles.switchMode}>
          {isSignup ? "Already have an account? " : "New to MyTurn? "}
          <Link href={isSignup ? "/login" : "/signup"}>
            {isSignup ? "Sign in" : "Create an account"}
          </Link>
        </p>
        {isSignup && loginStep === "password" && <p className={styles.planNote}>Free Basic plan. <Link href="/pricing">See plans & usage limits <ArrowRight size={12} /></Link></p>}
      </div>
    </section>
  );
}