'use client';
import { useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import styles from '../../styles/Landing.module.css';
import { auth } from '../../lib/api';
import { isAuthenticated, setToken, setUser } from '../../lib/auth';

// "View Demo Dashboard": drops a visitor into the shared demo account with no
// signup (POST /auth/demo-login issues a token without credentials). This
// button lived on the old homepage and was lost when the landing page was
// replaced -- it's back here.
//
// If this browser already has a real session, go to that dashboard instead of
// logging in as the demo user -- otherwise clicking this while signed in as the
// owner (or a customer) would silently replace their session with the demo one.
export default function DemoDashboardButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const open = async () => {
    if (isAuthenticated()) {
      router.push('/dashboard');
      return;
    }
    setLoading(true);
    try {
      const res = await auth.demoLogin();
      setToken(res.data.access_token);
      setUser(res.data);
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'The demo is unavailable right now. Please try again in a minute.');
      setLoading(false);
    }
  };

  return (
    <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={open} disabled={loading}>
      {loading ? 'Opening demo…' : 'View demo dashboard'}
    </button>
  );
}
