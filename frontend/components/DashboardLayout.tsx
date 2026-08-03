import Sidebar, { SIDEBAR_WIDTH_EXPANDED, SIDEBAR_WIDTH_COLLAPSED } from './Sidebar';
import OnboardingTour from './OnboardingTour';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getToken, getUser } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { useTutorial } from '../lib/TutorialContext';
import { useSidebar } from '../lib/SidebarContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useLanguage();
  const { autoStartIfNeeded } = useTutorial();
  const { collapsed } = useSidebar();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
    } else {
      setReady(true);
    }
  }, []);

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
      <main style={{ marginLeft: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED, flex: 1, minWidth: 0, padding: '32px', minHeight: '100vh', transition: 'margin-left 0.18s ease' }}>
        {children}
      </main>
      <OnboardingTour />
    </div>
  );
}
