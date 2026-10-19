import { PricingPlans } from "@/components/PricingPlans";
import { listPlans } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const plans = await listPlans();

  return (
    <div className="p-8 bg-white rounded-xl shadow-sm border border-slate-200">
      <h1 className="text-3xl font-bold mb-4 text-slate-900">Pricing Plans</h1>
      <p className="text-slate-600 mb-6">
        Choose a plan that fits your business needs.
      </p>

      <PricingPlans plans={plans} />
    </div>
  );
}
