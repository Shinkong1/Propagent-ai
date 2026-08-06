import Sidebar, { SIDEBAR_WIDTH_EXPANDED, SIDEBAR_WIDTH_COLLAPSED } from './Sidebar';
import OnboardingTour from './OnboardingTour';
import { Menu, MailWarning, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getToken, getUser } from '../lib/auth';
import { auth as authApi } from '../lib/api';
import { useLanguage } from '../lib/LanguageContext';
import { useTutorial } from '../lib/TutorialContext';
import { useSidebar } from '../lib/SidebarContext';
import toast from 'react-hot-toast';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useLanguage();
  const { autoStartIfNeeded } = useTutorial();
  const { collapsed, isMobile, setMobileOpen } = useSidebar();
  const [ready, setReady] = useState(false);
  const [showVerifyBanner, setShowVerifyBanner] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
    } else {
      setReady(true);
      // Only new signups are ever marked unverified -- existing sessions
      // predating this feature have no is_verified field cached at all and
      // correctly never see this.
      setShowVerifyBanner(getUser()?.is_verified === false && sessionStorage.getItem('hideVerifyBanner') !== '1');
    }
  }, []);

  const resendVerification = async () => {
    setResending(true);
    try {
      await authApi.resendVerification();
      toast.success('Verification email sent — check your inbox.');
    } catch {
      toast.error('Failed to send — try again shortly.');
    } finally {
      setResending(false);
    }
  };

  const dismissBanner = () => {
    sessionStorage.setItem('hideVerifyBanner', '1');
    setShowVerifyBanner(false);
  };

  useEffect(() => {
    if (ready) autoStartIfNeeded();
  }, [ready]);

  if (!ready) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#FBC02D', fontFamily: 'IBM Plex Mono' }}>{t('nav.loading')}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-app)' }}>
      <Sidebar />
      <main style={{
        marginLeft: isMobile ? 0 : (collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED),
        flex: 1, minWidth: 0, padding: isMobile ? '16px' : '32px', minHeight: '100vh',
        transition: 'margin-left 0.18s ease', maxWidth: '100%', overflowX: 'hidden',
      }}>
        {isMobile && (
          <button
            onClick={() => setMobileOpen(true)}
            aria-label={t('nav.expand')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 40, height: 40, borderRadius: 8, marginBottom: 16,
              background: 'var(--bg-surface)', border: '1px solid var(--border-strong)',
              color: 'var(--text-primary)', cursor: 'pointer',
            }}
          >
            <Menu size={18} />
          </button>
        )}
        {showVerifyBanner && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            background: 'rgba(251,192,45,0.08)', border: '1px solid rgba(251,192,45,0.3)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 20,
          }}>
            <MailWarning size={16} color="#FBC02D" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Sans', flex: 1 }}>
              Please verify your email address so you never lose access to your account.
            </span>
            <button onClick={resendVerification} disabled={resending} style={{
              padding: '5px 12px', borderRadius: 6, background: 'rgba(251,192,45,0.15)', border: '1px solid rgba(251,192,45,0.4)',
              color: '#FBC02D', fontSize: 12, fontFamily: 'Syne', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            }}>
              {resending ? 'Sending...' : 'Resend email'}
            </button>
            <button onClick={dismissBanner} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
              <X size={14} />
            </button>
          </div>
        )}
        {children}
      </main>
      <OnboardingTour />
    </div>
  );
}
