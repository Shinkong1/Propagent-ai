import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { Zap, Building2, MessageSquare, Wrench, Users, Phone, ChevronRight, Check } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import PublicFooter from '../components/PublicFooter';
import PublicNav from '../components/PublicNav';
import SalesChatWidget from '../components/SalesChatWidget';
import { auth, publicTestimonials } from '../lib/api';
import { setToken, setUser } from '../lib/auth';
import toast from 'react-hot-toast';

const DEMO_EMAIL = 'demo@propagentai.com';
const DEMO_PASSWORD = 'PropAgentDemo2026!';

// Design rules for this page (documented so they stay consistent):
// - One accent: brand gold, used for the primary CTA, the headline emphasis
//   word and interactive states only. Nothing else on the page is gold.
// - One radius scale: containers and buttons 12px, icon tiles 10px.
// - Dark/light aware: every surface and text color comes from the theme tokens
//   in styles/globals.css. Gold text uses --pa-gold-text so it stays legible
//   on the light theme too.
const R = 12;

const FEATURES = [
  { icon: MessageSquare, title: 'AI Tenant Chat', desc: '24/7 automated responses to tenant queries, maintenance, and leasing questions.', span: 7, tint: true },
  { icon: Wrench, title: 'Auto Maintenance', desc: 'AI classifies requests, creates tickets, and dispatches vendors automatically.', span: 5, tint: false },
  { icon: Phone, title: 'Voice AI', desc: 'Inbound call AI handles tenants via Twilio, with speech-to-text feeding the agent pipeline.', span: 5, tint: false },
  { icon: Building2, title: 'Portfolio Management', desc: 'Full property, unit, tenant, and lease management in one unified dashboard.', span: 7, tint: true },
  { icon: Users, title: 'Lead Generation', desc: 'Scrape landlord data from Google, LinkedIn, and Zillow. Auto outreach sequences.', span: 4, tint: false },
  { icon: Zap, title: 'Autonomous Agents', desc: 'LangGraph orchestrates 7 specialized agents working together automatically.', span: 8, tint: true },
];

const SEGMENTS = [
  {
    title: 'Independent Landlords',
    desc: 'Managing a few units on the side? Let Voice AI take the 2am calls and triage maintenance so you\'re not on-call around the clock.',
  },
  {
    title: 'Property Management Companies',
    desc: 'Running dozens of properties across a team? Centralize leasing, maintenance, and collections into one AI-driven workflow instead of five disconnected tools.',
  },
  {
    title: 'Fee Managers & Portfolio Operators',
    desc: 'Managing properties for multiple owners? Keep every owner\'s books, reporting, and communications cleanly separated, automatically.',
  },
];

// The three "moments" that used to be a row of three equal cards. Same copy,
// now played out step by step in the hero. Every step is taken from the
// original resolution text; nothing here is new product claims.
const SCENARIOS = [
  {
    tab: '2am pipe burst',
    trigger: 'Tenant texts at 2:14am: "water everywhere."',
    pain: 'Before: after-hours emergencies wait for a human.',
    steps: [
      'Voice AI answers in one ring',
      'Classifies it as urgent',
      'Texts the on-call plumber',
      'Confirms an ETA to the tenant',
    ],
    outcome: 'All of it happens before you\'ve seen the message.',
  },
  {
    tab: 'Vacant unit',
    trigger: 'Unit 4B has been empty for three weeks. Every showing request means answering the same five questions again.',
    pain: 'Before: manual leasing inquiries stall vacant units.',
    steps: [
      'AI tenant chat qualifies every inquiry instantly',
      'Screens for pets, income, and move-in date',
      'Books the serious ones straight onto your calendar',
    ],
    outcome: 'You only meet the prospects worth meeting.',
  },
  {
    tab: 'Late rent',
    trigger: 'Rent\'s ten days late again. You don\'t want to be "that landlord," so you wait.',
    pain: 'Before: collections feel personal, so they get delayed.',
    steps: [
      'The Collections agent sends the first reminder on day one',
      'Friendly, consistent, and logged',
      'Escalates on a schedule you set',
    ],
    outcome: 'It\'s never coming from you.',
  },
];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

