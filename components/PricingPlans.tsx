"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Building2, CheckCircle2, Layers, QrCode, Store, Ticket, UserCheck } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import type { PlanRecord } from "@/lib/plans";
import styles from "./PricingPlans.module.css";

const FEATURED_PLAN_CODE = "pro";

function limitText(limit: number | null, singular: string, plural: string): string {
  if (limit === null) return `Unlimited ${plural}`;
  if (limit === 1) return `1 ${singular}`;
  return `Up to ${limit.toLocaleString("en-US")} ${plural}`;
}

function planFeatures({ limits }: PlanRecord): string[] {
  return [
    limitText(limits.branches, "branch", "branches"),
    limitText(limits.services, "service", "services"),
    limitText(limits.staff_users, "staff member", "staff members"),
    limits.tickets_per_day === null
      ? "Unlimited tickets"
      : `Up to ${limits.tickets_per_day.toLocaleString("en-US")} tickets per day`,
  ];
}

export function PricingPlans({ plans }: { plans: PlanRecord[] }) {
  const { user, accessToken } = useAuth();
  const [currentPlanCode, setCurrentPlanCode] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");

  useEffect(() => {
    if (!user || !accessToken) {
      setCurrentPlanCode(null);
      setPlanStatus("idle");
      return;
    }
    const controller = new AbortController();
    setCurrentPlanCode(null);
    setPlanStatus("loading");
    (async () => {
      try {
        const response = await fetch("/api/usage", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => null)) as { plan_code?: string } | null;
        if (controller.signal.aborted) return;
        if (response.ok && result?.plan_code) {
          setCurrentPlanCode(result.plan_code);
          setPlanStatus("ready");
        } else {
          setPlanStatus("unavailable");
        }
      } catch {
        if (!controller.signal.aborted) setPlanStatus("unavailable");
      }
    })();
    return () => controller.abort();
  }, [user, accessToken]);

  const currentPlan = plans.find((plan) => plan.code === currentPlanCode);

  if (plans.length === 0) {
    return <section className={styles.emptyState} role="status"><Building2 size={30} /><h2>Plans are temporarily unavailable.</h2><p>Please try again shortly to see current prices and limits.</p><a href="/pricing" className={styles.secondaryAction}>Reload plans <ArrowRight size={17} /></a></section>;
  }

  return (
    <>
      <div className={styles.included} aria-label="Queue workflows"><span><QrCode size={18} /> Remote booking</span><span><Ticket size={18} /> Walk-in tickets</span><span><UserCheck size={18} /> Staff counter</span></div>
      {planStatus === "loading" && <p className={styles.planStatus} role="status">Checking your current plan...</p>}
      {planStatus === "unavailable" && <p className={styles.planStatus} role="status">We couldn&apos;t confirm your current plan. <Link href="/admin">Open your workspace <ArrowUpRight size={14} /></Link></p>}
      {currentPlan && (
        <div className={styles.currentNotice} role="status"><span><CheckCircle2 size={20} />You are on the <strong>{currentPlan.name}</strong> plan.</span><Link href="/admin">Open workspace <ArrowUpRight size={16} /></Link></div>
      )}

      <section className={styles.planGrid} aria-label="Available pricing plans">
        {plans.map((plan, index) => {
          const isCurrent = plan.code === currentPlanCode;
          const isFeatured = plan.code === FEATURED_PLAN_CODE;
          const Icon = plan.code === "basic" ? Store : isFeatured ? Layers : Building2;
          const description = plan.code === "basic" ? "A simple start for your first counter." : isFeatured ? "More room for busy teams and branches." : plan.code === "enterprise" ? "Capacity for a wider operation." : "Capacity for your everyday service.";
          return (
            <article
              key={plan.code}
              aria-labelledby={`plan-${plan.code}`}
              className={`${styles.planCard} ${isFeatured ? styles.featuredCard : ""} ${isCurrent ? styles.currentCard : ""}`}
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <div className={styles.cardTop}><span className={styles.planIcon}><Icon size={28} strokeWidth={1.6} /></span>{isCurrent ? <span className={styles.currentBadge}><CheckCircle2 size={13} />Current plan</span> : isFeatured ? <span className={styles.featuredBadge}>Featured plan</span> : null}</div>
              <h2 id={`plan-${plan.code}`}>{plan.name}</h2>
              <p className={styles.planDescription}>{description}</p>
              <p className={styles.price}>{plan.price_label}</p>
              <p className={styles.capacityLabel}>Your account capacity</p>
              <ul className={styles.features}>
                {planFeatures(plan).map((feature) => (
                  <li key={feature}><CheckCircle2 size={17} />{feature}</li>
                ))}
              </ul>
              {isCurrent && <Link href="/admin" className={styles.cardLink}>Manage your workspace <ArrowUpRight size={16} /></Link>}
            </article>
          );
        })}
      </section>
      <div className={styles.capacityNote}>Limits apply to each account. Daily ticket capacity renews each day.</div>
      <section className={styles.startSection} aria-labelledby="pricing-start-title">
        <div><p className={styles.eyebrow}>A SMALL START IS A GOOD START</p><h2 id="pricing-start-title">Try it with your own queue.</h2><p>New accounts start on the free Basic plan. Usage limits apply.</p></div>
        <Link href={user ? "/admin" : "/signup"} className={styles.primaryAction}>{user ? "Go to your workspace" : "Start for free"}<ArrowRight size={19} /></Link>
      </section>
    </>
  );
}
