import { useEffect } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { auth } from '../../lib/api';
import { setToken, setUser, clearToken } from '../../lib/auth';

export default function OAuthCallback() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    const { token } = router.query;
    if (typeof token !== 'string' || !token) {
      router.replace('/login');
      return;
    }

    setToken(token);
    auth.me()
      .then(res => {
        const me = res.data;
        setUser({
          user_id: me.id,
          organization_id: me.organization_id,
          organization_name: me.organization_name,
          full_name: me.full_name,
          email: me.email,
          role: me.role,
          is_master: me.is_master,
          plan: me.plan,
          language: me.language,
          theme: me.theme,
          timezone: me.timezone,
          currency: me.currency,
          notify_email_enabled: me.notify_email_enabled,
          notify_sms_enabled: me.notify_sms_enabled,
        });
        toast.success('Welcome!');
        router.replace('/dashboard');
      })
      .catch(() => {
        clearToken();
        toast.error('Google sign-in failed');
        router.replace('/login');
      });
  }, [router.isReady, router.query.token]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontFamily: 'IBM Plex Sans', fontSize: 14 }}>Signing you in...</p>
    </div>
  );
}
