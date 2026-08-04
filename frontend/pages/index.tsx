import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { Zap, Building2, MessageSquare, Wrench, Users, Phone, ChevronRight, Check } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { useSidebar } from '../lib/SidebarContext';
import { auth } from '../lib/api';
import { setToken, setUser } from '../lib/auth';
import toast from 'react-hot-toast';

const DEMO_EMAIL = 'demo@propagentai.com';
const DEMO_PASSWORD = 'PropAgentDemo2026!';

const FEATURES = [
  { icon: MessageSquare, title: 'AI Tenant Chat', desc: '24/7 automated responses to tenant queries, maintenance, and leasing questions.' },
  { icon: Wrench, title: 'Auto Maintenance', desc: 'AI classifies requests, creates tickets, and dispatches vendors automatically.' },
  { icon: Users, title: 'Lead Generation', desc: 'Scrape landlord data from Google, LinkedIn, and Zillow. Auto outreach sequences.' },
  { icon: Phone, title: 'Voice AI', desc: 'Inbound call AI handles tenants via Twilio — speech-to-text to agent pipeline.' },
  { icon: Building2, title: 'Portfolio Management', desc: 'Full property, unit, tenant, and lease management in one unified dashboard.' },
  { icon: Zap, title: 'Autonomous Agents', desc: 'LangGraph orchestrates 7 specialized agents working together automatically.' },
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
    desc: 'Managing properties for multiple owners? Keep every owner\'s books, reporting, and communications cleanly separated — automatically.',
  },
];

const MOMENTS = [
  {
    title: 'The 2am pipe burst',
    quote: '"Tenant texts at 2:14am: \'water everywhere.\' You\'re asleep. By the time you see it, it\'s been leaking for six hours."',
    pain: 'Pain · after-hours emergencies wait for a human',
    resolution: 'Voice AI answers in one ring, classifies it urgent, texts the on-call plumber, and confirms an ETA to the tenant — before you\'ve even seen the message.',
  },
  {
    title: 'The vacant unit bleeding rent',
    quote: '"Unit 4B has been empty for three weeks. Every showing request means answering the same five questions again."',
    pain: 'Pain · manual leasing inquiries stall vacant units',
    resolution: 'AI tenant chat qualifies every inquiry instantly — pets, income, move-in date — and books the serious ones straight onto your calendar. 47% less vacancy time on average.',
  },
  {
    title: 'The awkward rent chase',
    quote: '"Rent\'s ten days late again. You don\'t want to be \'that landlord,\' so you wait. Then it\'s thirty days late."',
    pain: 'Pain · collections feel personal, so they get delayed',
    resolution: 'The Collections agent sends the first reminder on day one — friendly, consistent, logged — and escalates on a schedule you set, so it\'s never coming from you.',
  },
];

