import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Zap, LogOut, LayoutDashboard, CreditCard, Wrench } from 'lucide-react';
import { isTenantAuthenticated, getTenant, clearTenantToken } from '../lib/tenantAuth';

const NAV = [
  { href: '/portal', key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/portal/payments', key: 'payments', label: 'Payments', icon: CreditCard },
  { href: '/portal/maintenance', key: 'maintenance', label: 'Maintenance', icon: Wrench },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const tenant = getTenant();

  useEffect(() => {
    if (!isTenantAuthenticated()) {
      router.push('/portal/login');
    } else {
      setReady(true);
    }
  }, []);

  const signOut = () => {
    clearTenantToken();
    router.push('/portal/login');
  };

  if (!ready) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#FBC02D', fontFamily: 'IBM Plex Mono' }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border-strong)', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={15} color="var(--bg-app)" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.1 }}>PropAgent AI</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>TENANT PORTAL</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {NAV.map(item => {
            const active = router.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.key} href={item.href} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8,
                  background: active ? 'rgba(251,192,45,0.12)' : 'transparent',
                  color: active ? '#FBC02D' : 'var(--text-secondary)', fontSize: 13, fontFamily: 'IBM Plex Sans', fontWeight: active ? 600 : 400,
                }}>
                  <Icon size={14} /> {item.label}
                </div>
              </Link>
            );
          })}
          <button onClick={signOut} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'IBM Plex Sans', cursor: 'pointer', marginLeft: 6 }}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </nav>
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px' }}>
        {children}
      </main>
    </div>
  );
}
