import { Outfit } from "next/font/google";
import { UpgradeRequest } from "@/components/UpgradeRequest";
import { listPlans } from "@/lib/plans";
import styles from "@/components/UpgradeRequest.module.css";

const upgradeFont = Outfit({ subsets: ["latin"], display: "swap", variable: "--font-upgrade" });

export const dynamic = "force-dynamic";

export default async function UpgradePage({ searchParams }: { searchParams: { plan?: string | string[] } }) {
  const plans = await listPlans().catch(() => []);
  const planCode = typeof searchParams.plan === "string" ? searchParams.plan : null;

  return (
    <div className={`${styles.page} ${upgradeFont.variable}`}>
      <UpgradeRequest plans={plans} planCode={planCode} />
    </div>
  );
}
