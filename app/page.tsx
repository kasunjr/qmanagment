"use client";

import Link from "next/link";
import Image from "next/image";
import { Outfit } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowRight, ArrowUpRight, Building2, CheckCircle2, ChevronDown,
  GraduationCap, Lock, Mail, QrCode, RotateCcw, Settings2, Store, Ticket, UserCheck, Users,
} from "lucide-react";
import type { PlanRecord } from "@/lib/plans";
import styles from "./home.module.css";
import logo from "./assets/logo.png";

const homeFont = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-home-sans",
});

const workflow = [
  { icon: UserCheck, title: "Sign up", text: "Create your account and verify your email. Start with the free Basic plan." },
  { icon: Settings2, title: "Set up", text: "Add your branch, service, and queue. Assign the person at your counter." },
  { icon: QrCode, title: "Start serving", text: "Share your link or QR code. Customers join, and your team calls the next ticket." },
];

const sampleTickets = ["A-024", "A-025", "A-026", "A-027"];

const previewCustomers = [
  { number: "024", name: "Sample customer 1", service: "General enquiries" },
  { number: "025", name: "Sample customer 2", service: "Account services" },
  { number: "026", name: "Sample customer 3", service: "General enquiries" },
];

function capacityText(limit: number | null, singular: string, plural: string): string {
  return limit === null ? `Unlimited ${plural}` : `${limit.toLocaleString("en-US")} ${limit === 1 ? singular : plural}`;
}

const benefits = [
  { icon: QrCode, title: "Join before arriving", text: "Customers open your portal or scan your QR code, choose a service, and receive a ticket." },
  { icon: Ticket, title: "Walk-ins welcome", text: "Your team can issue tickets at the counter, keeping walk-ins and remote bookings in one queue." },
  { icon: UserCheck, title: "Know who is next", text: "Staff see the waiting list, call the next customer, and mark each service complete." },
  { icon: Building2, title: "Keep it all together", text: "Manage branches, services, queues, and staff from your admin workspace, within your plan limits." },
];

const questions = [
  { question: "Can I start for free?", answer: "Yes. New accounts start on the free Basic plan, with limits on branches, services, queues, staff, and daily tickets. Check the plans page for the available capacity." },
  { question: "Is MyTurn suitable for a small shop or institute?", answer: "Yes. Start with one branch, one service, and the person at your counter. You don't need a large team to keep your queue organized." },
  { question: "How do customers join my queue?", answer: "Share your branch's customer portal link or QR code. Customers enter their details, choose a branch and service, and receive a ticket. Your staff can also issue walk-in tickets." },
  { question: "What if I need more capacity?", answer: "Compare the available plans and usage limits to find an option that fits your branches, team, and daily ticket volume." },
];

