import { PricingPlans } from "@/components/PricingPlans";
import { Outfit } from "next/font/google";
import { listPlans } from "@/lib/plans";
import styles from "@/components/PricingPlans.module.css";

const pricingFont = Outfit({ subsets: ["latin"], display: "swap", variable: "--font-pricing" });

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const plans = await listPlans().catch(() => []);

  return (
    <div className={`${styles.page} ${pricingFont.variable}`}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>A LITTLE ROOM TO GROW</p>
        <h1>Pricing plans<span>.</span></h1>
        <p>One counter or many branches. Start small, compare your capacity, and find the right fit for your day.</p>
      </header>
      <PricingPlans plans={plans} />
      <section className={styles.questions} aria-labelledby="pricing-questions-title">
        <div><p className={styles.eyebrow}>GOOD TO KNOW</p><h2 id="pricing-questions-title">A few clear answers.</h2><p>No guesswork about the capacity your team can use.</p></div>
        <div className={styles.questionList}>
          <details><summary>Can I start for free?<span aria-hidden="true">+</span></summary><p>Yes. New accounts start on the free Basic plan, within its limits. Set up your queue and try the workflow with your own team.</p></details>
          <details><summary>What happens when I reach a limit?<span aria-hidden="true">+</span></summary><p>You cannot add more branches, services, queues, or staff than your plan allows. If you reach the daily ticket limit, new tickets are paused until the next day; your team can still serve existing tickets.</p></details>
          <details><summary>Does signing up activate a paid plan?<span aria-hidden="true">+</span></summary><p>No. Creating an account starts you on Basic. To move to a paid or custom plan, choose it here and send an upgrade request; signing up alone does not purchase or activate one.</p></details>
        </div>
      </section>
    </div>
  );
}
