import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { Zap, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth, mfa as mfaApi, oauth } from '../lib/api';
import { setToken, setUser } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';

export default function Login() {
  const router = useRouter();
  const { t } = useLanguage();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    oauth.googleConfig().then(res => setGoogleEnabled(res.data.enabled)).catch(() => setGoogleEnabled(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await auth.login(form);
      if (res.data.mfa_required) {
        setMfaToken(res.data.mfa_token);
        return;
      }
      setToken(res.data.access_token);
      setUser(res.data);
      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaToken) return;
    setLoading(true);
    try {
      const res = await mfaApi.loginVerify(mfaToken, mfaCode);
      setToken(res.data.access_token);
      setUser(res.data);
      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Sign In — PropAgent AI</title>
        <meta name="description" content="Sign in to your PropAgent AI property management dashboard." />
        <meta name="robots" content="noindex" />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} color="var(--bg-app)" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 20, color: 'var(--text-primary)' }}>PropAgent AI</span>
          </div>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 24, color: 'var(--text-primary)', marginBottom: 6 }}>
            {mfaToken ? t('login.mfaTitle') : t('login.title')}
          </h1>
          <p style={{ color: '#64748B', fontSize: 14, fontFamily: 'IBM Plex Sans' }}>
            {mfaToken ? t('login.mfaSubtitle') : t('login.subtitle')}
          </p>
        </div>

        {mfaToken ? (
          <form onSubmit={handleMfaSubmit} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28 }}>
            <div style={{ marginBottom: 12 }}>
              <input
                type="text" required value={mfaCode} maxLength={9}
                onChange={e => setMfaCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                placeholder={t('login.mfaCodePlaceholder')}
                style={{ ...inputStyle, textAlign: 'center', fontSize: 22, letterSpacing: 4, fontFamily: 'IBM Plex Mono' }}
                autoFocus
              />
            </div>
            <p style={{ fontSize: 12, color: '#64748B', marginBottom: 12, textAlign: 'center' }}>
              {t('login.mfaBackupHint')}
            </p>
            <button type="submit" disabled={loading || mfaCode.length < 6} style={btnStyle}>
              {loading ? '...' : t('login.mfaSubmit')}
            </button>
            <button type="button" onClick={() => { setMfaToken(null); setMfaCode(''); }} style={{ width: '100%', marginTop: 12, background: 'none', border: 'none', color: '#64748B', fontSize: 13, cursor: 'pointer', fontFamily: 'IBM Plex Sans' }}>
              {t('login.mfaBack')}
            </button>
          </form>
        ) : (
        <form onSubmit={handleSubmit} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{t('login.email')}</label>
            <input
              type="email" required value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="you@company.com"
              style={inputStyle}
              spellCheck={false} autoCorrect="off" autoCapitalize="off" autoComplete="email"
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>{t('login.password')}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'} required value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
                style={{ ...inputStyle, paddingRight: 40 }}
                spellCheck={false} autoCorrect="off" autoCapitalize="off" autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', padding: 4, cursor: 'pointer',
                  color: '#64748B', display: 'flex', alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div style={{ textAlign: 'right', marginTop: 8 }}>
              <Link href="/forgot-password" style={{ fontSize: 12.5, color: '#64748B', textDecoration: 'none' }}>Forgot password?</Link>
            </div>
          </div>
          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'Signing in...' : t('login.submit')}
          </button>

          {googleEnabled && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border-strong)' }} />
                <span style={{ fontSize: 12, color: '#64748B', fontFamily: 'IBM Plex Sans' }}>{t('login.orDivider')}</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border-strong)' }} />
              </div>
              <button
                type="button"
                onClick={() => { window.location.href = oauth.googleLoginUrl(); }}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-app)',
                  border: '1px solid var(--border-input)', color: 'var(--text-primary)', fontSize: 14,
                  fontFamily: 'IBM Plex Sans', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33z"/>
                  <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z"/>
                </svg>
                {t('login.googleSignIn')}
              </button>
            </>
          )}
        </form>
        )}

        {!mfaToken && (
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#64748B', fontFamily: 'IBM Plex Sans' }}>
          {t('login.noAccount')}{' '}
          <Link href="/signup" style={{ color: '#FBC02D', textDecoration: 'none', fontWeight: 600 }}>{t('login.signupLink')}</Link>
        </p>
        )}

      </div>
      </div>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: 6, fontSize: 12, fontFamily: 'IBM Plex Mono',
  color: 'var(--text-secondary)', letterSpacing: '0.5px',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: 'var(--bg-app)',
  border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)',
  fontSize: 14, fontFamily: 'IBM Plex Sans', outline: 'none',
  boxSizing: 'border-box',
};
const btnStyle: React.CSSProperties = {
  width: '100%', padding: '12px', borderRadius: 8,
  background: 'linear-gradient(135deg, #FBC02D, #F57F17)',
  color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', fontSize: 15,
  border: 'none', cursor: 'pointer', lineHeight: 1.4, boxSizing: 'border-box',
};
