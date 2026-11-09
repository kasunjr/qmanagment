"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Clock3, KeyRound, Layers, Mail, Send, Wallet } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import type { PlanLimits, PlanRecord, TenantUsage } from "@/lib/plans";
import type { UpgradeRequestRecord } from "@/lib/upgrade-requests";
import styles from "./UpgradeRequest.module.css";

// Mirrors DEFAULT_PLAN_CODE in lib/plans.ts, which can't be imported here as it pulls in the DB client.
const DEFAULT_PLAN_CODE = "basic";
const CUSTOM_PLAN_CODE = "enterprise";
const NOTE_MAX_LENGTH = 500;

const limitRows: { key: keyof PlanLimits; label: string }[] = [
  { key: "branches", label: "Branches" },
  { key: "services", label: "Services" },
  { key: "staff_users", label: "Staff members" },
  { key: "tickets_per_day", label: "Tickets per day" },
];

function limitText(limit: number | null): string {
  return limit === null ? "Unlimited" : limit.toLocaleString("en-US");
}

function formatRequestDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

type ResponseBody = { request?: UpgradeRequestRecord | null; error?: string } | null;

function StatusPanel({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <section className={styles.statusPanel} role="status">
      <span className={styles.statusIcon} aria-hidden="true">{icon}</span>
      <h1>{title}</h1>
      {children}
    </section>
  );
}