export default function HomePage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentTicket = sampleTickets[currentIndex];
  const [previewIndex, setPreviewIndex] = useState(0);
  const servingCustomer = previewCustomers[previewIndex];
  const waitingCustomers = previewCustomers.slice(previewIndex + 1);
  const [basicPlan, setBasicPlan] = useState<PlanRecord | null>(null);
  const [isPlanLoading, setIsPlanLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public/plans", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as { plan?: PlanRecord };
        if (response.ok && result.plan) setBasicPlan(result.plan);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setIsPlanLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const elements = root.querySelectorAll<HTMLElement>("[data-reveal]");
    const revealAll = () => elements.forEach((element) => element.setAttribute("data-visible", "true"));
    if (!("IntersectionObserver" in window)) {
      revealAll();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.setAttribute("data-visible", "true");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -35px 0px" });
    elements.forEach((element) => {
      element.setAttribute("data-visible", motionPreference.matches || element.getBoundingClientRect().top < window.innerHeight ? "true" : "false");
      if (!motionPreference.matches) observer.observe(element);
    });
    const motionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.setAttribute("data-in-view", String(entry.isIntersecting)));
    });
    root.querySelectorAll<HTMLElement>("[data-motion]").forEach((element) => motionObserver.observe(element));
    const handleMotionChange = () => {
      if (motionPreference.matches) {
        revealAll();
        observer.disconnect();
      }
    };
    motionPreference.addEventListener("change", handleMotionChange);
    return () => {
      observer.disconnect();
      motionObserver.disconnect();
      motionPreference.removeEventListener("change", handleMotionChange);
    };
  }, []);

  return (
    <div
      ref={pageRef}
      className={`${styles.home} ${homeFont.variable}`}
      onFocusCapture={(event) => event.target.closest("[data-reveal]")?.setAttribute("data-visible", "true")}
    >
      <div className={styles.scrollProgress} aria-hidden="true" />
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}><span className={styles.statusDot} /> A LITTLE LESS WAITING.</p>
          <h1 id="home-title" className={styles.heroWordmark} aria-label="MyTurn">
            <Image src={logo} alt="MyTurn" className={styles.heroLogo} sizes="(max-width: 640px) 320px, 480px" priority />
          </h1>
          <p className={styles.heroSubtitle}>Your queue,<br /><span>organized.</span></p>
          <p className={styles.heroDescription}>Let customers join remotely, manage walk-ins, and keep your counter moving. Start free in a few simple steps.</p>
          <div className={styles.actions}>
            <Link href="/signup" className={styles.primaryButton}>Start for free <ArrowRight size={19} /></Link>
            <a href="#setup" className={styles.secondaryButton}>How it works <ArrowDown size={17} /></a>
          </div>
          <p className={styles.startNote}>Free Basic plan. <Link href="/pricing">Usage limits apply <ArrowUpRight size={12} /></Link></p>
        </div>
        <div className={styles.heroIllustration} role="group" aria-label="Interactive sample queue illustration" data-reveal="zoom" data-motion>
          <div className={styles.illustrationGrid}>
            <span className={styles.illustrationCaption}>YOUR QUEUE, CONNECTED.</span>
            <div className={styles.queueRoute} />
            <div className={styles.counterRoute} />
            <div className={styles.phoneGraphic} aria-hidden="true">
              <span className={styles.phoneSpeaker} />
              <span className={styles.phoneBrand}>MyTurn.</span>
              <QrCode size={48} strokeWidth={1.5} />
              <span className={styles.phoneCaption}>Your place in line</span>
              <span className={styles.phoneTicket}>{currentTicket}</span>
              <span className={styles.phoneHome} />
            </div>
            <div className={styles.illustrationQueue}>
              {[1, 2, 3].map((offset) => (
                <div key={offset}><span><Users size={15} /></span><strong>{sampleTickets[(currentIndex + offset) % sampleTickets.length]}</strong><span className={styles.queueDash} /></div>
              ))}
            </div>
            <button
              type="button"
              className={styles.heroTicket}
              onClick={() => setCurrentIndex((index) => (index + 1) % sampleTickets.length)}
              aria-label="Call next sample ticket"
              title="Call next sample ticket"
            >
              <span className={styles.heroTicketBrand}><span>MyTurn.</span><Ticket size={21} /></span>
              <span className={styles.heroTicketLabel}> TICKET NUMBER</span>
              <strong key={currentTicket} aria-live="polite" aria-atomic="true">{currentTicket}</strong>
              <span className={styles.heroTicketRule} />
              <span className={styles.heroTicketCounter}><span>Counter 01</span><ArrowUpRight size={18} /></span>
            </button>
            <div className={styles.illustrationCounter}><UserCheck size={23} /><div><span>NOW SERVING</span><strong>Ready for your turn.</strong></div><CheckCircle2 size={18} /></div>
          </div>
        </div>
        <a href="#setup" className={styles.scrollLink} data-motion>A simpler start <ArrowDown size={15} /></a>
      </section>

      <section id="setup" className={styles.workflow} aria-labelledby="workflow-title">
        <div className={styles.sectionHeading} data-reveal><p className={styles.eyebrow}>THREE STEPS. THAT&apos;S IT.</p><h2 id="workflow-title">From signup to your first customer.</h2></div>
        <div className={styles.steps}>{workflow.map((step, index) => {
          return (
            <article key={step.title} className={styles.step} data-reveal="up" data-motion style={{ transitionDelay: `${index * 130}ms` }}>
              <div className={styles.stepGraphic} aria-hidden="true">
                {index === 0 ? (
                  <>
                    <div className={styles.signupSheet}>
                      <div className={styles.sceneToolbar}><span /><span /><span /></div>
                      <span className={styles.signupAvatar}><UserCheck size={26} strokeWidth={1.6} /></span>
                      <div className={styles.signupField}><Mail size={15} /><span /></div>
                      <div className={styles.signupField}><Lock size={15} /><span /></div>
                      <div className={styles.signupSubmit}><span /><ArrowRight size={16} /></div>
                    </div>
                    <span className={styles.verifiedStamp}><CheckCircle2 size={31} strokeWidth={1.7} /></span>
                  </>
                ) : index === 1 ? (
                  <>
                    <div className={styles.branchNode}><Building2 size={32} strokeWidth={1.5} /></div>
                    <div className={styles.branchStem} />
                    <div className={styles.branchRail} />
                    <div className={styles.queueNodes}>
                      {[Settings2, Ticket, Users].map((NodeIcon, nodeIndex) => (
                        <div key={nodeIndex}><span><NodeIcon size={24} strokeWidth={1.6} /></span><i /><i /></div>
                      ))}
                    </div>
                    <span className={styles.branchComplete}><CheckCircle2 size={19} /><span /><span /><span /></span>
                  </>
                ) : (
                  <>
                    <div className={styles.scanPhone}>
                      <span className={styles.scanSpeaker} />
                      <span className={styles.scanBrand}>MyTurn.</span>
                      <div className={styles.scanCode}><QrCode size={48} strokeWidth={1.6} /><span className={styles.scanBeam} /></div>
                      <span className={styles.scanHome} />
                    </div>
                    <span className={styles.ticketTransfer}><ArrowRight size={23} /></span>
                    <div className={styles.issuedTicket}>
                      <Ticket size={23} strokeWidth={1.6} />
                      <strong>A-001</strong>
                      <span /><UserCheck size={21} strokeWidth={1.5} />
                    </div>
                    <span className={styles.ticketStamp}><CheckCircle2 size={27} strokeWidth={1.7} /></span>
                  </>
                )}
                <span className={styles.stepNumber}>0{index + 1}</span>
              </div>
              {index < workflow.length - 1 && <span className={styles.stepConnector} aria-hidden="true"><ArrowRight size={23} strokeWidth={1.5} /></span>}
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          );
        })}</div>
      </section>

      <section className={styles.productPreview} aria-labelledby="product-preview-title">
        <div className={styles.productCopy} data-reveal="left">
          <p className={styles.eyebrow}>AT YOUR COUNTER</p>
          <h2 id="product-preview-title">See the next step.<br />Serve the next person.</h2>
          <p>A waiting list your team can follow. A clear view of who is being served. One action to complete service and call the next customer.</p>
          <Link href="/signup" className={styles.faqPlanLink}>Set up your own queue <ArrowUpRight size={17} /></Link>
        </div>
        <div className={styles.counterPreview} data-reveal="up" role="group" aria-label="Interactive staff counter preview">
          <div className={styles.previewHeader}>
            <div><UserCheck size={23} /><div><h3>Staff counter</h3><span>Sample branch / General queue</span></div></div>
            <span className={styles.previewBadge}>Sample data</span>
          </div>
          <div className={styles.previewServing}>
            <p><span className={styles.statusDot} /> NOW SERVING</p>
            <div className={styles.previewCustomer} aria-live="polite" aria-atomic="true">
              <strong>{servingCustomer?.number ?? "Done"}</strong>
              <div><h4>{servingCustomer?.name ?? "Queue is clear"}</h4><span>{servingCustomer?.service ?? "All sample customers have been served."}</span></div>
            </div>
            <button type="button" className={styles.previewNext} disabled={!servingCustomer} onClick={() => setPreviewIndex((index) => Math.min(index + 1, previewCustomers.length))}>
              <CheckCircle2 size={18} />{servingCustomer ? (waitingCustomers.length ? "Complete & call next" : "Complete service") : "All customers served"}
            </button>
          </div>
          <div className={styles.previewWaiting}>
            <div className={styles.previewWaitingTitle}><h4>Waiting queue</h4><span>{waitingCustomers.length} waiting</span></div>
            <ol>{waitingCustomers.map((customer) => <li key={customer.number}><span>{customer.number}</span><div><strong>{customer.name}</strong><span>{customer.service}</span></div><Ticket size={17} /></li>)}</ol>
            {waitingCustomers.length === 0 && <p className={styles.previewEmpty}>No waiting customers.</p>}
          </div>
          <div className={styles.previewFooter}><span>Interactive preview / Fictional customers</span><button type="button" onClick={() => setPreviewIndex(0)} aria-label="Reset staff counter preview" title="Reset preview"><RotateCcw size={17} /></button></div>
        </div>
      </section>

      <section className={styles.benefits} aria-labelledby="benefits-title">
        <div className={styles.sectionHeading} data-reveal>
          <p className={styles.eyebrow}>LESS GUESSWORK. MORE GOOD SERVICE.</p>
          <h2 id="benefits-title">Better for your customers.<br />Easier for your team.</h2>
        </div>
        <div className={styles.benefitGrid}>
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <article key={benefit.title} className={styles.benefit} data-reveal={index % 2 === 0 ? "left" : "right"} style={{ transitionDelay: `${index * 90}ms` }}>
                <span className={styles.benefitIcon}><Icon size={28} strokeWidth={1.6} aria-hidden="true" /></span>
                <h3>{benefit.title}</h3>
                <p>{benefit.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.smallBusiness} aria-labelledby="small-business-title" data-reveal="zoom">
        <div>
          <p className={styles.eyebrow}>SMALL BUSINESS. BIG WELCOME.</p>
          <h2 id="small-business-title">One counter is<br />a great place to start.</h2>
          <p>Keep your queue organized, whether you run a neighborhood shop, an institute, or a busy service desk.</p>
          <div className={styles.businessTypes}><span><Store size={18} /> Shops</span><span><GraduationCap size={18} /> Institutes</span><span><Building2 size={18} /> Service teams</span></div>
        </div>
        <div className={styles.freeOffer}>
          <div className={styles.shopGraphic} aria-hidden="true">
            <div className={styles.shopRoof} />
            <div className={styles.shopFront}>
              <span className={styles.shopWindow}><Store size={29} strokeWidth={1.5} /></span>
              <span className={styles.shopDoor} />
            </div>
            <span className={styles.shopCheck}><CheckCircle2 size={25} /></span>
          </div>
          <span className={styles.freeLabel}>Your first step</span>
          <h3>Start free.<br />Grow at your pace.</h3>
          <div className={styles.planCapacity} aria-busy={isPlanLoading}>
            <p>{basicPlan ? `${basicPlan.name} plan capacity` : "Free plan capacity"}</p>
            {isPlanLoading ? <p role="status">Loading current limits...</p> : basicPlan ? (
              <ul>
                {[
                  capacityText(basicPlan.limits.branches, "branch", "branches"),
                  capacityText(basicPlan.limits.services, "service", "services"),
                  capacityText(basicPlan.limits.staff_users, "staff member", "staff members"),
                  capacityText(basicPlan.limits.tickets_per_day, "ticket per day", "tickets per day"),
                ].map((feature) => <li key={feature}><CheckCircle2 size={16} />{feature}</li>)}
              </ul>
            ) : <p>Current limits are unavailable here. Please check the <Link href="/pricing">plans page</Link>.</p>}
          </div>
          <Link href="/signup" className={styles.primaryButton}>Create an account <ArrowRight size={18} /></Link>
          <p className={styles.startNote}>Free Basic plan. <Link href="/pricing">See plans & limits <ArrowUpRight size={12} /></Link></p>
        </div>
      </section>

      <section className={styles.faq} aria-labelledby="faq-title">
        <div className={styles.faqIntro} data-reveal="left">
          <p className={styles.eyebrow}>A FEW THINGS WORTH KNOWING</p>
          <h2 id="faq-title">A simpler start.<br />A few quick answers.</h2>
          <p>Start small and choose the capacity that works for you.</p>
          <Link href="/pricing" className={styles.faqPlanLink}>See plans & limits <ArrowUpRight size={17} /></Link>
        </div>
        <div className={styles.faqList}>
          {questions.map(({ question, answer }, index) => (
            <details key={question} className={styles.faqItem} data-reveal="up" style={{ transitionDelay: `${index * 70}ms` }}>
              <summary>{question}<ChevronDown size={20} aria-hidden="true" /></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className={styles.footer} data-reveal="up">
        <Link href="/" aria-label="MyTurn home">MyTurn<span>.</span></Link>
        <p>A better turn for everyone.</p>
        <div><Link href="/pricing">Plans</Link><Link href="/admin">Admin</Link><Link href="/staff">Staff <ArrowUpRight size={13} /></Link></div>
      </footer>
    </div>
  );
}
