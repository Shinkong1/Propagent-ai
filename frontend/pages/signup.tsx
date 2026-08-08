import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { Zap, Gift } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth } from '../lib/api';
import { setToken, setUser } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';

export default function Signup() {
  const router = useRouter();
  const { t } = useLanguage();
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '', organization_name: '' });
  const [referralCode, setReferralCode] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  // A referral link looks like https://propagent.app/signup?ref=ABCD1234 --
  // pick that up once the router's query params are available and carry it
  // through to the signup payload, so the referring org actually gets
  // credit (see routes/auth.py's signup(), which already looks up
  // `referral_code` -- this was the missing piece connecting a clicked
  // link to that existing mechanism).
  useEffect(() => {
    if (!router.isReady) return;
    const ref = router.query.ref;
    if (typeof ref === 'string' && ref) {
      setReferralCode(ref.toUpperCase());
    }
  }, [router.isReady, router.query.ref]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      toast.error(t('signup.mustAgree'));
      return;
    }
    setLoading(true);
    try {
      const payload = referralCode ? { ...form, referral_code: referralCode } : form;
      const res = await auth.signup(payload);
      setToken(res.data.access_token);
      setUser(res.data);
      toast.success('Account created! Welcome to PropAgent AI.');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [key]: e.target.value }));

  return (
    <>
      <Head>
        <title>Sign Up — PropAgent AI</title>
        <meta name="description" content="Start your free trial of PropAgent AI — AI-powered property management. No credit card required." />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} color="var(--bg-app)" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 20, color: 'var(--text-primary)' }}>PropAgent AI</span>
          </div>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 24, color: 'var(--text-primary)', marginBottom: 6 }}>{t('signup.title')}</h1>
          <p style={{ color: '#64748B', fontSize: 14 }}>{t('signup.subtitle')}</p>
        </div>

        {referralCode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(251,192,45,0.1)', border: '1px solid rgba(251,192,45,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
            <Gift size={15} color="#FBC02D" />
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Sans' }}>
              Referral code <strong style={{ color: '#FBC02D', fontFamily: 'IBM Plex Mono' }}>{referralCode}</strong> applied
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>{t('signup.firstName')}</label>
              <input type="text" required value={form.first_name} onChange={f('first_name')} placeholder="John" style={inputStyle} spellCheck autoCorrect="on" autoCapitalize="words" />
            </div>
            <div>
              <label style={labelStyle}>{t('signup.lastName')}</label>
              <input type="text" required value={form.last_name} onChange={f('last_name')} placeholder="Smith" style={inputStyle} spellCheck autoCorrect="on" autoCapitalize="words" />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{t('signup.orgName')}</label>
            <input type="text" required value={form.organization_name} onChange={f('organization_name')} placeholder="Smith Property Management" style={inputStyle} spellCheck autoCorrect="on" autoCapitalize="words" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{t('login.email')}</label>
            <input type="email" required value={form.email} onChange={f('email')} placeholder="you@company.com" style={inputStyle} spellCheck={false} autoCorrect="off" autoCapitalize="off" autoComplete="email" />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>{t('login.password')}</label>
            <input type="password" required minLength={8} value={form.password} onChange={f('password')} placeholder="Min 8 characters" style={inputStyle} spellCheck={false} autoCorrect="off" autoCapitalize="off" autoComplete="new-password" />
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 18, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              style={{ marginTop: 2, flexShrink: 0, accentColor: '#FBC02D' }}
            />
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {t('signup.agreePrefix')}{' '}
              <Link href="/terms" target="_blank" style={{ color: '#FBC02D', textDecoration: 'none' }}>{t('signup.termsLink')}</Link>
              {' '}{t('signup.agreeAnd')}{' '}
              <Link href="/privacy" target="_blank" style={{ color: '#FBC02D', textDecoration: 'none' }}>{t('signup.privacyLink')}</Link>
            </span>
          </label>

          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'Creating account...' : t('landing.startTrial')}
          </button>
          <p style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: '#475569', fontFamily: 'IBM Plex Mono' }}>
            {t('landing.noCard')}
          </p>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#64748B' }}>
          {t('signup.haveAccount')}{' '}
          <Link href="/login" style={{ color: '#FBC02D', textDecoration: 'none', fontWeight: 600 }}>{t('signup.loginLink')}</Link>
        </p>
      </div>
      </div>
    </>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 5, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 14, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' };
const btnStyle: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: 8, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', fontSize: 15, border: 'none', cursor: 'pointer' };
