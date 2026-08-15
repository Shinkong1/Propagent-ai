import Link from 'next/link';
import { Zap, ArrowLeft, ArrowRight } from 'lucide-react';
import PublicFooter from './PublicFooter';
import { isAuthenticated } from '../lib/auth';

// Shared chrome for /resources articles -- nav + title block + footer, built
// to match the header/footer pattern already used on pricing.tsx, compare.tsx,
// and security.tsx (same logo mark, Syne/IBM Plex Mono/Sans fonts, --bg-app/
// --bg-surface/--border-strong/--text-* variables, #FBC02D accent). Factored
// out here (rather than re-pasted per article, the pattern the rest of the
// public pages use) because /resources adds six pages that all share this
// exact shell -- pasting it six times would just be six places to drift out
// of sync with the design system.
export default function ArticleLayout({ eyebrow, title, dek, readTime, children }: {
  eyebrow?: string;
  title: string;
  dek?: string;
  readTime?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', color: '#E2E8F0' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 48px', borderBottom: '1px solid var(--border-subtle)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={16} color="var(--bg-app)" strokeWidth={2.5} />
          </div>
          <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>PropAgent AI</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link href="/resources" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14, fontFamily: 'IBM Plex Sans' }}>Resources</Link>
          <Link href={isAuthenticated() ? '/dashboard' : '/login'} style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14 }}>
            {isAuthenticated() ? 'Dashboard' : 'Sign in'}
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '56px 24px 32px' }}>
        <Link href="/resources" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13, fontFamily: 'IBM Plex Mono', marginBottom: 28 }}>
          <ArrowLeft size={13} /> All resources
        </Link>

        {eyebrow && (
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, fontWeight: 600, color: '#FBC02D', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 12 }}>
            {eyebrow}
          </div>
        )}
        <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 36, color: 'var(--text-primary)', marginBottom: 14, lineHeight: 1.2 }}>{title}</h1>
        {dek && (
          <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: 14, maxWidth: 680 }}>{dek}</p>
        )}
        {readTime && (
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--text-muted)', marginBottom: 36, paddingBottom: 28, borderBottom: '1px solid var(--border-subtle)' }}>{readTime}</div>
        )}

        <article>{children}</article>
      </div>
      <PublicFooter />
    </div>
  );
}

// Shared "prose" typography for article bodies -- kept here so every
// /resources page renders identically instead of five slightly-different
// copies of the same heading/paragraph/list styles.
export const h2: React.CSSProperties = { fontFamily: 'Syne', fontWeight: 700, fontSize: 22, color: 'var(--text-primary)', margin: '36px 0 14px' };
export const h3: React.CSSProperties = { fontFamily: 'Syne', fontWeight: 700, fontSize: 17, color: 'var(--text-primary)', margin: '26px 0 10px' };
export const p: React.CSSProperties = { fontSize: 15, lineHeight: 1.8, color: 'var(--text-secondary)', marginBottom: 16, fontFamily: 'IBM Plex Sans' };
export const ul: React.CSSProperties = { listStyle: 'disc', margin: '0 0 16px', padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: 8 };
export const li: React.CSSProperties = { fontSize: 15, lineHeight: 1.75, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Sans' };
export const a: React.CSSProperties = { color: '#FBC02D', textDecoration: 'none', fontWeight: 600 };

export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(251,192,45,0.08)', border: '1px solid rgba(251,192,45,0.25)', borderRadius: 12, padding: '16px 18px', margin: '24px 0', fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
      {children}
    </div>
  );
}

export function CTABox({ heading, body }: { heading: string; body: string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: '28px 26px', textAlign: 'center', marginTop: 44 }}>
      <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 19, color: 'var(--text-primary)', marginBottom: 8 }}>{heading}</h2>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto 18px', lineHeight: 1.7 }}>{body}</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
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
  );
}