export default function Home() {
  const { t } = useLanguage();
  const { isMobile } = useSidebar();
  const router = useRouter();
  const [demoLoading, setDemoLoading] = useState(false);

  const handleViewDemo = async () => {
    setDemoLoading(true);
    try {
      const res = await auth.login({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
      setToken(res.data.access_token);
      setUser(res.data);
      router.push('/dashboard');
    } catch {
      toast.error('Demo is temporarily unavailable — please try again shortly.');
      setDemoLoading(false);
    }
  };

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
      
      <div style={{ minHeight: '100vh', background: 'var(--bg-app)', color: '#E2E8F0' }}>
        {/* Nav */}
        <nav style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '16px' : '20px 48px', borderBottom: '1px solid var(--border-subtle)',
          position: 'sticky', top: 0, background: 'rgba(6,11,24,0.95)', backdropFilter: 'blur(12px)',
          zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={16} color="var(--bg-app)" strokeWidth={2.5} />
            </div>
            {!isMobile && <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>PropAgent AI</span>}
          </div>
          <div style={{ display: 'flex', gap: isMobile ? 8 : 12, alignItems: 'center' }}>
            {!isMobile && <Link href="/pricing" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14, fontFamily: 'IBM Plex Sans' }}>{t('landing.pricing')}</Link>}
            {!isMobile && <Link href="/login" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14, fontFamily: 'IBM Plex Sans' }}>{t('landing.signIn')}</Link>}
            {isMobile && <Link href="/login" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 13, fontFamily: 'IBM Plex Sans' }}>{t('landing.signIn')}</Link>}
            <Link href="/signup" style={{
              background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)',
              padding: isMobile ? '8px 14px' : '8px 18px', borderRadius: 8, textDecoration: 'none',
              fontSize: isMobile ? 13 : 14, fontWeight: 700, fontFamily: 'Syne', whiteSpace: 'nowrap',
            }}>{t('landing.getStarted')}</Link>
          </div>
        </nav>

        {/* Hero */}
        <section style={{ textAlign: 'center', padding: isMobile ? '48px 20px 40px' : '80px 24px 60px', maxWidth: 800, margin: '0 auto' }}>
          <div style={{
            display: 'inline-block', padding: '4px 14px', borderRadius: 100,
            background: 'rgba(var(--accent-rgb),0.12)', border: '1px solid rgba(var(--accent-rgb),0.3)',
            marginBottom: 24, fontSize: 12, fontFamily: 'IBM Plex Mono', color: '#FBC02D', letterSpacing: '1px',
          }}>
            {t('landing.tagline')}
          </div>
          <h1 style={{
            fontFamily: 'Syne', fontWeight: 800, fontSize: isMobile ? 34 : 56, lineHeight: 1.15,
            color: 'var(--text-primary)', marginBottom: 20, letterSpacing: '-1px',
          }}>
            {t('landing.heading1')}<br />
            <span style={{ color: '#FBC02D' }}>{t('landing.heading2')}</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1.6, marginBottom: 16, fontFamily: 'IBM Plex Sans' }}>
            {t('landing.subtitle')}
          </p>
          <p style={{ color: '#64748B', fontSize: 14, lineHeight: 1.6, marginBottom: 36, fontFamily: 'IBM Plex Sans', maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
            Not a chatbot bolted onto your PMS — <span style={{ color: 'var(--text-secondary)' }}>a multi-agent AI platform that runs full workflows end-to-end: triage, dispatch, follow-up, and reporting, autonomously.</span>
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/signup" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)',
              padding: '14px 28px', borderRadius: 10, textDecoration: 'none',
              fontSize: 16, fontWeight: 700, fontFamily: 'Syne',
            }}>
              {t('landing.startTrial')} <ChevronRight size={18} />
            </Link>
            <button onClick={handleViewDemo} disabled={demoLoading} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--hover-overlay)', color: '#E2E8F0', border: '1px solid var(--border-strong)',
              padding: '14px 28px', borderRadius: 10, cursor: demoLoading ? 'default' : 'pointer',
              fontSize: 16, fontWeight: 500, fontFamily: 'IBM Plex Sans', opacity: demoLoading ? 0.6 : 1,
            }}>
              {demoLoading ? '...' : t('landing.viewDemo')}
            </button>
          </div>
          <p style={{ marginTop: 16, fontSize: 12, color: '#475569', fontFamily: 'IBM Plex Mono' }}>
            {t('landing.noCard')}
          </p>
        </section>

        {/* Stats */}
        <section style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          justifyItems: 'center', gap: isMobile ? 24 : 40, padding: isMobile ? '32px 24px' : '40px 24px',
          maxWidth: 900, margin: '0 auto',
          borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)',
        }}>
          {[['15hrs', 'Saved/week avg'], ['94%', 'Response rate'], ['3x', 'Faster maintenance'], ['47%', 'Less vacancy'], ['8', 'Languages supported']].map(([v, l]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 28, fontWeight: 600, color: '#FBC02D' }}>{v}</div>
              <div style={{ fontSize: 12, color: '#64748B', fontFamily: 'IBM Plex Sans', marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </section>

        {/* Moments — where the hours actually go */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px 40px' }}>
          <p style={{ textAlign: 'center', fontSize: 12, fontFamily: 'IBM Plex Mono', color: '#FBC02D', letterSpacing: '1px', marginBottom: 10, textTransform: 'uppercase' }}>
            Where the hours actually go
          </p>
          <h2 style={{ textAlign: 'center', fontFamily: 'Syne', fontWeight: 800, fontSize: 36, color: 'var(--text-primary)', marginBottom: 48, maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
            Three moments where PropAgent measurably changes your week.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {MOMENTS.map(m => (
              <div key={m.title} style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-strong)',
                borderRadius: 14, padding: '26px 24px', display: 'flex', flexDirection: 'column', gap: 14,
              }}>
                <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 17, color: 'var(--text-primary)' }}>{m.title}</div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic', fontFamily: 'IBM Plex Sans' }}>{m.quote}</p>
                <div style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#EF4444', letterSpacing: '0.3px' }}>{m.pain}</div>
                <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                <p style={{ fontSize: 14, lineHeight: 1.6, fontFamily: 'IBM Plex Sans' }}>
                  <span style={{ color: '#FBC02D', fontWeight: 700, fontFamily: 'Syne' }}>PropAgent → </span>
                  <span style={{ color: 'var(--text-secondary)' }}>{m.resolution}</span>
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Segments — built for how you manage */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
          <h2 style={{ textAlign: 'center', fontFamily: 'Syne', fontWeight: 800, fontSize: 32, color: 'var(--text-primary)', marginBottom: 40 }}>
            Built for how you manage
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {SEGMENTS.map(s => (
              <div key={s.title} style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-strong)',
                borderRadius: 14, padding: '24px', borderTop: '3px solid #FBC02D',
              }}>
                <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 10 }}>{s.title}</div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: 'IBM Plex Sans' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 80px' }}>
          <h2 style={{ textAlign: 'center', fontFamily: 'Syne', fontWeight: 800, fontSize: 36, color: 'var(--text-primary)', marginBottom: 12 }}>
            Everything Automated
          </h2>
          <p style={{ textAlign: 'center', color: '#64748B', marginBottom: 48, fontFamily: 'IBM Plex Sans' }}>
            Seven specialized AI agents handle every aspect of property management
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-strong)',
                borderRadius: 12, padding: '24px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#FBC02D'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(var(--accent-rgb),0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <Icon size={20} color="#FBC02D" />
                </div>
                <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 8 }}>{title}</div>
                <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, fontFamily: 'IBM Plex Sans' }}>{desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ textAlign: 'center', padding: '60px 24px 80px', borderTop: '1px solid var(--border-subtle)' }}>
          <h2 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 40, color: 'var(--text-primary)', marginBottom: 16 }}>
            Ready to automate?
          </h2>
          <Link href="/signup" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)',
            padding: '16px 32px', borderRadius: 10, textDecoration: 'none',
            fontSize: 16, fontWeight: 700, fontFamily: 'Syne',
          }}>
            Start Your Free Trial <ChevronRight size={18} />
          </Link>
        </section>

        <footer style={{ textAlign: 'center', padding: '20px', borderTop: '1px solid var(--border-subtle)', color: '#334155', fontSize: 12, fontFamily: 'IBM Plex Mono' }}>
          © {new Date().getFullYear()} PropAgent AI · AI-Powered Property Management
          <span style={{ margin: '0 8px' }}>·</span>
          <Link href="/terms" style={{ color: '#475569', textDecoration: 'none' }}>Terms</Link>
          <span style={{ margin: '0 8px' }}>·</span>
          <Link href="/privacy" style={{ color: '#475569', textDecoration: 'none' }}>Privacy</Link>
        </footer>
      </div>
    </>
  );
}
