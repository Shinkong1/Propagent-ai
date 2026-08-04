import Head from 'next/head';
import Link from 'next/link';
import { Zap, Building2, MessageSquare, Wrench, Users, Phone, ChevronRight, Check } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

const FEATURES = [
  { icon: MessageSquare, title: 'AI Tenant Chat', desc: '24/7 automated responses to tenant queries, maintenance, and leasing questions.' },
  { icon: Wrench, title: 'Auto Maintenance', desc: 'AI classifies requests, creates tickets, and dispatches vendors automatically.' },
  { icon: Users, title: 'Lead Generation', desc: 'Scrape landlord data from Google, LinkedIn, and Zillow. Auto outreach sequences.' },
  { icon: Phone, title: 'Voice AI', desc: 'Inbound call AI handles tenants via Twilio — speech-to-text to agent pipeline.' },
  { icon: Building2, title: 'Portfolio Management', desc: 'Full property, unit, tenant, and lease management in one unified dashboard.' },
  { icon: Zap, title: 'Autonomous Agents', desc: 'LangGraph orchestrates 7 specialized agents working together automatically.' },
];

export default function Home() {
  const { t } = useLanguage();
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
          padding: '20px 48px', borderBottom: '1px solid var(--border-subtle)',
          position: 'sticky', top: 0, background: 'rgba(6,11,24,0.95)', backdropFilter: 'blur(12px)',
          zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={16} color="var(--bg-app)" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>PropAgent AI</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Link href="/pricing" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14, fontFamily: 'IBM Plex Sans' }}>{t('landing.pricing')}</Link>
            <Link href="/login" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14, fontFamily: 'IBM Plex Sans' }}>{t('landing.signIn')}</Link>
            <Link href="/signup" style={{
              background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)',
              padding: '8px 18px', borderRadius: 8, textDecoration: 'none',
              fontSize: 14, fontWeight: 700, fontFamily: 'Syne',
            }}>{t('landing.getStarted')}</Link>
          </div>
        </nav>

        {/* Hero */}
        <section style={{ textAlign: 'center', padding: '80px 24px 60px', maxWidth: 800, margin: '0 auto' }}>
          <div style={{
            display: 'inline-block', padding: '4px 14px', borderRadius: 100,
            background: 'rgba(var(--accent-rgb),0.12)', border: '1px solid rgba(var(--accent-rgb),0.3)',
            marginBottom: 24, fontSize: 12, fontFamily: 'IBM Plex Mono', color: '#FBC02D', letterSpacing: '1px',
          }}>
            {t('landing.tagline')}
          </div>
          <h1 style={{
            fontFamily: 'Syne', fontWeight: 800, fontSize: 56, lineHeight: 1.1,
            color: 'var(--text-primary)', marginBottom: 20, letterSpacing: '-1px',
          }}>
            {t('landing.heading1')}<br />
            <span style={{ color: '#FBC02D' }}>{t('landing.heading2')}</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1.6, marginBottom: 36, fontFamily: 'IBM Plex Sans' }}>
            {t('landing.subtitle')}
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
            <Link href="/dashboard" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--hover-overlay)', color: '#E2E8F0', border: '1px solid var(--border-strong)',
              padding: '14px 28px', borderRadius: 10, textDecoration: 'none',
              fontSize: 16, fontWeight: 500, fontFamily: 'IBM Plex Sans',
            }}>
              {t('landing.viewDemo')}
            </Link>
          </div>
          <p style={{ marginTop: 16, fontSize: 12, color: '#475569', fontFamily: 'IBM Plex Mono' }}>
            {t('landing.noCard')}
          </p>
        </section>

        {/* Stats */}
        <section style={{ display: 'flex', justifyContent: 'center', gap: 48, padding: '40px 24px', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
          {[['15hrs', 'Saved/week avg'], ['94%', 'Response rate'], ['3x', 'Faster maintenance'], ['47%', 'Less vacancy']].map(([v, l]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 28, fontWeight: 600, color: '#FBC02D' }}>{v}</div>
              <div style={{ fontSize: 12, color: '#64748B', fontFamily: 'IBM Plex Sans', marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </section>

        {/* Features */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px' }}>
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
