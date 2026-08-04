import Link from 'next/link';
import { Mail, Phone } from 'lucide-react';

export default function PublicFooter() {
  return (
    <footer style={{ textAlign: 'center', padding: '28px 20px', borderTop: '1px solid var(--border-subtle)', color: '#334155', fontSize: 12, fontFamily: 'IBM Plex Mono' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 12, color: '#64748B' }}>
        <a href="mailto:support@propagent.app" style={{ color: '#64748B', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Mail size={13} /> support@propagent.app
        </a>
        <a href="tel:+16175003821" style={{ color: '#64748B', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Phone size={13} /> (617) 500-3821
        </a>
      </div>
      © {new Date().getFullYear()} PropAgent AI · AI-Powered Property Management
      <span style={{ margin: '0 8px' }}>·</span>
      <Link href="/terms" style={{ color: '#475569', textDecoration: 'none' }}>Terms</Link>
      <span style={{ margin: '0 8px' }}>·</span>
      <Link href="/privacy" style={{ color: '#475569', textDecoration: 'none' }}>Privacy</Link>
    </footer>
  );
}
