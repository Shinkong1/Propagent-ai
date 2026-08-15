import Head from 'next/head';
import Link from 'next/link';
import { Zap, ArrowRight, ShieldCheck, Wrench, Sparkles, ListChecks, DollarSign } from 'lucide-react';
import PublicFooter from '../../components/PublicFooter';
import { isAuthenticated } from '../../lib/auth';

const SITE_URL = 'https://propagent.app';

const ARTICLES = [
  {
    slug: 'how-to-screen-tenants',
    icon: ShieldCheck,
    title: 'How to Screen Tenants: A Practical, Fair Process',
    dek: 'A step-by-step tenant screening process -- what to check, in what order, and how to stay consistent from one applicant to the next.',
    readTime: '9 min read',
  },
  {
    slug: 'property-management-software-features',
    icon: ListChecks,
    title: 'Property Management Software Features to Look For',
    dek: "A buying guide: what to actually check before picking property management software, and which 'AI-powered' claims deserve scrutiny.",
    readTime: '10 min read',
  },
  {
    slug: 'handling-maintenance-requests',
    icon: Wrench,
    title: 'How to Handle Maintenance Requests Efficiently',
    dek: 'A practical system for triaging, assigning, and closing out tenant maintenance requests -- without a spreadsheet or a group text.',
    readTime: '8 min read',
  },
  {
    slug: 'ai-in-property-management',
    icon: Sparkles,
    title: "AI in Property Management: What It Can (and Can't) Do Well",
    dek: "A plain, non-hype explanation of what AI actually does in property management software today -- and where it still needs a human.",
    readTime: '9 min read',
  },
  {
    slug: 'rent-collection-best-practices',
    icon: DollarSign,
    title: 'Rent Collection Best Practices: A Guide for Landlords',
    dek: 'How to set up a rent collection process that gets paid on time more often -- online payments, late fee policy, and a consistent escalation process.',
    readTime: '8 min read',
  },
];

export default function ResourcesIndex() {
  return (
    <>
      <Head>
        <title>Resources for Landlords & Property Managers | PropAgent AI</title>
        <meta name="description" content="Practical, honest guides on tenant screening, maintenance, rent collection, AI in property management, and choosing property management software." />
        <link rel="canonical" href={`${SITE_URL}/resources`} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE_URL}/resources`} />
        <meta property="og:title" content="Resources for Landlords & Property Managers | PropAgent AI" />
        <meta property="og:description" content="Practical, honest guides on tenant screening, maintenance, rent collection, AI in property management, and choosing property management software." />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg-app)', color: '#E2E8F0' }}>
        <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 48px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={16} color="var(--bg-app)" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>PropAgent AI</span>
          </Link>
          <Link href={isAuthenticated() ? '/dashboard' : '/login'} style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14 }}>
            {isAuthenticated() ? 'Dashboard' : 'Sign in'}
          </Link>
        </nav>

        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '64px 24px 80px' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 42, color: 'var(--text-primary)', marginBottom: 14 }}>Resources</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 16, fontFamily: 'IBM Plex Sans', maxWidth: 620, margin: '0 auto', lineHeight: 1.7 }}>
              Practical guides on running rental property day-to-day -- tenant screening, maintenance, rent
              collection, and what AI actually does (and doesn&apos;t) in this space. Written to be useful whether or
              not you ever use PropAgent AI.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {ARTICLES.map(article => (
              <Link key={article.slug} href={`/resources/${article.slug}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16,
                  padding: 26, height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(251,192,45,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, flexShrink: 0 }}>
                    <article.icon size={17} color="#FBC02D" strokeWidth={2.25} />
                  </div>
                  <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 17, color: 'var(--text-primary)', marginBottom: 10, lineHeight: 1.35 }}>
                    {article.title}
                  </h2>
                  <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-secondary)', marginBottom: 18, flexGrow: 1 }}>
                    {article.dek}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--text-muted)' }}>
                    <span>{article.readTime}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#FBC02D', fontWeight: 600 }}>
                      Read <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 14, background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: '32px 28px', textAlign: 'center', flexDirection: 'column', alignItems: 'center', marginTop: 48 }}>
            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 22, color: 'var(--text-primary)' }}>
              Looking for the product, not the reading?
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 520, lineHeight: 1.7 }}>
              See PropAgent AI&apos;s full feature set and pricing, browse listings currently posted on the platform,
              or see how it compares to traditional property management software.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
              <Link href="/pricing" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)',
                fontFamily: 'Syne', fontWeight: 700, fontSize: 14, padding: '12px 24px', borderRadius: 8,
                textDecoration: 'none',
              }}>
                View Pricing <ArrowRight size={15} />
              </Link>
              <Link href="/compare" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'transparent', color: '#E2E8F0', border: '1px solid var(--border-strong)',
                fontFamily: 'Syne', fontWeight: 700, fontSize: 14, padding: '12px 24px', borderRadius: 8,
                textDecoration: 'none',
              }}>
                Compare Platforms
              </Link>
              <Link href="/listings" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'transparent', color: '#E2E8F0', border: '1px solid var(--border-strong)',
                fontFamily: 'Syne', fontWeight: 700, fontSize: 14, padding: '12px 24px', borderRadius: 8,
                textDecoration: 'none',
              }}>
                Browse Listings
              </Link>
            </div>
          </div>
        </div>
        <PublicFooter />
      </div>
    </>
  );
}
