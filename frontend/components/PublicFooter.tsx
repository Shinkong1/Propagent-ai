import Link from 'next/link';
import { Mail, Phone, MapPin } from 'lucide-react';

export default function PublicFooter() {
  return (
    <footer style={{ textAlign: 'center', padding: '28px 20px', borderTop: '1px solid var(--border-subtle)', color: '#334155', fontSize: 12, fontFamily: 'IBM Plex Mono' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 12, color: 'var(--text-muted)' }}>
        <a href="mailto:propagentapp@gmail.com" style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Mail size={13} /> propagentapp@gmail.com
        </a>
        <a href="tel:+16175003821" style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Phone size={13} /> (617) 500-3821
        </a>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={13} /> 9169 W State St #3241, Garden City, ID 83714
        </span>
      </div>
      © {new Date().getFullYear()} PropAgent AI · AI-Powered Property Management
      <span style={{ margin: '0 8px' }}>·</span>
      <Link href="/terms" style={{ color: '#475569', textDecoration: 'none' }}>Terms</Link>
      <span style={{ margin: '0 8px' }}>·</span>
      <Link href="/privacy" style={{ color: '#475569', textDecoration: 'none' }}>Privacy</Link>
      <span style={{ margin: '0 8px' }}>·</span>
      <Link href="/security" style={{ color: '#475569', textDecoration: 'none' }}>Security</Link>
      <span style={{ margin: '0 8px' }}>·</span>
      <Link href="/api-docs" style={{ color: '#475569', textDecoration: 'none' }}>API Docs</Link>
    </footer>
  );
}
