import Link from 'next/link';
import { Mail, Phone, MapPin } from 'lucide-react';

// Colors come from the theme tokens (the old footer hardcoded #334155 / #475569,
// which measured 1.8:1 and 2.6:1 against the dark background, and were
// unreadable outright on the light theme). Links use .pa-textlink from
// styles/globals.css for the hover underline and keyboard focus ring.
const LEGAL_LINKS = [
  { href: '/resources', label: 'Resources' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/security', label: 'Security' },
  { href: '/api-docs', label: 'API Docs' },
];

export default function PublicFooter() {
  return (
    <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '32px 20px 36px', fontSize: 13, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px 24px', flexWrap: 'wrap' }}>
          <a href="mailto:propagentapp@gmail.com" className="pa-textlink pa-focus" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Mail size={14} aria-hidden="true" /> propagentapp@gmail.com
          </a>
          <a href="tel:+16175003821" className="pa-textlink pa-focus" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Phone size={14} aria-hidden="true" /> (617) 500-3821
          </a>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={14} aria-hidden="true" /> 9169 W State St #3241, Garden City, ID 83714
          </span>
        </div>
        <nav aria-label="Footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px 24px', flexWrap: 'wrap' }}>
          {LEGAL_LINKS.map(l => (
            <Link key={l.href} href={l.href} className="pa-textlink pa-focus">{l.label}</Link>
          ))}
        </nav>
        <div>© {new Date().getFullYear()} PropAgent AI. AI-Powered Property Management</div>
      </div>
    </footer>
  );
}