function useMinWidth(px: number) {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    const on = () => setOk(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [px]);
  return ok;
}

// Fades + rises a block into place the first time it crosses into view.
// IntersectionObserver (not a scroll listener), fires once, and is skipped
// entirely for prefers-reduced-motion.
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (reduced) { setVisible(true); return; }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.12 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduced]);
  return (
    <div ref={ref} style={{
      opacity: visible || reduced ? 1 : 0,
      transform: visible || reduced ? 'translateY(0)' : 'translateY(18px)',
      transition: reduced ? 'none' : `opacity 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      height: '100%',
    }}>
      {children}
    </div>
  );
}

// Counts up from 0 to the stat's leading integer once it scrolls into view,
// preserving the suffix ("94%", "15hrs"). requestAnimationFrame plus a single
// IntersectionObserver; no scroll listener.
function AnimatedStat({ value }: { value: string }) {
  const match = value.match(/^(\d+)(.*)$/);
  const target = match ? parseInt(match[1], 10) : 0;
  const suffix = match ? match[2] : '';
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (reduced) { setDisplay(target); return; }
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const duration = 900;
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          setDisplay(Math.round(target * (1 - Math.pow(1 - progress, 3))));
          if (progress < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        observer.disconnect();
      }
    }, { threshold: 0.4 });
    observer.observe(el);
    return () => { observer.disconnect(); cancelAnimationFrame(raf); };
  }, [reduced, target]);
  return (
    <div ref={ref} style={{ fontFamily: 'IBM Plex Mono', fontSize: 30, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
      {display}{suffix}
    </div>
  );
}

// Interactive hero: pick a situation and watch it get handled, step by step.
// Auto-rotates until the visitor clicks a tab or hovers the panel. Text only
// (no fake dashboard chrome), and with reduced motion it shows the full
// sequence immediately and never auto-rotates.
function ScenarioPlayer() {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(0);
  const [picked, setPicked] = useState(false);
  const [hovering, setHovering] = useState(false);
  const s = SCENARIOS[active];
  const total = s.steps.length + 1;

  useEffect(() => {
    if (reduced) { setShown(total); return; }
    setShown(0);
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= total) clearInterval(id);
    }, 650);
    return () => clearInterval(id);
  }, [active, reduced, total]);

  useEffect(() => {
    if (reduced || picked || hovering || shown < total) return;
    const id = setTimeout(() => setActive(a => (a + 1) % SCENARIOS.length), 4500);
    return () => clearTimeout(id);
  }, [reduced, picked, hovering, shown, total]);

  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: R, overflow: 'hidden' }}
    >
      <div role="tablist" aria-label="Example situations" style={{ display: 'flex', borderBottom: '1px solid var(--border-strong)' }}>
        {SCENARIOS.map((sc, i) => (
          <button
            key={sc.tab}
            role="tab"
            id={`scenario-tab-${i}`}
            aria-selected={i === active}
            aria-controls="scenario-panel"
            className="pa-focus"
            onClick={() => { setActive(i); setPicked(true); }}
            style={{
              flex: 1, padding: '14px 8px', background: i === active ? 'var(--hover-overlay)' : 'transparent',
              color: i === active ? 'var(--text-primary)' : 'var(--text-secondary)', border: 'none',
              borderBottom: `2px solid ${i === active ? 'var(--pa-gold-text)' : 'transparent'}`,
              fontFamily: 'Syne', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'color 0.2s, background 0.2s',
            }}
          >
            {sc.tab}
          </button>
        ))}
      </div>
      <div id="scenario-panel" role="tabpanel" aria-labelledby={`scenario-tab-${active}`} style={{ padding: '24px 26px 26px', minHeight: 344 }}>
        <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans', fontStyle: 'italic', marginBottom: 8 }}>
          {s.trigger}
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Sans', marginBottom: 22 }}>{s.pain}</p>
        <p style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: 'var(--pa-gold-text)', marginBottom: 12 }}>With PropAgent</p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {s.steps.map((step, i) => (
            <li key={step} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 14.5, lineHeight: 1.45, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans',
              opacity: shown > i ? 1 : 0, transform: shown > i ? 'translateY(0)' : 'translateY(8px)',
              transition: reduced ? 'none' : 'opacity 0.4s ease, transform 0.4s ease',
            }}>
              <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1, background: 'rgba(var(--accent-rgb),0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={13} color="var(--pa-gold-text)" strokeWidth={3} />
              </span>
              {step}
            </li>
          ))}
        </ul>
        <p style={{
          marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-strong)', fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans',
          opacity: shown >= total ? 1 : 0, transition: reduced ? 'none' : 'opacity 0.5s ease',
        }}>
          {s.outcome}
        </p>
      </div>
    </div>
  );
}

function SegmentAccordion() {
  const reduced = usePrefersReducedMotion();
  const [open, setOpen] = useState(0);
  return (
    <div style={{ borderBottom: '1px solid var(--border-strong)' }}>
      {SEGMENTS.map((s, i) => {
        const isOpen = open === i;
        return (
          <div key={s.title} style={{ borderTop: '1px solid var(--border-strong)' }}>
            <button
              className="pa-focus"
              aria-expanded={isOpen}
              aria-controls={`segment-${i}`}
              onClick={() => setOpen(isOpen ? -1 : i)}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '22px 0',
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                color: isOpen ? 'var(--text-primary)' : 'var(--text-secondary)', fontFamily: 'Syne', fontWeight: 700, fontSize: 20,
                transition: 'color 0.2s',
              }}
            >
              {s.title}
              <ChevronRight size={20} style={{ flexShrink: 0, transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: reduced ? 'none' : 'transform 0.25s ease' }} />
            </button>
            <div id={`segment-${i}`} role="region" style={{
              display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: reduced ? 'none' : 'grid-template-rows 0.3s ease',
            }}>
              <div style={{ overflow: 'hidden' }}>
                <p style={{ maxWidth: '60ch', paddingBottom: 24, fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Sans' }}>{s.desc}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const { t } = useLanguage();
  const router = useRouter();
  const wide = useMinWidth(1000);
  const [demoLoading, setDemoLoading] = useState(false);

  // Real customer testimonials only, managed by the owner in the admin dashboard
  // (see /admin/testimonials). No fallback/example content: if nothing has been
  // published yet, `testimonials` just stays an empty array and the section
  // below renders nothing at all.
  const [testimonials, setTestimonials] = useState<any[]>([]);
  useEffect(() => {
    publicTestimonials.list().then(res => setTestimonials(res.data || [])).catch(() => {});
  }, []);

  const handleViewDemo = async () => {
    setDemoLoading(true);
    try {
      const res = await auth.login({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
      setToken(res.data.access_token);
      setUser(res.data);
      router.push('/dashboard');
    } catch {
      toast.error('Demo is temporarily unavailable. Please try again shortly.');
      setDemoLoading(false);
    }
  };

  const sectionPad = wide ? '96px 24px' : '64px 20px';
  const h2Style = { fontFamily: 'Syne', fontWeight: 800, fontSize: wide ? 36 : 28, lineHeight: 1.15, color: 'var(--text-primary)', letterSpacing: '-0.5px', textWrap: 'balance' } as React.CSSProperties;

  return (
    <>
      <Head>
        <title>PropAgent AI — AI-Powered Property Management</title>
        <meta name="description" content="Automate tenant communication, maintenance, leasing, and more with AI." />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="PropAgent AI — AI-Powered Property Management" />
        <meta property="og:description" content="Automate tenant communication, maintenance, leasing, and more with AI." />
        <meta property="og:image" content="/icon-512.png" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="PropAgent AI — AI-Powered Property Management" />
        <meta name="twitter:description" content="Automate tenant communication, maintenance, leasing, and more with AI." />
      </Head>

      <div style={{ minHeight: '100vh', background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
        <PublicNav />

        {/* Hero: value prop on the left, the product handling a real situation on the right */}
        <section style={{ maxWidth: 1120, margin: '0 auto', padding: wide ? '56px 24px 88px' : '36px 20px 56px' }}>
          <p style={{ fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--pa-gold-text)', letterSpacing: '1px', marginBottom: 18, textTransform: 'uppercase' }}>
            {t('landing.tagline')}
          </p>
          {/* Syne ExtraBold is very wide ("Property Management" alone is ~850px at
              48px), so the headline gets its own full-width row: two lines on
              desktop instead of wrapping to three inside a half-width column. */}
          <h1 style={{
            fontFamily: 'Syne', fontWeight: 800, fontSize: wide ? 48 : 30, lineHeight: 1.1,
            color: 'var(--text-primary)', marginBottom: wide ? 40 : 24, letterSpacing: '-1px', textWrap: 'balance',
          } as React.CSSProperties}>
            {t('landing.heading1')}{' '}
            <span style={{ color: 'var(--pa-gold-text)' }}>{t('landing.heading2')}</span>
          </h1>
          <div style={{ display: 'grid', gridTemplateColumns: wide ? 'minmax(0,1fr) minmax(0,1fr)' : '1fr', gap: wide ? 56 : 32, alignItems: 'center' }}>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1.6, marginBottom: 32, fontFamily: 'IBM Plex Sans', maxWidth: '46ch' }}>
              {t('landing.subtitle')}
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/signup" className="pa-btn pa-btn-primary pa-focus" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#FBC02D', color: '#060B18',
                padding: '14px 26px', borderRadius: R, textDecoration: 'none',
                fontSize: 16, fontWeight: 700, fontFamily: 'Syne', whiteSpace: 'nowrap',
              }}>
                {t('landing.startTrial')} <ChevronRight size={18} />
              </Link>
              <button onClick={handleViewDemo} disabled={demoLoading} className="pa-btn pa-btn-ghost pa-focus" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-strong)',
                padding: '14px 26px', borderRadius: R, cursor: demoLoading ? 'default' : 'pointer',
                fontSize: 16, fontWeight: 500, fontFamily: 'IBM Plex Sans', opacity: demoLoading ? 0.6 : 1, whiteSpace: 'nowrap',
              }}>
                {demoLoading ? '...' : t('landing.viewDemo')}
              </button>
            </div>
          </div>
          <ScenarioPlayer />
          </div>
        </section>

        {/* Metrics, in plain layout rather than cards */}
        <section style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', justifyItems: 'center',
            gap: wide ? 40 : 24, padding: wide ? '48px 24px' : '36px 20px', maxWidth: 960, margin: '0 auto',
          }}>
            {[['15hrs', 'Saved/week avg'], ['94%', 'Response rate'], ['3x', 'Faster maintenance'], ['47%', 'Less vacancy'], ['8', 'Languages supported']].map(([v, l]) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <AnimatedStat value={v} />
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Sans', marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features: asymmetric grid, six items in six cells */}
        <section style={{ maxWidth: 1120, margin: '0 auto', padding: sectionPad }}>
          <Reveal>
            <h2 style={{ ...h2Style, marginBottom: 14 }}>Everything Automated</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.65, fontFamily: 'IBM Plex Sans', maxWidth: '62ch', marginBottom: 44 }}>
              Not a chatbot bolted onto your PMS. It's a multi-agent AI platform that runs full workflows end-to-end: triage, dispatch, follow-up, and reporting, autonomously.
            </p>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: wide ? 'repeat(12, minmax(0, 1fr))' : '1fr', gap: 16 }}>
            {FEATURES.map(({ icon: Icon, title, desc, span, tint }, i) => (
              <div key={title} style={{ gridColumn: wide ? `span ${span}` : 'auto' }}>
                <Reveal delay={(i % 2) * 0.08}>
                  <div className="pa-lift" style={{
                    height: '100%', minHeight: wide && span >= 7 ? 190 : 0, padding: span >= 7 && wide ? '32px' : '26px',
                    background: tint ? 'rgba(var(--accent-rgb),0.05)' : 'var(--bg-surface)',
                    border: '1px solid var(--border-strong)', borderRadius: R,
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 24,
                  }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(var(--accent-rgb),0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={20} color="var(--pa-gold-text)" />
                    </div>
                    <div>
                      <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: span >= 7 && wide ? 21 : 18, color: 'var(--text-primary)', marginBottom: 8 }}>{title}</div>
                      <div style={{ fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: 'IBM Plex Sans', maxWidth: '46ch' }}>{desc}</div>
                    </div>
                  </div>
                </Reveal>
              </div>
            ))}
          </div>
        </section>

        {/* Segments: an accordion, not another row of cards */}
        <section style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{
            maxWidth: 1120, margin: '0 auto', padding: sectionPad,
            display: 'grid', gridTemplateColumns: wide ? 'minmax(0,0.8fr) minmax(0,1.2fr)' : '1fr', gap: wide ? 64 : 28, alignItems: 'start',
          }}>
            <h2 style={h2Style}>Built for how you manage</h2>
            <SegmentAccordion />
          </div>
        </section>

        {/* Testimonials: real customer quotes only, added by the owner as they're
            actually collected (see the admin dashboard's Testimonials tab). Renders
            nothing at all when there are none published yet; no placeholder content. */}
        {testimonials.length > 0 && (
          <section style={{ maxWidth: 1120, margin: '0 auto', padding: `0 ${wide ? 24 : 20}px ${wide ? 96 : 64}px` }}>
            <h2 style={{ ...h2Style, marginBottom: 32 }}>What real customers say</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {testimonials.map((tst: any, i: number) => (
                <Reveal key={tst.id} delay={i * 0.08}>
                  <div className="pa-lift" style={{
                    height: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)',
                    borderRadius: R, padding: '26px', display: 'flex', flexDirection: 'column', gap: 14,
                  }}>
                    {tst.rating ? (
                      <div style={{ color: 'var(--pa-gold-text)', fontSize: 14, letterSpacing: '1px' }}>
                        {'★'.repeat(tst.rating)}{'☆'.repeat(5 - tst.rating)}
                      </div>
                    ) : null}
                    <p style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.6, fontFamily: 'IBM Plex Sans' }}>
                      &ldquo;{tst.quote_text}&rdquo;
                    </p>
                    <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                      {tst.customer_name}
                      {tst.customer_title && (
                        <div style={{ fontWeight: 400, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Sans', marginTop: 2 }}>{tst.customer_title}</div>
                      )}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* CTA: the trial terms live here, not under the hero buttons */}
        <section style={{ borderTop: '1px solid var(--border-subtle)', textAlign: 'center', padding: wide ? '88px 24px 96px' : '64px 20px 72px' }}>
          <Reveal>
            <h2 style={{ ...h2Style, marginBottom: 28 }}>Ready to automate?</h2>
            <Link href="/signup" className="pa-btn pa-btn-primary pa-focus" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#FBC02D', color: '#060B18',
              padding: '15px 30px', borderRadius: R, textDecoration: 'none',
              fontSize: 16, fontWeight: 700, fontFamily: 'Syne', whiteSpace: 'nowrap',
            }}>
              {t('landing.startTrial')} <ChevronRight size={18} />
            </Link>
            <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Sans' }}>
              {t('landing.noCard')}
            </p>
          </Reveal>
        </section>

        <PublicFooter />
      </div>
      <SalesChatWidget />
    </>
  );
}
