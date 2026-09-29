'use client';
import { useEffect, useRef, useState } from 'react';
import styles from '../../styles/Landing.module.css';
import { useReveal } from './useReveal';

// Ported from design/propagent-landing.html's explainer. Runs on plain
// React state (not refs like PromoStage) since this only updates every
// 4.2s or on click, not per animation frame -- no performance reason to
// go imperative here.
const ICONS: Record<string, string> = {
  ear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h2l2-5 4 10 3-7 2 2h3"/></svg>',
  brain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg>',
  fork: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v6a6 6 0 0 0 6 6h0a6 6 0 0 0 6-6V3M12 15v6"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 2 5 13.5h6L9.5 22 19 9.5h-6.2z"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3h4l2 5-3 2a11 11 0 0 0 4 4l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/></svg>',
  msg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  web: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M15 4a5 5 0 0 0-4.7 6.7L4 17v3h3l6.3-6.3A5 5 0 1 0 15 4z"/></svg>',
  card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
};

const mini = (icon: string, label: string, meta: string, right: string, hl = false) =>
  `<div class="${styles.mini} ${hl ? styles.miniHl : ''}"><span class="${styles.miniIc}">${ICONS[icon]}</span><span>${label}<span class="${styles.miniM}">${meta}</span></span><span class="${styles.miniR}">${right}</span></div>`;

const STEPS = [
  {
    k: '01', t: 'Listen', icon: 'ear', h: 'Every channel lands in one place.',
    p: 'Calls, texts, emails and portal requests arrive in a single queue, any hour of the day.',
    li: ['Answers calls in a natural voice', 'Replies to texts in seconds', "Nothing sits in a voicemail box"],
    vis: `<div class="${styles.pv}">${mini('phone', 'Voice call', 'Unit 4B &middot; 2:14 AM', 'Live', true)}${mini('msg', 'Text message', 'Unit 2A &middot; "Is rent due the 1st?"', 'Answered')}${mini('mail', 'Listing inquiry', 'Unit 1D &middot; 2BR, available Nov 1', 'Queued')}${mini('web', 'Portal request', 'Unit 3C &middot; Dishwasher not draining', 'Queued')}</div>`,
  },
  {
    k: '02', t: 'Understand', icon: 'brain', h: 'It knows the unit, the lease and the history.',
    p: 'Before replying, the agent pulls the context a good property manager would have in their head.',
    li: ['Reads the lease and repair terms', 'Checks past tickets for the unit', 'Sorts urgent from routine'],
    vis: `<div class="${styles.pv}"><dl class="${styles.ctx}"><dt>Unit</dt><dd>4B &middot; 2BR &middot; Maple Court</dd><dt>Tenant</dt><dd>Maria T. &middot; since Mar 2024</dd><dt>Lease</dt><dd>Plumbing = landlord repair</dd><dt>History</dt><dd>Sink trap replaced Jan 2026</dd><dt>Class</dt><dd style="color:var(--warn)">Urgent &middot; active leak</dd></dl></div>`,
  },
  {
    k: '03', t: 'Decide', icon: 'fork', h: 'Your rules, applied every time.',
    p: 'You set spend limits, preferred vendors and what needs your sign-off. The agent never goes past them.',
    li: ['Auto-approve up to your limit', 'Asks you when it should', 'Every decision is explained'],
    vis: `<div class="${styles.pv}"><div class="${styles.rule}"><span class="${styles.ruleKw}">when</span> category = plumbing<br>&nbsp;&nbsp;<span class="${styles.ruleKw}">and</span> severity = urgent<br><span class="${styles.ruleKw}">then</span> dispatch preferred vendor<br>&nbsp;&nbsp;<span class="${styles.ruleKw}">approve up to</span> <span class="${styles.ruleV}">$350</span><br><span class="${styles.ruleKw}">else</span> text owner for approval</div>${mini('fork', 'Rule matched', '$285 estimate &le; $350 limit', 'Auto-approve', true)}</div>`,
  },
  {
    k: '04', t: 'Act', icon: 'bolt', h: "It does the work, not just the triage.",
    p: 'The agent takes action across your tools: vendors, tenants, calendars and payments.',
    li: ['Dispatches vendors and tracks ETAs', 'Books showings on your calendar', 'Collects rent and sends reminders'],
    vis: `<div class="${styles.pv}">${mini('wrench', 'Work order WO-1042', 'Rivera Plumbing &middot; ETA 3:00 AM', 'Dispatched', true)}${mini('msg', 'Tenant update sent', 'SMS to Maria T.', 'Delivered')}${mini('cal', 'Showing booked', 'Unit 1D &middot; Sat 10:00 AM', 'Confirmed')}${mini('card', 'Rent posted', 'Unit 2A &middot; $1,450', 'Paid')}</div>`,
  },
  {
    k: '05', t: 'Report', icon: 'doc', h: 'You see everything it did.',
    p: 'Every call, message, decision and dollar is logged. Owners get a short digest each morning.',
    li: ['Daily digest by email or text', 'Full call recordings and transcripts', 'Audit log for every action'],
    vis: `<div class="${styles.pv}">${mini('doc', 'Overnight digest', '7:00 AM &middot; 6 actions &middot; 0 need you', 'Sent')}<div class="${styles.rule}" style="font-size:12px">02:14&nbsp;&nbsp;call.received&nbsp;&nbsp;unit=4B<br>02:15&nbsp;&nbsp;rule.matched&nbsp;&nbsp;&nbsp;limit=<span class="${styles.ruleV}">$350</span><br>02:15&nbsp;&nbsp;vendor.dispatch rivera<br>02:15&nbsp;&nbsp;sms.sent&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;tenant<br>03:52&nbsp;&nbsp;wo.closed&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="${styles.ruleKw}">$285</span></div></div>`,
  },
];

