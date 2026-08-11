import Head from 'next/head';
import Link from 'next/link';
import { Zap, Check, X, Minus, ArrowRight } from 'lucide-react';
import PublicFooter from '../components/PublicFooter';

type Cell = { state: 'yes' | 'no' | 'partial'; note?: string };

const ROWS: { feature: string; propagent: Cell; traditional: Cell; manual: Cell }[] = [
  {
    feature: 'AI chat support for tenants & prospects',
    propagent: { state: 'yes' },
    traditional: { state: 'no', note: 'Not built in' },
    manual: { state: 'no' },
  },
  {
    feature: 'Voice AI call center (answers & routes calls)',
    propagent: { state: 'yes', note: 'Professional plan and up' },
    traditional: { state: 'no', note: 'Not built in' },
    manual: { state: 'no' },
  },
  {
    feature: 'Executive AI Assistant',
    propagent: { state: 'yes', note: 'Professional plan and up' },
    traditional: { state: 'no' },
    manual: { state: 'no' },
  },
  {
    feature: 'Maintenance ticket tracking',
    propagent: { state: 'yes' },
    traditional: { state: 'yes' },
    manual: { state: 'partial', note: 'Manual spreadsheet or email tracking' },
  },
  {
    feature: 'Document uploads & search',
    propagent: { state: 'yes' },
    traditional: { state: 'yes' },
    manual: { state: 'partial', note: 'Shared drive, no real search' },
  },
  {
    feature: 'Rental inquiry & prospect tracking',
    propagent: { state: 'yes' },
    traditional: { state: 'yes' },
    manual: { state: 'partial', note: 'Usually a separate spreadsheet' },
  },
  {
    feature: 'AI lease & notice generation',
    propagent: { state: 'yes', note: 'Professional plan and up' },
    traditional: { state: 'no' },
    manual: { state: 'no' },
  },
  {
    feature: 'AI inspection photo damage detection',
    propagent: { state: 'yes', note: 'Professional plan and up' },
    traditional: { state: 'no' },
    manual: { state: 'no' },
  },
  {
    feature: 'Automated compliance, collections & communications agents',
    propagent: { state: 'yes', note: 'Professional plan and up' },
    traditional: { state: 'no' },
    manual: { state: 'no' },
  },
  {
    feature: 'Portfolio dashboard & investment analysis',
    propagent: { state: 'yes', note: 'Enterprise plan' },
    traditional: { state: 'partial', note: 'Often a separate paid module' },
    manual: { state: 'no' },
  },
  {
    feature: 'Custom integrations (public REST API)',
    propagent: { state: 'yes', note: 'Enterprise plan — see API Docs' },
    traditional: { state: 'partial', note: 'Varies by vendor/tier' },
    manual: { state: 'no' },
  },
  {
    feature: 'Pricing model',
    propagent: { state: 'yes', note: 'Flat monthly tiers, starting at $49/mo' },
    traditional: { state: 'partial', note: 'Typically per-unit — scales up fast on larger portfolios' },
    manual: { state: 'yes', note: 'Free, but costs staff time instead' },
  },
  {
    feature: 'Setup & onboarding',
    propagent: { state: 'yes', note: '14-day free trial, no setup fees' },
    traditional: { state: 'partial', note: 'Often longer contracts and onboarding' },
    manual: { state: 'yes', note: 'Nothing to set up' },
  },
  {
    feature: 'Interface',
    propagent: { state: 'yes', note: 'Built recently, modern web app' },
    traditional: { state: 'partial', note: 'Widely known for a dated, enterprise-era UI' },
    manual: { state: 'no', note: 'No unified interface at all' },
  },
];