export function UpgradeRequest({ plans, planCode }: { plans: PlanRecord[]; planCode: string | null }) {
  const router = useRouter();
  const { user, accessToken, isLoading } = useAuth();
  const [usage, setUsage] = useState<TenantUsage | null>(null);
  const [usageStatus, setUsageStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [latestRequest, setLatestRequest] = useState<UpgradeRequestRecord | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [justSent, setJustSent] = useState(false);

  const planIndex = plans.findIndex((plan) => plan.code === planCode);
  const plan = planIndex === -1 ? null : plans[planIndex];

  // The page can be opened directly, so it checks the session itself rather than relying on the pricing cards.
  useEffect(() => {
    if (isLoading || user) return;
    const upgradePath = `/upgrade${planCode ? `?plan=${encodeURIComponent(planCode)}` : ""}`;
    router.replace(`/login?next=${encodeURIComponent(upgradePath)}`);
  }, [isLoading, planCode, router, user]);

  useEffect(() => {
    if (!user || !accessToken) return;
    const controller = new AbortController();
    setUsageStatus("loading");
    (async () => {
      try {
        const options = { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" as const, signal: controller.signal };
        const [usageResponse, requestResponse] = await Promise.all([
          fetch("/api/usage", options),
          fetch("/api/subscription/requests", options),
        ]);
        const result = (await usageResponse.json().catch(() => null)) as TenantUsage | null;
        const requestResult = (await requestResponse.json().catch(() => null)) as ResponseBody;
        if (controller.signal.aborted) return;
        if (usageResponse.ok && result?.plan_code && requestResponse.ok) {
          setUsage(result);
          setLatestRequest(requestResult?.request ?? null);
          setUsageStatus("ready");
        } else {
          setUsageStatus("unavailable");
        }
      } catch {
        if (!controller.signal.aborted) setUsageStatus("unavailable");
      }
    })();
    return () => controller.abort();
  }, [user, accessToken]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!plan || !accessToken || isSubmitting) return;
    setSubmitError("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/subscription/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ plan_code: plan.code, note }),
      });
      const result = (await response.json().catch(() => null)) as ResponseBody;
      if (response.ok && result?.request) {
        setLatestRequest(result.request);
        setJustSent(true);
        return;
      }
      // Another tab or an earlier click already sent one: show that request instead of an error.
      if (response.status === 409) {
        const latest = await fetch("/api/subscription/requests", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        const latestResult = (await latest.json().catch(() => null)) as ResponseBody;
        if (latest.ok && latestResult?.request) {
          setLatestRequest(latestResult.request);
          return;
        }
      }
      setSubmitError(result?.error ?? "Unable to send your request. Please try again.");
    } catch {
      setSubmitError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || !user) {
    return <StatusPanel icon={<KeyRound size={24} />} title={isLoading ? "Checking your session..." : "Redirecting you to sign in..."} />;
  }

  const backToPlans = <Link href="/pricing" className={styles.secondaryAction}><ArrowLeft size={17} /> Back to plans</Link>;

  if (plans.length === 0) {
    return (
      <StatusPanel icon={<Building2 size={24} />} title="Plans are temporarily unavailable.">
        <p>Please try again shortly.</p>
        {backToPlans}
      </StatusPanel>
    );
  }

  if (!plan || plan.code === DEFAULT_PLAN_CODE) {
    return (
      <StatusPanel icon={<Layers size={24} />} title="Choose a plan to upgrade to.">
        <p>{plan ? "Basic is the free plan every account starts on, so there is nothing to request." : "We couldn't find that plan."}</p>
        {backToPlans}
      </StatusPanel>
    );
  }

  if (usageStatus === "loading") {
    return <StatusPanel icon={<Clock3 size={24} />} title="Loading your current plan..." />;
  }

  if (usageStatus === "unavailable" || !usage) {
    return (
      <StatusPanel icon={<Building2 size={24} />} title="We couldn't load your current plan.">
        <p>Refresh the page to try again.</p>
        {backToPlans}
      </StatusPanel>
    );
  }

  // One pending request per tenant, whichever plan it is for, so it is shown instead of the form.
  if (latestRequest?.status === "pending") {
    return (
      <StatusPanel
        icon={justSent ? <CheckCircle2 size={24} /> : <Clock3 size={24} />}
        title={justSent ? `Your ${latestRequest.plan_name} request has been sent.` : `Your ${latestRequest.plan_name} request is pending.`}
      >
        <p>
          Sent on {formatRequestDate(latestRequest.created_at)}. We will contact you at <strong>{user.email}</strong> with
          payment details. Your plan is activated once payment is confirmed.
        </p>
        {latestRequest.note && <p className={styles.requestNote}>&ldquo;{latestRequest.note}&rdquo;</p>}
        {latestRequest.plan_code !== plan.code && (
          <p>You can request {plan.name} after this request is closed.</p>
        )}
        <Link href="/admin" className={styles.secondaryAction}>Open your workspace <ArrowRight size={17} /></Link>
      </StatusPanel>
    );
  }

  // The plan in effect: an expired paid plan has already fallen back to Basic.
  const currentIndex = plans.findIndex((entry) => entry.code === usage.plan_code);
  if (currentIndex > planIndex) {
    return (
      <StatusPanel icon={<CheckCircle2 size={24} />} title={`Your ${usage.plan_name} plan already covers ${plan.name}.`}>
        <p>Your current plan has more capacity than {plan.name}, so there is no need to upgrade.</p>
        <Link href="/admin" className={styles.secondaryAction}>Open your workspace <ArrowRight size={17} /></Link>
      </StatusPanel>
    );
  }

  const isRenewal = usage.plan_code === plan.code;
  const isCustom = plan.code === CUSTOM_PLAN_CODE;
  const title = isRenewal ? `Renew your ${plan.name} plan` : `Upgrade to ${plan.name}`;

  return (
    <>
      <Link href="/pricing" className={styles.backLink}><ArrowLeft size={16} /> All plans</Link>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{isRenewal ? "KEEP YOUR CAPACITY" : "MORE ROOM TO GROW"}</p>
        <h1>{title}<span>.</span></h1>
        <p>
          {isCustom
            ? "Tell us about your operation and we will get back to you with a plan that fits."
            : "Send a request and we will email you payment details. Your plan is activated once payment is confirmed."}
        </p>
      </header>

      <div className={styles.layout}>
        <section className={styles.summary} aria-labelledby="upgrade-summary-title">
          <div className={styles.summaryTop}>
            <div>
              <p className={styles.summaryLabel}>Requested plan</p>
              <h2 id="upgrade-summary-title">{plan.name}</h2>
            </div>
            <p className={styles.price}>{plan.price_label}</p>
          </div>

          <table className={styles.compare}>
            <caption className={styles.srOnly}>Your current limits compared with the {plan.name} plan</caption>
            <thead>
              <tr>
                <th scope="col">Limit</th>
                <th scope="col">Now ({usage.plan_name})</th>
                <th scope="col">{plan.name}</th>
              </tr>
            </thead>
            <tbody>
              {limitRows.map(({ key, label }) => {
                const current = usage.limits[key];
                const next = plan.limits[key];
                const increases = current !== null && (next === null || next > current);
                return (
                  <tr key={key}>
                    <th scope="row">{label}</th>
                    <td>{limitText(current)}</td>
                    <td className={increases ? styles.increase : undefined}>{limitText(next)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <ol className={styles.steps} aria-label="How upgrading works">
            <li><span aria-hidden="true"><Send size={16} /></span><div><strong>Send your request</strong><p>{isCustom ? "Share what you need." : "We confirm the plan you chose."}</p></div></li>
            <li><span aria-hidden="true"><Wallet size={16} /></span><div><strong>{isCustom ? "Agree on a price" : "Make the payment"}</strong><p>{isCustom ? "We reply by email with a custom offer." : "Payment details arrive in your inbox."}</p></div></li>
            <li><span aria-hidden="true"><CheckCircle2 size={16} /></span><div><strong>Plan activated</strong><p>New limits apply as soon as we confirm.</p></div></li>
          </ol>
        </section>

        <form className={styles.form} onSubmit={handleSubmit} aria-busy={isSubmitting} aria-labelledby="upgrade-form-title">
          <h2 id="upgrade-form-title">{isCustom ? "Tell us about your needs" : "Your request"}</h2>
          <p className={styles.account}><Mail size={16} /> Sent from <strong>{user.email}</strong></p>

          <label htmlFor="upgrade-note">{isCustom ? "Branches, staff and daily volume you expect" : "Note (optional)"}</label>
          <textarea
            id="upgrade-note"
            rows={5}
            maxLength={NOTE_MAX_LENGTH}
            value={note}
            disabled={isSubmitting}
            onChange={(event) => setNote(event.target.value)}
            placeholder={isCustom ? "For example: 12 branches, 40 staff, about 3,000 tickets a day." : "Anything we should know about your upgrade."}
          />
          <p className={styles.counter}>{note.length}/{NOTE_MAX_LENGTH}</p>

          {submitError && <p className={styles.error} role="alert">{submitError}</p>}
          <button type="submit" className={styles.primaryAction} disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : isCustom ? "Send request" : isRenewal ? "Request renewal" : `Request ${plan.name}`}
            {!isSubmitting && <ArrowRight size={18} />}
          </button>
          <p className={styles.notice} role="note">Nothing is charged from this page. You pay only after we confirm your request.</p>
        </form>
      </div>
    </>
  );
}
