import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/DashboardLayout';
import TutorialWalkthrough from '../../components/TutorialWalkthrough';
import { User, Mail, Building2, CreditCard, Shield, Globe, ChevronRight } from 'lucide-react';
import { auth, billing } from '../../lib/api';
import { getUser } from '../../lib/auth';
import { useLanguage } from '../../lib/LanguageContext';
import { LANGUAGES } from '../../lib/translations';
import { useSidebar } from '../../lib/SidebarContext';

export default function Profile() {
  const [me, setMe] = useState<any>(getUser() || {});
  const [plans, setPlans] = useState<any[]>([]);
  const [openingPortal, setOpeningPortal] = useState(false);
  const { language } = useLanguage();
  const { isMobile } = useSidebar();
  const currentLang = LANGUAGES.find(l => l.code === language);

  useEffect(() => {
    auth.me().then(r => setMe((prev: any) => ({ ...prev, ...r.data }))).catch(() => {});
    billing.plans().then(r => setPlans(r.data?.plans || [])).catch(() => {});
  }, []);

  const currentPlan = plans.find(p => p.key === me.plan);

  const openBillingPortal = async () => {
    setOpeningPortal(true);
    try {
      const res = await billing.portal();
      window.location.href = res.data.url;
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Could not open the billing portal.');
      setOpeningPortal(false);
    }
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1100 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)', marginBottom: 4 }}>Profile</h1>
          <p style={{ color: '#64748B', fontSize: 14 }}>Your account, and a quick tour of what PropAgent AI can do.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '340px 1fr', gap: 24, alignItems: 'start' }}>
          {/* Account info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #FBC02D, #F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, color: 'var(--bg-app)', fontFamily: 'Syne' }}>
                  {me.full_name?.split(' ').map((n: string) => n[0]).join('') || '?'}
                </div>
                <div>
                  <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{me.full_name || 'Loading...'}</div>
                  <div style={{ fontSize: 12, color: '#64748B', textTransform: 'capitalize' }}>{me.role || ''}</div>
                </div>
              </div>

              <InfoRow icon={<Mail size={14} />} label="Email" value={me.email} />
              <InfoRow icon={<Building2 size={14} />} label="Organization ID" value={me.organization_id?.slice(0, 8)} />
              <InfoRow icon={<Shield size={14} />} label="Role" value={me.role} capitalize />
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <CreditCard size={16} color="#FBC02D" />
                <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Current Plan</h3>
              </div>
              {currentPlan ? (
                <>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#FBC02D', fontFamily: 'Syne', marginBottom: 4 }}>{currentPlan.name}</div>
                  <div style={{ fontSize: 13, color: '#64748B', marginBottom: 14 }}>${currentPlan.price}/mo</div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {currentPlan.features?.slice(0, 4).map((f: string) => (
                      <li key={f} style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Sans' }}>· {f}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <div style={{ fontSize: 13, color: '#64748B' }}>Loading plan...</div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <a href="/pricing" style={{ flex: 1, display: 'block', textAlign: 'center', padding: '9px', borderRadius: 8, background: 'rgba(var(--accent-rgb),0.1)', border: '1px solid rgba(var(--accent-rgb),0.3)', color: '#FBC02D', fontSize: 13, fontFamily: 'Syne', fontWeight: 600, textDecoration: 'none' }}>
                  View Plans
                </a>
                <button
                  onClick={openBillingPortal}
                  disabled={openingPortal}
                  style={{ flex: 1, textAlign: 'center', padding: '9px', borderRadius: 8, background: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'Syne', fontWeight: 600, cursor: 'pointer' }}
                >
                  {openingPortal ? '...' : 'Manage Subscription'}
                </button>
              </div>
              <p style={{ fontSize: 11, color: '#64748B', marginTop: 8, textAlign: 'center' }}>
                Manage Subscription lets you change plans, update your payment method, or cancel — handled securely by Stripe.
              </p>
            </div>

            <Link href="/dashboard/language" style={{ textDecoration: 'none' }}>
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Globe size={18} color="#FBC02D" />
                  <div>
                    <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Language</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>{currentLang?.flag} {currentLang?.nativeName}</div>
                  </div>
                </div>
                <ChevronRight size={16} color="#64748B" />
              </div>
            </Link>

          </div>

          {/* Tutorial */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <User size={16} color="var(--text-secondary)" />
              <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Getting Started Tour</h3>
            </div>
            <TutorialWalkthrough />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function InfoRow({ icon, label, value, capitalize }: { icon: React.ReactNode; label: string; value?: string; capitalize?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border-subtle)' }}>
      <span style={{ color: '#64748B' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: '#64748B', fontFamily: 'IBM Plex Mono' }}>{label.toUpperCase()}</div>
        <div style={{ fontSize: 13, color: '#E2E8F0', fontFamily: 'IBM Plex Sans', textTransform: capitalize ? 'capitalize' : 'none' }}>{value || '—'}</div>
      </div>
    </div>
  );
}