export default function Compare() {
  return (
    <>
      <Head>
        <title>PropAgent AI vs. Traditional Property Management Software</title>
        <meta name="description" content="How PropAgent AI compares to traditional property management software (like AppFolio and Buildium) and to running things on spreadsheets." />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg-app)', color: '#E2E8F0' }}>
        <nav style={{ display: 'flex', alignItems: 'center', padding: '20px 48px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={16} color="var(--bg-app)" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>PropAgent AI</span>
          </Link>
        </nav>

        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '64px 24px 80px' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 40, color: 'var(--text-primary)', marginBottom: 14 }}>
              PropAgent AI vs. Traditional Property Management
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 16, fontFamily: 'IBM Plex Sans', maxWidth: 680, margin: '0 auto', lineHeight: 1.7 }}>
              A straight comparison of what&apos;s actually built into PropAgent AI today against what&apos;s
              generally true of legacy property management platforms (like AppFolio and Buildium) — and against
              running a portfolio on spreadsheets and email.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12, background: 'rgba(251,192,45,0.08)', border: '1px solid rgba(251,192,45,0.25)', borderRadius: 12, padding: '16px 18px', marginBottom: 40, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <p style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              We named AppFolio and Buildium because they&apos;re the platforms prospective customers usually ask
              us about. We don&apos;t have access to their current internal pricing or roadmaps, so the
              &quot;Traditional PM Software&quot; column reflects general, well-known industry reputation (per-unit
              pricing, legacy UI, limited built-in AI) rather than a line-by-line audit of any single vendor&apos;s
              product today. Every claim in the PropAgent AI column reflects what&apos;s actually shipped in the
              product, matching our <Link href="/pricing" style={{ color: '#FBC02D' }}>Pricing</Link> page.
            </p>
          </div>

          <div style={{ overflowX: 'auto', marginBottom: 40 }}>
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 14 }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left', minWidth: 260 }}>Feature</th>
                  <th style={{ ...th, color: '#FBC02D' }}>PropAgent AI</th>
                  <th style={th}>Traditional PM Software</th>
                  <th style={th}>Manual / Spreadsheets</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, i) => (
                  <tr key={row.feature} style={{ background: i % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                    <td style={{ ...td, textAlign: 'left', fontFamily: 'IBM Plex Sans', color: 'var(--text-primary)', fontWeight: 500 }}>{row.feature}</td>
                    <td style={td}><CellIcon cell={row.propagent} highlight /></td>
                    <td style={td}><CellIcon cell={row.traditional} /></td>
                    <td style={td}><CellIcon cell={row.manual} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 14, background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: '32px 28px', textAlign: 'center', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 22, color: 'var(--text-primary)' }}>
              See it on your own portfolio
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 520, lineHeight: 1.7 }}>
              Start a 14-day free trial — no setup fees, no long-term contract. Or compare plans and pricing first.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
              <Link href="/signup" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)',
                fontFamily: 'Syne', fontWeight: 700, fontSize: 14, padding: '12px 24px', borderRadius: 8,
                textDecoration: 'none',
              }}>
                Start Free Trial <ArrowRight size={15} />
              </Link>
              <Link href="/pricing" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'transparent', color: '#E2E8F0', border: '1px solid var(--border-strong)',
                fontFamily: 'Syne', fontWeight: 700, fontSize: 14, padding: '12px 24px', borderRadius: 8,
                textDecoration: 'none',
              }}>
                View Pricing
              </Link>
            </div>
          </div>

          <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-muted)', textAlign: 'center' }}>
            Questions about a specific feature? <Link href="/contact" style={{ color: '#FBC02D' }}>Contact us</Link> or
            check the <Link href="/api-docs" style={{ color: '#FBC02D' }}>API Docs</Link> for integration details.
          </p>
        </div>
        <PublicFooter />
      </div>
    </>
  );
}

function CellIcon({ cell, highlight }: { cell: Cell; highlight?: boolean }) {
  const color = cell.state === 'yes' ? (highlight ? '#FBC02D' : '#22C55E') : cell.state === 'no' ? '#475569' : '#F59E0B';
  const Icon = cell.state === 'yes' ? Check : cell.state === 'no' ? X : Minus;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <Icon size={16} color={color} strokeWidth={2.5} />
      {cell.note && <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'IBM Plex Sans', lineHeight: 1.4, maxWidth: 150, textAlign: 'center' }}>{cell.note}</span>}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '14px 16px', fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: 'var(--text-secondary)',
  borderBottom: '1px solid var(--border-strong)', textAlign: 'center', whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '14px 16px', fontSize: 12.5, borderBottom: '1px solid var(--border-subtle)', textAlign: 'center', verticalAlign: 'top',
};
