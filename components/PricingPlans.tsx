"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { PlanRecord } from "@/lib/plans";

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
    limitText(limits.queues, "queue", "queues"),
    limitText(limits.staff_users, "staff member", "staff members"),
    limits.tickets_per_day === null
      ? "Unlimited tickets"
      : `Up to ${limits.tickets_per_day.toLocaleString("en-US")} tickets per day`,
  ];
}

export function PricingPlans({ plans }: { plans: PlanRecord[] }) {
  const { user, accessToken } = useAuth();
  const [currentPlanCode, setCurrentPlanCode] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !accessToken) {
      setCurrentPlanCode(null);
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch("/api/usage", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => null)) as { plan_code?: string } | null;
        if (response.ok && result?.plan_code) setCurrentPlanCode(result.plan_code);
      } catch {
        // Without a current plan the cards are shown as for a guest.
      }
    })();
    return () => controller.abort();
  }, [user, accessToken]);

  const currentPlan = plans.find((plan) => plan.code === currentPlanCode);

  return (
    <>
      {currentPlan && (
        <p className="mb-6 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
          You are on the <span className="font-semibold">{currentPlan.name}</span> plan.
        </p>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrent = plan.code === currentPlanCode;
          const isFeatured = plan.code === FEATURED_PLAN_CODE;
          return (
            <div
              key={plan.code}
              className={
                isCurrent
                  ? "border-2 border-emerald-500 p-6 rounded-lg relative"
                  : isFeatured
                    ? "border-2 border-indigo-600 p-6 rounded-lg relative"
                    : "border border-slate-200 p-6 rounded-lg relative"
              }
            >
              {isCurrent ? (
                <span className="bg-emerald-600 text-white text-xs px-2 py-1 rounded absolute -top-3 right-4">
                  Current plan
                </span>
              ) : (
                isFeatured && (
                  <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded absolute -top-3 right-4">
                    Popular
                  </span>
                )
              )}
              <h3 className="font-bold text-xl mb-2">{plan.name}</h3>
              <p className="text-2xl font-extrabold text-indigo-600 mb-4">{plan.price_label}</p>
              <ul className="space-y-2 text-sm text-slate-600">
                {planFeatures(plan).map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}
