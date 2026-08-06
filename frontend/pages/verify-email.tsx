import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { Zap, CheckCircle, XCircle } from 'lucide-react';
import { auth } from '../lib/api';

export default function VerifyEmail() {
  const router = useRouter();
  const { token } = router.query;
  const [status, setStatus] = useState<'checking' | 'success' | 'error'>('checking');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!router.isReady) return;
    if (typeof token !== 'string') { setStatus('error'); setError('Missing verification token.'); return; }
    auth.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err: any) => { setStatus('error'); setError(err?.response?.data?.detail || 'This verification link is invalid or has expired.'); });
  }, [router.isReady, token]);

  return (
    <>
      <Head>
        <title>Verify Email — PropAgent AI</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 420, padding: '0 24px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} color="var(--bg-app)" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 20, color: 'var(--text-primary)' }}>PropAgent AI</span>
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 32 }}>
            {status === 'checking' && <p style={{ color: '#64748B', fontFamily: 'IBM Plex Mono', fontSize: 13 }}>Verifying...</p>}
            {status === 'success' && (
              <>
                <CheckCircle size={32} color="#10B981" style={{ marginBottom: 14 }} />
                <h1 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', marginBottom: 6 }}>Email verified</h1>
                <p style={{ color: '#64748B', fontSize: 13.5, fontFamily: 'IBM Plex Sans', marginBottom: 20 }}>You're all set.</p>
                <Link href="/dashboard" style={{ color: '#FBC02D', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>Go to dashboard</Link>
              </>
            )}
            {status === 'error' && (
              <>
                <XCircle size={32} color="#EF4444" style={{ marginBottom: 14 }} />
                <h1 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', marginBottom: 6 }}>Couldn't verify</h1>
                <p style={{ color: '#64748B', fontSize: 13.5, fontFamily: 'IBM Plex Sans', marginBottom: 20 }}>{error} You can request a new link from your dashboard.</p>
                <Link href="/login" style={{ color: '#FBC02D', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>Back to sign in</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
