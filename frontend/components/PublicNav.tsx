import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Zap, Menu, X } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { useSidebar } from '../lib/SidebarContext';
import { isAuthenticated } from '../lib/auth';

// One nav for every public page. Before this, each page carried its own
// hand-copied nav: /compare, /security, /api-docs, /privacy and /terms had a
// logo and nothing else (no way to sign up or move around), /contact and
// /listings used different padding and a smaller logo, and only /pricing and
// /demo had a sign-in link. Same height, spacing, links and CTA everywhere now.

const CTA_STYLE: React.CSSProperties = {
  background: '#FBC02D', color: '#060B18', borderRadius: 12, textDecoration: 'none',
  fontWeight: 700, fontFamily: 'Syne', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center',
};

export default function PublicNav() {
  const { t } = useLanguage();
  const { isMobile } = useSidebar();
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => { setAuthed(isAuthenticated()); }, []);
  useEffect(() => {
    const close = () => setOpen(false);
    router.events.on('routeChangeStart', close);
    return () => router.events.off('routeChangeStart', close);
  }, [router.events]);
  useEffect(() => { if (!isMobile) setOpen(false); }, [isMobile]);

  const links = [
    { href: '/listings', label: 'Browse Rentals' },
    { href: '/pricing', label: t('landing.pricing') },
    { href: '/resources', label: 'Resources' },
    { href: '/contact', label: 'Contact' },
  ];
  const isActive = (href: string) => router.pathname === href || router.pathname.startsWith(href + '/');

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 100 }}>
      <nav aria-label="Main" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box',
        height: isMobile ? 60 : 68, padding: isMobile ? '0 16px' : '0 48px',
        borderBottom: '1px solid var(--border-subtle)', background: 'color-mix(in srgb, var(--bg-app) 92%, transparent)', backdropFilter: 'blur(12px)',
      }}>
        <Link href="/" className="pa-focus" aria-label="PropAgent AI home" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', minWidth: 0, borderRadius: 8 }}>
          <span style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={16} color="#060B18" strokeWidth={2.5} />
          </span>
          <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>PropAgent AI</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 28 }}>
          {!isMobile && links.map(l => (
            <Link key={l.href} href={l.href} className="pa-navlink pa-focus" aria-current={isActive(l.href) ? 'page' : undefined}>{l.label}</Link>
          ))}
          {authed ? (
            <Link href="/dashboard" className="pa-btn pa-btn-primary pa-focus" style={{ ...CTA_STYLE, padding: isMobile ? '8px 14px' : '9px 18px', fontSize: 14 }}>Dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="pa-navlink pa-focus" aria-current={router.pathname === '/login' ? 'page' : undefined}>{t('landing.signIn')}</Link>
              <Link href="/signup" className="pa-btn pa-btn-primary pa-focus" style={{ ...CTA_STYLE, padding: isMobile ? '8px 14px' : '9px 18px', fontSize: 14 }}>{t('landing.getStarted')}</Link>
            </>
          )}
          {isMobile && (
            <button
              className="pa-focus" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="pa-mobile-menu"
              onClick={() => setOpen(o => !o)}
              style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 12, color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          )}
        </div>
      </nav>

      {isMobile && open && (
        <div id="pa-mobile-menu" style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-subtle)', padding: '8px 16px 16px', display: 'flex', flexDirection: 'column' }}>
          {links.map(l => (
            <Link key={l.href} href={l.href} className="pa-focus" aria-current={isActive(l.href) ? 'page' : undefined} style={{
              padding: '14px 4px', fontSize: 16, fontFamily: 'IBM Plex Sans', textDecoration: 'none', borderBottom: '1px solid var(--border-subtle)',
              color: isActive(l.href) ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isActive(l.href) ? 600 : 400,
            }}>{l.label}</Link>
          ))}
        </div>
      )}
    </div>
  );
}
