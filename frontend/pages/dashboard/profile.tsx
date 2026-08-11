import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/DashboardLayout';
import TutorialWalkthrough from '../../components/TutorialWalkthrough';
import { User, Mail, Building2, CreditCard, Shield, Globe, ChevronRight, Gift, Copy, Check } from 'lucide-react';
import { auth, billing } from '../../lib/api';
import { getUser } from '../../lib/auth';
import { useLanguage } from '../../lib/LanguageContext';
import { LANGUAGES } from '../../lib/translations';
import { useSidebar } from '../../lib/SidebarContext';

export default function Profile() {
  const [me, setMe] = useState<any>(getUser() || {});
  const [plans, setPlans] = useState<any[]>([]);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [referral, setReferral] = useState<{ referral_code: string; referral_credits_earned: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const { language } = useLanguage();
  const { isMobile } = useSidebar();
  const currentLang = LANGUAGES.find(l => l.code === language);

  useEffect(() => {
    auth.me().then(r => setMe((prev: any) => ({ ...prev, ...r.data }))).catch(() => {});
    billing.plans().then(r => setPlans(r.data?.plans || [])).catch(() => {});
    auth.referral().then(r => setReferral(r.data)).catch(() => {});
  }, []);

  const currentPlan = plans.find(p => p.key === me.plan);
  const referralLink = referral ? `https://propagent.app/signup?ref=${referral.referral_code}` : '';

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

  const copyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('Signup link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — copy it manually instead.');
    }
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1100 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)', marginBottom: 4 }}>Profile</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Your account, and a quick tour of what PropAgent AI can do.</p>
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
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{me.role || ''}</div>
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
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>${currentPlan.price}/mo</div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {currentPlan.features?.slice(0, 4).map((f: string) => (
                      <li key={f} style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Sans' }}>· {f}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading plan...</div>
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
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                Manage Subscription lets you change plans, update your payment method, or cancel — handled securely by Stripe.
              </p>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Gift size={16} color="#FBC02D" />
                <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Refer a Friend</h3>
              </div>
              {referral ? (
                <>
                  <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
                    Share your link. When someone signs up and converts to a paid plan, you earn a free-month credit.
                  </p>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginBottom: 4 }}>YOUR REFERRAL CODE</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#FBC02D', fontFamily: 'IBM Plex Mono', letterSpacing: 1 }}>{referral.referral_code}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <input
                      readOnly
                      value={referralLink}
                      onFocus={(e) => e.target.select()}
                      style={{ flex: 1, minWidth: 0, padding: '9px 10px', borderRadius: 8, background: 'var(--bg-app)', border: '1px solid var(--border-input)', color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'IBM Plex Mono' }}
                    />
                    <button
                      onClick={copyReferralLink}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, background: 'rgba(var(--accent-rgb),0.1)', border: '1px solid rgba(var(--accent-rgb),0.3)', color: '#FBC02D', fontSize: 12.5, fontFamily: 'Syne', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Free-month credits earned</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Syne' }}>{referral.referral_credits_earned}</span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading your referral link...</div>
              )}
            </div>

            <Link href="/dashboard/language" style={{ textDecoration: 'none' }}>
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Globe size={18} color="#FBC02D" />
                  <div>
                    <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Language</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{currentLang?.flag} {currentLang?.nativeName}</div>
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
      <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>{label.toUpperCase()}</div>
        <div style={{ fontSize: 13, color: '#E2E8F0', fontFamily: 'IBM Plex Sans', textTransform: capitalize ? 'capitalize' : 'none' }}>{value || '—'}</div>
      </div>
    </div>
  );
}