export default function HowItWorks() {
  const head = useReveal<HTMLDivElement>();
  const stack = useReveal<HTMLDivElement>();
  const [cur, setCur] = useState(0);
  const autoRef = useRef(true);
  const visibleRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const flowLineRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  const goTo = (k: number, userInitiated = false) => {
    if (userInitiated) autoRef.current = false;
    setCur(k);
    const pct = (k / (STEPS.length - 1)) * 100;
    if (fillRef.current) fillRef.current.style.width = pct + '%';
    if (dotRef.current) dotRef.current.style.left = pct + '%';
    flowRef.current?.style.setProperty('--h', pct + '%');
    flowLineRef.current?.style.setProperty('--h', pct + '%');
  };

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    autoRef.current = !reduced;
    goTo(0);

    const panel = panelRef.current;
    let io: IntersectionObserver | undefined;
    if (panel) {
      io = new IntersectionObserver(([entry]) => { visibleRef.current = entry.isIntersecting; }, { threshold: 0.3 });
      io.observe(panel);
    }
    const id = setInterval(() => {
      if (autoRef.current && visibleRef.current) {
        setCur(c => { const next = (c + 1) % STEPS.length; goTo(next); return next; });
      }
    }, 4200);
    return () => { io?.disconnect(); clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section id="how" className={styles.section}>
      <div ref={head.ref} className={`${styles.secHead} ${styles.rv} ${head.inView ? styles.rvIn : ''}`}>
        <span className={styles.eyebrow}>How it works</span>
        <h2>One agent, from the first ring to the owner&apos;s report.</h2>
        <p>Every request moves through the same five stages. You set the rules once; PropAgent follows them on every call, text and ticket.</p>
      </div>

      <div className={styles.flow} ref={flowRef}>
        <div className={styles.flowLine} ref={flowLineRef} aria-hidden="true">
          <i ref={fillRef} />
          <b ref={dotRef} />
        </div>
        {STEPS.map((s, k) => (
          <button
            key={s.k}
            className={`${styles.step} ${k === cur ? styles.stepAct : ''} ${k < cur ? styles.stepDone : ''}`}
            aria-pressed={k === cur}
            onClick={() => goTo(k, true)}
          >
            <span className={styles.stepNode} dangerouslySetInnerHTML={{ __html: ICONS[s.icon] }} />
            <span className={styles.stepTxt}>
              <span className={styles.stepK}>{s.k}</span>
              <span className={styles.stepT}>{s.t}</span>
            </span>
          </button>
        ))}
      </div>

      <div className={styles.panel} ref={panelRef} aria-live="polite">
        {STEPS.map((s, k) => (
          <div key={s.k} style={{ display: k === cur ? 'contents' : 'none' }}>
            <div className={styles.paneCopy}>
              <span className={styles.eyebrow}>Step {s.k}</span>
              <h3>{s.h}</h3>
              <p>{s.p}</p>
              <ul>{s.li.map(x => <li key={x}>{x}</li>)}</ul>
            </div>
            <div className={styles.paneVis} dangerouslySetInnerHTML={{ __html: s.vis }} />
          </div>
        ))}
      </div>

      <div ref={stack.ref} className={`${styles.stack} ${styles.rv} ${stack.inView ? styles.rvIn : ''}`}>
        <span style={{ border: 0, padding: 0 }}>Built on</span>
        <span>LangGraph agent pipeline</span>
        <span>Twilio Voice &amp; SMS</span>
        <span>Stripe Billing</span>
        <span>FastAPI</span>
      </div>
    </section>
  );
}
